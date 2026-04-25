import {
  beginResourceRequest,
  commitResourceError,
  commitResourceValue,
  createResourceState,
  publishChannel,
  subscribeChannel,
  type Channel,
  type ChannelMessage,
  type ResourceState
} from "@jue/runtime-core";
import { Lane, ResourceStatus } from "@jue/shared";

export interface StreamSubscription {
  unsubscribe(): void;
}

export interface JueStream<T> {
  subscribe(listener: (value: T) => void): StreamSubscription;
  map<U>(mapper: (value: T) => U): JueStream<U>;
  filter(predicate: (value: T) => boolean): JueStream<T>;
  scan<U>(reducer: (accumulator: U, value: T) => U, seed: U): JueStream<U>;
  distinctUntilChanged(compare?: (left: T, right: T) => boolean): JueStream<T>;
  merge(...streams: readonly JueStream<T>[]): JueStream<T>;
  takeUntil(notifier: JueStream<unknown>): JueStream<T>;
}

export interface StreamController<T> {
  readonly stream: JueStream<T>;
  emit(value: T): void;
}

export interface SignalBridge<T> {
  read(): T;
  write(value: T): void;
  subscribe(listener: (value: T) => void): StreamSubscription;
}

export interface StreamResource<T> {
  readonly state: ResourceState;
  status(): ResourceStatus;
  value(): T | null;
  error(): unknown;
}

export function createStream<T>(): StreamController<T> {
  const listeners = new Set<(value: T) => void>();

  return {
    stream: createJueStream(listener => {
      listeners.add(listener);

      return {
        unsubscribe() {
          listeners.delete(listener);
        }
      };
    }),
    emit(value) {
      for (const listener of listeners) {
        listener(value);
      }
    }
  };
}

export function createSignalBridge<T>(initialValue: T): SignalBridge<T> {
  let current = initialValue;
  const listeners = new Set<(value: T) => void>();

  return {
    read() {
      return current;
    },
    write(value) {
      current = value;
      for (const listener of listeners) {
        listener(value);
      }
    },
    subscribe(listener) {
      listeners.add(listener);

      return {
        unsubscribe() {
          listeners.delete(listener);
        }
      };
    }
  };
}

export function fromSignal<T>(signal: SignalBridge<T>): JueStream<T> {
  return createJueStream(listener => {
    listener(signal.read());
    return signal.subscribe(listener);
  });
}

export function fromChannel<T>(channel: Channel<T>): JueStream<ChannelMessage<T>> {
  return createJueStream(listener => subscribeChannel(channel, listener));
}

export function toSignal<T>(stream: JueStream<T>, signal: SignalBridge<T>): StreamSubscription {
  return stream.subscribe(value => {
    signal.write(value);
  });
}

export function toChannel<T>(
  stream: JueStream<T>,
  channel: Channel<T>,
  lane: Lane = Lane.VISIBLE_UPDATE
): StreamSubscription {
  return stream.subscribe(value => {
    void publishChannel(channel, value, lane);
  });
}

export function toResource<T, U>(
  stream: JueStream<T>,
  options: {
    readonly load: (value: T) => Promise<U>;
    readonly lane?: Lane;
  }
): StreamResource<U> {
  const state = createResourceState(1);
  const lane = options.lane ?? Lane.VISIBLE_UPDATE;

  const handleEmission = async (value: T): Promise<void> => {
    const request = beginResourceRequest(state, 0, lane);
    if (!request.ok) {
      return;
    }

    try {
      const loaded = await options.load(value);
      void commitResourceValue(state, 0, request.value, loaded);
    } catch (errorValue) {
      void commitResourceError(state, 0, request.value, errorValue);
    }
  };

  stream.subscribe(value => {
    void handleEmission(value);
  });

  return {
    state,
    status() {
      return (state.status[0] ?? ResourceStatus.IDLE) as ResourceStatus;
    },
    value() {
      return (state.valueRef[0] ?? null) as U | null;
    },
    error() {
      return state.errorRef[0];
    }
  };
}

export function mergeStreams<T>(...streams: readonly JueStream<T>[]): JueStream<T> {
  return createJueStream(listener => {
    const subscriptions = streams.map(stream => stream.subscribe(listener));

    return {
      unsubscribe() {
        subscriptions.forEach(subscription => subscription.unsubscribe());
      }
    };
  });
}

function createJueStream<T>(
  subscribe: (listener: (value: T) => void) => StreamSubscription
): JueStream<T> {
  return {
    subscribe,
    map<U>(mapper: (value: T) => U): JueStream<U> {
      return createJueStream(listener => subscribe(value => listener(mapper(value))));
    },
    filter(predicate: (value: T) => boolean): JueStream<T> {
      return createJueStream(listener => subscribe(value => {
        if (predicate(value)) {
          listener(value);
        }
      }));
    },
    scan<U>(reducer: (accumulator: U, value: T) => U, seed: U): JueStream<U> {
      return createJueStream(listener => {
        let accumulator = seed;
        return subscribe(value => {
          accumulator = reducer(accumulator, value);
          listener(accumulator);
        });
      });
    },
    distinctUntilChanged(compare: (left: T, right: T) => boolean = Object.is): JueStream<T> {
      return createJueStream(listener => {
        let hasValue = false;
        let previousValue: T | undefined;

        return subscribe(value => {
          if (hasValue && previousValue !== undefined && compare(previousValue, value)) {
            return;
          }

          hasValue = true;
          previousValue = value;
          listener(value);
        });
      });
    },
    merge(...streams: readonly JueStream<T>[]): JueStream<T> {
      return mergeStreams(this, ...streams);
    },
    takeUntil(notifier: JueStream<unknown>): JueStream<T> {
      return createJueStream(listener => {
        let active = true;
        const sourceSubscription = subscribe(value => {
          if (active) {
            listener(value);
          }
        });
        const notifierSubscription = notifier.subscribe(() => {
          active = false;
        });

        return {
          unsubscribe() {
            active = false;
            sourceSubscription.unsubscribe();
            notifierSubscription.unsubscribe();
          }
        };
      });
    }
  };
}
