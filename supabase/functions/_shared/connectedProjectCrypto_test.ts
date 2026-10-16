import { decryptConnectedProjectSecret } from './connectedProjectCrypto.ts';

function encodeBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return new Uint8Array(value).buffer as ArrayBuffer;
}

function encodeBase64Url(bytes: Uint8Array): string {
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function encrypt(plaintext: string, keyBytes: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), 'AES-GCM', false, ['encrypt']);
  return new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv), tagLength: 128 },
    key,
    toArrayBuffer(new TextEncoder().encode(plaintext)),
  ));
}

Deno.test('decrypts the versioned server AES-GCM format', async () => {
  const key = Uint8Array.from({ length: 32 }, (_, index) => index);
  const iv = Uint8Array.from({ length: 12 }, (_, index) => index + 32);
  const encrypted = await encrypt('publishable-key', key, iv);
  const body = encrypted.slice(0, -16);
  const tag = encrypted.slice(-16);
  const serialized = `v1.${encodeBase64Url(iv)}.${encodeBase64Url(tag)}.${encodeBase64Url(body)}`;

  const plaintext = await decryptConnectedProjectSecret(serialized, encodeBase64(key));
  if (plaintext !== 'publishable-key') throw new Error('Versioned credential did not decrypt correctly.');
});

Deno.test('continues to decrypt the legacy packed AES-GCM format', async () => {
  const key = Uint8Array.from({ length: 32 }, (_, index) => 63 - index);
  const iv = Uint8Array.from({ length: 12 }, (_, index) => index + 8);
  const encrypted = await encrypt('legacy-secret', key, iv);
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv, 0);
  packed.set(encrypted, iv.length);

  const plaintext = await decryptConnectedProjectSecret(encodeBase64(packed), encodeBase64(key));
  if (plaintext !== 'legacy-secret') throw new Error('Legacy credential did not decrypt correctly.');
});
