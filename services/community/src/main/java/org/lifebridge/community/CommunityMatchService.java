package org.lifebridge.community;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Service
public class CommunityMatchService {
  private static final Set<String> ACTIONS =
      Set.of("approval", "offers", "assignment", "progress", "close", "revoke");
  private final JdbcTemplate jdbc;
  private final ObjectMapper mapper;

  public CommunityMatchService(JdbcTemplate jdbc, ObjectMapper mapper) {
    this.jdbc = jdbc;
    this.mapper = mapper;
  }

  @Transactional(readOnly = true)
  public Result query(Map<String, Object> body, String role, String correlationId) {
    String permission =
        role.equals("volunteer")
            ? "community_match.volunteer.read"
            : "community_match.coordinator.read";
    Auth auth = authorize(
        body,
        permission,
        role.equals("volunteer")
            ? "/internal/v1/community/matches/volunteer/query"
            : "/internal/v1/community/matches/organization/query");
    String organizationId = text(body, "organizationId");
    requireEnrollment(auth.actorRef(), organizationId, role);
    List<Map<String, Object>> items =
        jdbc.query(
            """
            SELECT m.*, r.category, r.province_city_code, r.day_part,
              (SELECT o.offer_id FROM community_match_offers o WHERE o.match_id=m.match_id
               AND o.state IN ('offered','accepted') ORDER BY o.expires_at DESC LIMIT 1) current_offer_id
            FROM community_matches m
            JOIN community_help_requests r ON r.request_id=m.request_id
            WHERE m.organization_id=?
              AND (? <> 'volunteer' OR EXISTS (
                SELECT 1 FROM community_match_offers o
                JOIN community_organization_enrollments e
                  ON e.enrollment_id=o.volunteer_enrollment_id
                WHERE o.match_id=m.match_id AND e.actor_ref_digest=?
              ))
            ORDER BY m.confirmed_at, m.match_id LIMIT 25
            """,
            (row, ignored) -> projection(row, role),
            organizationId,
            role,
            CommunityDigest.sha256(auth.actorRef()));
    return ok(matchResult(items), correlationId);
  }

  @Transactional(readOnly = true)
  public Result detail(String matchId, Map<String, Object> body, String correlationId) {
    Auth auth = authorizeRead(body, "/internal/v1/community/matches/" + matchId + "/query");
    String organizationId = text(body, "organizationId");
    String role = requireAnyEnrollment(auth.actorRef(), organizationId);
    List<Map<String, Object>> rows =
        jdbc.query(
            """
            SELECT m.*, r.category, r.province_city_code, r.day_part,
              (SELECT o.offer_id FROM community_match_offers o WHERE o.match_id=m.match_id
               AND o.state IN ('offered','accepted') ORDER BY o.expires_at DESC LIMIT 1) current_offer_id
            FROM community_matches m
            JOIN community_help_requests r ON r.request_id=m.request_id
            WHERE m.match_id=? AND m.organization_id=?
            """,
            (row, ignored) -> projection(row, role),
            matchId,
            organizationId);
    if (rows.isEmpty()) throw failure(HttpStatus.NOT_FOUND, "COMMUNITY_MATCH_NOT_FOUND");
    return ok(matchResult(rows), correlationId);
  }

