package org.lifebridge.community;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.ObjectMapper;

final class InternalTokenFilterTest {
  private static final String SECRET = "synthetic-community-key-0000001";
  private final ObjectMapper mapper = new ObjectMapper();

  @Test
  void productionRequiresValidScopedGatewayIdentity() throws Exception {
    InternalTokenFilter filter = filter();
    assertStatus(filter, null, 401);
    assertStatus(filter, assertion("gateway", "community", "wrong.scope", Instant.now()), 401);
    assertStatus(
        filter,
        assertion("gateway", "community", "community.access", Instant.now().minusSeconds(180)),
        401);
    assertStatus(
        filter, assertion("gateway", "community", "community.access", Instant.now()), 200);
  }

  private InternalTokenFilter filter() {
    return new InternalTokenFilter(
        new CommunityProperties(SECRET, null, List.of("SYN-PC-001"), false, "production"), mapper);
  }

  private void assertStatus(InternalTokenFilter filter, String assertion, int expected)
      throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/internal/v1/community");
    request.addHeader("x-internal-service-token", SECRET);
    if (assertion != null) request.addHeader("x-lifebridge-service-identity", assertion);
    MockHttpServletResponse response = new MockHttpServletResponse();
    filter.doFilter(request, response, new MockFilterChain());
    assertEquals(expected, response.getStatus());
  }

  private String assertion(String caller, String audience, String scope, Instant now)
      throws Exception {
    long issued = now.getEpochSecond();
    String json =
        mapper.writeValueAsString(
            Map.of(
                "v", 1,
                "kid", "gateway-current",
                "iss", caller,
                "aud", audience,
                "scope", scope,
                "iat", issued,
                "exp", issued + 60,
                "nonce", "synthetic_nonce_0001"));
    String payload =
        Base64.getUrlEncoder().withoutPadding()
            .encodeToString(json.getBytes(StandardCharsets.UTF_8));
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    return payload
        + "."
        + Base64.getUrlEncoder().withoutPadding()
            .encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
  }
}
