import { env } from "cloudflare:workers";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getKey() {
  const secret = (env as unknown as Record<string, string | undefined>).FEED_ENCRYPTION_KEY;
  if (!secret) throw new Error("Feed encryption is not configured");
  const raw = base64ToBytes(secret);
  if (raw.byteLength !== 32) throw new Error("Feed encryption key must be 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await getKey(),
    new TextEncoder().encode(value),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(value: string) {
  const [ivPart, cipherPart] = value.split(".");
  if (!ivPart || !cipherPart) throw new Error("Invalid encrypted value");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivPart) },
    await getKey(),
    base64ToBytes(cipherPart),
  );
  return new TextDecoder().decode(plaintext);
}