  @Transactional
  public Result mutate(
      String matchId,
      String action,
      Map<String, Object> body,
      String idempotencyKey,
      String correlationId) {
    if (!ACTIONS.contains(action)) throw new IllegalArgumentException("MATCH_ACTION_INVALID");
    String permission =
        action.equals("progress")
            ? "community_match.progress.record"
            : "community_match.coordinator.manage";
    Auth auth = authorize(
        body, permission, "/internal/v1/community/matches/" + matchId + "/" + action);
    String organizationId = text(body, "organizationId");
    String role =
        action.equals("progress")
            ? requireAnyEnrollment(auth.actorRef(), organizationId)
            : requireEnrollment(auth.actorRef(), organizationId, "coordinator");
    validateKey(idempotencyKey);
    Map<String, Object> replay = replay(auth, action, idempotencyKey, body);
    if (replay != null) return ok(replay, correlationId);
    Match match = lockMatch(matchId, organizationId);
    int expectedVersion = integer(body, "expectedVersion");
    if (match.version() != expectedVersion) {
      throw failure(HttpStatus.CONFLICT, "COMMUNITY_MATCH_VERSION_CONFLICT");
    }

    Mutation mutation =
        switch (action) {
          case "approval" -> approve(match, body);
          case "offers" -> offer(match, body);
          case "assignment" -> assign(match, body);
          case "progress" -> progress(match, body, role);
          case "close" -> close(match, body);
          case "revoke" -> revoke(match, body);
          default -> throw new IllegalArgumentException("MATCH_ACTION_INVALID");
        };
    writeEvidence(matchId, mutation, auth, correlationId);
    Map<String, Object> result = matchResult(loadProjection(matchId, role));
    storeReplay(auth, action, idempotencyKey, body, matchId, result);
    return ok(result, correlationId);
  }

  @Transactional
  public Result respondOffer(
      String matchId,
      String offerId,
      Map<String, Object> body,
      String idempotencyKey,
      String correlationId) {
    Auth auth = authorize(
        body,
        "community_match.volunteer.respond",
        "/internal/v1/community/matches/" + matchId + "/offers/" + offerId + "/response");
    String organizationId = text(body, "organizationId");
    requireEnrollment(auth.actorRef(), organizationId, "volunteer");
    validateKey(idempotencyKey);
    Map<String, Object> replay = replay(auth, "offer_response", idempotencyKey, body);
    if (replay != null) return ok(replay, correlationId);
    Match match = lockMatch(matchId, organizationId);
    if (match.version() != integer(body, "expectedVersion")) {
      throw failure(HttpStatus.CONFLICT, "COMMUNITY_MATCH_VERSION_CONFLICT");
    }
    String response = text(body, "response");
    if (!Set.of("accepted", "declined").contains(response)) {
      throw new IllegalArgumentException("MATCH_RESPONSE_INVALID");
    }
    List<Map<String, Object>> offers =
        jdbc.queryForList(
            """
            SELECT o.offer_id,o.state,o.version,o.expires_at
            FROM community_match_offers o
            JOIN community_organization_enrollments e
              ON e.enrollment_id=o.volunteer_enrollment_id
            WHERE o.offer_id=? AND o.match_id=? AND e.actor_ref_digest=?
            FOR UPDATE
            """,
            offerId,
            matchId,
            CommunityDigest.sha256(auth.actorRef()));
    if (offers.isEmpty()) throw failure(HttpStatus.NOT_FOUND, "COMMUNITY_MATCH_NOT_FOUND");
    Map<String, Object> offer = offers.getFirst();
    if (!"offered".equals(offer.get("state"))) {
      throw failure(HttpStatus.CONFLICT, "COMMUNITY_MATCH_OFFER_STATE_CONFLICT");
    }
    if (((Timestamp) offer.get("expires_at")).toInstant().isBefore(Instant.now())) {
      throw failure(HttpStatus.CONFLICT, "COMMUNITY_MATCH_OFFER_EXPIRED");
    }
    int next = match.version() + 1;
    String state = response;
    jdbc.update(
        "UPDATE community_match_offers SET state=?,version=version+1,responded_at=? WHERE offer_id=?",
        state,
        Timestamp.from(Instant.now()),
        offerId);
    jdbc.update("UPDATE community_matches SET state=?,version=? WHERE match_id=?", state, next, matchId);
    Mutation mutation = new Mutation(state, next, "match.offer_responded");
    writeEvidence(matchId, mutation, auth, correlationId);
    Map<String, Object> result = matchResult(loadProjection(matchId, "volunteer"));
    storeReplay(auth, "offer_response", idempotencyKey, body, matchId, result);
    return ok(result, correlationId);
  }

