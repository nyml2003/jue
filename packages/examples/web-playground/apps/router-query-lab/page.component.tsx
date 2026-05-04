import { Button, Show, Text, View, signal } from "@jue/jsx";
import { createQuery, createQueryClient } from "@jue/query";
import { createRouteHandoff, createRouter, type Router } from "@jue/router";

type ProjectId = "alpha" | "bravo";
type TabId = "overview" | "activity";
type RouteKey = `${ProjectId}:${TabId}`;

interface ProjectView {
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly owner: string;
  readonly phaseValue: TabId;
  readonly insightValue: string;
  readonly summary: string;
  readonly blockerActive: boolean;
  readonly blockerTitle: string;
  readonly blockerBody: string;
  readonly healthyTitle: string;
  readonly healthyBody: string;
}

const pageClass = signal("router-query-page");
const shellClass = signal("router-query-shell");
const title = signal("Router Query Lab");
const summary = signal("A user-facing routed inbox that proves query cache and authored Show branches can run from TSX.");
const routeLabel = signal("/projects/alpha?tab=overview");
const cacheLabel = signal("No cache activity yet.");
const projectLabel = signal("Alpha checkout");
const ownerLabel = signal("Payments squad");
const projectSummary = signal("Waiting for the first routed query.");
const blockerActive = signal(true);
const blockerTitle = signal("Escalation is still blocking launch.");
const blockerBody = signal("The authored Show branch will stay visible until the route data clears it.");
const healthyTitle = signal("This route is clear to ship.");
const healthyBody = signal("No blocker remains on the current route.");
const alphaButtonClass = signal("router-query-chip router-query-chip--active");
const bravoButtonClass = signal("router-query-chip");
const overviewButtonClass = signal("router-query-chip router-query-chip--tab router-query-chip--tab-active");
const activityButtonClass = signal("router-query-chip router-query-chip--tab");

const queryClient = createQueryClient();
let runtimeStarted = false;
let runtimeSubscriptions: Array<{ unsubscribe(): void }> = [];
let routerRuntime: Router | null = null;
let activeRouteLoadToken = 0;
let loadCounts = new Map<RouteKey, number>();
let currentSelection: { projectId: ProjectId; tab: TabId } = {
  projectId: "alpha",
  tab: "overview"
};

const PROJECT_VIEWS: Record<RouteKey, ProjectView> = {
  "alpha:overview": {
    projectId: "alpha",
    projectName: "Alpha checkout",
    owner: "Payments squad",
    phaseValue: "overview",
    insightValue: "Checkout copy is stable, but launch still depends on a tax edge-case fix before Friday.",
    summary: "Route params pick the project while @jue/query reuses the cached overview if you come back later.",
    blockerActive: true,
    blockerTitle: "Escalation is still blocking launch.",
    blockerBody: "A jurisdiction-specific tax rule is still under review on the overview route.",
    healthyTitle: "This route is clear to ship.",
    healthyBody: "No blocker remains on the current route."
  },
  "alpha:activity": {
    projectId: "alpha",
    projectName: "Alpha checkout",
    owner: "Payments squad",
    phaseValue: "activity",
    insightValue: "Deployment freeze lifted after the card vault replay succeeded in staging six minutes ago.",
    summary: "The activity tab is a separate query key, so the first visit fetches once and later visits reuse cache.",
    blockerActive: false,
    blockerTitle: "Escalation is still blocking launch.",
    blockerBody: "This branch only shows while the query says a blocker is active.",
    healthyTitle: "Activity feed looks healthy.",
    healthyBody: "The latest rollout checks passed, so the fallback branch is now visible."
  },
  "bravo:overview": {
    projectId: "bravo",
    projectName: "Bravo billing",
    owner: "Revenue systems",
    phaseValue: "overview",
    insightValue: "Billing retries are down 18%, and the route is intentionally quiet to prove the healthy fallback branch.",
    summary: "This route demonstrates a fully cached, healthy view with no blocker banner after the first load.",
    blockerActive: false,
    blockerTitle: "Escalation is still blocking launch.",
    blockerBody: "A blocker would render here if the billing view regressed.",
    healthyTitle: "This route is clear to ship.",
    healthyBody: "Bravo overview currently renders the Show fallback branch."
  },
  "bravo:activity": {
    projectId: "bravo",
    projectName: "Bravo billing",
    owner: "Revenue systems",
    phaseValue: "activity",
    insightValue: "Two stale invoices were reprocessed, and support has no open escalations on the route.",
    summary: "Switching tabs changes only the query string, while the router keeps the same project param match.",
    blockerActive: false,
    blockerTitle: "Escalation is still blocking launch.",
    blockerBody: "A blocker would render here if the activity route regressed.",
    healthyTitle: "Activity feed looks healthy.",
    healthyBody: "The feed is clean, so cache reuse is the main thing to watch on this route."
  }
};

