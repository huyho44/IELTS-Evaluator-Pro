import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, originalKeyHex] = parts;
  const derivedKey = scryptSync(password, salt, 64);
  const originalKey = Buffer.from(originalKeyHex, 'hex');
  if (derivedKey.length !== originalKey.length) {
    return false;
  }
  return timingSafeEqual(derivedKey, originalKey);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function newRefreshToken(): string {
  return randomBytes(32).toString('hex');
}
