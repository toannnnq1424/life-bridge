export class IdentityError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly messageKey: string,
    public readonly retryable = false,
  ) {
    super(code);
    this.name = "IdentityError";
  }
}
