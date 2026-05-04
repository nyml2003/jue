export type Result<T, E> =
  | {
      ok: true;
      value: T;
      error: null;
    }
  | {
      ok: false;
      value: null;
      error: E;
    };

export function ok<T>(value: T): Result<T, never> {
  return {
    ok: true,
    value,
    error: null
  };
}

export function err<E>(error: E): Result<never, E> {
  return {
    ok: false,
    value: null,
    error
  };
}
