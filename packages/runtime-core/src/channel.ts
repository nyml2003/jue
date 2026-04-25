import { Lane, err, ok, type Result } from "@jue/shared";

export interface ChannelMessage<T> {
  readonly lane: Lane;
  readonly value: T;
  readonly version: number;
}

export interface Channel<T> {
  readonly name: string;
  version: number;
  readonly queue: ChannelMessage<T>[];
  readonly subscribers: Set<(message: ChannelMessage<T>) => void>;
}

export interface ChannelError {
  readonly code: string;
  readonly message: string;
}

export interface ChannelSubscription {
  unsubscribe(): void;
}

export function createChannel<T>(name: string): Channel<T> {
  return {
    name,
    version: 0,
    queue: [],
    subscribers: new Set()
  };
}

export function publishChannel<T>(
  channel: Channel<T>,
  value: T,
  lane: Lane = Lane.VISIBLE_UPDATE
): Result<ChannelMessage<T>, ChannelError> {
  if (channel.name.length === 0) {
    return err({
      code: "CHANNEL_NAME_MISSING",
      message: "Channel name must not be empty."
    });
  }

  const message: ChannelMessage<T> = {
    lane,
    value,
    version: channel.version + 1
  };

  channel.version = message.version;
  channel.queue.push(message);

  for (const subscriber of channel.subscribers) {
    subscriber(message);
  }

  return ok(message);
}

export function subscribeChannel<T>(
  channel: Channel<T>,
  subscriber: (message: ChannelMessage<T>) => void
): ChannelSubscription {
  channel.subscribers.add(subscriber);

  return {
    unsubscribe() {
      channel.subscribers.delete(subscriber);
    }
  };
}

export function drainChannel<T>(channel: Channel<T>): readonly ChannelMessage<T>[] {
  const messages = channel.queue.slice();
  channel.queue.length = 0;
  return messages;
}
