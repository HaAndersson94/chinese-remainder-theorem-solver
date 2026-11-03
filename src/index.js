/**
 * Public entry point for chinese-remainder-theorem-solver.
 *
 * Re-exports the solver surface so consumers can import from the package
 * root without reaching into internal modules.
 */

export { solve, solvePair, gcd, lcm, modInverse, validateSystem } from './core.js';
