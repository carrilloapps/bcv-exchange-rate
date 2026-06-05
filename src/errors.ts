/**
 * Typed error hierarchy. Every error raised by the library extends
 * `BcvExchangeError` and preserves the original failure in `cause`,
 * so consumers can branch on error type and still inspect the root cause.
 */

/** Base class for all library errors. */
export class BcvExchangeError extends Error {
    public override readonly cause?: unknown;
    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = this.constructor.name;
        this.cause = cause;
    }
}

/** Network-level failures (timeouts, DNS, TLS, 5xx after retries). */
export class NetworkError extends BcvExchangeError {}

/** HTML parsing failures (unexpected document shape). */
export class ParseError extends BcvExchangeError {}

/** Input validation failures. */
export class ValidationError extends BcvExchangeError {}

/** Raised exclusively by `getTrmRates` when the Colombia API responds with an error. */
export class TrmApiError extends BcvExchangeError {}

/** Raised exclusively by `getBrlRates` when the Banco Central do Brasil API responds with an error. */
export class BrlApiError extends BcvExchangeError {}
