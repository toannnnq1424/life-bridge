package org.lifebridge.community;

import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;

class CommunityPropertiesTest {

  @Test
  void treatsAnEmptyPreviousRotationKeyAsNotConfigured() {
    CommunityProperties properties =
        new CommunityProperties(
            "community-current-secret-123456",
            "",
            List.of("SYN-PC-001"),
            false,
            "test");

    assertNull(properties.previousInternalToken());
  }
}
