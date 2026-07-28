package org.lifebridge.community;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.lifebridge.community.CommunityModels.Authorization;
import org.lifebridge.community.CommunityModels.Disclosure;
import org.lifebridge.community.CommunityModels.Location;
import org.lifebridge.community.CommunityModels.Submission;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.NONE,
    properties = {
      "community.retention-sweep-ms=3600000",
      "community.retention-sweep-initial-delay-ms=3600000"
    })
@EnabledIfEnvironmentVariable(named = "P5_S1_COMMUNITY_INTEGRATION", matches = "1")
class CommunityServiceIntegrationTest {
  private static final String CORRELATION_ID = "corr_integration_0001";
  private static final String HOUSEHOLD_ID = "household_integration_0001";
  private static final String RECIPIENT_ID = "recipient_integration_0001";
  private static final String ACTOR_ID = "account_integration_0001";
  private final AtomicInteger decisions = new AtomicInteger();

  @Autowired private CommunityService service;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private ObjectMapper mapper;

  @BeforeEach
  void clearOwnedData() {
    jdbc.update("DELETE FROM community_idempotency");
    jdbc.update("DELETE FROM community_outbox");
    jdbc.update("DELETE FROM community_audit");
    jdbc.update("DELETE FROM community_request_tombstones");
    jdbc.update("DELETE FROM community_help_requests");
    jdbc.update("DELETE FROM community_directory_listings");
  }

