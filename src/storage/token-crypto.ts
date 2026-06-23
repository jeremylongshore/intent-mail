/**
 * Token encryption at rest.
 *
 * OAuth access/refresh tokens are the crown jewels of a self-hosted mail MCP:
 * anyone with the SQLite file should NOT get a usable mailbox token. This
 * module encrypts them with AES-256-GCM (authenticated encryption) using
 * Node's built-in crypto — zero native dependencies, works headless.
 *
 * We deliberately do NOT use keytar in the key-resolution chain: it is async
 * (token storage is synchronous) and fails on headless boxes where libsecret
 * is absent (the same problem already hit in src/ai/router.ts). The master key
 * comes from an env var or a 0600 file instead.
 *
 * Master key resolution (first hit wins, cached for the process):
 *   1. INTENTMAIL_MASTER_KEY env — raw 32-byte key (hex/base64) or any
 *      passphrase (scrypt-derived).
 *   2. ~/.config/intentmail/master.key — 32 random bytes (hex), mode 0600,
 *      auto-created on first use.
 *
 * Wire format (per token): `enc:v1:<ivB64url>:<tagB64url>:<ciphertextB64url>`.
 * Values without the `enc:v1:` prefix are treated as plaintext and passed
 * through unchanged, so legacy rows decrypt transparently and can be lazily
 * re-encrypted on next write.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  chmodSync,
} from 'node:fs';

const ENC_PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';
const KEY_LEN = 32; // 256-bit
const IV_LEN = 12; // 96-bit nonce, recommended for GCM
const SCRYPT_SALT = 'intentmail.token-crypto.v1';

let cachedKey: Buffer | null = null;

/**
 * Derive a 32-byte key from an arbitrary env-provided string: use it directly
 * if it decodes to exactly 32 bytes (hex or base64), otherwise scrypt-derive.
 */
function deriveKeyFromString(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  try {
    const b64 = Buffer.from(raw, 'base64');
    if (b64.length === KEY_LEN) return b64;
  } catch {
    // fall through to scrypt
  }
  return scryptSync(raw, SCRYPT_SALT, KEY_LEN);
}

/** Path to the on-disk master key file. */
function keyFilePath(): string {
  const dir =
    process.env.INTENTMAIL_CONFIG_DIR || join(homedir(), '.config', 'intentmail');
  return join(dir, 'master.key');
}

/** Read the key file, or create it (0600) with fresh random bytes. */
function loadOrCreateFileKey(): Buffer {
  const path = keyFilePath();

  if (existsSync(path)) {
    const hex = readFileSync(path, 'utf8').trim();
    const buf = Buffer.from(hex, 'hex');
    if (buf.length === KEY_LEN) {
      return buf;
    }
    // Corrupt/short key file: fail loudly rather than silently rotating and
    // orphaning existing ciphertext.
    throw new Error(
      `Master key file ${path} is malformed (expected ${KEY_LEN} bytes hex). Refusing to overwrite.`
    );
  }

  const dir = join(path, '..');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const key = randomBytes(KEY_LEN);
  writeFileSync(path, key.toString('hex'), { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // best-effort on platforms without chmod semantics
  }
  return key;
}

/**
 * Resolve (and cache) the process master key.
 */
export function getMasterKey(): Buffer {
  if (cachedKey) return cachedKey;

  const env = process.env.INTENTMAIL_MASTER_KEY;
  if (env && env.trim()) {
    cachedKey = deriveKeyFromString(env.trim());
    return cachedKey;
  }

  cachedKey = loadOrCreateFileKey();
  return cachedKey;
}

/** Reset the cached key (tests only). */
export function _resetMasterKeyCache(): void {
  cachedKey = null;
}

/** True if the value is an intentmail-encrypted token. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

/**
 * Encrypt a token string. Idempotent-safe: already-encrypted values are
 * returned unchanged so double-encryption cannot happen.
 */
export function encryptToken(plaintext: string): string {
  if (isEncrypted(plaintext)) return plaintext;

  const key = getMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENC_PREFIX + iv.toString('base64url'),
    tag.toString('base64url'),
    ct.toString('base64url'),
  ].join(':');
}

/**
 * Decrypt a token string. Plaintext (no `enc:v1:` prefix) passes through
 * unchanged, enabling transparent reads of legacy rows.
 */
export function decryptToken(value: string): string {
  if (!isEncrypted(value)) return value;

  const rest = value.slice(ENC_PREFIX.length);
  const parts = rest.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted token (expected iv:tag:ciphertext)');
  }
  const [ivB64, tagB64, ctB64] = parts;

  const key = getMasterKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64url')),
    decipher.final(),
  ]);
  return pt.toString('utf8');
}

/** Encrypt a possibly-null DB value (null/empty normalize to null). */
export function encryptNullable(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  return encryptToken(value);
}

/** Decrypt a possibly-null DB value (null/empty normalize to null). */
export function decryptNullable(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  return decryptToken(value);
}
