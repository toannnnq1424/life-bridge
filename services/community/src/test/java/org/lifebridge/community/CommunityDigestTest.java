package org.lifebridge.community;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class CommunityDigestTest {
  private final ObjectMapper mapper = new ObjectMapper();

  @Test
  void matchesEveryFrozenNodeGatewayVector() {
    Map<String, Object> disclosure = new LinkedHashMap<>();
    disclosure.put("purpose", "community_support");
    disclosure.put("visibility", "current_request_collaborators");
    disclosure.put("policyVersion", "P5-S1-v1");
    disclosure.put("confirmed", true);
    Map<String, Object> location = new LinkedHashMap<>();
    location.put("granularity", "province_city");
    location.put("provinceCityCode", "SYN-PC-001");
    Map<String, Object> submission = new LinkedHashMap<>();
    submission.put("submissionReference", "submission_synthetic_0001");
    submission.put("category", "daily_living_support");
    submission.put("location", location);
    submission.put("dayPart", "flexible");
    submission.put("disclosure", disclosure);

    assertThat(
            CommunityDigest.requestDigest(
                mapper, "POST", "/internal/v1/community/help-requests/query", Map.of()))
        .isEqualTo("81f1fa58d51b25cf81198059cf2c800b3b3fc30f845945b709cdccb516248115");
    assertThat(
            CommunityDigest.requestDigest(
                mapper, "POST", "/internal/v1/community/help-requests", submission))
        .isEqualTo("8fd3a63d8d663d50de05e0e9d4c396878950b52bdfb9fcf246e9bd060d2cfa82");
    assertThat(
            CommunityDigest.requestDigest(
                mapper,
                "POST",
                "/internal/v1/community/help-requests/reconcile",
                Map.of("submissionReference", "submission_synthetic_0001")))
        .isEqualTo("4443b5bab164dcb20a7a091b9026960b9f15c0d26431812396f2abb70704de84");
    assertThat(
            CommunityDigest.requestDigest(
                mapper,
                "POST",
                "/internal/v1/community/help-requests/request_synthetic_0001/close",
                Map.of("expectedVersion", 3)))
        .isEqualTo("85dabbd6a6febdbb374d092c77cf63a5d9f2dfb75917ea61a1e227225daa130d");
    assertThat(
            CommunityDigest.requestDigest(
                mapper,
                "DELETE",
                "/internal/v1/community/help-requests/request_synthetic_0001",
                Map.of("expectedVersion", 3)))
        .isEqualTo("06b507915bbaef65b995f06fd031935ed04c521a6bd7ad343b4ce19de4fa41cc");
  }

  @Test
  void sortsNestedObjectKeysAndPreservesArrayOrder() {
    Map<String, Object> unsorted = new LinkedHashMap<>();
    unsorted.put("z", 1);
    unsorted.put("a", Map.of("y", 2, "b", java.util.List.of(3, Map.of("d", 4, "c", 5))));
    assertThat(CommunityDigest.requestDigest(mapper, "POST", "/fixed", unsorted))
        .isEqualTo(
            CommunityDigest.requestDigest(
                mapper,
                "POST",
                "/fixed",
                Map.of(
                    "a",
                    Map.of("b", java.util.List.of(3, Map.of("c", 5, "d", 4)), "y", 2),
                    "z",
                    1)));
  }
}
