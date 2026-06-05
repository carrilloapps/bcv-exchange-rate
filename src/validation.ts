/**
 * Input validation helpers. Every public parameter is validated before any
 * network request is issued, so invalid input fails fast with a typed
 * `ValidationError`.
 */
import { ValidationError } from './errors';

/** Asserts that `value` is an integer greater than or equal to `min`. */
export function assertPositiveInt(value: unknown, name: string, min: number): void {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
        throw new ValidationError(`Invalid "${name}": expected integer >= ${min}, got ${String(value)}.`);
    }
}

/** Asserts an optional limit between 1 and `max` (inclusive). No-op when `undefined`. */
export function assertLimit(value: number | undefined, max: number): void {
    if (value === undefined) return;
    assertPositiveInt(value, 'limit', 1);
    if (value > max) throw new ValidationError(`Invalid "limit": must be <= ${max}.`);
}
