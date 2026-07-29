package org.lifebridge.community;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@EnabledIfEnvironmentVariable(named = "P5_S3_COMMUNITY_INTEGRATION", matches = "1")
class CommunityModerationServiceIntegrationTest {
  private static final String CASE = "case_moderation_integration_0001";
  private static final String ACTOR = "moderator_integration_0001";
  private static final String CORRELATION = "corr_moderation_integration_0001";
  private final AtomicInteger decisions = new AtomicInteger();
  @Autowired CommunityModerationService service;
  @Autowired JdbcTemplate jdbc;
  @Autowired ObjectMapper mapper;

  @BeforeEach
  void seed() {
    jdbc.update("DELETE FROM community_moderation_idempotency");
    jdbc.update("DELETE FROM community_moderation_resolutions");
    jdbc.update("DELETE FROM community_moderation_cases");
    jdbc.update("DELETE FROM community_moderator_enrollments");
    jdbc.update("DELETE FROM community_outbox WHERE event_type='community.moderation.resolved.v1'");
    jdbc.update("DELETE FROM community_audit WHERE action LIKE 'moderation.%'");
    Instant now = Instant.now();
    jdbc.update("INSERT INTO community_moderator_enrollments(enrollment_id,actor_ref_digest,status,expires_at,version) VALUES (?,?, 'active',?,1)",
        "moderator_enrollment_0001", CommunityDigest.sha256(ACTOR), Timestamp.from(now.plus(1, ChronoUnit.DAYS)));
    insertCase(CASE);
  }

  @Test
  void auditsQueueAndDetailAndAtomicallyResolvesWithStableReplay() {
    assertThat(service.queue(command("community_moderation.queue.read", "/internal/v1/community/moderation/query", Map.of("operation", "query")), CORRELATION).body().get("cases")).isNotNull();
    assertThat(service.detail(CASE, command("community_moderation.case.read", "/internal/v1/community/moderation/" + CASE + "/query", Map.of("operation", "detail")), CORRELATION).body()).containsKey("case");
    var first = service.resolve(CASE, resolveBody(CASE, 1, "no_change", "insufficient_authoritative_evidence", "submission_mod_1"), "idem_mod_0001", CORRELATION);
    var replay = service.resolve(CASE, resolveBody(CASE, 1, "no_change", "insufficient_authoritative_evidence", "submission_mod_1"), "idem_mod_0001", CORRELATION);
    assertThat(replay.body()).isEqualTo(first.body()).containsEntry("state", "resolved").containsEntry("version", 2);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM community_moderation_resolutions", Integer.class)).isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM community_audit WHERE action='moderation.resolved'", Integer.class)).isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM community_outbox WHERE event_type='community.moderation.resolved.v1'", Integer.class)).isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM community_audit WHERE action IN ('moderation.queue_read','moderation.case_read')", Integer.class)).isEqualTo(2);
  }

  @Test
  void rejectsChangedReplayStaleVersionAndInvalidOutcomeReasonPair() {
    service.resolve(CASE, resolveBody(CASE, 1, "no_change", "duplicate_report", "submission_mod_2"), "idem_mod_0002", CORRELATION);
    assertThatThrownBy(() -> service.resolve(CASE, resolveBody(CASE, 1, "no_change", "outside_moderation_scope", "submission_mod_2"), "idem_mod_0002", CORRELATION))
        .isInstanceOf(CommunityFailure.class).hasMessage("COMMUNITY_MODERATION_IDEMPOTENCY_CONFLICT");
    insertCase("case_moderation_integration_0002");
    assertThatThrownBy(() -> service.resolve("case_moderation_integration_0002", resolveBody("case_moderation_integration_0002", 2, "no_change", "duplicate_report", "submission_mod_3"), "idem_mod_0003", CORRELATION))
        .isInstanceOf(CommunityFailure.class).hasMessage("COMMUNITY_MODERATION_VERSION_CONFLICT");
    assertThatThrownBy(() -> service.resolve("case_moderation_integration_0002", resolveBody("case_moderation_integration_0002", 1, "no_change", "policy_privacy_boundary", "submission_mod_4"), "idem_mod_0004", CORRELATION))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void serializesConcurrentDifferentDecisions() throws Exception {
    CountDownLatch start = new CountDownLatch(1); AtomicInteger committed = new AtomicInteger();
    try (var executor = Executors.newFixedThreadPool(2)) {
      var one = executor.submit(() -> { start.await(); try { service.resolve(CASE, resolveBody(CASE, 1, "no_change", "duplicate_report", "submission_concurrent_1"), "idem_concurrent_1", CORRELATION); committed.incrementAndGet(); } catch (RuntimeException ignored) {} return null; });
      var two = executor.submit(() -> { start.await(); try { service.resolve(CASE, resolveBody(CASE, 1, "content_visibility_restricted", "policy_content_boundary", "submission_concurrent_2"), "idem_concurrent_2", CORRELATION); committed.incrementAndGet(); } catch (RuntimeException ignored) {} return null; });
      start.countDown(); one.get(); two.get();
    }
    assertThat(committed.get()).isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM community_moderation_resolutions WHERE case_id=?", Integer.class, CASE)).isEqualTo(1);
  }

  private void insertCase(String id) { Instant now=Instant.now(); jdbc.update("INSERT INTO community_moderation_cases(case_id,report_ref_digest,state,evidence_category,provenance,redaction_state,policy_version,version,reported_at,expires_at) VALUES (?,?,'open','privacy_boundary','community_report','minimum_redacted','P5-S3-v1',1,?,?)", id, CommunityDigest.sha256("report_"+id), Timestamp.from(now), Timestamp.from(now.plus(1, ChronoUnit.DAYS))); }
  private Map<String,Object> resolveBody(String id,int version,String outcome,String reason,String submission) { return command("community_moderation.resolve", "/internal/v1/community/moderation/"+id+"/resolve", Map.of("operation","resolve","expectedVersion",version,"outcome",outcome,"reason",reason,"submissionReference",submission)); }
  private Map<String,Object> command(String permission,String path,Map<String,Object> intent) { Map<String,Object> body=new LinkedHashMap<>(intent); Instant now=Instant.now(); body.put("authorization", Map.of("decisionId","decision_mod_"+decisions.incrementAndGet(),"purpose","community_moderation_resolution","permission",permission,"actorRef",ACTOR,"decidedAt",now.toString(),"expiresAt",now.plusSeconds(10).toString(),"requestDigest",CommunityDigest.requestDigest(mapper,"POST",path,intent))); return body; }
}
