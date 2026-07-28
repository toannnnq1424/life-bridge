package org.lifebridge.community;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.lifebridge.community.CommunityModels.Authorization;
import org.lifebridge.community.CommunityModels.Submission;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

class CommunityProviderContractTest {
  private static final String CORRELATION_ID = "corr_provider_0001";
  private CommunityService service;
  private MockMvc mvc;

  @BeforeEach
  void configureProvider() {
    service = mock(CommunityService.class);
    var mapper =
        JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();
    mvc =
        MockMvcBuilders.standaloneSetup(new CommunityController(service))
            .setControllerAdvice(new CommunityExceptionHandler())
            .setMessageConverters(new JacksonJsonHttpMessageConverter(mapper))
            .build();
  }

  @Test
  void acceptsTheFrozenSubmitTransportAndReturnsOnlyTheProviderEnvelope()
      throws Exception {
    when(
            service.submit(
                any(),
                any(),
                eq("idem_provider_0001"),
                eq(CORRELATION_ID),
                eq("/internal/v1/community/help-requests")))
        .thenReturn(
            new CommunityService.ServiceResult(
                HttpStatus.CREATED,
                Map.of(
                    "data", Map.of("outcome", "submitted"),
                    "meta", Map.of("correlationId", CORRELATION_ID))));

    mvc.perform(
            post("/internal/v1/community/help-requests")
                .contentType(MediaType.APPLICATION_JSON)
                .header("idempotency-key", "idem_provider_0001")
                .header("x-correlation-id", CORRELATION_ID)
                .content(validSubmitJson()))
        .andExpect(status().isCreated())
        .andExpect(header().string("cache-control", "no-store"))
        .andExpect(jsonPath("$.data.outcome").value("submitted"))
        .andExpect(jsonPath("$.meta.correlationId").value(CORRELATION_ID));

    var authorization = ArgumentCaptor.forClass(Authorization.class);
    var submission = ArgumentCaptor.forClass(Submission.class);
    verify(service)
        .submit(
            authorization.capture(),
            submission.capture(),
            eq("idem_provider_0001"),
            eq(CORRELATION_ID),
            eq("/internal/v1/community/help-requests"));
    assertThat(authorization.getValue().purpose()).isEqualTo("community_support");
    assertThat(authorization.getValue().permission())
        .isEqualTo("community.help_request.submit");
    assertThat(authorization.getValue().grantId()).isNull();
    assertThat(submission.getValue().location().granularity()).isEqualTo("province_city");
    assertThat(submission.getValue().disclosure().confirmed()).isTrue();
  }

  @Test
  void rejectsUnknownCommandPropertiesWithoutEchoingInput() throws Exception {
    mvc.perform(
            post("/internal/v1/community/help-requests")
                .contentType(MediaType.APPLICATION_JSON)
                .header("idempotency-key", "idem_provider_0001")
                .header("x-correlation-id", CORRELATION_ID)
                .content(validSubmitJson().replace("\"operation\":\"submit\"", "\"operation\":\"submit\",\"sensitiveNote\":\"forbidden\"")))
        .andExpect(status().isBadRequest())
        .andExpect(header().string("cache-control", "no-store"))
        .andExpect(jsonPath("$.error.code").value("COMMUNITY_REQUEST_VALIDATION_FAILED"))
        .andExpect(jsonPath("$.sensitiveNote").doesNotExist());
  }

  @Test
  void exposesRepositoryStandardLiveReadyAndVersionEndpoints() throws Exception {
    when(service.ready()).thenReturn(true);
    mvc.perform(get("/health/live"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("live"));
    mvc.perform(get("/health/ready"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ready"));
    mvc.perform(get("/version"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.service").value("community"))
        .andExpect(jsonPath("$.contract").value("P5-S2-v1"));
  }

  private String validSubmitJson() {
    return """
        {
          "operation":"submit",
          "authorization":{
            "decisionId":"decision_provider_0001",
            "purpose":"community_support",
            "permission":"community.help_request.submit",
            "actorRef":"account_provider_0001",
            "householdId":"household_provider_0001",
            "recipientContextId":"recipient_provider_0001",
            "subjectVersion":1,
            "grantId":null,
            "grantVersion":null,
            "privacyVersion":null,
            "requestId":null,
            "decidedAt":"2026-07-29T00:00:00Z",
            "correlationId":"corr_provider_0001",
            "requestDigest":"8fd3a63dd62a839f3e866c129b3aa2a7be4f4f2d8f403c972238565d2edcfa82"
          },
          "request":{
            "submissionReference":"submission_provider_0001",
            "category":"daily_living_support",
            "location":{"granularity":"province_city","provinceCityCode":"SYN-PC-001"},
            "dayPart":"morning",
            "disclosure":{
              "purpose":"community_support",
              "visibility":"current_request_collaborators",
              "policyVersion":"P5-S1-v1",
              "confirmed":true
            }
          }
        }
        """;
  }
}
