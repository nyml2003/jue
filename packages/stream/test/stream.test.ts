import { describe, expect, it } from "vitest";

import { createChannel, drainChannel } from "@jue/runtime-core/channel";

import { createSignalBridge, createStream, fromChannel, fromSignal, mergeStreams, toChannel, toResource, toSignal } from "../src/index";

describe("@jue/stream", () => {
  it("bridges signals through streams", () => {
    const count = createSignalBridge(0);
    const doubled = createSignalBridge(0);

    const subscription = toSignal(
      fromSignal(count).map(value => value * 2).distinctUntilChanged(),
      doubled
    );

    count.write(2);
    count.write(2);
    count.write(3);

    expect(doubled.read()).toBe(6);
    subscription.unsubscribe();
  });

  it("bridges streams to channels and resources", async () => {
    const channel = createChannel<number>("saveDone");
    const controller = createStream<number>();
    const channelValues: number[] = [];
    fromChannel(channel).subscribe(message => {
      channelValues.push(message.value);
    });

    const resource = toResource(controller.stream, {
      load: value => Promise.resolve(`value:${value}`)
    });
    const channelSubscription = toChannel(controller.stream, channel);

    controller.emit(1);
    controller.emit(2);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(channelValues).toEqual([1, 2]);
    expect(drainChannel(channel)).toHaveLength(2);
    expect(resource.value()).toBe("value:2");
    channelSubscription.unsubscribe();
  });

  it("supports stream operators and merge", () => {
    const left = createStream<number>();
    const right = createStream<number>();
    const values: number[] = [];

    mergeStreams(left.stream, right.stream)
      .filter(value => value > 1)
      .scan((sum, value) => sum + value, 0)
      .subscribe(value => {
        values.push(value);
      });

    left.emit(1);
    right.emit(2);
    left.emit(3);

    expect(values).toEqual([2, 5]);
  });
});
