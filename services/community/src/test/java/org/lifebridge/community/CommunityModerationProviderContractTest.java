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

class CommunityModerationProviderContractTest {
  private CommunityModerationService service;
  private MockMvc mvc;

  @BeforeEach
  void configure() {
    service = mock(CommunityModerationService.class);
    mvc = MockMvcBuilders.standaloneSetup(new CommunityModerationController(service))
        .setControllerAdvice(new CommunityExceptionHandler())
        .setMessageConverters(new JacksonJsonHttpMessageConverter(JsonMapper.builder().build()))
        .build();
  }

  @Test
  void exposesQueueAndDetailAsNonCacheableMinimumDisclosure() throws Exception {
    when(service.queue(any(), eq("corr_moderation_provider_1"))).thenReturn(
        new CommunityModerationService.Result(200, Map.of("cases", List.of(), "minimumDisclosure", "P5-S3-v1")));
    mvc.perform(post("/internal/v1/community/moderation/cases/query").contentType(MediaType.APPLICATION_JSON)
            .header("x-correlation-id", "corr_moderation_provider_1").content("{}"))
        .andExpect(status().isOk()).andExpect(header().string("cache-control", "no-store"))
        .andExpect(jsonPath("$.minimumDisclosure").value("P5-S3-v1"));
    verify(service).queue(any(), eq("corr_moderation_provider_1"));

    when(service.detail(eq("case_synthetic_0001"), any(), eq("corr_moderation_provider_2")))
        .thenReturn(new CommunityModerationService.Result(200, Map.of("case", Map.of("caseId", "case_synthetic_0001", "redactionState", "minimum_redacted"))));
    mvc.perform(post("/internal/v1/community/moderation/cases/case_synthetic_0001/query")
            .contentType(MediaType.APPLICATION_JSON).header("x-correlation-id", "corr_moderation_provider_2").content("{}"))
        .andExpect(status().isOk()).andExpect(header().string("cache-control", "no-store"))
        .andExpect(jsonPath("$.case.redactionState").value("minimum_redacted"));
  }

  @Test
  void forwardsResolveHeadersAndReturnsFrozenResult() throws Exception {
    when(service.resolve(eq("case_synthetic_0001"), any(), eq("idem_moderation_0001"), eq("corr_moderation_provider_3")))
        .thenReturn(new CommunityModerationService.Result(200, Map.of("caseId", "case_synthetic_0001", "state", "resolved", "outcome", "no_change", "policyVersion", "P5-S3-v1")));
    mvc.perform(post("/internal/v1/community/moderation/cases/case_synthetic_0001/resolution")
            .contentType(MediaType.APPLICATION_JSON).header("idempotency-key", "idem_moderation_0001")
            .header("x-correlation-id", "corr_moderation_provider_3").content("{}"))
        .andExpect(status().isOk()).andExpect(header().string("cache-control", "no-store"))
        .andExpect(jsonPath("$.state").value("resolved")).andExpect(jsonPath("$.policyVersion").value("P5-S3-v1"));
    verify(service).resolve(eq("case_synthetic_0001"), any(), eq("idem_moderation_0001"), eq("corr_moderation_provider_3"));
  }

  @Test
  void mapsValidationWithoutEchoingSensitiveInput() throws Exception {
    when(service.queue(any(), eq("bad_corr"))).thenThrow(new IllegalArgumentException("MODERATION_INVALID"));
    mvc.perform(post("/internal/v1/community/moderation/cases/query").contentType(MediaType.APPLICATION_JSON)
            .header("x-correlation-id", "bad_corr").content("{\"sensitiveNarrative\":\"never-echo\"}"))
        .andExpect(status().isBadRequest()).andExpect(header().string("cache-control", "no-store"))
        .andExpect(jsonPath("$.error.code").value("COMMUNITY_MODERATION_VALIDATION_FAILED"))
        .andExpect(jsonPath("$.sensitiveNarrative").doesNotExist());
  }
}
