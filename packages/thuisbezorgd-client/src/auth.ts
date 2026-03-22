import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import fetch, { HeadersInit } from 'node-fetch';
import { machineIdSync } from 'node-machine-id';
import { NotFoundError } from '@orderfood/shared';

export interface ThuisbezorgdCredentials {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
}

interface StoredCredentials {
  iv: string;
  ciphertext: string;
  user_id: string;
}

export interface PendingThuisbezorgdLogin {
  email: string;
  code_verifier: string;
  state: string;
  validated_return_url: string;
  cookies: Record<string, string>;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  id_token?: string;
  token_type: 'Bearer';
}

const PLATFORM = 'thuisbezorgd';
const SALT = 'orderfood-v1';
const AUTH_BASE = 'https://auth.thuisbezorgd.nl';
const CLIENT_ID = 'consumer_web_je';
const REDIRECT_URI = 'https://www.thuisbezorgd.nl/en/signin-oidc?returnUrl=/';

function deriveKey(): Buffer {
  const machineId = machineIdSync(true);
  const prk = createHash('sha256')
    .update(Buffer.from(SALT))
    .update(Buffer.from(machineId, 'hex'))
    .digest();
  const info = Buffer.from(PLATFORM);
  const okm = createHash('sha256')
    .update(prk)
    .update(info)
    .update(Buffer.from([0x01]))
    .digest();
  return okm.slice(0, 32);
}

export async function encryptCredentials(
  creds: ThuisbezorgdCredentials,
): Promise<StoredCredentials> {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(creds));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: Buffer.concat([encrypted, tag]).toString('base64'),
    user_id: creds.user_id,
  };
}

export async function decryptCredentials(
  stored: StoredCredentials,
): Promise<ThuisbezorgdCredentials> {
  const key = deriveKey();
  const iv = Buffer.from(stored.iv, 'base64');
  const buf = Buffer.from(stored.ciphertext, 'base64');
  const tag = buf.slice(buf.length - 16);
  const ciphertext = buf.slice(0, buf.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString()) as ThuisbezorgdCredentials;
}

function credentialsPath(): string {
  return join(homedir(), '.orderfood', `${PLATFORM}.json`);
}

export async function loadCredentials(): Promise<ThuisbezorgdCredentials> {
  const stored: StoredCredentials = JSON.parse(
    await readFile(credentialsPath(), 'utf-8'),
  );
  return decryptCredentials(stored);
}

export async function saveCredentials(
  creds: ThuisbezorgdCredentials,
): Promise<void> {
  const path = credentialsPath();
  await mkdir(join(homedir(), '.orderfood'), { recursive: true });
  const stored = await encryptCredentials(creds);
  await writeFile(path, JSON.stringify(stored, null, 2), 'utf-8');
}

export function isAccessTokenExpired(
  creds: ThuisbezorgdCredentials,
): boolean {
  return creds.expires_at <= Math.floor(Date.now() / 1000) + 60;
}

export async function beginEmailLogin(
  email: string,
): Promise<PendingThuisbezorgdLogin> {
  const jar: Record<string, string> = {};
  const state = randomBytes(16).toString('hex');
  const code_verifier = toBase64Url(randomBytes(32));
  const code_challenge = toBase64Url(
    createHash('sha256').update(code_verifier).digest(),
  );

  const authorizeParams = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'openid profile mobile_scope offline_access',
    code_challenge,
    code_challenge_method: 'S256',
    state,
    ui_locales: 'en',
    acr_values: 'tenant:nl',
  });

  const authorizeUrl = `${AUTH_BASE}/connect/authorize?${authorizeParams.toString()}`;
  await authRequest(authorizeUrl, { method: 'GET' }, jar);

  const returnUrl = `/connect/authorize/callback?${authorizeParams.toString()}`;
  const res = await authRequest(
    `${AUTH_BASE}/applications/authenticationservice/credentials/email/validate`,
    {
      method: 'POST',
      headers: jsonHeaders(jar),
      body: JSON.stringify({ email, returnUrl }),
    },
    jar,
  );
  const json = (await res.json()) as { validatedReturnUrl?: string };
  if (!json.validatedReturnUrl) {
    throw new NotFoundError(
      'Thuisbezorgd email validation did not return a validatedReturnUrl',
      'AUTH_INVALID',
    );
  }

  return {
    email,
    code_verifier,
    state,
    validated_return_url: json.validatedReturnUrl,
    cookies: jar,
  };
}

