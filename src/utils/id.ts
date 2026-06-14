// Generates a random unique ID using the Web Crypto API.
// Prefer this over Math.random() — crypto.randomUUID() is collision-safe
// and available in all modern browsers and Node 14.17+.
export function generateId(): string {
  return crypto.randomUUID();
}
