package org.lifebridge.community;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.lifebridge.community.CommunityModels.Authorization;
import org.lifebridge.community.CommunityModels.Submission;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Service
public class CommunityService {
  private static final Set<String> CATEGORIES =
      Set.of(
          "daily_living_support",
          "transport_coordination",
          "household_errand",
          "social_connection",
          "digital_access",
          "accessibility_support");
  private static final Set<String> DAY_PARTS =
      Set.of("flexible", "morning", "afternoon", "evening");
  private static final Set<String> ORGANIZATION_TYPES =
      Set.of("public_service", "nonprofit", "community_group");

  private final JdbcTemplate jdbc;
  private final ObjectMapper mapper;
  private final CommunityProperties properties;

  public CommunityService(
      JdbcTemplate jdbc, ObjectMapper mapper, CommunityProperties properties) {
    this.jdbc = jdbc;
    this.mapper = mapper;
    this.properties = properties;
  }

  public boolean ready() {
    Integer state =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM community_schema_state WHERE service='community' AND version=1",
            Integer.class);
    return state != null && state == 1;
  }

  public Map<String, Object> directory(
      Map<String, String> query, String correlationId) {
    if (!Set.of("category", "provinceCityCode", "organizationType")
        .containsAll(query.keySet())) {
      throw validation(true);
    }
    String category = query.get("category");
    String provinceCityCode = query.get("provinceCityCode");
    String organizationType = query.get("organizationType");
    if ((category != null && !CATEGORIES.contains(category))
        || (provinceCityCode != null
            && !properties.allowedProvinceCityCodes().contains(provinceCityCode))
        || (organizationType != null && !ORGANIZATION_TYPES.contains(organizationType))) {
      throw validation(true);
    }

    StringBuilder sql =
        new StringBuilder(
            """
            SELECT * FROM community_directory_listings
            WHERE reviewed = TRUE
            """);
    List<Object> arguments = new ArrayList<>();
    if (category != null) {
      sql.append(" AND ? = ANY(categories)");
      arguments.add(category);
    }
    if (provinceCityCode != null) {
      sql.append(" AND province_city_code = ?");
      arguments.add(provinceCityCode);
    }
    if (organizationType != null) {
      sql.append(" AND organization_type = ?");
      arguments.add(organizationType);
    }
    sql.append(" ORDER BY public_name, listing_id LIMIT 25");
    Instant now = Instant.now();
    List<Map<String, Object>> items =
        jdbc.query(
            sql.toString(),
            (result, ignored) -> directoryProjection(result, now),
            arguments.toArray());
    return envelope(
        Map.of(
            "items", items,
            "generatedAt", now.toString(),
            "cachePolicy", "public_5m_session_24h",
            "matchingState", "unavailable_in_p5_s1",
            "resultMeaning", "informational_not_eligibility_availability_or_endorsement"),
        correlationId);
  }

  @Transactional
  public ServiceResult list(
      Authorization authorization, String correlationId, String exactPath) {
    authorize(
        authorization,
        "community.help_request.list",
        "POST",
        exactPath,
        Map.of(),
        correlationId,
        null);
    sweepRetention();
    List<Map<String, Object>> requests =
        jdbc.query(
            """
            SELECT * FROM community_help_requests
            WHERE household_id = ? AND recipient_context_id = ?
            ORDER BY confirmed_at DESC, request_id
            LIMIT 25
            """,
            (result, ignored) -> projection(row(result)),
            authorization.householdId(),
            authorization.recipientContextId());
    return new ServiceResult(
        HttpStatus.OK,
        envelope(
            Map.of("requests", requests, "serverTime", Instant.now().toString()),
            correlationId));
  }

  @Transactional
  public ServiceResult submit(
      Authorization authorization,
      Submission submission,
      String idempotencyKey,
      String correlationId,
      String exactPath) {
    validateSubmission(submission);
    authorize(
        authorization,
        "community.help_request.submit",
        "POST",
        exactPath,
        submission,
        correlationId,
        null);
    sweepRetention();
    String actorDigest = CommunityDigest.sha256(authorization.actorRef());
    String routeDigest = CommunityDigest.sha256(exactPath);
    validateIdempotencyKey(idempotencyKey);
    int deletedReference =
        jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM community_request_tombstones
            WHERE actor_ref_digest = ? AND submission_reference_digest = ?
              AND retain_until > CURRENT_TIMESTAMP
            """,
            Integer.class,
            actorDigest,
            CommunityDigest.sha256(submission.submissionReference()));
    if (deletedReference > 0) {
      throw failure(
          HttpStatus.CONFLICT,
          "COMMUNITY_REQUEST_DUPLICATE",
          "community.request.duplicate",
          false);
    }
    ServiceResult replay =
        replay(
            idempotencyKey,
            actorDigest,
            "submit",
            routeDigest,
            authorization.requestDigest());
    if (replay != null) return replay;

    String duplicateBoundary =
        String.join(
            ":",
            authorization.recipientContextId(),
            submission.category(),
            submission.location().provinceCityCode(),
            String.valueOf(submission.dayPart()));
    jdbc.query(
        "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
        result -> null,
        duplicateBoundary);

    List<HelpRow> sameReference =
        jdbc.query(
            """
            SELECT * FROM community_help_requests
            WHERE actor_ref_digest = ? AND submission_reference = ?
            FOR UPDATE
            """,
            (result, ignored) -> row(result),
            actorDigest,
            submission.submissionReference());
    if (!sameReference.isEmpty()) {
      HelpRow existing = sameReference.getFirst();
      if (!sameIntent(existing, submission)) {
        throw failure(
            HttpStatus.CONFLICT,
            "IDEMPOTENCY_CONFLICT",
            "community.idempotency.conflict",
            false);
      }
      ServiceResult duplicate = mutationResult(existing, "submitted", true, correlationId);
      storeReplay(
          idempotencyKey,
          actorDigest,
          "submit",
          routeDigest,
          authorization.requestDigest(),
          existing.requestId(),
          duplicate);
      return duplicate;
    }

    List<HelpRow> duplicateRows =
        jdbc.query(
            """
            SELECT * FROM community_help_requests
            WHERE recipient_context_id = ? AND category = ? AND province_city_code = ?
              AND day_part IS NOT DISTINCT FROM ? AND status = 'pending'
            FOR UPDATE
            """,
            (result, ignored) -> row(result),
            authorization.recipientContextId(),
            submission.category(),
            submission.location().provinceCityCode(),
            submission.dayPart());
    if (!duplicateRows.isEmpty()) {
      HelpRow duplicateRow = duplicateRows.getFirst();
      ServiceResult duplicate =
          mutationResult(duplicateRow, "submitted", true, correlationId);
      storeReplay(
          idempotencyKey,
          actorDigest,
          "submit",
          routeDigest,
          authorization.requestDigest(),
          duplicateRow.requestId(),
          duplicate);
      return duplicate;
    }

    Instant now = Instant.now();
    String requestId = id("request");
    jdbc.update(
        """
        INSERT INTO community_help_requests(
          request_id,submission_reference,actor_ref_digest,household_id,
          recipient_context_id,category,location_granularity,province_city_code,
          day_part,visibility,status,version,confirmed_at,pending_auto_close_at,
          closed_at,purge_after
        ) VALUES (?,?,?,?,?,?,'province_city',?,?,'current_request_collaborators',
                  'pending',1,?,?,NULL,NULL)
        """,
        requestId,
        submission.submissionReference(),
        actorDigest,
        authorization.householdId(),
        authorization.recipientContextId(),
        submission.category(),
        submission.location().provinceCityCode(),
        submission.dayPart(),
        Timestamp.from(now),
        Timestamp.from(now.plus(30, ChronoUnit.DAYS)));
    HelpRow inserted = readRequestForActor(requestId, authorization);
    audit(
        "help_request.submitted",
        "confirmed",
        actorDigest,
        requestId,
        1,
        correlationId,
        now);
    outbox(
        "community.help_request.submitted.v1",
        requestId,
        1,
        "pending",
        correlationId,
        authorization.decisionId(),
        now);
    ServiceResult result = mutationResult(inserted, "submitted", false, correlationId);
    result = new ServiceResult(HttpStatus.CREATED, result.body());
    storeReplay(
        idempotencyKey,
        actorDigest,
        "submit",
        routeDigest,
        authorization.requestDigest(),
        requestId,
        result);
    return result;
  }

  @Transactional
  public ServiceResult reconcile(
      Authorization authorization,
      String submissionReference,
      String correlationId,
      String exactPath) {
    if (submissionReference == null
        || !submissionReference.matches("^[A-Za-z0-9_-]{12,128}$")) {
      throw validation(false);
    }
    authorize(
        authorization,
        "community.help_request.reconcile",
        "POST",
        exactPath,
        Map.of("submissionReference", submissionReference),
        correlationId,
        null);
    sweepRetention();
    List<HelpRow> rows =
        jdbc.query(
            """
            SELECT * FROM community_help_requests
            WHERE actor_ref_digest = ? AND submission_reference = ?
              AND household_id = ? AND recipient_context_id = ?
            """,
            (result, ignored) -> row(result),
            CommunityDigest.sha256(authorization.actorRef()),
            submissionReference,
            authorization.householdId(),
            authorization.recipientContextId());
    if (rows.isEmpty()) throw inaccessible();
    HelpRow row = rows.getFirst();
    return mutationResult(
        row, row.status().equals("closed") ? "closed" : "submitted", true, correlationId);
  }

  @Transactional
  public ServiceResult close(
      Authorization authorization,
      int expectedVersion,
      String idempotencyKey,
      String correlationId,
      String exactPath,
      String requestId) {
    if (expectedVersion < 1) throw validation(false);
    authorize(
        authorization,
        "community.help_request.close",
        "POST",
        exactPath,
        Map.of("expectedVersion", expectedVersion),
        correlationId,
        requestId);
    sweepRetention();
    String actorDigest = CommunityDigest.sha256(authorization.actorRef());
    String routeDigest = CommunityDigest.sha256(exactPath);
    ServiceResult replay =
        replay(
            idempotencyKey,
            actorDigest,
            "close",
            routeDigest,
            authorization.requestDigest());
    if (replay != null) return replay;
    HelpRow current = readRequestForActor(requestId, authorization);
    if (current.version() != expectedVersion) throw versionConflict();
    if (!current.status().equals("pending")) throw stateConflict();

    Instant now = Instant.now();
    int updated =
        jdbc.update(
            """
            UPDATE community_help_requests
            SET status='closed',version=version+1,closed_at=?,purge_after=?
            WHERE request_id=? AND version=? AND status='pending'
            """,
            Timestamp.from(now),
            Timestamp.from(now.plus(30, ChronoUnit.DAYS)),
            requestId,
            expectedVersion);
    if (updated != 1) throw versionConflict();
    HelpRow closed = readRequestForActor(requestId, authorization);
    audit(
        "help_request.closed",
        "confirmed",
        actorDigest,
        requestId,
        closed.version(),
        correlationId,
        now);
    outbox(
        "community.help_request.closed.v1",
        requestId,
        closed.version(),
        "closed",
        correlationId,
        authorization.decisionId(),
        now);
    ServiceResult result = mutationResult(closed, "closed", false, correlationId);
    storeReplay(
        idempotencyKey,
        actorDigest,
        "close",
        routeDigest,
        authorization.requestDigest(),
        requestId,
        result);
    return result;
  }

  @Transactional
  public ServiceResult delete(
      Authorization authorization,
      int expectedVersion,
      String idempotencyKey,
      String correlationId,
      String exactPath,
      String requestId) {
    if (expectedVersion < 1) throw validation(false);
    authorize(
        authorization,
        "community.help_request.delete",
        "DELETE",
        exactPath,
        Map.of("expectedVersion", expectedVersion),
        correlationId,
        requestId);
    sweepRetention();
    String actorDigest = CommunityDigest.sha256(authorization.actorRef());
    String routeDigest = CommunityDigest.sha256(exactPath);
    ServiceResult replay =
        replay(
            idempotencyKey,
            actorDigest,
            "delete",
            routeDigest,
            authorization.requestDigest());
    if (replay != null) return replay;
    HelpRow current = readRequestForActor(requestId, authorization);
    if (current.version() != expectedVersion) throw versionConflict();
    Instant now = Instant.now();
    int deletedVersion = current.version() + 1;
    int deleted =
        jdbc.update(
            "DELETE FROM community_help_requests WHERE request_id=? AND version=?",
            requestId,
            expectedVersion);
    if (deleted != 1) throw versionConflict();
    tombstone(current, now);
    invalidateProtectedReplays(current.requestId());
    audit(
        "help_request.deleted",
        "confirmed",
        actorDigest,
        requestId,
        deletedVersion,
        correlationId,
        now);
    outbox(
        "community.help_request.deleted.v1",
        requestId,
        deletedVersion,
        "deleted",
        correlationId,
        authorization.decisionId(),
        now);
    ServiceResult result =
        new ServiceResult(
            HttpStatus.OK,
            envelope(
                Map.of(
                    "outcome", "deleted",
                    "deletedRequestId", requestId,
                    "confirmedAt", now.toString()),
                correlationId));
    storeReplay(
        idempotencyKey,
        actorDigest,
        "delete",
        routeDigest,
        authorization.requestDigest(),
        requestId,
        result);
    return result;
  }

  private void authorize(
      Authorization authorization,
      String permission,
      String method,
      String exactPath,
      Object intentBody,
      String correlationId,
      String requestId) {
    Instant now = Instant.now();
    if (authorization == null
        || !opaqueId(authorization.decisionId())
        || !"community_support".equals(authorization.purpose())
        || !permission.equals(authorization.permission())
        || !opaqueId(authorization.actorRef())
        || !opaqueId(authorization.householdId())
        || !opaqueId(authorization.recipientContextId())
        || authorization.subjectVersion() < 1
        || (authorization.grantId() != null && !opaqueId(authorization.grantId()))
        || (authorization.grantVersion() != null && authorization.grantVersion() < 1)
        || (authorization.privacyVersion() != null && authorization.privacyVersion() < 1)
        || authorization.decidedAt() == null
        || authorization.decidedAt().isBefore(now.minusSeconds(10))
        || authorization.decidedAt().isAfter(now.plusSeconds(2))
        || !correlationId.equals(authorization.correlationId())
        || !java.util.Objects.equals(requestId, authorization.requestId())
        || authorization.requestDigest() == null
        || !authorization.requestDigest().matches("^[a-f0-9]{64}$")
        || !CommunityDigest.requestDigest(mapper, method, exactPath, intentBody)
            .equals(authorization.requestDigest())) {
      throw inaccessible();
    }
  }

  private void validateSubmission(Submission submission) {
    if (submission == null
        || submission.submissionReference() == null
        || !submission.submissionReference().matches("^[A-Za-z0-9_-]{12,128}$")
        || !CATEGORIES.contains(submission.category())
        || submission.location() == null
        || !"province_city".equals(submission.location().granularity())
        || !properties
            .allowedProvinceCityCodes()
            .contains(submission.location().provinceCityCode())
        || (submission.dayPart() != null && !DAY_PARTS.contains(submission.dayPart()))
        || submission.disclosure() == null
        || !"community_support".equals(submission.disclosure().purpose())
        || !"current_request_collaborators".equals(submission.disclosure().visibility())
        || !"P5-S1-v1".equals(submission.disclosure().policyVersion())
        || !submission.disclosure().confirmed()) {
      throw validation(false);
    }
  }

  private HelpRow readRequestForActor(String requestId, Authorization authorization) {
    List<HelpRow> rows =
        jdbc.query(
            """
            SELECT * FROM community_help_requests
            WHERE request_id=? AND household_id=? AND recipient_context_id=?
            FOR UPDATE
            """,
            (result, ignored) -> row(result),
            requestId,
            authorization.householdId(),
            authorization.recipientContextId());
    if (rows.isEmpty()) throw inaccessible();
    return rows.getFirst();
  }

  private ServiceResult replay(
      String rawKey,
      String actorDigest,
      String operation,
      String routeDigest,
      String intentDigest) {
    validateIdempotencyKey(rawKey);
    String keyDigest = CommunityDigest.sha256(rawKey);
    String lockBoundary =
        String.join(":", keyDigest, actorDigest, operation, routeDigest);
    jdbc.query(
        "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
        result -> null,
        lockBoundary);
    List<ReplayRow> rows =
        jdbc.query(
            """
            SELECT intent_digest,response_status,response_json::text
            FROM community_idempotency
            WHERE key_digest=? AND actor_ref_digest=? AND operation=? AND route_digest=?
              AND expires_at > CURRENT_TIMESTAMP
            FOR UPDATE
            """,
            (result, ignored) ->
                new ReplayRow(
                    result.getString(1), result.getInt(2), result.getString(3)),
            keyDigest,
            actorDigest,
            operation,
            routeDigest);
    if (rows.isEmpty()) return null;
    ReplayRow row = rows.getFirst();
    if (!row.intentDigest().equals(intentDigest)) {
      throw failure(
          HttpStatus.CONFLICT,
          "IDEMPOTENCY_CONFLICT",
          "community.idempotency.conflict",
          false);
    }
    try {
      Map<String, Object> body =
          mapper.readValue(row.responseJson(), new TypeReference<>() {});
      return new ServiceResult(HttpStatus.valueOf(row.responseStatus()), body);
    } catch (JacksonException exception) {
      throw failure(
          HttpStatus.SERVICE_UNAVAILABLE,
          "INTERNAL_CONTRACT_INVALID",
          "community.contract.invalid",
          false);
    }
  }

  private void storeReplay(
      String rawKey,
      String actorDigest,
      String operation,
      String routeDigest,
      String intentDigest,
      String requestId,
      ServiceResult result) {
    try {
      jdbc.update(
          """
          INSERT INTO community_idempotency(
            key_digest,actor_ref_digest,operation,route_digest,aggregate_ref_digest,intent_digest,
            response_status,response_json,created_at,expires_at
          ) VALUES (?,?,?,?,?,?,?,?::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL '24 hours')
          """,
          CommunityDigest.sha256(rawKey),
          actorDigest,
          operation,
          routeDigest,
          CommunityDigest.sha256(requestId),
          intentDigest,
          result.status().value(),
          mapper.writeValueAsString(result.body()));
    } catch (JacksonException exception) {
      throw new IllegalStateException("COMMUNITY_RESPONSE_SERIALIZATION_FAILED", exception);
    }
  }

  private ServiceResult mutationResult(
      HelpRow row, String outcome, boolean duplicate, String correlationId) {
    Instant confirmed = Instant.now();
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("outcome", outcome);
    data.put("duplicate", duplicate);
    data.put("request", projection(row));
    data.put("confirmedAt", confirmed.toString());
    return new ServiceResult(HttpStatus.OK, envelope(data, correlationId));
  }

  private Map<String, Object> projection(HelpRow row) {
    Map<String, Object> projection = new LinkedHashMap<>();
    projection.put("requestId", row.requestId());
    projection.put("submissionReference", row.submissionReference());
    projection.put("category", row.category());
    projection.put("locationGranularity", "province_city");
    projection.put("provinceCityCode", row.provinceCityCode());
    projection.put("dayPart", row.dayPart());
    projection.put("visibility", "current_request_collaborators");
    projection.put("status", row.status());
    projection.put("submissionOutcome", "confirmed");
    projection.put("matchingState", "unavailable_in_p5_s1");
    projection.put("retentionPolicy", "pending_30d_closed_30d_then_purge");
    projection.put("version", row.version());
    projection.put("confirmedAt", row.confirmedAt().toString());
    projection.put("pendingAutoCloseAt", row.pendingAutoCloseAt().toString());
    projection.put("closedAt", row.closedAt() == null ? null : row.closedAt().toString());
    projection.put("purgeAfter", row.purgeAfter() == null ? null : row.purgeAfter().toString());
    return projection;
  }

  private Map<String, Object> directoryProjection(ResultSet result, Instant now)
      throws SQLException {
    String[] categories = (String[]) result.getArray("categories").getArray();
    Map<String, Object> provenance =
        Map.of(
            "sourceLabel", result.getString("source_label"),
            "sourceUrl", result.getString("source_url"),
            "lastReviewedAt", result.getTimestamp("last_reviewed_at").toInstant().toString(),
            "nextReviewAt", result.getTimestamp("next_review_at").toInstant().toString(),
            "state",
                result.getTimestamp("next_review_at").toInstant().isBefore(now)
                    ? "stale"
                    : "current");
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("listingId", result.getString("listing_id"));
    item.put("publicName", result.getString("public_name"));
    item.put("organizationType", result.getString("organization_type"));
    item.put("provinceCityCode", result.getString("province_city_code"));
    item.put("provinceCityLabel", result.getString("province_city_label"));
    item.put("categories", Arrays.asList(categories));
    item.put(
        "contactChannel",
        Map.of(
            "type", result.getString("contact_type"),
            "label", result.getString("contact_label"),
            "value", result.getString("contact_value")));
    item.put("accessibilityContactNote", result.getString("accessibility_contact_note"));
    item.put("provenance", provenance);
    item.put("availabilityState", "not_verified");
    item.put("eligibilityState", "not_determined");
    item.put("endorsementState", "none");
    return item;
  }

  private HelpRow row(ResultSet result) throws SQLException {
    return new HelpRow(
        result.getString("request_id"),
        result.getString("submission_reference"),
        result.getString("actor_ref_digest"),
        result.getString("household_id"),
        result.getString("recipient_context_id"),
        result.getString("category"),
        result.getString("province_city_code"),
        result.getString("day_part"),
        result.getString("status"),
        result.getInt("version"),
        result.getTimestamp("confirmed_at").toInstant(),
        result.getTimestamp("pending_auto_close_at").toInstant(),
        instant(result, "closed_at"),
        instant(result, "purge_after"));
  }

  private Instant instant(ResultSet result, String column) throws SQLException {
    Timestamp value = result.getTimestamp(column);
    return value == null ? null : value.toInstant();
  }

  private boolean sameIntent(HelpRow row, Submission submission) {
    return row.category().equals(submission.category())
        && row.provinceCityCode().equals(submission.location().provinceCityCode())
        && java.util.Objects.equals(row.dayPart(), submission.dayPart());
  }

  private void audit(
      String action,
      String outcome,
      String actorDigest,
      String requestId,
      int version,
      String correlationId,
      Instant occurredAt) {
    jdbc.update(
        """
        INSERT INTO community_audit(
          audit_id,action,outcome,actor_ref_digest,aggregate_ref_digest,
          aggregate_version,correlation_id,occurred_at
        ) VALUES (?,?,?,?,?,?,?,?)
        """,
        id("audit"),
        action,
        outcome,
        actorDigest,
        CommunityDigest.sha256(requestId),
        version,
        correlationId,
        Timestamp.from(occurredAt));
  }

  private void outbox(
      String eventType,
      String requestId,
      int version,
      String lifecycle,
      String correlationId,
      String causationId,
      Instant occurredAt) {
    String eventId = id("event");
    Map<String, Object> payload =
        Map.ofEntries(
            Map.entry("eventId", eventId),
            Map.entry("eventType", eventType),
            Map.entry("eventVersion", 1),
            Map.entry("producer", "community"),
            Map.entry("aggregateId", requestId),
            Map.entry("aggregateVersion", version),
            Map.entry("lifecycleOutcome", lifecycle),
            Map.entry("deliveryState", "suppressed_not_configured"),
            Map.entry("occurredAt", occurredAt.toString()),
            Map.entry("correlationId", correlationId),
            Map.entry("causationId", causationId));
    try {
      jdbc.update(
          """
          INSERT INTO community_outbox(
            event_id,event_type,aggregate_id,aggregate_version,lifecycle_outcome,
            delivery_state,payload,occurred_at,correlation_id,causation_id
          ) VALUES (?,?,?,?,?,'suppressed_not_configured',?::jsonb,?,?,?)
          """,
          eventId,
          eventType,
          requestId,
          version,
          lifecycle,
          mapper.writeValueAsString(payload),
          Timestamp.from(occurredAt),
          correlationId,
          causationId);
    } catch (JacksonException exception) {
      throw new IllegalStateException("COMMUNITY_EVENT_SERIALIZATION_FAILED", exception);
    }
  }

  private void tombstone(HelpRow row, Instant now) {
    jdbc.update(
        """
        INSERT INTO community_request_tombstones(
          tombstone_id,request_digest,actor_ref_digest,submission_reference_digest,
          deleted_at,retain_until
        ) VALUES (?,?,?,?,?,?)
        """,
        id("tombstone"),
        CommunityDigest.sha256(row.requestId()),
        row.actorDigest(),
        CommunityDigest.sha256(row.submissionReference()),
        Timestamp.from(now),
        Timestamp.from(now.plus(365, ChronoUnit.DAYS)));
  }

  private void invalidateProtectedReplays(String requestId) {
    jdbc.update(
        "DELETE FROM community_idempotency WHERE aggregate_ref_digest=?",
        CommunityDigest.sha256(requestId));
  }

  @Scheduled(
      fixedDelayString = "${community.retention-sweep-ms:60000}",
      initialDelayString = "${community.retention-sweep-initial-delay-ms:60000}")
  @Transactional
  public void sweepRetention() {
    Instant now = Instant.now();
    List<HelpRow> expiredPending =
        jdbc.query(
            """
            SELECT * FROM community_help_requests
            WHERE status='pending' AND pending_auto_close_at <= CURRENT_TIMESTAMP
            FOR UPDATE SKIP LOCKED
            """,
            (result, ignored) -> row(result));
    for (HelpRow row : expiredPending) {
      int nextVersion = row.version() + 1;
      jdbc.update(
          """
          UPDATE community_help_requests
          SET status='closed',version=?,closed_at=?,purge_after=?
          WHERE request_id=?
          """,
          nextVersion,
          Timestamp.from(now),
          Timestamp.from(now.plus(30, ChronoUnit.DAYS)),
          row.requestId());
      audit(
          "help_request.auto_closed",
          "confirmed",
          row.actorDigest(),
          row.requestId(),
          nextVersion,
          "corr_retention_sweep",
          now);
      outbox(
          "community.help_request.closed.v1",
          row.requestId(),
          nextVersion,
          "closed",
          "corr_retention_sweep",
          "retention_sweep",
          now);
    }
    List<HelpRow> expiredClosed =
        jdbc.query(
            """
            SELECT * FROM community_help_requests
            WHERE status='closed' AND purge_after <= CURRENT_TIMESTAMP
            FOR UPDATE SKIP LOCKED
            """,
            (result, ignored) -> row(result));
    for (HelpRow row : expiredClosed) {
      int deletedVersion = row.version() + 1;
      invalidateProtectedReplays(row.requestId());
      jdbc.update("DELETE FROM community_help_requests WHERE request_id=?", row.requestId());
      tombstone(row, now);
      audit(
          "help_request.retention_purged",
          "purged",
          row.actorDigest(),
          row.requestId(),
          deletedVersion,
          "corr_retention_sweep",
          now);
      outbox(
          "community.help_request.deleted.v1",
          row.requestId(),
          deletedVersion,
          "deleted",
          "corr_retention_sweep",
          "retention_sweep",
          now);
    }
    jdbc.update("DELETE FROM community_idempotency WHERE expires_at <= CURRENT_TIMESTAMP");
    jdbc.update(
        "DELETE FROM community_request_tombstones WHERE retain_until <= CURRENT_TIMESTAMP");
    jdbc.update(
        "DELETE FROM community_audit WHERE occurred_at <= CURRENT_TIMESTAMP - INTERVAL '365 days'");
    jdbc.update(
        "DELETE FROM community_outbox WHERE occurred_at <= CURRENT_TIMESTAMP - INTERVAL '365 days'");
  }

  private void validateIdempotencyKey(String value) {
    if (value == null || !value.matches("^[A-Za-z0-9._:-]{8,128}$")) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "IDEMPOTENCY_KEY_REQUIRED",
          "community.idempotency.required",
          false);
    }
  }

  private Map<String, Object> envelope(Object data, String correlationId) {
    return Map.of("data", data, "meta", Map.of("correlationId", correlationId));
  }

  private String id(String prefix) {
    return prefix + "_" + UUID.randomUUID().toString().replace("-", "");
  }

  private boolean opaqueId(String value) {
    return value != null && value.matches("^[A-Za-z0-9_-]{8,128}$");
  }

  private CommunityFailure validation(boolean directory) {
    return failure(
        HttpStatus.BAD_REQUEST,
        directory ? "DIRECTORY_VALIDATION_FAILED" : "COMMUNITY_REQUEST_VALIDATION_FAILED",
        directory ? "community.directory.validation" : "community.request.validation",
        false);
  }

  private CommunityFailure inaccessible() {
    return failure(
        HttpStatus.NOT_FOUND,
        "COMMUNITY_RESOURCE_NOT_FOUND",
        "community.resource_not_found",
        false);
  }

  private CommunityFailure versionConflict() {
    return failure(
        HttpStatus.CONFLICT,
        "COMMUNITY_REQUEST_VERSION_CONFLICT",
        "community.request.version_conflict",
        false);
  }

  private CommunityFailure stateConflict() {
    return failure(
        HttpStatus.CONFLICT,
        "COMMUNITY_REQUEST_STATE_CONFLICT",
        "community.request.state_conflict",
        false);
  }

  private CommunityFailure failure(
      HttpStatus status, String code, String messageKey, boolean retryable) {
    return new CommunityFailure(status, code, messageKey, retryable);
  }

  public record ServiceResult(HttpStatus status, Map<String, Object> body) {}

  private record ReplayRow(String intentDigest, int responseStatus, String responseJson) {}

  private record HelpRow(
      String requestId,
      String submissionReference,
      String actorDigest,
      String householdId,
      String recipientContextId,
      String category,
      String provinceCityCode,
      String dayPart,
      String status,
      int version,
      Instant confirmedAt,
      Instant pendingAutoCloseAt,
      Instant closedAt,
      Instant purgeAfter) {}
}
