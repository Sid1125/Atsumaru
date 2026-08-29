/**
 * Lives in its own module so the demo layer and the real client can both raise the
 * same error type without importing each other (client → demo → client would be a
 * cycle, and Metro resolves those to `undefined` at module-init time).
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}