  @Transactional(readOnly = true)
  public Result reconcile(Map<String, Object> body, String correlationId) {
    Auth auth = authorize(
        body,
        text(object(body, "authorization"), "permission"),
        "/internal/v1/community/matches/reconcile");
    String submissionReference = text(body, "submissionReference");
    List<String> rows =
        jdbc.query(
            """
            SELECT response_json::text FROM community_match_idempotency
            WHERE actor_ref_digest=? AND intent_digest=? AND expires_at>CURRENT_TIMESTAMP
            ORDER BY created_at DESC LIMIT 1
            """,
            (row, ignored) -> row.getString(1),
            CommunityDigest.sha256(auth.actorRef()),
            CommunityDigest.sha256(submissionReference));
    if (rows.isEmpty()) throw failure(HttpStatus.NOT_FOUND, "COMMUNITY_MATCH_NOT_FOUND");
    try {
      return ok(
          mapper.readValue(rows.getFirst(), new TypeReference<Map<String, Object>>() {}),
          correlationId);
    } catch (Exception exception) {
      throw failure(HttpStatus.SERVICE_UNAVAILABLE, "COMMUNITY_SERVICE_UNAVAILABLE");
    }
  }

  private Mutation approve(Match match, Map<String, Object> body) {
    String decision = text(body, "decision");
    if (!Set.of("approved", "rejected").contains(decision)
        || !Set.of("pending_approval", "approved").contains(match.state())) {
      throw failure(HttpStatus.CONFLICT, "COMMUNITY_MATCH_APPROVAL_REQUIRED");
    }
    Instant expiry = Instant.parse(text(body, "expiresAt"));
    if (expiry.isAfter(Instant.now().plus(30, ChronoUnit.DAYS))) {
      throw new IllegalArgumentException("APPROVAL_EXPIRY_INVALID");
    }
    String state = decision;
    int next = match.version() + 1;
    jdbc.update(
        "UPDATE community_matches SET state=?,approval_expires_at=?,version=? WHERE match_id=?",
        state,
        Timestamp.from(expiry),
        next,
        match.id());
    return new Mutation(state, next, "match." + (state.equals("approved") ? "approved" : "rejected"));
  }

  private Mutation offer(Match match, Map<String, Object> body) {
    if (!"approved".equals(match.state())) {
      throw failure(HttpStatus.CONFLICT, "COMMUNITY_MATCH_APPROVAL_REQUIRED");
    }
    String enrollmentId = text(body, "volunteerEnrollmentId");
    Map<String, Object> slot = object(body, "capacitySlot");
    LocalDate serviceDate = LocalDate.parse(text(slot, "serviceDate"));
    String dayPart = text(slot, "dayPart");
    Instant expiry = Instant.parse(text(body, "expiresAt"));
    if (expiry.isAfter(Instant.now().plus(7, ChronoUnit.DAYS))) {
      throw new IllegalArgumentException("OFFER_EXPIRY_INVALID");
    }
    String offerId = "offer_" + UUID.randomUUID().toString().replace("-", "");
    String reservationId = "cap_" + UUID.randomUUID().toString().replace("-", "");
    try {
      jdbc.update(
          """
          INSERT INTO community_capacity_reservations(
            reservation_id,match_id,organization_id,volunteer_enrollment_id,
            service_date,day_part,state,version,expires_at
          ) VALUES (?,?,?,?,?,?,'reserved',1,?)
          """,
          reservationId,
          match.id(),
          match.organizationId(),
          enrollmentId,
          serviceDate,
          dayPart,
          Timestamp.from(expiry));
    } catch (Exception exception) {
      throw failure(HttpStatus.CONFLICT, "COMMUNITY_MATCH_NO_CAPACITY");
    }
    jdbc.update(
        """
        INSERT INTO community_match_offers(
          offer_id,match_id,volunteer_enrollment_id,state,version,expires_at
        ) VALUES (?,?,?,'offered',1,?)
        """,
        offerId,
        match.id(),
        enrollmentId,
        Timestamp.from(expiry));
    int next = match.version() + 1;
    jdbc.update("UPDATE community_matches SET state='offered',version=? WHERE match_id=?", next, match.id());
    return new Mutation("offered", next, "match.offered");
  }

