package org.lifebridge.community;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.FilterChain;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.json.JsonMapper;

final class ContractVersionFilterTest {
  private final ContractVersionFilter filter =
      new ContractVersionFilter(JsonMapper.builder().build());

  @Test
  void servesCurrentAndPreviousAndDefaultsHeaderlessPreviousConsumers() throws Exception {
    for (String requested : new String[] {null, "community-v1", "community-v2"}) {
      var request = new MockHttpServletRequest("POST", "/internal/v1/community/help-requests");
      request.addHeader("x-correlation-id", "corr_version_0001");
      if (requested != null) request.addHeader(ContractVersionFilter.HEADER, requested);
      var response = new MockHttpServletResponse();
      var invoked = new AtomicBoolean();
      FilterChain chain = (ignoredRequest, ignoredResponse) -> invoked.set(true);

      filter.doFilter(request, response, chain);

      assertThat(invoked).isTrue();
      assertThat(response.getHeader(ContractVersionFilter.HEADER))
          .isEqualTo(requested == null ? "community-v1" : requested);
    }
  }

  @Test
  void rejectsUnsupportedVersionBeforeDispatchWithoutEchoingPayload() throws Exception {
    var request = new MockHttpServletRequest("POST", "/internal/v1/community/help-requests");
    request.addHeader("x-correlation-id", "corr_version_0002");
    request.addHeader(ContractVersionFilter.HEADER, "community-v3");
    var response = new MockHttpServletResponse();
    var invoked = new AtomicBoolean();

    filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> invoked.set(true));

    assertThat(invoked).isFalse();
    assertThat(response.getStatus()).isEqualTo(406);
    assertThat(response.getContentAsString())
        .contains("COMMUNITY_CONTRACT_VERSION_UNSUPPORTED")
        .doesNotContain("authorization");
  }
}
