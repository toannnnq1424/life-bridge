package org.lifebridge.community;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@EnabledIfEnvironmentVariable(named = "P7_S1_COMMUNITY_INTEGRATION", matches = "1")
class CommunityMigrationIntegrationTest {
  @Autowired private CommunityService service;
  @Autowired private JdbcTemplate runtimeJdbc;

  @Test
  void flywayNIsReadyButRuntimeCannotPerformDdlOrReadMigrationHistory() {
    assertThat(service.ready()).isTrue();
    if (!"1".equals(System.getenv("P7_S1_EXPECT_RUNTIME_DENIAL"))) return;
    assertThatThrownBy(() -> runtimeJdbc.execute("CREATE TABLE forbidden_runtime_ddl(id int)"))
        .isInstanceOf(BadSqlGrammarException.class);
    assertThatThrownBy(() -> runtimeJdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history", Integer.class))
        .isInstanceOf(BadSqlGrammarException.class);
  }
}
