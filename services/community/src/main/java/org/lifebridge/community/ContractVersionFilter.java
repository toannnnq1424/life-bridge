package org.lifebridge.community;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.Set;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

@Component
public final class ContractVersionFilter extends OncePerRequestFilter {
  public static final String HEADER = "x-lifebridge-contract-version";
  public static final String CURRENT = "community-v2";
  public static final String PREVIOUS = "community-v1";
  private static final Set<String> SUPPORTED = Set.of(CURRENT, PREVIOUS);
  private final ObjectMapper objectMapper;

  public ContractVersionFilter(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !request.getRequestURI().startsWith("/internal/v1/community");
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String requested = request.getHeader(HEADER);
    String selected = requested == null || requested.isBlank() ? PREVIOUS : requested;
    response.setHeader(HEADER, selected);
    if (!SUPPORTED.contains(selected)) {
      response.setStatus(HttpServletResponse.SC_NOT_ACCEPTABLE);
      response.setContentType(MediaType.APPLICATION_JSON_VALUE);
      objectMapper.writeValue(
          response.getWriter(),
          Map.of(
              "error",
              Map.of(
                  "code", "COMMUNITY_CONTRACT_VERSION_UNSUPPORTED",
                  "messageKey", "community.contract_version.unsupported",
                  "retryable", false,
                  "correlationId", safeCorrelation(request.getHeader("x-correlation-id")))));
      return;
    }
    chain.doFilter(request, response);
  }

  private String safeCorrelation(String value) {
    return value != null && value.matches("^[A-Za-z0-9_-]{8,128}$")
        ? value
        : "corr_version_rejected";
  }
}
