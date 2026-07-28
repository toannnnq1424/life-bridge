package org.lifebridge.community;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
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
    if (supplied != null
        && CommunityDigest.secretEquals(properties.internalToken(), supplied)) {
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

  static String safeCorrelation(String candidate) {
    if (candidate != null && candidate.matches("^[A-Za-z0-9_-]{8,128}$")) {
      return candidate;
    }
    return "corr_" + UUID.randomUUID().toString().replace("-", "");
  }
}
