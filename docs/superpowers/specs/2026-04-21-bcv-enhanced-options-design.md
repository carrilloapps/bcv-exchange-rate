# Design Spec: Enhanced BCV Scraping Options (v1.1.0)

**Date:** 2026-04-21  
**Status:** Approved  
**Topic:** Modular filtering, selective loading, and advanced pagination for BCV (Venezuela) exchange rates.

## 1. Overview
The goal is to provide users with fine-grained control over what data they fetch from the Banco Central de Venezuela (BCV). This includes filtering specific currencies (USD, EUR, etc.), toggling between current rates and historical bank data, and optimized pagination for historical records.

## 2. Technical Requirements

### 2.1 API Design (TypeScript)
The `BcvParams` interface will be extended to support selective loading and filtering.

```typescript
export interface BcvParams extends RequestOptions {
    /** 
     * Specific currency code(s) to return (e.g., 'USD' or ['USD', 'EUR']).
     * Defaults to all available if omitted.
     */
    currencies?: string | string[];
    /** Whether to include current rates from the main page. Default: true */
    includeCurrent?: boolean;
    /** Whether to include historical bank rates. Default: true */
    includeHistory?: boolean;
    /** Range of days for historical data. Default: 7 */
    days?: number;
    /** Page number for historical results pagination. Default: 0 */
    page?: number;
}
```

### 2.2 Functional Changes

#### `getBcvRates(params)`
- **Conditional Scraping:** 
    - If `includeCurrent` is `true`, scrape `https://www.bcv.org.ve/`.
    - If `includeHistory` is `true`, scrape `https://www.bcv.org.ve/tasas-informativas-sistema-bancario`.
- **Currency Filtering:** If `currencies` is provided, the `current` object will only contain the requested keys.
- **Optimization:** If `includeCurrent` is `false`, the function skips the main page request entirely.

#### `getBcvHistory(params)` (New Function)
- Specialized function that **only** fetches historical bank rates.
- Returns `Pick<BcvResponse, 'history' | 'pagination'>`.
- Bypasses the main BCV home page to save bandwidth and time.

### 2.3 Observability (Logging)
- Ensure the `logger` parameter in `RequestOptions` is fully respected.
- Users can pass a custom `winston` instance or a compatible object with `info`, `debug`, `warn`, `error` methods.
- Detailed logs for when a request is skipped due to `includeCurrent: false` or `includeHistory: false`.

## 3. Documentation (es_VE)
The `README.md` will be updated with clear, localized examples:

### Examples to Include:
- **Solo USD:** `getBcvRates({ currencies: 'USD', includeHistory: false })`.
- **Historial Puro:** `getBcvHistory({ days: 30, page: 2 })`.
- **Personalización de Log:** Inyectando un logger propio.

## 4. Test Strategy
- **100% Coverage:** Use `axios-mock-adapter` to simulate different scraping scenarios (only home, only history, filtered currencies).
- **Validation:** Verify that requesting a non-existent currency returns an empty object or omits the key.
- **Pagination:** Verify `hasNextPage` logic in both `getBcvRates` and `getBcvHistory`.

## 5. Self-Review Checklist
1. **Placeholder Scan:** No "TBD" or "TODO" items.
2. **Consistency:** Property names match the previously established `en_US` standard (`current`, `history`).
3. **Scope:** Focused on BCV enhancements.
4. **Ambiguity:** `currencies` handling (string vs array) is explicitly defined.
