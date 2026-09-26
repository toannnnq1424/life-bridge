package org.lifebridge.community;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class SafeTelemetry {
  private static final Pattern TRACEPARENT = Pattern.compile("^00-([0-9a-f]{32})-([0-9a-f]{16})-0[01]$");
  private static final SecureRandom RANDOM = new SecureRandom();
  private SafeTelemetry() {}

  static Map<String, String> propagationHeaders(String inbound, boolean authenticatedInternalCaller) {
    String traceId = null;
    if (authenticatedInternalCaller && inbound != null) {
      Matcher match = TRACEPARENT.matcher(inbound);
      if (match.matches() && !match.group(1).matches("0+") && !match.group(2).matches("0+")) traceId = match.group(1);
    }
    if (traceId == null) traceId = randomHex(16);
    String spanId = randomHex(8);
    return Map.of("traceparent", "00-" + traceId + "-" + spanId + "-01", "x-correlation-id", "corr_" + traceId);
  }

  private static String randomHex(int bytes) {
    byte[] value = new byte[bytes]; RANDOM.nextBytes(value); return HexFormat.of().formatHex(value);
  }
}
