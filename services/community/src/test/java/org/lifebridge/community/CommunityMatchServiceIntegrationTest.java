package org.lifebridge.community;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@EnabledIfEnvironmentVariable(named = "P5_S2_COMMUNITY_INTEGRATION", matches = "1")
class CommunityMatchServiceIntegrationTest {
  private static final String MATCH_ID = "match_integration_0001";
  private static final String ORG_ID = "organization_integration_0001";
  private static final String COORDINATOR = "coordinator_integration_0001";
  private static final String VOLUNTEER = "volunteer_integration_0001";
  private static final String CORRELATION = "corr_match_integration_0001";
  private final AtomicInteger decisions = new AtomicInteger();

  @Autowired CommunityMatchService service;
  @Autowired JdbcTemplate jdbc;
  @Autowired ObjectMapper mapper;

  @BeforeEach
  void seedMinimumOwnedState() {
    jdbc.update("DELETE FROM community_match_idempotency");
    jdbc.update("DELETE FROM community_match_progress");
    jdbc.update("DELETE FROM community_capacity_reservations");
    jdbc.update("DELETE FROM community_match_offers");
    jdbc.update("DELETE FROM community_matches");
    jdbc.update("DELETE FROM community_organization_enrollments");
    jdbc.update("DELETE FROM community_organizations");
    jdbc.update("DELETE FROM community_outbox");
    jdbc.update("DELETE FROM community_audit");
    jdbc.update("DELETE FROM community_help_requests");
    Instant now = Instant.now();
    jdbc.update("INSERT INTO community_help_requests(request_id,submission_reference,actor_ref_digest,household_id,recipient_context_id,category,location_granularity,province_city_code,day_part,visibility,status,version,confirmed_at,pending_auto_close_at) VALUES (?,?,?,?,?,'daily_living_support','province_city','SYN-PC-001','morning','current_request_collaborators','pending',1,?,?)",
        "request_match_integration_0001", "submission_match_integration_0001",
        CommunityDigest.sha256("subject_actor_integration"), "household_match_integration",
        "recipient_match_integration", Timestamp.from(now), Timestamp.from(now.plus(30, ChronoUnit.DAYS)));
    jdbc.update("INSERT INTO community_organizations(organization_id,status,version) VALUES (?,'active',1)", ORG_ID);
    jdbc.update("INSERT INTO community_organization_enrollments(enrollment_id,organization_id,actor_ref_digest,role,status,version,expires_at) VALUES (?,?,?,'coordinator','active',1,?)",
        "enrollment_coordinator_0001", ORG_ID, CommunityDigest.sha256(COORDINATOR), Timestamp.from(now.plus(30, ChronoUnit.DAYS)));
    jdbc.update("INSERT INTO community_organization_enrollments(enrollment_id,organization_id,actor_ref_digest,role,status,version,expires_at) VALUES (?,?,?,'volunteer','active',1,?)",
        "enrollment_volunteer_0001", ORG_ID, CommunityDigest.sha256(VOLUNTEER), Timestamp.from(now.plus(30, ChronoUnit.DAYS)));
    jdbc.update("INSERT INTO community_matches(match_id,request_id,organization_id,recipient_context_digest,state,version,confirmed_at) VALUES (?,?,?,?,'pending_approval',1,?)",
        MATCH_ID, "request_match_integration_0001", ORG_ID,
        CommunityDigest.sha256("recipient_match_integration"), Timestamp.from(now));
  }

