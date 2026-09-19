/**
 * Compare two secrets without leaking their contents through timing.
 *
 * A naive `===` returns as soon as two bytes differ, so an attacker can
 * recover a key one character at a time by measuring how long the answer
 * takes. This always walks the full length of both inputs.
 *
 * Plain TypeScript on purpose: it runs in Route Handlers but the rule is not
 * tied to Node, and `src/lib` has to stay runtime-agnostic.
 */
export function equalsConstantTime(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  let mismatch = left.length ^ right.length
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) {
    mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0)
  }
  return mismatch === 0
}
