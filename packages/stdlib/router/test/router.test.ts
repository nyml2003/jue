import { describe, expect, it } from "vitest";

import { createDevTraceCollector } from "@jue/devtrace";

import {
  createBrowserHistoryBridge,
  createHistoryBridge,
  createRouteHandoff,
  createRouter
} from "../src/index";

describe("@jue/router", () => {
  it("tracks route state and query through the history bridge", () => {
    const router = createRouter({
      history: createHistoryBridge("/issues/42?tab=activity")
    });

    expect(router.state().pathname).toBe("/issues/42");
    expect(router.query()).toEqual({ tab: "activity" });

    router.navigate("/users/7?panel=profile");
    expect(router.state().pathname).toBe("/users/7");
    expect(router.query()).toEqual({ panel: "profile" });

    router.back();
    expect(router.state().pathname).toBe("/issues/42");
  });

  it("matches route params against explicit patterns", () => {
    const router = createRouter({
      history: createHistoryBridge("/users/7/issues/42")
    });

    expect(router.match("/users/:userId/issues/:issueId")).toEqual({
      matched: true,
      params: {
        userId: "7",
        issueId: "42"
      }
    });
    expect(router.match("/users/:userId")).toEqual({
      matched: false,
      params: {}
    });
  });

  it("emits navigation trace entries when a collector is present", () => {
    const trace = createDevTraceCollector();
    const router = createRouter({
      history: createHistoryBridge("/"),
      trace
    });

    router.navigate("/issues/42");
    expect(trace.read().some(event => event.kind === "navigation" && event.message.includes("/issues/42"))).toBe(true);
  });

  it("supports explicit route handoff hooks", () => {
    const router = createRouter({
      history: createHistoryBridge("/users/7")
    });
    const entered: string[] = [];
    const handoff = createRouteHandoff(router, [
      {
        pattern: "/users/:userId",
        enter({ match }) {
          entered.push(match.params.userId ?? "");
        }
      }
    ]);

    router.navigate("/users/42");
    expect(entered).toEqual(["42"]);
    handoff.unsubscribe();
  });

  it("falls back to an in-memory history bridge when no browser target is available", () => {
    const router = createRouter();

    expect(router.state().href).toBe("/");
    router.navigate("/reports/weekly?tab=review");
    expect(router.state().href).toBe("/reports/weekly?tab=review");
    router.back();
    expect(router.state().href).toBe("/");
  });

  it("can read and drive a browser-style history target without example-specific glue", () => {
    const popstateListeners = new Set<() => void>();
    const entries = ["/projects/alpha?tab=overview"];
    let index = 0;
    let href = entries[index] ?? "/";
    const target = {
      location: {
        get pathname() {
          return new URL(href, "https://jue.local").pathname;
        },
        get search() {
          return new URL(href, "https://jue.local").search;
        },
        get hash() {
          return new URL(href, "https://jue.local").hash;
        }
      },
      history: {
        pushState(_data: unknown, _unused: string, nextHref?: string | URL | null) {
          href = nextHref?.toString() ?? href;
          entries.splice(index + 1);
          entries.push(href);
          index = entries.length - 1;
        },
        replaceState(_data: unknown, _unused: string, nextHref?: string | URL | null) {
          href = nextHref?.toString() ?? href;
          entries[index] = href;
        },
        back() {
          index = Math.max(0, index - 1);
          href = entries[index] ?? "/";
          popstateListeners.forEach(listener => listener());
        }
      },
      addEventListener(_type: "popstate", listener: () => void) {
        popstateListeners.add(listener);
      }
    };

    const router = createRouter({
      history: createBrowserHistoryBridge(target)
    });

    expect(router.state().href).toBe("/projects/alpha?tab=overview");
    router.navigate("/projects/bravo?tab=activity");
    expect(router.state().href).toBe("/projects/bravo?tab=activity");
    router.back();
    expect(router.state().href).toBe("/projects/alpha?tab=overview");

    router.navigate("/projects/bravo?tab=activity");
    href = "/projects/bravo?tab=overview";
    entries.splice(index + 1);
    entries.push(href);
    index = entries.length - 1;
    popstateListeners.forEach(listener => listener());
    expect(router.state().href).toBe("/projects/bravo?tab=overview");
  });
});
