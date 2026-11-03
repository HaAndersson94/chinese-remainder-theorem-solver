/**
 * Core arithmetic for solving systems of simultaneous modular congruences
 * via the Chinese Remainder Theorem.
 *
 * Design decision: this library solves systems whose moduli are pairwise
 * coprime. The classical CRT guarantees a unique solution modulo the product
 * of the moduli under that condition. Generalising to non-coprime moduli
 * requires a different algorithm (incremental merging with gcd checks) and
 * a different contract for when no solution exists, so it is deliberately
 * out of scope. Callers who need that should reduce their system first.
 *
 * All arithmetic uses BigInt because JavaScript numbers lose precision well
 * below the products that realistic CRT inputs produce (a handful of moduli
 * around 2**31 already overflow 2**53). Mixing number and BigInt silently
 * throws in JS, so the public API accepts both and normalises to BigInt
 * internally, returning BigInt. This is the one awkward edge callers hit.
 */

/**
 * Greatest common divisor of two non-negative BigInts (Euclid).
 *
 * @param {bigint} a
 * @param {bigint} b
 * @returns {bigint}
 */
export function gcd(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/**
 * Least common multiple of two non-negative BigInts.
 *
 * @param {bigint} a
 * @param {bigint} b
 * @returns {bigint}
 */
export function lcm(a, b) {
  if (a === 0n || b === 0n) return 0n;
  const g = gcd(a, b);
  return (a / g) * b;
}

/**
 * Modular inverse of `a` modulo `m`, using the extended Euclidean algorithm.
 *
 * Throws when the inverse does not exist, i.e. when gcd(a, m) !== 1. We throw
 * rather than return null because a missing inverse almost always indicates a
 * caller mistake (non-coprime modulus), and silently returning a sentinel
 * would push the failure further away from its cause.
 *
 * @param {bigint} a
 * @param {bigint} m must be > 0
 * @returns {bigint} the inverse in [0, m)
 */
export function modInverse(a, m) {
  if (m <= 0n) {
    throw new RangeError('modulus must be positive');
  }
  let old_r = ((a % m) + m) % m;
  let r = m;
  let old_s = 1n;
  let s = 0n;
  while (r !== 0n) {
    const q = old_r / r;
    const tmp_r = old_r - q * r;
    old_r = r;
    r = tmp_r;
    const tmp_s = old_s - q * s;
    old_s = s;
    s = tmp_s;
  }
  if (old_r !== 1n) {
    throw new RangeError('modular inverse does not exist: moduli are not coprime');
  }
  return ((old_s % m) + m) % m;
}

/**
 * Coerce a number or BigInt into a BigInt without silently truncating.
 *
 * @param {number|bigint} value
 * @returns {bigint}
 */
function toBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new TypeError('congruence values must be integers');
    }
    if (!Number.isSafeInteger(value)) {
      throw new RangeError('integer exceeds safe range; pass a BigInt instead');
    }
    return BigInt(value);
  }
  throw new TypeError('congruence values must be numbers or BigInts');
}

/**
 * Validate a system of congruences without solving it.
 *
 * Returns a structured result rather than throwing so callers can pre-flight
 * untrusted input. The `coprime` flag is what the solver actually requires.
 *
 * @param {Array<{remainder: number|bigint, modulus: number|bigint}>} system
 * @returns {{ok: boolean, coprime: boolean, product: bigint, reason: string|null}}
 */
export function validateSystem(system) {
  if (!Array.isArray(system)) {
    return { ok: false, coprime: false, product: 0n, reason: 'system must be an array' };
  }
  if (system.length === 0) {
    return { ok: false, coprime: false, product: 0n, reason: 'system must not be empty' };
  }
  let product = 1n;
  const moduli = [];
  for (let i = 0; i < system.length; i++) {
    const entry = system[i];
    if (entry === null || typeof entry !== 'object') {
      return { ok: false, coprime: false, product: 0n, reason: `entry ${i} is not an object` };
    }
    let r;
    let m;
    try {
      r = toBigInt(entry.remainder);
      m = toBigInt(entry.modulus);
    } catch (err) {
      return { ok: false, coprime: false, product: 0n, reason: `entry ${i}: ${err.message}` };
    }
    if (m <= 0n) {
      return { ok: false, coprime: false, product: 0n, reason: `entry ${i}: modulus must be positive` };
    }
    moduli.push(m);
    product *= m;
  }
  for (let i = 0; i < moduli.length; i++) {
    for (let j = i + 1; j < moduli.length; j++) {
      if (gcd(moduli[i], moduli[j]) !== 1n) {
        return { ok: false, coprime: false, product, reason: `moduli at indices ${i} and ${j} are not coprime` };
      }
    }
  }
  return { ok: true, coprime: true, product, reason: null };
}

/**
 * Solve a two-congruence system.
 *
 * This is the primitive the general solver folds over. It is exported because
 * two-congruence systems are common enough to be worth a direct call, and
 * because exposing it makes the incremental structure of `solve` legible.
 *
 * @param {number|bigint} r1
 * @param {number|bigint} m1
 * @param {number|bigint} r2
 * @param {number|bigint} m2
 * @returns {{remainder: bigint, modulus: bigint}}
 */
export function solvePair(r1, m1, r2, m2) {
  const a1 = toBigInt(r1);
  const n1 = toBigInt(m1);
  const a2 = toBigInt(r2);
  const n2 = toBigInt(m2);
  if (n1 <= 0n || n2 <= 0n) {
    throw new RangeError('moduli must be positive');
  }
  const g = gcd(n1, n2);
  if (g !== 1n) {
    throw new RangeError('moduli must be coprime');
  }
  const modulus = n1 * n2;
  const inv = modInverse(n1, n2);
  // x = a1 + n1 * k, solve a1 + n1*k = a2 (mod n2) => k = (a2 - a1) * inv(n1) (mod n2)
  const k = (((a2 - a1) % n2) * inv) % n2;
  const remainder = (((a1 + n1 * k) % modulus) + modulus) % modulus;
  return { remainder, modulus };
}

/**
 * Solve a system of congruences.
 *
 * @param {Array<{remainder: number|bigint, modulus: number|bigint}>} system
 * @returns {{remainder: bigint, modulus: bigint}} the unique solution in [0, modulus)
 * @throws {TypeError|RangeError} when the system is malformed or not coprime
 */
export function solve(system) {
  const check = validateSystem(system);
  if (!check.ok) {
    throw new RangeError(check.reason);
  }
  let acc = null;
  for (const entry of system) {
    const r = toBigInt(entry.remainder);
    const m = toBigInt(entry.modulus);
    if (acc === null) {
      acc = { remainder: ((r % m) + m) % m, modulus: m };
    } else {
      acc = solvePair(acc.remainder, acc.modulus, r, m);
    }
  }
  return acc;
}
