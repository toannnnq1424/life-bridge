package org.lifebridge.community;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Iterator;
import java.util.Map;
import java.util.TreeMap;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

public final class CommunityDigest {
  private CommunityDigest() {}

  public static String requestDigest(
      ObjectMapper mapper, String method, String exactPath, Object intentBody) {
    try {
      JsonNode canonical = canonicalNode(mapper, mapper.valueToTree(intentBody));
      String body = mapper.writeValueAsString(canonical);
      return sha256(method.toUpperCase() + "\n" + exactPath + "\n" + body);
    } catch (Exception exception) {
      throw new IllegalArgumentException("COMMUNITY_DIGEST_VALUE_INVALID", exception);
    }
  }

  public static String sha256(String value) {
    try {
      byte[] bytes =
          MessageDigest.getInstance("SHA-256")
              .digest(value.getBytes(StandardCharsets.UTF_8));
      return java.util.HexFormat.of().formatHex(bytes);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA_256_UNAVAILABLE", exception);
    }
  }

  public static boolean secretEquals(String expected, String actual) {
    return MessageDigest.isEqual(
        expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
  }

  private static JsonNode canonicalNode(ObjectMapper mapper, JsonNode value) {
    if (value.isObject()) {
      ObjectNode result = mapper.createObjectNode();
      Map<String, JsonNode> fields = new TreeMap<>();
      Iterator<Map.Entry<String, JsonNode>> iterator = value.properties().iterator();
      iterator.forEachRemaining(entry -> fields.put(entry.getKey(), entry.getValue()));
      fields.forEach((key, child) -> result.set(key, canonicalNode(mapper, child)));
      return result;
    }
    if (value.isArray()) {
      ArrayNode result = mapper.createArrayNode();
      value.forEach(child -> result.add(canonicalNode(mapper, child)));
      return result;
    }
    return value;
  }
}