  private Mutation assign(Match match, Map<String, Object> body) {
    if (!"accepted".equals(match.state()) && !"assigned".equals(match.state())) {
      throw failure(HttpStatus.CONFLICT, "COMMUNITY_MATCH_ASSIGNMENT_CONFLICT");
    }
    String offerId = text(body, "offerId");
    List<String> enrollmentIds =
        jdbc.query(
            "SELECT volunteer_enrollment_id FROM community_match_offers WHERE offer_id=? AND match_id=? AND state='accepted' FOR UPDATE",
            (row, ignored) -> row.getString(1),
            offerId,
            match.id());
    if (enrollmentIds.isEmpty()) {
      throw failure(HttpStatus.CONFLICT, "COMMUNITY_MATCH_ASSIGNMENT_CONFLICT");
    }
    boolean reassign = "assigned".equals(match.state());
    int next = match.version() + 1;
    jdbc.update(
        "UPDATE community_matches SET state='assigned',assigned_enrollment_id=?,version=? WHERE match_id=?",
        enrollmentIds.getFirst(),
        next,
        match.id());
    return new Mutation("assigned", next, reassign ? "match.reassigned" : "match.assigned");
  }

  private Mutation progress(Match match, Map<String, Object> body, String role) {
    if (!Set.of("assigned", "in_progress").contains(match.state())) {
      throw failure(HttpStatus.CONFLICT, "COMMUNITY_MATCH_PROGRESS_CONFLICT");
    }
    String checkpoint = text(body, "checkpoint");
    if (!Set.of(
            "arrangements_confirmed",
            "support_started",
            "support_completed",
            "unable_to_proceed")
        .contains(checkpoint)) {
      throw new IllegalArgumentException("PROGRESS_INVALID");
    }
    int next = match.version() + 1;
    jdbc.update(
        """
        INSERT INTO community_match_progress(
          progress_id,match_id,aggregate_version,checkpoint,actor_role,occurred_at
        ) VALUES (?,?,?,?,?,?)
        """,
        "progress_" + UUID.randomUUID().toString().replace("-", ""),
        match.id(),
        next,
        checkpoint,
        role,
        Timestamp.from(Instant.now()));
    jdbc.update("UPDATE community_matches SET state='in_progress',version=? WHERE match_id=?", next, match.id());
    return new Mutation("in_progress", next, "match.progress_recorded");
  }

  private Mutation close(Match match, Map<String, Object> body) {
    if (!Set.of("assigned", "in_progress").contains(match.state())) {
      throw failure(HttpStatus.CONFLICT, "COMMUNITY_MATCH_CLOSED");
    }
    String reason = text(body, "reason");
    if (!Set.of(
            "support_completed",
            "recipient_cancelled",
            "organization_cancelled",
            "unable_to_proceed")
        .contains(reason)) {
      throw new IllegalArgumentException("CLOSE_REASON_INVALID");
    }
    int next = match.version() + 1;
    Instant now = Instant.now();
    jdbc.update(
        "UPDATE community_matches SET state='closed',version=?,closed_at=?,purge_after=? WHERE match_id=?",
        next,
        Timestamp.from(now),
        Timestamp.from(now.plus(30, ChronoUnit.DAYS)),
        match.id());
    releaseCapacity(match.id());
    return new Mutation("closed", next, "match.closed");
  }

