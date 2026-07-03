// RFC 4648 Base32 — uppercase alphabet, no padding, no ambiguous chars (0/O, 1/I/L)
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const DECODE_MAP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  DECODE_MAP[ALPHABET[i]] = i;
}

export function base32Encode(buf: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += ALPHABET[(value >> bits) & 31];
    }
  }

  if (bits > 0) {
    result += ALPHABET[(value << (5 - bits)) & 31];
  }

  return result;
}

export function base32Decode(str: string): Buffer {
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of str.toUpperCase()) {
    const charVal = DECODE_MAP[char];
    if (charVal === undefined) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }
    value = (value << 5) | charVal;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >> bits) & 255);
    }
  }

  return Buffer.from(output);
}
