package org.lifebridge.community;

import java.util.Map;
import org.lifebridge.community.CommunityModels.ListCommand;
import org.lifebridge.community.CommunityModels.ReconcileCommand;
import org.lifebridge.community.CommunityModels.SubmitCommand;
import org.lifebridge.community.CommunityModels.VersionCommand;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public final class CommunityController {
  private final CommunityService service;

  public CommunityController(CommunityService service) {
    this.service = service;
  }

  @GetMapping("/internal/v1/community/directory")
  public ResponseEntity<Map<String, Object>> directory(
      @RequestParam Map<String, String> query,
      @RequestHeader("x-correlation-id") String correlationId) {
    return ResponseEntity.ok()
        .header("cache-control", "public, max-age=300")
        .body(service.directory(query, safeCorrelation(correlationId)));
  }

  @PostMapping("/internal/v1/community/help-requests/query")
  public ResponseEntity<Map<String, Object>> list(
      @RequestBody ListCommand command,
      @RequestHeader("x-correlation-id") String correlationId) {
    requireOperation(command.operation(), "list");
    return response(
        service.list(
            command.authorization(),
            safeCorrelation(correlationId),
            "/internal/v1/community/help-requests/query"));
  }

  @PostMapping("/internal/v1/community/help-requests")
  public ResponseEntity<Map<String, Object>> submit(
      @RequestBody SubmitCommand command,
      @RequestHeader("idempotency-key") String idempotencyKey,
      @RequestHeader("x-correlation-id") String correlationId) {
    requireOperation(command.operation(), "submit");
    return response(
        service.submit(
            command.authorization(),
            command.request(),
            idempotencyKey,
            safeCorrelation(correlationId),
            "/internal/v1/community/help-requests"));
  }

  @PostMapping("/internal/v1/community/help-requests/reconcile")
  public ResponseEntity<Map<String, Object>> reconcile(
      @RequestBody ReconcileCommand command,
      @RequestHeader("x-correlation-id") String correlationId) {
    requireOperation(command.operation(), "reconcile");
    return response(
        service.reconcile(
            command.authorization(),
            command.submissionReference(),
            safeCorrelation(correlationId),
            "/internal/v1/community/help-requests/reconcile"));
  }

  @PostMapping("/internal/v1/community/help-requests/{requestId}/close")
  public ResponseEntity<Map<String, Object>> close(
      @PathVariable String requestId,
      @RequestBody VersionCommand command,
      @RequestHeader("idempotency-key") String idempotencyKey,
      @RequestHeader("x-correlation-id") String correlationId) {
    requireId(requestId);
    requireOperation(command.operation(), "close");
    return response(
        service.close(
            command.authorization(),
            command.expectedVersion(),
            idempotencyKey,
            safeCorrelation(correlationId),
            "/internal/v1/community/help-requests/" + requestId + "/close",
            requestId));
  }

  @DeleteMapping("/internal/v1/community/help-requests/{requestId}")
  public ResponseEntity<Map<String, Object>> delete(
      @PathVariable String requestId,
      @RequestBody VersionCommand command,
      @RequestHeader("idempotency-key") String idempotencyKey,
      @RequestHeader("x-correlation-id") String correlationId) {
    requireId(requestId);
    requireOperation(command.operation(), "delete");
    return response(
        service.delete(
            command.authorization(),
            command.expectedVersion(),
            idempotencyKey,
            safeCorrelation(correlationId),
            "/internal/v1/community/help-requests/" + requestId,
            requestId));
  }

  @GetMapping("/version")
  public Map<String, String> version() {
    return Map.of(
        "service", "community",
        "contract", "P5-S1-v1");
  }

  @GetMapping("/health/live")
  public Map<String, String> live() {
    return Map.of("status", "live");
  }

  @GetMapping("/health/ready")
  public ResponseEntity<Map<String, String>> ready() {
    if (!service.ready()) {
      return ResponseEntity.status(503).body(Map.of("status", "not_ready"));
    }
    return ResponseEntity.ok(Map.of("status", "ready"));
  }

  private ResponseEntity<Map<String, Object>> response(
      CommunityService.ServiceResult result) {
    return ResponseEntity.status(result.status())
        .header("cache-control", "no-store")
        .body(result.body());
  }

  private String safeCorrelation(String value) {
    if (value == null || !value.matches("^[A-Za-z0-9_-]{8,128}$")) {
      throw new IllegalArgumentException("COMMUNITY_CORRELATION_INVALID");
    }
    return value;
  }

  private void requireOperation(String actual, String expected) {
    if (!expected.equals(actual)) {
      throw new IllegalArgumentException("COMMUNITY_OPERATION_INVALID");
    }
  }

  private void requireId(String value) {
    if (!value.matches("^[A-Za-z0-9_-]{8,128}$")) {
      throw new IllegalArgumentException("COMMUNITY_REQUEST_ID_INVALID");
    }
  }
}
