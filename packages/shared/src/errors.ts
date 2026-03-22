export class PlatformError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'PlatformError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthError extends PlatformError {
  constructor(message: string, code: string, statusCode?: number) {
    super(message, code, statusCode);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends PlatformError {
  constructor(message: string, code: string, statusCode?: number) {
    super(message, code, statusCode);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends PlatformError {
  constructor(message: string, code: string, statusCode?: number) {
    super(message, code, statusCode);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends PlatformError {
  constructor(
    message: string,
    public readonly retry_after: number,
  ) {
    super(message, 'RATE_LIMITED');
    this.name = 'RateLimitError';
  }
}
