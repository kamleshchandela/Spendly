/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import * as Crypto from 'expo-crypto';

export interface EncryptedBackupEnvelope {
  encrypted: true;
  algorithm: 'SHA256-CHACHA20-HMAC';
  version: number;
  salt: string;
  iv: string;
  hmac: string;
  ciphertext: string;
}

export const isEncryptedBackup = (value: unknown): value is EncryptedBackupEnvelope => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.encrypted === true &&
    typeof obj.salt === 'string' &&
    typeof obj.iv === 'string' &&
    typeof obj.hmac === 'string' &&
    typeof obj.ciphertext === 'string'
  );
};

// Pure-JS UTF-8 helpers (works identically on Hermes, JSC, and Web)
const stringToUtf8Bytes = (str: string): Uint8Array => {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let codePoint = str.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = ((codePoint - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
        i++;
      }
    }
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
};

const utf8BytesToString = (bytes: Uint8Array): string => {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 0x80) {
      result += String.fromCharCode(b0);
    } else if (b0 >= 0xc0 && b0 < 0xe0) {
      const b1 = bytes[i++] & 0x3f;
      result += String.fromCharCode(((b0 & 0x1f) << 6) | b1);
    } else if (b0 >= 0xe0 && b0 < 0xf0) {
      const b1 = bytes[i++] & 0x3f;
      const b2 = bytes[i++] & 0x3f;
      result += String.fromCharCode(((b0 & 0x0f) << 12) | (b1 << 6) | b2);
    } else {
      const b1 = bytes[i++] & 0x3f;
      const b2 = bytes[i++] & 0x3f;
      const b3 = bytes[i++] & 0x3f;
      const cp = (((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | b3) - 0x10000;
      result += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return result;
};

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const bytesToBase64 = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += BASE64_CHARS[(triple >> 18) & 0x3f];
    out += BASE64_CHARS[(triple >> 12) & 0x3f];
    out += i + 1 < bytes.length ? BASE64_CHARS[(triple >> 6) & 0x3f] : '=';
    out += i + 2 < bytes.length ? BASE64_CHARS[triple & 0x3f] : '=';
  }
  return out;
};

const base64ToBytes = (base64: string): Uint8Array => {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const outLen = Math.floor((clean.length * 3) / 4) - padding;
  const out = new Uint8Array(outLen);
  let outIdx = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_CHARS.indexOf(clean[i]);
    const c1 = BASE64_CHARS.indexOf(clean[i + 1]);
    const c2 = clean[i + 2] === '=' ? 0 : BASE64_CHARS.indexOf(clean[i + 2]);
    const c3 = clean[i + 3] === '=' ? 0 : BASE64_CHARS.indexOf(clean[i + 3]);
    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;

    if (outIdx < outLen) out[outIdx++] = (triple >> 16) & 0xff;
    if (outIdx < outLen) out[outIdx++] = (triple >> 8) & 0xff;
    if (outIdx < outLen) out[outIdx++] = triple & 0xff;
  }
  return out;
};

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const hexToBytes = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

// RFC 8439 ChaCha20 quarter round and block function
const rotl32 = (v: number, c: number): number => ((v << c) | (v >>> (32 - c))) >>> 0;

const quarterRound = (s: Uint32Array, a: number, b: number, c: number, d: number): void => {
  s[a] = (s[a] + s[b]) >>> 0;
  s[d] = rotl32(s[d] ^ s[a], 16);
  s[c] = (s[c] + s[d]) >>> 0;
  s[b] = rotl32(s[b] ^ s[c], 12);
  s[a] = (s[a] + s[b]) >>> 0;
  s[d] = rotl32(s[d] ^ s[a], 8);
  s[c] = (s[c] + s[d]) >>> 0;
  s[b] = rotl32(s[b] ^ s[c], 7);
};

const readU32LE = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>>
  0;

