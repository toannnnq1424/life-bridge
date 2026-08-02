package org.lifebridge.community;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "community")
public record CommunityProperties(
    String internalToken,
    String previousInternalToken,
    List<String> allowedProvinceCityCodes,
    boolean fixturesEnabled,
    String runtimeMode) {

  public CommunityProperties {
    if (internalToken == null || internalToken.length() < 24 || internalToken.length() > 256) {
      throw new IllegalArgumentException("COMMUNITY_INTERNAL_TOKEN_INVALID");
    }
    previousInternalToken =
        previousInternalToken == null || previousInternalToken.isBlank()
            ? null
            : previousInternalToken;
    if (previousInternalToken != null
        && (previousInternalToken.length() < 24 || previousInternalToken.length() > 256)) {
      throw new IllegalArgumentException("COMMUNITY_INTERNAL_TOKEN_PREVIOUS_INVALID");
    }
    allowedProvinceCityCodes = List.copyOf(allowedProvinceCityCodes);
    if (allowedProvinceCityCodes.isEmpty()
        || allowedProvinceCityCodes.stream().anyMatch(code -> !code.matches("^[A-Z0-9-]{3,32}$"))) {
      throw new IllegalArgumentException("COMMUNITY_ALLOWED_PROVINCE_CITY_CODES_INVALID");
    }
    if (!List.of("local", "test", "production").contains(runtimeMode)) {
      throw new IllegalArgumentException("COMMUNITY_RUNTIME_MODE_INVALID");
    }
    if (fixturesEnabled && "production".equals(runtimeMode)) {
      throw new IllegalArgumentException("COMMUNITY_FIXTURES_FORBIDDEN");
    }
  }
}