  @Test
  void provesSubmissionReplayConflictCloseDeleteAndContentFreeEvidence() {
    Submission submission = submission("submission_integration_0001", "morning");
    String submitPath = "/internal/v1/community/help-requests";
    Authorization submitAuthorization =
        authorization(
            "community.help_request.submit",
            "POST",
            submitPath,
            submission,
            null,
            Instant.now());

    var created =
        service.submit(
            submitAuthorization,
            submission,
            "idem_integration_submit_0001",
            CORRELATION_ID,
            submitPath);
    assertThat(created.status()).isEqualTo(HttpStatus.CREATED);
    assertThat(data(created).get("outcome")).isEqualTo("submitted");
    assertThat(data(created).get("duplicate")).isEqualTo(false);

    var replayed =
        service.submit(
            submitAuthorization,
            submission,
            "idem_integration_submit_0001",
            CORRELATION_ID,
            submitPath);
    assertThat(replayed.status()).isEqualTo(HttpStatus.CREATED);
    assertThat(replayed.body()).isEqualTo(created.body());
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_help_requests", Integer.class))
        .isEqualTo(1);

    String requestId = request(created).get("requestId").toString();
    Authorization stale =
        authorization(
            "community.help_request.list",
            "POST",
            "/internal/v1/community/help-requests/query",
            Map.of(),
            null,
            Instant.now().minusSeconds(11));
    assertThatThrownBy(
            () ->
                service.list(
                    stale,
                    CORRELATION_ID,
                    "/internal/v1/community/help-requests/query"))
        .isInstanceOf(CommunityFailure.class)
        .hasMessageContaining("COMMUNITY_RESOURCE_NOT_FOUND");

    String wrongClosePath =
        "/internal/v1/community/help-requests/" + requestId + "/close";
    Authorization wrongClose =
        authorization(
            "community.help_request.close",
            "POST",
            wrongClosePath,
            Map.of("expectedVersion", 9),
            requestId,
            Instant.now());
    assertThatThrownBy(
            () ->
                service.close(
                    wrongClose,
                    9,
                    "idem_integration_close_bad",
                    CORRELATION_ID,
                    wrongClosePath,
                    requestId))
        .isInstanceOf(CommunityFailure.class)
        .hasMessageContaining("COMMUNITY_REQUEST_VERSION_CONFLICT");

    Authorization close =
        authorization(
            "community.help_request.close",
            "POST",
            wrongClosePath,
            Map.of("expectedVersion", 1),
            requestId,
            Instant.now());
    var closed =
        service.close(
            close,
            1,
            "idem_integration_close_0001",
            CORRELATION_ID,
            wrongClosePath,
            requestId);
    assertThat(request(closed).get("status")).isEqualTo("closed");
    assertThat(request(closed).get("version")).isEqualTo(2);

    String deletePath = "/internal/v1/community/help-requests/" + requestId;
    Authorization delete =
        authorization(
            "community.help_request.delete",
            "DELETE",
            deletePath,
            Map.of("expectedVersion", 2),
            requestId,
            Instant.now());
    var deleted =
        service.delete(
            delete,
            2,
            "idem_integration_delete_0001",
            CORRELATION_ID,
            deletePath,
            requestId);
    assertThat(data(deleted).get("outcome")).isEqualTo("deleted");
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_help_requests", Integer.class))
        .isZero();
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM community_request_tombstones", Integer.class))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_audit", Integer.class))
        .isEqualTo(3);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_outbox", Integer.class))
        .isEqualTo(3);
    assertThat(
            jdbc.queryForList(
                "SELECT aggregate_version FROM community_outbox ORDER BY aggregate_version",
                Integer.class))
        .containsExactly(1, 2, 3);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_idempotency", Integer.class))
        .isEqualTo(1);
    assertThat(
            jdbc.queryForObject(
                "SELECT response_json::text FROM community_idempotency", String.class))
        .doesNotContain(
            "daily_living_support", "SYN-PC-001", "submission_integration_0001");

    assertThatThrownBy(
            () ->
                service.submit(
                    authorization(
                        "community.help_request.submit",
                        "POST",
                        submitPath,
                        submission,
                        null,
                        Instant.now()),
                    submission,
                    "idem_integration_submit_0001",
                    CORRELATION_ID,
                    submitPath))
        .isInstanceOf(CommunityFailure.class)
        .hasMessageContaining("COMMUNITY_REQUEST_DUPLICATE");
    assertThatThrownBy(
            () ->
                service.close(
                    authorization(
                        "community.help_request.close",
                        "POST",
                        wrongClosePath,
                        Map.of("expectedVersion", 1),
                        requestId,
                        Instant.now()),
                    1,
                    "idem_integration_close_0001",
                    CORRELATION_ID,
                    wrongClosePath,
                    requestId))
        .isInstanceOf(CommunityFailure.class)
        .hasMessageContaining("COMMUNITY_RESOURCE_NOT_FOUND");
    var deleteReplay =
        service.delete(
            authorization(
                "community.help_request.delete",
                "DELETE",
                deletePath,
                Map.of("expectedVersion", 2),
                requestId,
                Instant.now()),
            2,
            "idem_integration_delete_0001",
            CORRELATION_ID,
            deletePath,
            requestId);
    assertThat(deleteReplay.body()).isEqualTo(deleted.body());
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_audit", Integer.class))
        .isEqualTo(3);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_outbox", Integer.class))
        .isEqualTo(3);
    List<String> payloads =
        jdbc.queryForList("SELECT payload::text FROM community_outbox", String.class);
    assertThat(payloads)
        .allSatisfy(
            payload ->
                assertThat(payload)
                    .doesNotContain(
                        "daily_living_support",
                        "SYN-PC-001",
                        "submission_integration_0001",
                        ACTOR_ID,
                        HOUSEHOLD_ID,
                        RECIPIENT_ID));
  }

  @Test
  void serializesConcurrentFirstUseOfTheSameIdempotencyKey() throws Exception {
    Submission submission = submission("submission_same_key_0001", "flexible");
    String path = "/internal/v1/community/help-requests";
    var start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      List<Future<CommunityService.ServiceResult>> futures = new ArrayList<>();
      for (int index = 0; index < 2; index++) {
        futures.add(
            executor.submit(
                () -> {
                  Authorization authorization =
                      authorization(
                          "community.help_request.submit",
                          "POST",
                          path,
                          submission,
                          null,
                          Instant.now());
                  start.await();
                  return service.submit(
                      authorization,
                      submission,
                      "idem_same_key_community_0001",
                      CORRELATION_ID,
                      path);
                }));
      }
      start.countDown();
      List<CommunityService.ServiceResult> results =
          futures.stream()
              .map(
                  future -> {
                    try {
                      return future.get();
                    } catch (Exception exception) {
                      throw new AssertionError(exception);
                    }
                  })
              .toList();
      assertThat(results).extracting(CommunityService.ServiceResult::status)
          .containsOnly(HttpStatus.CREATED);
      assertThat(results.get(1).body()).isEqualTo(results.getFirst().body());
    }
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_help_requests", Integer.class))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_idempotency", Integer.class))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_audit", Integer.class))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_outbox", Integer.class))
        .isEqualTo(1);
  }

  @Test
  void serializesConcurrentDuplicateTupleSubmissionsToOneAuthoritativeRequest()
      throws Exception {
    List<Submission> submissions =
        List.of(
            submission("submission_concurrent_0001", "afternoon"),
            submission("submission_concurrent_0002", "afternoon"));
    var start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      List<Future<CommunityService.ServiceResult>> futures = new ArrayList<>();
      for (int index = 0; index < submissions.size(); index++) {
        int item = index;
        futures.add(
            executor.submit(
                () -> {
                  Submission submission = submissions.get(item);
                  Authorization authorization =
                      authorization(
                          "community.help_request.submit",
                          "POST",
                          "/internal/v1/community/help-requests",
                          submission,
                          null,
                          Instant.now());
                  start.await();
                  return service.submit(
                      authorization,
                      submission,
                      "idem_concurrent_000" + (item + 1),
                      CORRELATION_ID,
                      "/internal/v1/community/help-requests");
                }));
      }
      start.countDown();
      List<CommunityService.ServiceResult> results =
          futures.stream()
              .map(
                  future -> {
                    try {
                      return future.get();
                    } catch (Exception exception) {
                      throw new AssertionError(exception);
                    }
                  })
              .toList();
      assertThat(results).extracting(CommunityService.ServiceResult::status)
          .containsExactlyInAnyOrder(HttpStatus.CREATED, HttpStatus.OK);
      assertThat(results)
          .extracting(result -> data(result).get("duplicate"))
          .containsExactlyInAnyOrder(false, true);
    }
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_help_requests", Integer.class))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_audit", Integer.class))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_outbox", Integer.class))
        .isEqualTo(1);
  }

  @Test
  void returnsReviewedDirectoryDataWithExplicitStaleAndNoMatchingClaims() {
    jdbc.update(
        """
        INSERT INTO community_directory_listings(
          listing_id,public_name,organization_type,province_city_code,
          province_city_label,categories,contact_type,contact_label,contact_value,
          accessibility_contact_note,source_label,source_url,last_reviewed_at,
          next_review_at,reviewed
        ) VALUES (
          'listing_integration_0001','Synthetic directory desk','community_group',
          'SYN-PC-001','Synthetic Province/City 001',
          ARRAY['daily_living_support']::TEXT[],'website','Synthetic public page',
          'https://example.invalid/community',NULL,'Synthetic reviewed source',
          'https://example.invalid/source',CURRENT_TIMESTAMP - INTERVAL '30 days',
          CURRENT_TIMESTAMP - INTERVAL '1 day',TRUE
        )
        """);
    Map<String, Object> result =
        service.directory(
            Map.of(
                "category", "daily_living_support",
                "provinceCityCode", "SYN-PC-001"),
            CORRELATION_ID);
    Map<String, Object> data = cast(result.get("data"));
    assertThat(data.get("matchingState")).isEqualTo("unavailable_in_p5_s1");
    assertThat(data.get("resultMeaning"))
        .isEqualTo("informational_not_eligibility_availability_or_endorsement");
    List<Map<String, Object>> items = cast(data.get("items"));
    assertThat(items).singleElement()
        .satisfies(
            item -> {
              assertThat(item.get("availabilityState")).isEqualTo("not_verified");
              assertThat(item.get("eligibilityState")).isEqualTo("not_determined");
              assertThat(item.get("endorsementState")).isEqualTo("none");
              Map<String, Object> provenance = cast(item.get("provenance"));
              assertThat(provenance.get("state")).isEqualTo("stale");
            });
  }

  @Test
  void scheduledRetentionClosesAndPurgesWithoutTrafficUsingMonotonicVersions()
      throws Exception {
    assertThat(
            CommunityService.class
                .getMethod("sweepRetention")
                .getAnnotation(Scheduled.class))
        .isNotNull();

    String path = "/internal/v1/community/help-requests";
    Submission pendingSubmission = submission("submission_retention_pending", "morning");
    var pending =
        service.submit(
            authorization(
                "community.help_request.submit",
                "POST",
                path,
                pendingSubmission,
                null,
                Instant.now()),
            pendingSubmission,
            "idem_retention_pending_0001",
            CORRELATION_ID,
            path);
    String pendingId = request(pending).get("requestId").toString();

    Submission purgeSubmission = submission("submission_retention_purge", "evening");
    var purgePending =
        service.submit(
            authorization(
                "community.help_request.submit",
                "POST",
                path,
                purgeSubmission,
                null,
                Instant.now()),
            purgeSubmission,
            "idem_retention_purge_submit",
            CORRELATION_ID,
            path);
    String purgeId = request(purgePending).get("requestId").toString();
    String closePath = "/internal/v1/community/help-requests/" + purgeId + "/close";
    service.close(
        authorization(
            "community.help_request.close",
            "POST",
            closePath,
            Map.of("expectedVersion", 1),
            purgeId,
            Instant.now()),
        1,
        "idem_retention_purge_close",
        CORRELATION_ID,
        closePath,
        purgeId);

    jdbc.update(
        "UPDATE community_help_requests SET pending_auto_close_at=CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE request_id=?",
        pendingId);
    jdbc.update(
        "UPDATE community_help_requests SET purge_after=CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE request_id=?",
        purgeId);
    service.sweepRetention();

    assertThat(
            jdbc.queryForMap(
                "SELECT status,version FROM community_help_requests WHERE request_id=?",
                pendingId))
        .containsEntry("status", "closed")
        .containsEntry("version", 2);
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM community_help_requests WHERE request_id=?",
                Integer.class,
                purgeId))
        .isZero();
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM community_idempotency WHERE aggregate_ref_digest=?",
                Integer.class,
                CommunityDigest.sha256(purgeId)))
        .isZero();
    assertThat(
            jdbc.queryForList(
                "SELECT aggregate_version FROM community_outbox WHERE aggregate_id=? ORDER BY aggregate_version",
                Integer.class,
                pendingId))
        .containsExactly(1, 2);
    assertThat(
            jdbc.queryForList(
                "SELECT aggregate_version FROM community_outbox WHERE aggregate_id=? ORDER BY aggregate_version",
                Integer.class,
                purgeId))
        .containsExactly(1, 2, 3);
  }

  private Submission submission(String reference, String dayPart) {
    return new Submission(
        reference,
        "daily_living_support",
        new Location("province_city", "SYN-PC-001"),
        dayPart,
        new Disclosure(
            "community_support",
            "current_request_collaborators",
            "P5-S1-v1",
            true));
  }

  private Authorization authorization(
      String permission,
      String method,
      String path,
      Object body,
      String requestId,
      Instant decidedAt) {
    return new Authorization(
        "decision_integration_" + decisions.incrementAndGet(),
        "community_support",
        permission,
        ACTOR_ID,
        HOUSEHOLD_ID,
        RECIPIENT_ID,
        1,
        null,
        null,
        null,
        requestId,
        decidedAt,
        CORRELATION_ID,
        CommunityDigest.requestDigest(mapper, method, path, body));
  }

  private Map<String, Object> data(CommunityService.ServiceResult result) {
    return cast(result.body().get("data"));
  }

  private Map<String, Object> request(CommunityService.ServiceResult result) {
    return cast(data(result).get("request"));
  }

  @SuppressWarnings("unchecked")
  private <T> T cast(Object value) {
    return (T) value;
  }
}