export async function completeEmailLogin(
  pending: PendingThuisbezorgdLogin,
  otp: string,
): Promise<ThuisbezorgdCredentials> {
  const jar = { ...pending.cookies };
  const otpRes = await authRequest(
    `${AUTH_BASE}/applications/authenticationservice/credentials/otp/validate`,
    {
      method: 'POST',
      headers: jsonHeaders(jar),
      body: JSON.stringify({
        otp,
        returnUrl: pending.validated_return_url,
      }),
    },
    jar,
  );
  const otpJson = (await otpRes.json()) as { validatedReturnUrl?: string };
  const callbackPath = otpJson.validatedReturnUrl ?? pending.validated_return_url;

  const callbackRes = await authRequest(
    `${AUTH_BASE}${callbackPath}`,
    { method: 'GET', redirect: 'manual' },
    jar,
  );
  const callbackLocation = callbackRes.headers.get('location');
  const code = extractCodeFromLocation(callbackLocation);
  if (!code) {
    throw new NotFoundError(
      'Thuisbezorgd OTP flow did not yield an authorization code',
      'AUTH_INVALID',
    );
  }

  const tokenRes = await fetch(`${AUTH_BASE}/connect/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: pending.code_verifier,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
    }).toString(),
  });
  if (!tokenRes.ok) {
    throw new NotFoundError(
      `Thuisbezorgd token exchange failed: ${tokenRes.status}`,
      'AUTH_INVALID',
    );
  }

  const tokenJson = (await tokenRes.json()) as TokenResponse;
  const claims = decodeJwtPayload(tokenJson.access_token);
  return {
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + tokenJson.expires_in,
    user_id:
      readStringClaim(claims, 'user_id') ??
      readStringClaim(claims, 'customer_id') ??
      readStringClaim(claims, 'tkwy_enc_legacy_id') ??
      '',
  };
}

export async function refreshCredentials(
  creds: ThuisbezorgdCredentials,
): Promise<ThuisbezorgdCredentials> {
  const tokenRes = await fetch(`${AUTH_BASE}/connect/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refresh_token,
      client_id: CLIENT_ID,
    }).toString(),
  });
  if (!tokenRes.ok) {
    throw new NotFoundError(
      `Thuisbezorgd refresh failed: ${tokenRes.status}`,
      'AUTH_INVALID',
    );
  }

  const tokenJson = (await tokenRes.json()) as TokenResponse;
  return {
    ...creds,
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + tokenJson.expires_in,
  };
}

async function authRequest(
  url: string,
  init: {
    method: 'GET' | 'POST';
    headers?: HeadersInit;
    body?: string;
    redirect?: 'follow' | 'manual';
  },
  jar: Record<string, string>,
) {
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  const cookie = serializeCookieJar(jar);
  if (cookie) {
    headers.cookie = cookie;
  }

  const res = await fetch(url, {
    method: init.method,
    headers,
    body: init.body,
    redirect: init.redirect ?? 'follow',
  });
  const rawHeaders = res.headers.raw()['set-cookie'] ?? [];
  for (const header of rawHeaders) {
    const [cookiePair] = header.split(';');
    const eqIdx = cookiePair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = cookiePair.slice(0, eqIdx);
    const value = cookiePair.slice(eqIdx + 1);
    jar[key] = value;
  }
  return res;
}

function jsonHeaders(jar: Record<string, string>): HeadersInit {
  const cookie = serializeCookieJar(jar);
  return {
    'content-type': 'application/json',
    accept: 'application/json, text/plain, */*',
    'x-requested-with': 'XMLHttpRequest',
    ...(cookie ? { cookie } : {}),
  };
}

function serializeCookieJar(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function toBase64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function extractCodeFromLocation(location: string | null): string | null {
  if (!location) return null;
  try {
    const url = new URL(location, AUTH_BASE);
    return url.searchParams.get('code');
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const normalized = padded.padEnd(Math.ceil(padded.length / 4) * 4, '=');
  return JSON.parse(Buffer.from(normalized, 'base64').toString('utf-8')) as Record<string, unknown>;
}

function readStringClaim(
  claims: Record<string, unknown>,
  key: string,
): string | null {
  const value = claims[key];
  return typeof value === 'string' ? value : null;
}
