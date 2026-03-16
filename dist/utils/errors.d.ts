export declare class PRLensError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare class ProviderError extends PRLensError {
    constructor(provider: string, message: string);
}
export declare class RateLimitError extends PRLensError {
    retryAfter?: number | undefined;
    constructor(retryAfter?: number | undefined);
}
//# sourceMappingURL=errors.d.ts.map