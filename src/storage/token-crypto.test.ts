/**
 * Tests for token encryption at rest (AES-256-GCM).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encryptToken,
  decryptToken,
  isEncrypted,
  encryptNullable,
  decryptNullable,
  _resetMasterKeyCache,
} from './token-crypto.js';

const TEST_KEY = 'a'.repeat(64); // 32 bytes hex

beforeEach(() => {
  process.env.INTENTMAIL_MASTER_KEY = TEST_KEY;
  _resetMasterKeyCache();
});

afterEach(() => {
  delete process.env.INTENTMAIL_MASTER_KEY;
  _resetMasterKeyCache();
});

describe('encryptToken / decryptToken', () => {
  it('round-trips a token', () => {
    const secret = 'ya29.A0ARrdaM-super-secret-access-token';
    const enc = encryptToken(secret);
    expect(enc).not.toBe(secret);
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptToken(enc)).toBe(secret);
  });

  it('produces the enc:v1: iv:tag:ct shape', () => {
    const enc = encryptToken('hello');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(enc.slice('enc:v1:'.length).split(':')).toHaveLength(3);
  });

  it('uses a fresh IV each time (ciphertexts differ)', () => {
    const a = encryptToken('same');
    const b = encryptToken('same');
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe('same');
    expect(decryptToken(b)).toBe('same');
  });

  it('passes plaintext through decrypt unchanged (lazy migration)', () => {
    expect(decryptToken('legacy-plaintext-token')).toBe('legacy-plaintext-token');
    expect(isEncrypted('legacy-plaintext-token')).toBe(false);
  });

  it('is idempotent: encrypting an already-encrypted value is a no-op', () => {
    const enc = encryptToken('x');
    expect(encryptToken(enc)).toBe(enc);
  });

  it('rejects a tampered ciphertext (GCM auth tag)', () => {
    const enc = encryptToken('secret');
    const parts = enc.split(':'); // ['enc','v1',iv,tag,ct]
    // Flip the last char of the ciphertext segment.
    const ct = parts[4];
    parts[4] = ct.slice(0, -1) + (ct.endsWith('A') ? 'B' : 'A');
    const tampered = parts.join(':');
    expect(() => decryptToken(tampered)).toThrow();
  });

  it('fails to decrypt under a different master key', () => {
    const enc = encryptToken('secret');
    process.env.INTENTMAIL_MASTER_KEY = 'b'.repeat(64);
    _resetMasterKeyCache();
    expect(() => decryptToken(enc)).toThrow();
  });

  it('throws on a malformed encrypted value', () => {
    expect(() => decryptToken('enc:v1:onlytwo:parts')).toThrow();
  });
});

describe('nullable helpers', () => {
  it('encryptNullable passes null/empty through', () => {
    expect(encryptNullable(null)).toBeNull();
    expect(encryptNullable(undefined)).toBeNull();
    expect(encryptNullable('')).toBeNull();
  });

  it('decryptNullable passes null/empty through', () => {
    expect(decryptNullable(null)).toBeNull();
    expect(decryptNullable('')).toBeNull();
  });

  it('encryptNullable then decryptNullable round-trips', () => {
    const enc = encryptNullable('tok');
    expect(enc).not.toBeNull();
    expect(isEncrypted(enc!)).toBe(true);
    expect(decryptNullable(enc)).toBe('tok');
  });
});
