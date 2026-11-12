#!/usr/bin/env node
import { webcrypto } from 'node:crypto';

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run admin:hash -- "your-password"');
  process.exit(1);
}

if (password.length < 12) {
  console.warn(
    'Warning: use at least 12 characters. A long passphrase is better than a short password.',
  );
}

const iterations = Number(process.env.PBKDF2_ITERATIONS || 50_000);
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const key = await webcrypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(password),
  'PBKDF2',
  false,
  ['deriveBits'],
);
const bits = await webcrypto.subtle.deriveBits(
  { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
  key,
  256,
);

const base64 = (bytes) => Buffer.from(bytes).toString('base64');
console.log(
  `pbkdf2-sha256$${iterations}$${base64(salt)}$${base64(
    new Uint8Array(bits),
  )}`,
);
