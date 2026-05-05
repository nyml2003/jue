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

/**
 * 创建一个带版本号的运行时 channel。
 *
 * @description
 * channel 同时提供同步广播能力和可 drain 的消息缓冲区，
 * 适合在 block 或组件边界上传递带 lane 的离散事件。
 *
 * @param name 供诊断和校验使用的逻辑 channel 名称。
 * @returns 可用于发布和订阅的 channel。
 */
export function createChannel<T>(name: string): Channel<T> {
  return {
    name,
    version: 0,
    queue: [],
    subscribers: new Set()
  };
}

/**
 * 向 channel 发布一条消息，并同步通知当前订阅者。
 *
 * @description
 * 发布时会先递增 channel version，再把消息压入队列并广播给订阅者，
 * 这样实时订阅路径和后续 drain 路径看到的是同一份消息序列。
 *
 * @param channel 接收消息的 channel。
 * @param value 消息负载。
 * @param lane 附着在消息上的调度 lane。
 * @returns 包含递增 version 的已发布消息。
 */
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

/**
 * 注册一个订阅者，并返回取消订阅句柄。
 *
 * @description
 * 返回的句柄只负责把当前回调从 `Set` 中移除，
 * 不会回滚已经发布过的消息，也不会清空 channel 队列。
 *
 * @param channel 要订阅的 channel。
 * @param subscriber 每次发布消息时触发的回调。
 * @returns 用于移除回调的订阅句柄。
 */
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

/**
 * 以 FIFO 顺序取出并清空 channel 的缓冲消息。
 *
 * @description
 * 这个函数返回的是当前队列的浅拷贝快照，因此调用方后续修改返回数组，
 * 不会反向污染 channel 内部保留的队列存储。
 *
 * @param channel 要消费缓冲消息的 channel。
 * @returns 清空前的消息快照。
 */
export function drainChannel<T>(channel: Channel<T>): readonly ChannelMessage<T>[] {
  const messages = channel.queue.slice();
  channel.queue.length = 0;
  return messages;
}