function mount() {
  if (runtimeStarted) {
    return;
  }

  runtimeStarted = true;

  const router = createRouter();
  routerRuntime = router;
  const handoff = createRouteHandoff(router, [
    {
      pattern: "/projects/:projectId",
      enter({ match }) {
        currentSelection = {
          projectId: match.params.projectId === "bravo" ? "bravo" : "alpha",
          tab: readTab(router.state().query.tab)
        };
      }
    }
  ]);
  const routeSubscription = router.subscribe(() => {
    void loadCurrentRoute(router, false);
  });

  runtimeSubscriptions = [handoff, routeSubscription];

  if (!router.match("/projects/:projectId").matched) {
    router.replace("/projects/alpha?tab=overview");
    return;
  }

  void loadCurrentRoute(router, false);
}

function dispose() {
  runtimeSubscriptions.forEach(subscription => subscription.unsubscribe());
  runtimeSubscriptions = [];
  runtimeStarted = false;
  routerRuntime = null;
  activeRouteLoadToken += 1;
  loadCounts = new Map<RouteKey, number>();
  currentSelection = {
    projectId: "alpha",
    tab: "overview"
  };
}

function handleSelectAlpha() {
  routerRuntime?.navigate("/projects/alpha?tab=overview");
}

function handleSelectBravo() {
  routerRuntime?.navigate("/projects/bravo?tab=overview");
}

function handleSelectOverview() {
  routerRuntime?.navigate(`/projects/${currentSelection.projectId}?tab=overview`);
}

function handleSelectActivity() {
  routerRuntime?.navigate(`/projects/${currentSelection.projectId}?tab=activity`);
}

function handleGoBack() {
  routerRuntime?.back();
}

function handleReloadCurrent() {
  if (routerRuntime) {
    void loadCurrentRoute(routerRuntime, true);
  }
}

function handleInvalidateCurrent() {
  const query = getCurrentQuery(currentSelection.projectId, currentSelection.tab);
  query.invalidate();
  cacheLabel.set(`${currentSelection.projectId}/${currentSelection.tab} marked stale.`);
}

function getCurrentQuery(projectId: ProjectId, tab: TabId) {
  return createQuery(queryClient, {
    key: ["router-query-lab", projectId, tab],
    staleTime: 60_000,
    load: async () => {
      const routeKey = createRouteKey(projectId, tab);
      loadCounts.set(routeKey, (loadCounts.get(routeKey) ?? 0) + 1);
      await delay(resolveRouteDelay(routeKey));
      return PROJECT_VIEWS[routeKey];
    }
  });
}

