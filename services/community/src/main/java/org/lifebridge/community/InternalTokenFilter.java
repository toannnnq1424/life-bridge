package org.lifebridge.community;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

@Component
public final class InternalTokenFilter extends OncePerRequestFilter {
  private final CommunityProperties properties;
  private final ObjectMapper mapper;

  public InternalTokenFilter(CommunityProperties properties, ObjectMapper mapper) {
    this.properties = properties;
    this.mapper = mapper;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !request.getRequestURI().startsWith("/internal/");
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String supplied = request.getHeader("x-internal-service-token");
    String assertion = request.getHeader("x-lifebridge-service-identity");
    boolean legacy = supplied != null && CommunityDigest.secretEquals(properties.internalToken(), supplied);
    boolean identity = validAssertion(assertion);
    if (identity || (!"production".equals(properties.runtimeMode()) && legacy)) {
      chain.doFilter(request, response);
      return;
    }
    String correlationId = safeCorrelation(request.getHeader("x-correlation-id"));
    response.setStatus(401);
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.setHeader("cache-control", "no-store");
    mapper.writeValue(
        response.getOutputStream(),
        Map.of(
            "error",
            Map.of(
                "code", "COMMUNITY_AUTHORITY_REQUIRED",
                "messageKey", "community.resource_not_found",
                "retryable", false,
                "correlationId", correlationId)));
  }

  private boolean validAssertion(String assertion) {
    if (assertion == null || assertion.length() > 1024) return false;
    try {
      String[] parts = assertion.split("\\.", -1);
      if (parts.length != 2) return false;
      @SuppressWarnings("unchecked")
      Map<String, Object> payload = mapper.readValue(
          Base64.getUrlDecoder().decode(parts[0]), Map.class);
      String keyId = String.valueOf(payload.get("kid"));
      if (!"gateway-current".equals(keyId) && !"gateway-previous".equals(keyId)) return false;
      boolean signatureValid = false;
      for (String secret : new String[] {properties.internalToken(), properties.previousInternalToken()}) {
        if (secret == null) continue;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String expected = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(mac.doFinal(parts[0].getBytes(StandardCharsets.UTF_8)));
        signatureValid |= CommunityDigest.secretEquals(expected, parts[1]);
      }
      if (!signatureValid) return false;
      long now = Instant.now().getEpochSecond();
      long issued = ((Number) payload.getOrDefault("iat", 0)).longValue();
      long expiry = ((Number) payload.getOrDefault("exp", 0)).longValue();
      return Integer.valueOf(1).equals(payload.get("v"))
          && ("gateway-current".equals(payload.get("kid")) || "gateway-previous".equals(payload.get("kid")))
          && "gateway".equals(payload.get("iss"))
          && "community".equals(payload.get("aud"))
          && "community.access".equals(payload.get("scope"))
          && issued <= now + 5 && expiry >= now && expiry - issued <= 120
          && String.valueOf(payload.get("nonce")).matches("^[A-Za-z0-9_-]{16,64}$");
    } catch (Exception ignored) {
      return false;
    }
  }

  static String safeCorrelation(String candidate) {
    if (candidate != null && candidate.matches("^[A-Za-z0-9_-]{8,128}$")) {
      return candidate;
    }
    return "corr_" + UUID.randomUUID().toString().replace("-", "");
  }
}
