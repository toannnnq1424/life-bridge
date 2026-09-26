package org.lifebridge.community;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;

class CommunitySchemaCompatibilityTest {
  @Test
  void readinessUsesTheBoundedNMinusOneThroughNWindow() {
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    when(jdbc.queryForObject(contains("version BETWEEN 3 AND 4"), eq(Integer.class)))
        .thenReturn(1);
    CommunityService service =
        new CommunityService(
            jdbc,
            mock(ObjectMapper.class),
            new CommunityProperties(
                "synthetic-community-token-0001", null, List.of("SYN-PC-001"), false, "test"));

    assertThat(service.ready()).isTrue();
  }
}