async function loadCurrentRoute(
  router: ReturnType<typeof createRouter>,
  forceReload: boolean
): Promise<void> {
  const nextSelection = {
    projectId: readProjectId(router.state().pathname),
    tab: readTab(router.state().query.tab)
  };
  const loadToken = ++activeRouteLoadToken;
  currentSelection = nextSelection;

  routeLabel.set(router.state().href);
  syncSelection();

  const query = getCurrentQuery(nextSelection.projectId, nextSelection.tab);
  const result = forceReload ? await query.reload() : await query.preload();
  if (loadToken !== activeRouteLoadToken) {
    return;
  }

  if (!result.ok) {
    projectSummary.set(result.error.message);
    blockerActive.set(false);
    healthyTitle.set("Query failed.");
    healthyBody.set("Reload the current route to try again.");
    return;
  }

  const view = result.value;
  projectLabel.set(view.projectName);
  ownerLabel.set(view.owner);
  projectSummary.set(view.summary);
  blockerActive.set(view.blockerActive);
  blockerTitle.set(view.blockerTitle);
  blockerBody.set(view.blockerBody);
  healthyTitle.set(view.healthyTitle);
  healthyBody.set(view.healthyBody);
  cacheLabel.set(`${nextSelection.projectId}/${nextSelection.tab} loaded ${loadCounts.get(createRouteKey(nextSelection.projectId, nextSelection.tab)) ?? 0}x.`);
}

function syncSelection() {
  alphaButtonClass.set(currentSelection.projectId === "alpha"
    ? "router-query-chip router-query-chip--active"
    : "router-query-chip");
  bravoButtonClass.set(currentSelection.projectId === "bravo"
    ? "router-query-chip router-query-chip--active"
    : "router-query-chip");
  overviewButtonClass.set(currentSelection.tab === "overview"
    ? "router-query-chip router-query-chip--tab router-query-chip--tab-active"
    : "router-query-chip router-query-chip--tab");
  activityButtonClass.set(currentSelection.tab === "activity"
    ? "router-query-chip router-query-chip--tab router-query-chip--tab-active"
    : "router-query-chip router-query-chip--tab");
}

function createRouteKey(projectId: ProjectId, tab: TabId): RouteKey {
  return `${projectId}:${tab}`;
}

function readProjectId(pathname: string): ProjectId {
  return pathname.includes("/bravo") ? "bravo" : "alpha";
}

function resolveRouteDelay(routeKey: RouteKey): number {
  if (routeKey === "alpha:overview") {
    return 24;
  }

  if (routeKey === "bravo:overview") {
    return 4;
  }

  return 10;
}

function readTab(value: string | undefined): TabId {
  return value === "activity" ? "activity" : "overview";
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function render() {
  return (
    <View className={pageClass.get()}>
      <View className={shellClass.get()}>
        <Text className="router-query-title">{title.get()}</Text>
        <Text className="router-query-summary">{summary.get()}</Text>

        <View className="router-query-actions">
          <Button className={alphaButtonClass.get()} onPress={handleSelectAlpha}>Alpha checkout</Button>
          <Button className={bravoButtonClass.get()} onPress={handleSelectBravo}>Bravo billing</Button>
          <Button className={overviewButtonClass.get()} onPress={handleSelectOverview}>Overview tab</Button>
          <Button className={activityButtonClass.get()} onPress={handleSelectActivity}>Activity tab</Button>
          <Button className="router-query-action router-query-action--ghost" onPress={handleGoBack}>Back</Button>
          <Button className="router-query-action router-query-action--primary" onPress={handleReloadCurrent}>Reload view</Button>
          <Button className="router-query-action router-query-action--secondary" onPress={handleInvalidateCurrent}>Invalidate cache</Button>
        </View>

        <Text className="router-query-route">{routeLabel.get()}</Text>
        <Text className="router-query-cache">{cacheLabel.get()}</Text>
        <Text className="router-query-project">{projectLabel.get()}</Text>
        <Text className="router-query-owner">{ownerLabel.get()}</Text>
        <Text className="router-query-summary-text">{projectSummary.get()}</Text>

        <Show
          when={blockerActive.get()}
          fallback={
            <View className="router-query-banner router-query-banner--safe">
              <Text className="router-query-banner-title">{healthyTitle.get()}</Text>
              <Text className="router-query-banner-body">{healthyBody.get()}</Text>
            </View>
          }
        >
          <View className="router-query-banner router-query-banner--risk">
            <Text className="router-query-banner-title">{blockerTitle.get()}</Text>
            <Text className="router-query-banner-body">{blockerBody.get()}</Text>
          </View>
        </Show>
      </View>
    </View>
  );
}

export const handlers = {
  mount,
  dispose
};
