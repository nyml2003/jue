import { traceNavigation, type DevTraceCollector } from "@jue/devtrace";

export interface HistoryBridge {
  current(): string;
  navigate(href: string): void;
  replace(href: string): void;
  back(): void;
  subscribe(listener: (href: string) => void): { unsubscribe(): void };
}

interface BrowserHistoryTarget {
  readonly location: {
    readonly pathname: string;
    readonly search: string;
    readonly hash: string;
  };
  readonly history: {
    pushState(data: unknown, unused: string, href?: string | URL | null): void;
    replaceState(data: unknown, unused: string, href?: string | URL | null): void;
    back(): void;
  };
  addEventListener(type: "popstate", listener: () => void): void;
}

export interface RouteState {
  readonly href: string;
  readonly pathname: string;
  readonly query: Readonly<Record<string, string>>;
}

export interface RouteMatch {
  readonly matched: boolean;
  readonly params: Readonly<Record<string, string>>;
}

export interface Router {
  state(): RouteState;
  navigate(href: string): void;
  replace(href: string): void;
  back(): void;
  query(): Readonly<Record<string, string>>;
  match(pattern: string): RouteMatch;
  subscribe(listener: (state: RouteState) => void): { unsubscribe(): void };
}

export interface RouteHandoff {
  readonly pattern: string;
  readonly enter: (input: { readonly state: RouteState; readonly match: RouteMatch }) => void;
}

let defaultBrowserHistoryBridge: HistoryBridge | null = null;

export function createHistoryBridge(initialHref: string = "/"): HistoryBridge {
  const entries = [initialHref];
  let index = 0;
  const listeners = new Set<(href: string) => void>();

  const notify = () => {
    const href = entries[index] ?? "/";
    for (const listener of listeners) {
      listener(href);
    }
  };

  return {
    current() {
      return entries[index] ?? "/";
    },
    navigate(href) {
      entries.splice(index + 1);
      entries.push(href);
      index = entries.length - 1;
      notify();
    },
    replace(href) {
      entries[index] = href;
      notify();
    },
    back() {
      index = Math.max(0, index - 1);
      notify();
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

export function createBrowserHistoryBridge(
  target: BrowserHistoryTarget = resolveBrowserHistoryTarget()
): HistoryBridge {
  const listeners = new Set<(href: string) => void>();
  const readHref = () => `${target.location.pathname}${target.location.search}${target.location.hash}`;
  const entries = [readHref()];
  let index = 0;

  const notify = () => {
    const href = readHref();
    for (const listener of listeners) {
      listener(href);
    }
  };

  const handlePopState = () => {
    const href = readHref();
    const knownIndex = entries.lastIndexOf(href);
    if (knownIndex >= 0) {
      index = knownIndex;
    } else {
      entries.splice(index + 1);
      entries.push(href);
      index = entries.length - 1;
    }

    notify();
  };

  target.addEventListener("popstate", handlePopState);

  return {
    current() {
      return readHref();
    },
    navigate(href) {
      entries.splice(index + 1);
      entries.push(href);
      index = entries.length - 1;
      target.history.pushState({}, "", href);
      notify();
    },
    replace(href) {
      entries[index] = href;
      target.history.replaceState({}, "", href);
      notify();
    },
    back() {
      target.history.back();
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

export function createRouter(input: { readonly history?: HistoryBridge; readonly trace?: DevTraceCollector } = {}): Router {
  const history = input.history ?? createDefaultHistoryBridge();
  let currentState = parseRouteState(history.current());
  const listeners = new Set<(state: RouteState) => void>();

  history.subscribe(href => {
    currentState = parseRouteState(href);
    if (input.trace) {
      traceNavigation(input.trace, currentState.href);
    }
    for (const listener of listeners) {
      listener(currentState);
    }
  });

  return {
    state() {
      return currentState;
    },
    navigate(href) {
      history.navigate(href);
    },
    replace(href) {
      history.replace(href);
    },
    back() {
      history.back();
    },
    query() {
      return currentState.query;
    },
    match(pattern) {
      return matchRoutePattern(currentState.pathname, pattern);
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

export function createRouteHandoff(
  router: Router,
  routes: readonly RouteHandoff[]
): { unsubscribe(): void } {
  return router.subscribe(state => {
    for (const route of routes) {
      const match = router.match(route.pattern);
      if (!match.matched) {
        continue;
      }

      route.enter({
        state,
        match
      });
      return;
    }
  });
}

function parseRouteState(href: string): RouteState {
  const url = new URL(href, "https://jue.local");
  const query: Record<string, string> = {};

  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  return {
    href: `${url.pathname}${url.search}${url.hash}`,
    pathname: url.pathname,
    query
  };
}

function matchRoutePattern(pathname: string, pattern: string): RouteMatch {
  const pathSegments = pathname.split("/").filter(segment => segment.length > 0);
  const patternSegments = pattern.split("/").filter(segment => segment.length > 0);

  if (pathSegments.length !== patternSegments.length) {
    return {
      matched: false,
      params: {}
    };
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const pathSegment = pathSegments[index];
    if (!patternSegment || !pathSegment) {
      return {
        matched: false,
        params: {}
      };
    }

    if (patternSegment.startsWith(":")) {
      params[patternSegment.slice(1)] = pathSegment;
      continue;
    }

    if (patternSegment !== pathSegment) {
      return {
        matched: false,
        params: {}
      };
    }
  }

  return {
    matched: true,
    params
  };
}

function createDefaultHistoryBridge(): HistoryBridge {
  const target = tryResolveBrowserHistoryTarget();
  if (!target) {
    return createHistoryBridge("/");
  }

  defaultBrowserHistoryBridge ??= createBrowserHistoryBridge(target);
  return defaultBrowserHistoryBridge;
}

function resolveBrowserHistoryTarget(): BrowserHistoryTarget {
  const target = tryResolveBrowserHistoryTarget();
  if (!target) {
    throw new Error("Browser history target is not available in this environment.");
  }

  return target;
}

function tryResolveBrowserHistoryTarget(): BrowserHistoryTarget | null {
  const candidate = globalThis as {
    readonly location?: BrowserHistoryTarget["location"];
    readonly history?: BrowserHistoryTarget["history"];
    readonly addEventListener?: BrowserHistoryTarget["addEventListener"];
  };

  if (!candidate.location || !candidate.history || !candidate.addEventListener) {
    return null;
  }

  return {
    location: candidate.location,
    history: candidate.history,
    addEventListener: candidate.addEventListener.bind(globalThis)
  };
}
