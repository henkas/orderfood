import { describe, it, expect } from 'vitest';
import { encryptCredentials, decryptCredentials } from '../src/auth.js';

describe('credential encryption', () => {
  it('round-trips access_token through encrypt/decrypt', async () => {
    const creds = {
      access_token: 'test-token-abc',
      refresh_token: 'refresh-xyz',
      expires_at: '2030-01-01T00:00:00.000Z',
      cookies: { 'jwt-session': 'fake-jwt' },
    };
    const encrypted = await encryptCredentials(creds);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();
    const decrypted = await decryptCredentials(encrypted);
    expect(decrypted.access_token).toBe('test-token-abc');
    expect(decrypted.cookies['jwt-session']).toBe('fake-jwt');
  });
});
