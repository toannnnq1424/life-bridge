package org.lifebridge.community;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SafeTelemetryTest {
  @Test void restartsPublicContextAndNeverPropagatesBaggage() {
    String hostile = "00-11111111111111111111111111111111-2222222222222222-01";
    Map<String,String> headers = SafeTelemetry.propagationHeaders(hostile, false);
    assertThat(headers.get("traceparent")).doesNotStartWith("00-11111111111111111111111111111111-");
    assertThat(headers).containsOnlyKeys("traceparent", "x-correlation-id");
  }
  @Test void continuesStrictContextOnlyAfterInternalAuthentication() {
    String trusted = "00-11111111111111111111111111111111-2222222222222222-01";
    assertThat(SafeTelemetry.propagationHeaders(trusted, true).get("traceparent")).startsWith("00-11111111111111111111111111111111-");
  }
}
