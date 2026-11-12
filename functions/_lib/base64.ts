export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function textToBase64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

export function base64ToText(value: string): string {
  return new TextDecoder().decode(base64ToBytes(value.replace(/\s/g, '')));
}

export function approximateBase64Bytes(value: string): number {
  const clean = value.replace(/=+$/, '');
  return Math.floor((clean.length * 3) / 4);
}