  private Mutation revoke(Match match, Map<String, Object> body) {
    if (Set.of("closed", "revoked").contains(match.state())) {
      throw failure(HttpStatus.CONFLICT, "COMMUNITY_MATCH_REVOKED");
    }
    String reason = text(body, "reason");
    if (!Set.of("consent_revoked", "approval_revoked", "organization_revoked").contains(reason)) {
      throw new IllegalArgumentException("REVOKE_REASON_INVALID");
    }
    int next = match.version() + 1;
    Instant now = Instant.now();
    jdbc.update(
        "UPDATE community_matches SET state='revoked',version=?,closed_at=?,purge_after=? WHERE match_id=?",
        next,
        Timestamp.from(now),
        Timestamp.from(now.plus(30, ChronoUnit.DAYS)),
        match.id());
    releaseCapacity(match.id());
    return new Mutation("revoked", next, "match.revoked");
  }

  private void releaseCapacity(String matchId) {
    jdbc.update(
        "UPDATE community_capacity_reservations SET state='released',version=version+1 WHERE match_id=? AND state='reserved'",
        matchId);
    jdbc.update(
        "UPDATE community_match_offers SET state='revoked',version=version+1 WHERE match_id=? AND state IN ('offered','accepted')",
        matchId);
  }

  private Auth authorize(Map<String, Object> body, String permission, String exactPath) {
    Map<String, Object> raw = object(body, "authorization");
    String purpose = text(raw, "purpose");
    String actualPermission = text(raw, "permission");
    Instant expiresAt = Instant.parse(text(raw, "expiresAt"));
    Instant decidedAt = Instant.parse(text(raw, "decidedAt"));
    Map<String, Object> intent = new LinkedHashMap<>(body);
    intent.remove("authorization");
    String expectedDigest = CommunityDigest.requestDigest(mapper, "POST", exactPath, intent);
    if (!"community_match_coordination".equals(purpose)
        || !permission.equals(actualPermission)
        || expiresAt.isBefore(Instant.now())
        || expiresAt.isAfter(decidedAt.plus(10, ChronoUnit.SECONDS))
        || !CommunityDigest.secretEquals(expectedDigest, text(raw, "requestDigest"))) {
      throw failure(HttpStatus.NOT_FOUND, "COMMUNITY_MATCH_AUTHORITY_REQUIRED");
    }
    return new Auth(text(raw, "actorRef"), actualPermission, expiresAt);
  }

  private Auth authorizeRead(Map<String, Object> body, String exactPath) {
    Map<String, Object> raw = object(body, "authorization");
    String permission = text(raw, "permission");
    if (!Set.of("community_match.volunteer.read", "community_match.coordinator.read")
        .contains(permission)) {
      throw failure(HttpStatus.NOT_FOUND, "COMMUNITY_MATCH_AUTHORITY_REQUIRED");
    }
    return authorize(body, permission, exactPath);
  }

  private String requireAnyEnrollment(String actorRef, String organizationId) {
    List<String> roles =
        jdbc.query(
            """
            SELECT role FROM community_organization_enrollments
            WHERE organization_id=? AND actor_ref_digest=? AND status='active'
              AND expires_at>CURRENT_TIMESTAMP
            """,
            (row, ignored) -> row.getString(1),
            organizationId,
            CommunityDigest.sha256(actorRef));
    if (roles.isEmpty()) throw failure(HttpStatus.NOT_FOUND, "COMMUNITY_MATCH_AUTHORITY_REQUIRED");
    return roles.getFirst();
  }

  private String requireEnrollment(String actorRef, String organizationId, String role) {
    String actual = requireAnyEnrollment(actorRef, organizationId);
    if (!role.equals(actual)) throw failure(HttpStatus.NOT_FOUND, "COMMUNITY_MATCH_AUTHORITY_REQUIRED");
    return actual;
  }

  private Match lockMatch(String matchId, String organizationId) {
    List<Match> rows =
        jdbc.query(
            "SELECT match_id,organization_id,state,version FROM community_matches WHERE match_id=? AND organization_id=? FOR UPDATE",
            (row, ignored) ->
                new Match(row.getString(1), row.getString(2), row.getString(3), row.getInt(4)),
            matchId,
            organizationId);
    if (rows.isEmpty()) throw failure(HttpStatus.NOT_FOUND, "COMMUNITY_MATCH_NOT_FOUND");
    return rows.getFirst();
  }

