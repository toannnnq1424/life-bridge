package org.lifebridge.community;

import java.time.Instant;

public final class CommunityModels {
  private CommunityModels() {}

  public record Authorization(
      String decisionId,
      String purpose,
      String permission,
      String actorRef,
      String householdId,
      String recipientContextId,
      int subjectVersion,
      String grantId,
      Integer grantVersion,
      Integer privacyVersion,
      String requestId,
      Instant decidedAt,
      String correlationId,
      String requestDigest) {}

  public record Location(String granularity, String provinceCityCode) {}

  public record Disclosure(
      String purpose, String visibility, String policyVersion, boolean confirmed) {}

  public record Submission(
      String submissionReference,
      String category,
      Location location,
      String dayPart,
      Disclosure disclosure) {}

  public record ListCommand(String operation, Authorization authorization) {}

  public record SubmitCommand(
      String operation, Authorization authorization, Submission request) {}

  public record ReconcileCommand(
      String operation, Authorization authorization, String submissionReference) {}

  public record VersionCommand(
      String operation, Authorization authorization, int expectedVersion) {}
}
