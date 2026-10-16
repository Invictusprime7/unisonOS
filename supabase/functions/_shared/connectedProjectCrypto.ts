function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function decodeBase64Url(value: string): Uint8Array {
  return decodeBase64(value);
}

function decodeEncryptionKey(value: string): Uint8Array {
  if (/^[a-f0-9]{64}$/i.test(value)) {
    return Uint8Array.from(value.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
  }
  const key = decodeBase64(value);
  if (key.length !== 32) throw new Error('Connected backend encryption key must be 32 bytes.');
  return key;
}

function concatenate(left: Uint8Array, right: Uint8Array): Uint8Array {
  const result = new Uint8Array(left.length + right.length);
  result.set(left, 0);
  result.set(right, left.length);
  return result;
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return new Uint8Array(value).buffer as ArrayBuffer;
}

export async function decryptConnectedProjectSecret(ciphertext: string, keyValue: string): Promise<string> {
  const keyBytes = decodeEncryptionKey(keyValue);
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), 'AES-GCM', false, ['decrypt']);

  let iv: Uint8Array;
  let encrypted: Uint8Array;
  if (ciphertext.startsWith('v1.')) {
    const [version, ivValue, tagValue, bodyValue, extra] = ciphertext.split('.');
    if (version !== 'v1' || !ivValue || !tagValue || !bodyValue || extra !== undefined) {
      throw new Error('Stored connected backend credential has an invalid format.');
    }
    iv = decodeBase64Url(ivValue);
    encrypted = concatenate(decodeBase64Url(bodyValue), decodeBase64Url(tagValue));
  } else {
    const packed = decodeBase64(ciphertext);
    if (packed.length <= 12 + 16) throw new Error('Stored connected backend credential has an invalid format.');
    iv = packed.slice(0, 12);
    encrypted = packed.slice(12);
  }

  if (iv.length !== 12) throw new Error('Stored connected backend credential has an invalid nonce.');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv), tagLength: 128 },
    key,
    toArrayBuffer(encrypted),
  );
  return new TextDecoder().decode(plaintext);
}
