package org.lifebridge.community;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public final class CommunityMatchController {
  private final CommunityMatchService service;

  public CommunityMatchController(CommunityMatchService service) {
    this.service = service;
  }

  @PostMapping("/internal/v1/community/matches/volunteer/query")
  public ResponseEntity<Map<String, Object>> volunteerQueue(
      @RequestBody Map<String, Object> body,
      @RequestHeader("x-correlation-id") String correlationId) {
    return respond(service.query(body, "volunteer", correlationId));
  }

  @PostMapping("/internal/v1/community/matches/organization/query")
  public ResponseEntity<Map<String, Object>> organizationQueue(
      @RequestBody Map<String, Object> body,
      @RequestHeader("x-correlation-id") String correlationId) {
    return respond(service.query(body, "coordinator", correlationId));
  }

  @PostMapping("/internal/v1/community/matches/{matchId}/query")
  public ResponseEntity<Map<String, Object>> detail(
      @PathVariable String matchId,
      @RequestBody Map<String, Object> body,
      @RequestHeader("x-correlation-id") String correlationId) {
    return respond(service.detail(matchId, body, correlationId));
  }

  @PostMapping("/internal/v1/community/matches/{matchId}/{action}")
  public ResponseEntity<Map<String, Object>> mutate(
      @PathVariable String matchId,
      @PathVariable String action,
      @RequestBody Map<String, Object> body,
      @RequestHeader("idempotency-key") String idempotencyKey,
      @RequestHeader("x-correlation-id") String correlationId) {
    return respond(service.mutate(matchId, action, body, idempotencyKey, correlationId));
  }

  @PostMapping("/internal/v1/community/matches/{matchId}/offers/{offerId}/response")
  public ResponseEntity<Map<String, Object>> respondOffer(
      @PathVariable String matchId,
      @PathVariable String offerId,
      @RequestBody Map<String, Object> body,
      @RequestHeader("idempotency-key") String idempotencyKey,
      @RequestHeader("x-correlation-id") String correlationId) {
    return respond(
        service.respondOffer(matchId, offerId, body, idempotencyKey, correlationId));
  }

  @PostMapping("/internal/v1/community/matches/reconcile")
  public ResponseEntity<Map<String, Object>> reconcile(
      @RequestBody Map<String, Object> body,
      @RequestHeader("x-correlation-id") String correlationId) {
    return respond(service.reconcile(body, correlationId));
  }

  private ResponseEntity<Map<String, Object>> respond(CommunityMatchService.Result result) {
    return ResponseEntity.status(result.status())
        .header("cache-control", "no-store")
        .body(result.body());
  }
}
