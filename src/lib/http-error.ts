export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;

    // important pour instanceof
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export function getHttpStatus(err: unknown): number {
  if (err instanceof HttpError) return err.status;
  return 500;
}

export function getErrorCode(err: unknown): string {
  if (err instanceof HttpError && err.code) return err.code;
  return "internal_error";
}