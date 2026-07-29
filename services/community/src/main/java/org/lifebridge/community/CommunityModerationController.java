package org.lifebridge.community;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public final class CommunityModerationController {
  private final CommunityModerationService service;
  public CommunityModerationController(CommunityModerationService service) { this.service = service; }

  @PostMapping("/internal/v1/community/moderation/query")
  ResponseEntity<Map<String,Object>> queue(@RequestBody Map<String,Object> body,
      @RequestHeader("x-correlation-id") String correlation) { return respond(service.queue(body, correlation)); }

  @PostMapping("/internal/v1/community/moderation/{caseId}/query")
  ResponseEntity<Map<String,Object>> detail(@PathVariable String caseId, @RequestBody Map<String,Object> body,
      @RequestHeader("x-correlation-id") String correlation) { return respond(service.detail(caseId, body, correlation)); }

  @PostMapping("/internal/v1/community/moderation/{caseId}/resolve")
  ResponseEntity<Map<String,Object>> resolve(@PathVariable String caseId, @RequestBody Map<String,Object> body,
      @RequestHeader("idempotency-key") String key,
      @RequestHeader("x-correlation-id") String correlation) { return respond(service.resolve(caseId, body, key, correlation)); }

  private ResponseEntity<Map<String,Object>> respond(CommunityModerationService.Result result) {
    return ResponseEntity.status(result.status()).header("cache-control", "no-store").body(result.body());
  }
}
