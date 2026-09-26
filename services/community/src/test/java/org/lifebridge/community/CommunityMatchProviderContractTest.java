package org.lifebridge.community;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;

class CommunityMatchProviderContractTest {
  private CommunityMatchService service;
  private MockMvc mvc;

  @BeforeEach
  void configure() {
    service = mock(CommunityMatchService.class);
    mvc = MockMvcBuilders.standaloneSetup(new CommunityMatchController(service))
        .setControllerAdvice(new CommunityExceptionHandler())
        .setMessageConverters(new JacksonJsonHttpMessageConverter(JsonMapper.builder().build()))
        .build();
  }

  @Test
  void returnsFrozenMinimumDisclosureQueryResult() throws Exception {
    when(service.query(any(), eq("volunteer"), eq("corr_match_provider_0001")))
        .thenReturn(new CommunityMatchService.Result(200, Map.of(
            "matches", List.of(),
            "serverTime", "2026-07-29T00:00:00Z",
            "minimumDisclosure", "P5-S2-v1")));

    mvc.perform(post("/internal/v1/community/matches/volunteer/query")
            .contentType(MediaType.APPLICATION_JSON)
            .header("x-correlation-id", "corr_match_provider_0001")
            .content(validQuery()))
        .andExpect(status().isOk())
        .andExpect(header().string("cache-control", "no-store"))
        .andExpect(jsonPath("$.minimumDisclosure").value("P5-S2-v1"))
        .andExpect(jsonPath("$.matches.length()").value(0));
    verify(service).query(any(), eq("volunteer"), eq("corr_match_provider_0001"));
  }

  @Test
  void mapsMatchValidationWithoutEchoingSensitiveInput() throws Exception {
    when(service.query(any(), eq("volunteer"), eq("bad")))
        .thenThrow(new IllegalArgumentException("MATCH_COMMAND_INVALID"));
    mvc.perform(post("/internal/v1/community/matches/volunteer/query")
            .contentType(MediaType.APPLICATION_JSON)
            .header("x-correlation-id", "bad")
            .content("{\"forbiddenNarrative\":\"do-not-echo\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("COMMUNITY_MATCH_VALIDATION_FAILED"))
        .andExpect(jsonPath("$.forbiddenNarrative").doesNotExist());
  }

  private String validQuery() {
    return """
        {"operation":"query","organizationId":"org_provider_0001","audience":"volunteer",
         "authorization":{"decisionId":"decision_provider_0001","purpose":"community_match_coordination",
          "permission":"community_match.volunteer.read","actorRef":"actor_provider_0001",
          "recipientContextId":"recipient_provider_0001","subjectVersion":1,
          "grantId":"grant_provider_0001","grantVersion":1,"privacyVersion":1,
          "decidedAt":"2026-07-29T00:00:00Z","expiresAt":"2026-07-29T00:00:10Z",
          "correlationId":"corr_match_provider_0001",
          "requestDigest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}
        """;
  }
}
