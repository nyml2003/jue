import { traceResourceEvent, type DevTraceCollector } from "@jue/devtrace";
import { beginResourceRequest, commitResourceError, commitResourceValue, createResourceState } from "@jue/runtime-core";
import { Lane, ResourceStatus, err, ok, type Result } from "@jue/shared";

export type QueryKey = readonly unknown[];

export interface QueryError {
  readonly code: string;
  readonly message: string;
}

export interface QueryHandle<T> {
  key(): QueryKey;
  status(): ResourceStatus;
  value(): T | null;
  error(): unknown;
  isStale(): boolean;
  reload(): Promise<Result<T, QueryError>>;
  preload(): Promise<Result<T, QueryError>>;
  invalidate(): void;
}

export interface QueryClient {
  createQuery<T>(options: CreateQueryOptions<T>): QueryHandle<T>;
  invalidateQuery(key: QueryKey): boolean;
  preloadQuery<T>(key: QueryKey): Promise<Result<T, QueryError>>;
}

export interface QueryClientOptions {
  readonly trace?: DevTraceCollector;
}

export interface CreateQueryOptions<T> {
  readonly key: QueryKey;
  readonly load: (key: QueryKey) => Promise<T>;
  readonly lane?: Lane;
  readonly staleTime?: number;
}

interface QueryEntry<T> {
  readonly key: QueryKey;
  readonly load: (key: QueryKey) => Promise<T>;
  readonly lane: Lane;
  readonly staleTime: number;
  readonly state: ReturnType<typeof createResourceState>;
  updatedAt: number;
  stale: boolean;
}

export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  const entries = new Map<string, QueryEntry<unknown>>();

  const loadEntry = async <T>(entry: QueryEntry<T>): Promise<Result<T, QueryError>> => {
    const version = beginResourceRequest(entry.state, 0, entry.lane);
    if (!version.ok) {
      return err(version.error);
    }

    if (options.trace) {
      traceResourceEvent(options.trace, 0, entry.lane, "pending");
    }

    try {
      const value = await entry.load(entry.key);
      const committed = commitResourceValue(entry.state, 0, version.value, value);
      if (!committed.ok) {
        return err(committed.error);
      }

      entry.updatedAt = Date.now();
      entry.stale = false;
      if (options.trace) {
        traceResourceEvent(options.trace, 0, entry.lane, "ready");
      }
      return ok(value);
    } catch (errorValue) {
      const committed = commitResourceError(entry.state, 0, version.value, errorValue);
      if (!committed.ok) {
        return err(committed.error);
      }

      if (options.trace) {
        traceResourceEvent(options.trace, 0, entry.lane, "error");
      }

      return err({
        code: "QUERY_LOAD_FAILED",
        message: errorValue instanceof Error ? errorValue.message : String(errorValue)
      });
    }
  };

  return {
    createQuery<T>(options: CreateQueryOptions<T>): QueryHandle<T> {
      const key = serializeQueryKey(options.key);
      const existing = entries.get(key) as QueryEntry<T> | undefined;
      const entry = existing ?? {
        key: options.key,
        load: options.load,
        lane: options.lane ?? Lane.VISIBLE_UPDATE,
        staleTime: options.staleTime ?? 0,
        state: createResourceState(1),
        updatedAt: 0,
        stale: true
      };

      entries.set(key, entry);

      return {
        key() {
          return entry.key;
        },
        status() {
          return (entry.state.status[0] ?? ResourceStatus.IDLE) as ResourceStatus;
        },
        value() {
          return (entry.state.valueRef[0] ?? null) as T | null;
        },
        error() {
          return entry.state.errorRef[0];
        },
        isStale() {
          return entry.stale || (entry.staleTime > 0 && (Date.now() - entry.updatedAt) > entry.staleTime);
        },
        reload() {
          return loadEntry(entry);
        },
        preload() {
          if (!this.isStale() && this.status() === ResourceStatus.READY) {
            return Promise.resolve(ok(this.value() as T));
          }

          return loadEntry(entry);
        },
        invalidate() {
          entry.stale = true;
        }
      };
    },
    invalidateQuery(key) {
      const entry = entries.get(serializeQueryKey(key));
      if (!entry) {
        return false;
      }

      entry.stale = true;
      return true;
    },
    async preloadQuery<T>(key: QueryKey): Promise<Result<T, QueryError>> {
      const entry = entries.get(serializeQueryKey(key)) as QueryEntry<T> | undefined;
      if (!entry) {
        return err({
          code: "QUERY_MISSING",
          message: `Missing query for key ${serializeQueryKey(key)}.`
        });
      }

      return loadEntry(entry);
    }
  };
}

export function createQuery<T>(
  client: QueryClient,
  options: CreateQueryOptions<T>
): QueryHandle<T> {
  return client.createQuery(options);
}

export const query = createQuery;

function serializeQueryKey(key: QueryKey): string {
  return JSON.stringify(key);
}
