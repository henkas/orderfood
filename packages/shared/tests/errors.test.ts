import { describe, test, expect } from 'vitest';
import {
  PlatformError,
  AuthError,
  NotFoundError,
  ValidationError,
  RateLimitError,
} from '../src/errors.js';

describe('PlatformError', () => {
  test('extends Error with code and statusCode', () => {
    const err = new PlatformError('test message', 'TEST_CODE', 500);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('test message');
    expect(err.code).toBe('TEST_CODE');
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe('PlatformError');
  });

  test('works without statusCode', () => {
    const err = new PlatformError('msg', 'CODE');
    expect(err.statusCode).toBeUndefined();
  });
});

describe('AuthError', () => {
  test('is a PlatformError with correct name', () => {
    const err = new AuthError('auth failed', 'AUTH_ERROR');
    expect(err).toBeInstanceOf(PlatformError);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.name).toBe('AuthError');
  });
});

describe('NotFoundError', () => {
  test('is a PlatformError', () => {
    const err = new NotFoundError('not found', 'NOT_FOUND', 404);
    expect(err).toBeInstanceOf(PlatformError);
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('NotFoundError');
  });
});

describe('ValidationError', () => {
  test('is a PlatformError', () => {
    const err = new ValidationError('invalid options', 'VALIDATION_ERROR');
    expect(err).toBeInstanceOf(PlatformError);
    expect(err.name).toBe('ValidationError');
  });
});

describe('RateLimitError', () => {
  test('has retry_after and fixed RATE_LIMITED code', () => {
    const err = new RateLimitError('slow down', 30);
    expect(err).toBeInstanceOf(PlatformError);
    expect(err.retry_after).toBe(30);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.name).toBe('RateLimitError');
  });
});
