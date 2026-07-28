package org.lifebridge.community;

import java.sql.Timestamp;
import java.time.Instant;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public final class CommunityFixtureLoader implements ApplicationRunner {
  private final JdbcTemplate jdbc;
  private final CommunityProperties properties;

  public CommunityFixtureLoader(JdbcTemplate jdbc, CommunityProperties properties) {
    this.jdbc = jdbc;
    this.properties = properties;
  }

  @Override
  public void run(ApplicationArguments arguments) {
    if (!properties.fixturesEnabled()) return;
    insert(
        "listing_synthetic_0001",
        "Synthetic community desk",
        "community_group",
        "SYN-PC-001",
        "Synthetic Province/City 001",
        new String[] {"daily_living_support", "social_connection"},
        "website",
        "Synthetic public page",
        "https://example.invalid/community",
        "contact_for_accessibility_details",
        "Synthetic reviewed source",
        "https://example.invalid/source",
        Instant.parse("2026-07-20T00:00:00Z"),
        Instant.parse("2026-08-20T00:00:00Z"));
    insert(
        "listing_synthetic_0002",
        "Synthetic public support desk",
        "public_service",
        "SYN-PC-002",
        "Synthetic Province/City 002",
        new String[] {"transport_coordination", "accessibility_support"},
        "phone",
        "Synthetic public telephone",
        "+0000000000",
        null,
        "Synthetic reviewed source",
        "https://example.invalid/source-2",
        Instant.parse("2026-06-01T00:00:00Z"),
        Instant.parse("2026-07-01T00:00:00Z"));
  }

  private void insert(
      String id,
      String name,
      String type,
      String code,
      String label,
      String[] categories,
      String contactType,
      String contactLabel,
      String contactValue,
      String accessibility,
      String sourceLabel,
      String sourceUrl,
      Instant reviewedAt,
      Instant nextReviewAt) {
    jdbc.update(
        connection -> {
          var statement =
              connection.prepareStatement(
                  """
                  INSERT INTO community_directory_listings(
                    listing_id,public_name,organization_type,province_city_code,
                    province_city_label,categories,contact_type,contact_label,contact_value,
                    accessibility_contact_note,source_label,source_url,last_reviewed_at,
                    next_review_at,reviewed
                  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,TRUE)
                  ON CONFLICT (listing_id) DO NOTHING
                  """);
          statement.setString(1, id);
          statement.setString(2, name);
          statement.setString(3, type);
          statement.setString(4, code);
          statement.setString(5, label);
          statement.setArray(6, connection.createArrayOf("text", categories));
          statement.setString(7, contactType);
          statement.setString(8, contactLabel);
          statement.setString(9, contactValue);
          statement.setString(10, accessibility);
          statement.setString(11, sourceLabel);
          statement.setString(12, sourceUrl);
          statement.setTimestamp(13, Timestamp.from(reviewedAt));
          statement.setTimestamp(14, Timestamp.from(nextReviewAt));
          return statement;
        });
  }
}
