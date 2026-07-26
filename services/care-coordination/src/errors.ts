import type { ApiErrorCode, TaskProjection } from "@lifebridge/contracts";

export class CareError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    public readonly messageKey: string,
    public readonly retryable = false,
    public readonly fieldErrors?: Record<string, string>,
    public readonly currentTask?: TaskProjection,
  ) {
    super(code);
    this.name = "CareError";
  }
}
