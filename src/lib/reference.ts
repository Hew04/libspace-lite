import { randomInt } from "node:crypto";
import { REFERENCE_PREFIX } from "./config";

// No 0/O, 1/I/L — easy to read aloud and type from a phone screen.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** e.g. "LS-7K3QXM". 31^6 ≈ 887 million combinations; uniqueness is enforced by the DB. */
export function generateReference(): string {
  let body = "";
  for (let i = 0; i < 6; i++) body += ALPHABET[randomInt(ALPHABET.length)];
  return REFERENCE_PREFIX + body;
}