const chacha20Xor = (key32: Uint8Array, nonce12: Uint8Array, input: Uint8Array): Uint8Array => {
  const output = new Uint8Array(input.length);
  const constants = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];
  const initialState = new Uint32Array(16);
  initialState[0] = constants[0];
  initialState[1] = constants[1];
  initialState[2] = constants[2];
  initialState[3] = constants[3];
  for (let i = 0; i < 8; i++) {
    initialState[4 + i] = readU32LE(key32, i * 4);
  }
  initialState[12] = 1; // block counter
  initialState[13] = readU32LE(nonce12, 0);
  initialState[14] = readU32LE(nonce12, 4);
  initialState[15] = readU32LE(nonce12, 8);

  const working = new Uint32Array(16);
  const keystreamBlock = new Uint8Array(64);

  for (let offset = 0; offset < input.length; offset += 64) {
    working.set(initialState);
    for (let round = 0; round < 10; round++) {
      quarterRound(working, 0, 4, 8, 12);
      quarterRound(working, 1, 5, 9, 13);
      quarterRound(working, 2, 6, 10, 14);
      quarterRound(working, 3, 7, 11, 15);
      quarterRound(working, 0, 5, 10, 15);
      quarterRound(working, 1, 6, 11, 12);
      quarterRound(working, 2, 7, 8, 13);
      quarterRound(working, 3, 4, 9, 14);
    }

    for (let i = 0; i < 16; i++) {
      const word = (working[i] + initialState[i]) >>> 0;
      keystreamBlock[i * 4] = word & 0xff;
      keystreamBlock[i * 4 + 1] = (word >>> 8) & 0xff;
      keystreamBlock[i * 4 + 2] = (word >>> 16) & 0xff;
      keystreamBlock[i * 4 + 3] = (word >>> 24) & 0xff;
    }

    const blockLen = Math.min(64, input.length - offset);
    for (let i = 0; i < blockLen; i++) {
      output[offset + i] = input[offset + i] ^ keystreamBlock[i];
    }

    initialState[12] = (initialState[12] + 1) >>> 0;
  }

  return output;
};

const sha256Hex = (input: string): Promise<string> =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);

const deriveKeys = async (
  password: string,
  saltHex: string,
  ivHex: string
): Promise<{ encKey: Uint8Array; authKeyHex: string }> => {
  let stretched = await sha256Hex(`spendly-kdf-v1:${saltHex}:${password}`);
  for (let i = 0; i < 32; i++) {
    stretched = await sha256Hex(`${stretched}:${saltHex}:${password}:${i}`);
  }
  const encKeyHex = await sha256Hex(`enc:${stretched}:${ivHex}`);
  const authKeyHex = await sha256Hex(`auth:${stretched}:${saltHex}`);
  return { encKey: hexToBytes(encKeyHex), authKeyHex };
};

export const encryptBackupString = async (
  plaintext: string,
  password: string
): Promise<EncryptedBackupEnvelope> => {
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const ivBytes = await Crypto.getRandomBytesAsync(12);
  const salt = bytesToHex(saltBytes);
  const iv = bytesToHex(ivBytes);

  const { encKey, authKeyHex } = await deriveKeys(password, salt, iv);
  const plaintextBytes = stringToUtf8Bytes(plaintext);
  const cipherBytes = chacha20Xor(encKey, ivBytes, plaintextBytes);
  const ciphertext = bytesToBase64(cipherBytes);

  const hmac = await sha256Hex(`${authKeyHex}:${salt}:${iv}:${ciphertext}`);

  return {
    encrypted: true,
    algorithm: 'SHA256-CHACHA20-HMAC',
    version: 1,
    salt,
    iv,
    hmac,
    ciphertext,
  };
};

export const decryptBackupString = async (
  envelope: EncryptedBackupEnvelope,
  password: string
): Promise<string> => {
  const { encKey, authKeyHex } = await deriveKeys(password, envelope.salt, envelope.iv);
  const expectedHmac = await sha256Hex(
    `${authKeyHex}:${envelope.salt}:${envelope.iv}:${envelope.ciphertext}`
  );

  if (expectedHmac.toLowerCase() !== envelope.hmac.toLowerCase()) {
    throw new Error('Incorrect password. Please try again.');
  }

  const ivBytes = hexToBytes(envelope.iv);
  const cipherBytes = base64ToBytes(envelope.ciphertext);
  const plainBytes = chacha20Xor(encKey, ivBytes, cipherBytes);
  return utf8BytesToString(plainBytes);
};
