import { describe, expect, it } from "vitest";

import { createDevTraceCollector } from "@jue/devtrace";

import { createQuery, createQueryClient } from "../src/index";

describe("@jue/query", () => {
  it("loads, caches, and invalidates query entries", async () => {
    const client = createQueryClient();
    let loadCount = 0;
    const userQuery = createQuery(client, {
      key: ["user", "42"],
      staleTime: 1_000,
      load: () => {
        loadCount += 1;
        return Promise.resolve({ id: "42", name: "Ada" });
      }
    });

    expect(userQuery.isStale()).toBe(true);
    expect((await userQuery.preload()).ok).toBe(true);
    expect(userQuery.value()).toEqual({ id: "42", name: "Ada" });
    expect(userQuery.isStale()).toBe(false);
    expect(loadCount).toBe(1);

    expect(client.invalidateQuery(["user", "42"])).toBe(true);
    expect(userQuery.isStale()).toBe(true);
    expect((await userQuery.reload()).ok).toBe(true);
    expect(loadCount).toBe(2);
  });

  it("reports missing preload requests", async () => {
    const client = createQueryClient();
    const result = await client.preloadQuery(["missing"]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("QUERY_MISSING");
  });

  it("emits devtrace resource events when a collector is present", async () => {
    const trace = createDevTraceCollector();
    const client = createQueryClient({ trace });
    const todosQuery = createQuery(client, {
      key: ["todos"],
      load: () => Promise.resolve(["a", "b"])
    });

    expect((await todosQuery.reload()).ok).toBe(true);
    expect(trace.read().some(event => event.kind === "resource" && event.message.includes("ready"))).toBe(true);
  });
});