  private Map<String, Object> projection(java.sql.ResultSet row, String role)
      throws java.sql.SQLException {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("matchId", row.getString("match_id"));
    result.put("organizationId", row.getString("organization_id"));
    result.put("category", row.getString("category"));
    result.put("provinceCityCode", row.getString("province_city_code"));
    result.put("dayPart", row.getString("day_part"));
    String offerId = row.getString("current_offer_id");
    if (offerId != null) result.put("offerId", offerId);
    result.put("state", row.getString("state"));
    result.put("version", row.getInt("version"));
    result.put("nextActions", nextActions(row.getString("state"), role));
    result.put("confirmedAt", row.getTimestamp("confirmed_at").toInstant().toString());
    Timestamp expiry = row.getTimestamp("approval_expires_at");
    result.put(
        "evidenceExpiresAt",
        (expiry == null ? Instant.now().plus(10, ChronoUnit.SECONDS) : expiry.toInstant())
            .toString());
    return result;
  }

  private List<Map<String, Object>> loadProjection(String matchId, String role) {
    return jdbc.query(
        """
        SELECT m.*, r.category, r.province_city_code, r.day_part,
          (SELECT o.offer_id FROM community_match_offers o WHERE o.match_id=m.match_id
           AND o.state IN ('offered','accepted') ORDER BY o.expires_at DESC LIMIT 1) current_offer_id
        FROM community_matches m JOIN community_help_requests r ON r.request_id=m.request_id
        WHERE m.match_id=?
        """,
        (row, ignored) -> projection(row, role),
        matchId);
  }

  private List<String> nextActions(String state, String role) {
    if ("volunteer".equals(role)) {
      return switch (state) {
        case "offered" -> List.of("accept", "decline");
        case "assigned", "in_progress" -> List.of("record_progress");
        default -> List.of();
      };
    }
    return switch (state) {
      case "pending_approval" -> List.of("approve", "reject");
      case "approved" -> List.of("offer", "revoke");
      case "accepted" -> List.of("assign", "revoke");
      case "assigned", "in_progress" -> List.of("reassign", "record_progress", "close", "revoke");
      default -> List.of();
    };
  }

  private void writeEvidence(
      String matchId, Mutation mutation, Auth auth, String correlationId) {
    Instant now = Instant.now();
    String aggregateDigest = CommunityDigest.sha256(matchId);
    jdbc.update(
        """
        INSERT INTO community_audit(
          audit_id,action,outcome,actor_ref_digest,aggregate_ref_digest,
          aggregate_version,correlation_id,occurred_at
        ) VALUES (?,?,?,?,?,?,?,?)
        """,
        "audit_" + UUID.randomUUID().toString().replace("-", ""),
        mutation.action(),
        "confirmed",
        CommunityDigest.sha256(auth.actorRef()),
        aggregateDigest,
        mutation.version(),
        correlationId,
        Timestamp.from(now));
    String eventType = "community." + mutation.action() + ".v1";
    jdbc.update(
        """
        INSERT INTO community_outbox(
          event_id,event_type,aggregate_id,aggregate_version,lifecycle_outcome,
          delivery_state,payload,occurred_at,correlation_id,causation_id
        ) VALUES (?,?,?,?,?,'suppressed_not_configured',?::jsonb,?,?,?)
        """,
        "event_" + UUID.randomUUID().toString().replace("-", ""),
        eventType,
        aggregateDigest,
        mutation.version(),
        mutation.state(),
        json(
            Map.of(
                "producer", "community",
                "aggregateVersion", mutation.version(),
                "lifecycleOutcome", mutation.state())),
        Timestamp.from(now),
        correlationId,
        CommunityDigest.sha256(auth.actorRef() + ":" + mutation.version()));
  }

