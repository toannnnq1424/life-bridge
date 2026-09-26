import type {
  ApiErrorCode,
  AppointmentConflictProjection,
  AppointmentProjection,
  TaskProjection,
} from "@lifebridge/contracts";

export class CareError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    public readonly messageKey: string,
    public readonly retryable = false,
    public readonly fieldErrors?: Record<string, string>,
    public readonly currentTask?: TaskProjection,
    public readonly currentAppointment?: AppointmentProjection,
    public readonly conflict?: AppointmentConflictProjection,
    public readonly recoveryAction?:
      "reload_current" | "choose_another_time" | "check_current_state",
  ) {
    super(code);
    this.name = "CareError";
  }
}
