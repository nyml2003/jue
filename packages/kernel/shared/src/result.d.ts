export type Result<T, E> = {
    ok: true;
    value: T;
    error: null;
} | {
    ok: false;
    value: null;
    error: E;
};
export declare function ok<T>(value: T): Result<T, never>;
export declare function err<E>(error: E): Result<never, E>;
//# sourceMappingURL=result.d.ts.map