  private Map<String, Object> replay(
      Auth auth, String operation, String key, Map<String, Object> intent) {
    validateKey(key);
    String routeDigest = CommunityDigest.sha256(operation);
    jdbc.query(
        "SELECT pg_advisory_xact_lock(hashtextextended(?,0))",
        row -> null,
        auth.actorRef() + ":" + operation + ":" + key);
    List<Map<String, Object>> rows =
        jdbc.queryForList(
            """
            SELECT intent_digest,response_json::text FROM community_match_idempotency
            WHERE key_digest=? AND actor_ref_digest=? AND operation=? AND route_digest=?
              AND expires_at>CURRENT_TIMESTAMP
            """,
            CommunityDigest.sha256(key),
            CommunityDigest.sha256(auth.actorRef()),
            operation,
            routeDigest);
    if (rows.isEmpty()) return null;
    String intentDigest = CommunityDigest.sha256(json(intent));
    if (!intentDigest.equals(rows.getFirst().get("intent_digest"))) {
      throw failure(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT");
    }
    try {
      return mapper.readValue(
          String.valueOf(rows.getFirst().get("response_json")),
          new TypeReference<Map<String, Object>>() {});
    } catch (Exception exception) {
      throw failure(HttpStatus.SERVICE_UNAVAILABLE, "COMMUNITY_SERVICE_UNAVAILABLE");
    }
  }

  private void storeReplay(
      Auth auth,
      String operation,
      String key,
      Map<String, Object> intent,
      String matchId,
      Map<String, Object> result) {
    jdbc.update(
        """
        INSERT INTO community_match_idempotency(
          key_digest,actor_ref_digest,operation,route_digest,intent_digest,
          match_id,response_json,created_at,expires_at
        ) VALUES (?,?,?,?,?,?,?::jsonb,?,?)
        """,
        CommunityDigest.sha256(key),
        CommunityDigest.sha256(auth.actorRef()),
        operation,
        CommunityDigest.sha256(operation),
        CommunityDigest.sha256(json(intent)),
        matchId,
        json(result),
        Timestamp.from(Instant.now()),
        Timestamp.from(Instant.now().plus(24, ChronoUnit.HOURS)));
  }

  private Result ok(Object data, String correlationId) {
    @SuppressWarnings("unchecked")
    Map<String, Object> body = (Map<String, Object>) data;
    return new Result(200, body);
  }

  private Map<String, Object> matchResult(List<Map<String, Object>> matches) {
    return Map.of(
        "matches", matches,
        "serverTime", Instant.now().toString(),
        "minimumDisclosure", "P5-S2-v1");
  }

  private String json(Object value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception exception) {
      throw new IllegalArgumentException("MATCH_JSON_INVALID", exception);
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> object(Map<String, Object> source, String key) {
    Object value = source.get(key);
    if (!(value instanceof Map<?, ?>)) throw new IllegalArgumentException("MATCH_OBJECT_INVALID");
    return (Map<String, Object>) value;
  }

  private String text(Map<String, Object> source, String key) {
    Object value = source.get(key);
    if (!(value instanceof String string) || string.isBlank()) {
      throw new IllegalArgumentException("MATCH_TEXT_INVALID");
    }
    return string;
  }

  private int integer(Map<String, Object> source, String key) {
    Object value = source.get(key);
    if (!(value instanceof Number number) || number.intValue() < 1) {
      throw new IllegalArgumentException("MATCH_VERSION_INVALID");
    }
    return number.intValue();
  }

  private void validateKey(String key) {
    if (key == null || !key.matches("^[A-Za-z0-9._:-]{8,200}$")) {
      throw failure(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED");
    }
  }

  private CommunityFailure failure(HttpStatus status, String code) {
    return new CommunityFailure(status, code, "community.match.failure", false);
  }

  public record Result(int status, Map<String, Object> body) {}

  private record Auth(String actorRef, String permission, Instant expiresAt) {}

  private record Match(String id, String organizationId, String state, int version) {}

  private record Mutation(String state, int version, String action) {}
}
