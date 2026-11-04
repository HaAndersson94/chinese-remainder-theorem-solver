# chinese-remainder-theorem-solver

Solves a system of simultaneous modular congruences with pairwise coprime moduli and returns the unique solution modulo the product of those moduli.

```js
import { solve } from 'chinese-remainder-theorem-solver';

const { remainder, modulus } = solve([
  { remainder: 2, modulus: 3 },
  { remainder: 3, modulus: 5 },
  { remainder: 2, modulus: 7 },
]);

console.log(remainder); // 23n
console.log(modulus);   // 105n
```

The exported surface is `solve`, `solvePair`, `gcd`, `lcm`, `modInverse`, and `validateSystem`.

## Why this exists

A CRT solver is small enough to inline and easy enough to get subtly wrong. The usual failure mode is precision: the solution is bounded by the product of the moduli, and a system of a few 32-bit moduli already exceeds `Number.MAX_SAFE_INTEGER`. This library does all arithmetic in `BigInt` and returns `BigInt`, so the answer is exact for any input that fits in memory.

The trade-off is the contract. This solver only accepts pairwise coprime moduli. Generalising to arbitrary moduli means detecting when a system is inconsistent and merging congruences incrementally; that changes the return type (a system may have zero or many solutions) and the failure modes. Rather than paper over that, the library rejects non-coprime input with a `RangeError` and exposes `validateSystem` so callers can pre-flight untrusted systems without catching exceptions.

## The awkward edge

The public API accepts `number` or `bigint` for remainders and moduli, but always returns `bigint`. This is deliberate: JavaScript throws when you mix the two in arithmetic, so accepting both on the way in and normalising to one on the way out keeps the contract honest. If you pass a plain `number` that is not a safe integer, the library throws rather than silently rounding. Pass a `bigint` for large values.

Remainders are normalised into `[0, modulus)` before solving, so negative remainders such as `-1` are accepted and interpreted in the usual modular sense.

## API

- `solve(system)` — solve an array of `{ remainder, modulus }` entries. Returns `{ remainder: bigint, modulus: bigint }`. Throws `RangeError` for an empty system, a non-positive modulus, non-coprime moduli, or out-of-range numbers; throws `TypeError` for non-integer or non-numeric values.
- `solvePair(r1, m1, r2, m2)` — solve a two-congruence system directly. Returns `{ remainder: bigint, modulus: bigint }`.
- `gcd(a, b)` — greatest common divisor of two `bigint` values.
- `lcm(a, b)` — least common multiple of two `bigint` values.
- `modInverse(a, m)` — inverse of `a` modulo `m` in `[0, m)`. Throws `RangeError` when no inverse exists.
- `validateSystem(system)` — returns `{ ok, coprime, product, reason }` without throwing.
