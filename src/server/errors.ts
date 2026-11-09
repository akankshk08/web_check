/** Errors whose message is safe to show to the user. Anything else becomes a generic message. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: "BAD_REQUEST" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED",
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Invalid request.") {
    super(message, "BAD_REQUEST", 400);
  }
}
export class UnauthenticatedError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super(message, "UNAUTHENTICATED", 401);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that.") {
    super(message, "FORBIDDEN", 403);
  }
}
/** Also used for records in other organizations, so their existence is never revealed. */
export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(message, "NOT_FOUND", 404);
  }
}
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}
export class RateLimitError extends AppError {
  constructor(message = "Too many attempts. Please wait a few minutes and try again.") {
    super(message, "RATE_LIMITED", 429);
  }
}

/** Postgres unique violation. */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}
