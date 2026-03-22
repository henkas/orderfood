import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { machineIdSync } from 'node-machine-id';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface UberEatsCredentials {
  access_token: string;   // unused for cookie-based auth, kept for interface compat
  refresh_token: string;
  expires_at: string;     // ISO 8601
  cookies: Record<string, string>;
}

interface StoredCredentials {
  iv: string;
  ciphertext: string;
  user_id: string;
}

const PLATFORM = 'ubereats';
const SALT = 'orderfood-v1';

function deriveKey(): Buffer {
  const machineId = machineIdSync(true); // raw hex
  // HKDF-SHA256: extract step (HMAC-SHA256(salt, IKM))
  const prk = createHash('sha256')
    .update(Buffer.from(SALT))
    .update(Buffer.from(machineId, 'hex'))
    .digest();
  // expand step (HMAC-SHA256(prk, info || 0x01))
  const info = Buffer.from(PLATFORM);
  const okm = createHash('sha256')
    .update(prk)
    .update(info)
    .update(Buffer.from([0x01]))
    .digest();
  return okm.slice(0, 32);
}

export async function encryptCredentials(creds: UberEatsCredentials): Promise<StoredCredentials> {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(creds));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: Buffer.concat([encrypted, tag]).toString('base64'),
    user_id: '',
  };
}

export async function decryptCredentials(stored: StoredCredentials): Promise<UberEatsCredentials> {
  const key = deriveKey();
  const iv = Buffer.from(stored.iv, 'base64');
  const buf = Buffer.from(stored.ciphertext, 'base64');
  const tag = buf.slice(buf.length - 16);
  const ciphertext = buf.slice(0, buf.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString()) as UberEatsCredentials;
}

function credentialsPath(): string {
  return join(homedir(), '.orderfood', `${PLATFORM}.json`);
}

export async function loadCredentials(): Promise<UberEatsCredentials> {
  const stored: StoredCredentials = JSON.parse(await readFile(credentialsPath(), 'utf-8'));
  return decryptCredentials(stored);
}

export async function saveCredentials(creds: UberEatsCredentials): Promise<void> {
  const path = credentialsPath();
  await mkdir(join(homedir(), '.orderfood'), { recursive: true });
  const stored = await encryptCredentials(creds);
  await writeFile(path, JSON.stringify(stored, null, 2), 'utf-8');
}

export function isCookiesExpired(creds: UberEatsCredentials): boolean {
  // UberEats session cookies don't have a predictable expiry — check expires_at
  return new Date(creds.expires_at) <= new Date(Date.now() + 60_000);
}