  @Test
  void commitsApprovedOfferAcceptAssignProgressCloseWithAtomicEvidence() {
    var approved = mutate("approval", "community_match.coordinator.manage", COORDINATOR,
        Map.of("decision", "approved", "expiresAt", Instant.now().plus(10, ChronoUnit.DAYS).toString()), 1, "idem_match_approval_0001");
    assertState(approved, "approved", 2);
    var offered = mutate("offers", "community_match.coordinator.manage", COORDINATOR,
        Map.of("volunteerEnrollmentId", "enrollment_volunteer_0001", "capacitySlot",
            Map.of("serviceDate", "2026-08-01", "dayPart", "morning"),
            "expiresAt", Instant.now().plus(2, ChronoUnit.DAYS).toString()), 2, "idem_match_offer_0001");
    assertState(offered, "offered", 3);
    String offerId = jdbc.queryForObject("SELECT offer_id FROM community_match_offers WHERE match_id=?", String.class, MATCH_ID);
    var accepted = respond(offerId, 3);
    assertState(accepted, "accepted", 4);
    var assigned = mutate("assignment", "community_match.coordinator.manage", COORDINATOR,
        Map.of("offerId", offerId, "mode", "assign"), 4, "idem_match_assign_0001");
    assertState(assigned, "assigned", 5);
    var progressed = mutate("progress", "community_match.progress.record", VOLUNTEER,
        Map.of("checkpoint", "support_started"), 5, "idem_match_progress_0001");
    assertState(progressed, "in_progress", 6);
    var closed = mutate("close", "community_match.coordinator.manage", COORDINATOR,
        Map.of("reason", "support_completed"), 6, "idem_match_close_0001");
    assertState(closed, "closed", 7);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_match_progress", Integer.class)).isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_audit WHERE action LIKE 'match.%'", Integer.class)).isEqualTo(6);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM community_outbox WHERE event_type LIKE 'community.match.%'", Integer.class)).isEqualTo(6);
    assertThat(jdbc.queryForObject("SELECT state FROM community_capacity_reservations", String.class)).isEqualTo("released");
  }

  @Test
  void serializesConcurrentAcceptAndRevocationReleasesCapacity() throws Exception {
    mutate("approval", "community_match.coordinator.manage", COORDINATOR,
        Map.of("decision", "approved", "expiresAt", Instant.now().plus(10, ChronoUnit.DAYS).toString()), 1, "idem_match_concurrent_approval");
    mutate("offers", "community_match.coordinator.manage", COORDINATOR,
        Map.of("volunteerEnrollmentId", "enrollment_volunteer_0001", "capacitySlot",
            Map.of("serviceDate", "2026-08-02", "dayPart", "afternoon"),
            "expiresAt", Instant.now().plus(2, ChronoUnit.DAYS).toString()), 2, "idem_match_concurrent_offer");
    String offerId = jdbc.queryForObject("SELECT offer_id FROM community_match_offers WHERE match_id=?", String.class, MATCH_ID);
    CountDownLatch start = new CountDownLatch(1);
    AtomicInteger committed = new AtomicInteger();
    try (var executor = Executors.newFixedThreadPool(2)) {
      var first = executor.submit(() -> { start.await(); try { respond(offerId, 3, "idem_match_accept_first"); committed.incrementAndGet(); } catch (RuntimeException ignored) {} return null; });
      var second = executor.submit(() -> { start.await(); try { respond(offerId, 3, "idem_match_accept_second"); committed.incrementAndGet(); } catch (RuntimeException ignored) {} return null; });
      start.countDown(); first.get(); second.get();
    }
    assertThat(committed.get()).isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT state FROM community_matches WHERE match_id=?", String.class, MATCH_ID)).isEqualTo("accepted");
    mutate("revoke", "community_match.coordinator.manage", COORDINATOR,
        Map.of("reason", "consent_revoked"), 4, "idem_match_revoke_0001");
    assertThat(jdbc.queryForObject("SELECT state FROM community_capacity_reservations", String.class)).isEqualTo("released");
    assertThat(jdbc.queryForObject("SELECT state FROM community_matches WHERE match_id=?", String.class, MATCH_ID)).isEqualTo("revoked");
  }

  private CommunityMatchService.Result mutate(String action, String permission, String actor,
      Map<String, Object> fields, int expectedVersion, String idempotencyKey) {
    String path = "/internal/v1/community/matches/" + MATCH_ID + "/" + action;
    Map<String, Object> intent = new LinkedHashMap<>();
    intent.put("operation", action.equals("offers") ? "offer" : action);
    intent.put("organizationId", ORG_ID);
    intent.put("submissionReference", "submission_" + idempotencyKey);
    intent.put("expectedVersion", expectedVersion);
    intent.putAll(fields);
    Map<String, Object> body = new LinkedHashMap<>(intent);
    body.put("authorization", authorization(permission, actor, path, intent));
    return service.mutate(MATCH_ID, action, body, idempotencyKey, CORRELATION);
  }

  private CommunityMatchService.Result respond(String offerId, int expectedVersion) {
    return respond(offerId, expectedVersion, "idem_match_accept_0001");
  }

  private CommunityMatchService.Result respond(String offerId, int expectedVersion, String idempotencyKey) {
    String path = "/internal/v1/community/matches/" + MATCH_ID + "/offers/" + offerId + "/response";
    Map<String, Object> intent = new LinkedHashMap<>();
    intent.put("operation", "offer_response");
    intent.put("organizationId", ORG_ID);
    intent.put("submissionReference", "submission_match_accept_0001");
    intent.put("expectedVersion", expectedVersion);
    intent.put("offerId", offerId);
    intent.put("expectedOfferVersion", 1);
    intent.put("response", "accepted");
    Map<String, Object> body = new LinkedHashMap<>(intent);
    body.put("authorization", authorization("community_match.volunteer.respond", VOLUNTEER, path, intent));
    return service.respondOffer(MATCH_ID, offerId, body, idempotencyKey, CORRELATION);
  }

  private Map<String, Object> authorization(String permission, String actor, String path, Map<String, Object> intent) {
    Instant now = Instant.now();
    return Map.ofEntries(
        Map.entry("decisionId", "decision_match_" + decisions.incrementAndGet()),
        Map.entry("purpose", "community_match_coordination"), Map.entry("permission", permission),
        Map.entry("actorRef", actor), Map.entry("recipientContextId", "recipient_match_integration"),
        Map.entry("subjectVersion", 1), Map.entry("grantId", "grant_match_integration"),
        Map.entry("grantVersion", 1), Map.entry("privacyVersion", 1),
        Map.entry("decidedAt", now.toString()), Map.entry("expiresAt", now.plusSeconds(10).toString()),
        Map.entry("correlationId", CORRELATION),
        Map.entry("requestDigest", CommunityDigest.requestDigest(mapper, "POST", path, intent)));
  }

  @SuppressWarnings("unchecked")
  private void assertState(CommunityMatchService.Result result, String state, int version) {
    var matches = (java.util.List<Map<String, Object>>) result.body().get("matches");
    assertThat(matches.getFirst()).containsEntry("state", state).containsEntry("version", version);
  }
}
