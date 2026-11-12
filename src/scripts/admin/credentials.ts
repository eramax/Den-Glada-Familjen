const STORAGE_KEY = 'dgf_admin_credentials_v1';
const ITERATIONS = 210_000;

export interface StoredCredentials {
  version: 1;
  username: string;
  repo: string;
  branch: string;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
}

export interface CreateCredentialsInput {
  username: string;
  repo: string;
  branch: string;
  token: string;
  passphrase: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function createCredentials(
  input: CreateCredentialsInput,
): Promise<StoredCredentials> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(input.passphrase, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(input.token),
  );

  return {
    version: 1,
    username: input.username,
    repo: input.repo,
    branch: input.branch,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
    createdAt: new Date().toISOString(),
  };
}

export function saveCredentials(credentials: StoredCredentials): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    throw new Error(
      'تعذّر حفظ الإعداد في هذا المتصفح. تأكد من السماح بالتخزين المحلي.',
    );
  }
}

export function loadCredentials(): StoredCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<StoredCredentials>;
    if (
      data.version !== 1 ||
      typeof data.username !== 'string' ||
      typeof data.repo !== 'string' ||
      typeof data.branch !== 'string' ||
      typeof data.salt !== 'string' ||
      typeof data.iv !== 'string' ||
      typeof data.ciphertext !== 'string'
    ) {
      return null;
    }
    return data as StoredCredentials;
  } catch {
    return null;
  }
}

export function clearCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export async function unlockToken(
  credentials: StoredCredentials,
  passphrase: string,
): Promise<string> {
  const salt = fromBase64(credentials.salt);
  const iv = fromBase64(credentials.iv);
  const key = await deriveKey(passphrase, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      fromBase64(credentials.ciphertext),
    );
    return decoder.decode(decrypted);
  } catch {
    throw new Error('عبارة المرور غير صحيحة.');
  }
}
