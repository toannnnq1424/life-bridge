package org.lifebridge.community;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class CommunityContractIntegrityTest {
  private static final Path CONTRACT_ROOT =
      Path.of("../../contracts/community/p5-s1-v1").toAbsolutePath().normalize();

  @Test
  void consumesOnlyChecksumRecordedLanguageNeutralContracts() throws Exception {
    var mapper = new ObjectMapper();
    var lines = Files.readAllLines(CONTRACT_ROOT.resolve("SHA256SUMS"), StandardCharsets.UTF_8);
    assertThat(lines).hasSize(8);
    for (String line : lines) {
      String[] parts = line.split(" {2}", 2);
      assertThat(parts).hasSize(2);
      Path candidate = CONTRACT_ROOT.resolve(parts[1]).normalize();
      assertThat(candidate).startsWith(CONTRACT_ROOT);
      byte[] bytes = Files.readAllBytes(candidate);
      assertThat(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)))
          .isEqualTo(parts[0]);
      assertThat(mapper.readTree(bytes)).isNotNull();
    }
  }
}
