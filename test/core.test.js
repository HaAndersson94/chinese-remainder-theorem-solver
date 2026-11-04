import test from 'node:test';
import assert from 'node:assert/strict';

import { solve, solvePair, gcd, lcm, modInverse, validateSystem } from '../src/index.js';

test('gcd handles zero and negative inputs', () => {
  assert.equal(gcd(0n, 5n), 5n);
  assert.equal(gcd(5n, 0n), 5n);
  assert.equal(gcd(0n, 0n), 0n);
  assert.equal(gcd(-12n, 18n), 6n);
});

test('lcm returns zero when either operand is zero', () => {
  assert.equal(lcm(0n, 7n), 0n);
  assert.equal(lcm(7n, 0n), 0n);
  assert.equal(lcm(4n, 6n), 12n);
});

test('modInverse finds the inverse in range', () => {
  assert.equal(modInverse(3n, 11n), 4n);
  assert.equal(modInverse(10n, 17n), 12n);
  assert.equal(modInverse(-1n, 5n), 4n);
});

test('modInverse rejects non-coprime input', () => {
  assert.throws(() => modInverse(6n, 9n), RangeError);
});

test('modInverse rejects non-positive modulus', () => {
  assert.throws(() => modInverse(3n, 0n), RangeError);
});

test('solvePair combines two congruences', () => {
  const result = solvePair(2n, 3n, 3n, 5n);
  assert.deepEqual(result, { remainder: 8n, modulus: 15n });
  assert.equal(result.remainder % 3n, 2n);
  assert.equal(result.remainder % 5n, 3n);
});

test('solvePair rejects non-coprime moduli', () => {
  assert.throws(() => solvePair(1n, 4n, 2n, 6n), RangeError);
});

test('solve handles the classic Sunzi system', () => {
  const result = solve([
    { remainder: 2, modulus: 3 },
    { remainder: 3, modulus: 5 },
    { remainder: 2, modulus: 7 },
  ]);
  assert.deepEqual(result, { remainder: 23n, modulus: 105n });
});

test('solve normalises negative remainders', () => {
  const result = solve([
    { remainder: -1, modulus: 5 },
    { remainder: 1, modulus: 7 },
  ]);
  assert.deepEqual(result, { remainder: 29n, modulus: 35n });
  assert.equal(result.remainder % 5n, 4n);
  assert.equal(result.remainder % 7n, 1n);
});

test('solve accepts a single congruence', () => {
  const result = solve([{ remainder: 7, modulus: 11 }]);
  assert.deepEqual(result, { remainder: 7n, modulus: 11n });
});

test('solve uses BigInt and avoids precision loss', () => {
  const result = solve([
    { remainder: 1n, modulus: 4294967291n },
    { remainder: 2n, modulus: 4294967279n },
  ]);
  assert.equal(result.remainder % 4294967291n, 1n);
  assert.equal(result.remainder % 4294967279n, 2n);
  assert.equal(result.modulus, 4294967291n * 4294967279n);
});

test('solve rejects an empty system', () => {
  assert.throws(() => solve([]), RangeError);
});

test('solve rejects non-coprime moduli', () => {
  assert.throws(() => solve([
    { remainder: 1, modulus: 4 },
    { remainder: 2, modulus: 6 },
  ]), RangeError);
});

test('solve rejects a non-positive modulus', () => {
  assert.throws(() => solve([{ remainder: 1, modulus: 0 }]), RangeError);
});

test('solve rejects non-integer values', () => {
  assert.throws(() => solve([{ remainder: 1.5, modulus: 3 }]), RangeError);
});

test('validateSystem reports coprime false with a reason', () => {
  const check = validateSystem([
    { remainder: 1, modulus: 4 },
    { remainder: 2, modulus: 6 },
  ]);
  assert.equal(check.ok, false);
  assert.equal(check.coprime, false);
  assert.match(check.reason, /not coprime/);
});

test('validateSystem reports product for a valid system', () => {
  const check = validateSystem([
    { remainder: 1, modulus: 3 },
    { remainder: 2, modulus: 5 },
  ]);
  assert.equal(check.ok, true);
  assert.equal(check.coprime, true);
  assert.equal(check.product, 15n);
  assert.equal(check.reason, null);
});
