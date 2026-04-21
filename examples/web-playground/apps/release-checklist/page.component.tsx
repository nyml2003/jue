import { Button, Text, View, createSignal } from "@jue/jsx";

let openRunbookCount = 0;
let notifyOpsCount = 0;

function handleOpenRunbook() {
  openRunbookCount += 1;
  console.log("Open runbook clicked");
}

function handleNotifyOps() {
  notifyOpsCount += 1;
  console.log("Notify ops clicked");
}

function getOpenRunbookCount() {
  return openRunbookCount;
}

function getNotifyOpsCount() {
  return notifyOpsCount;
}

export function render() {
  const pageClass = createSignal("release-page");
  const shellClass = createSignal("release-shell");
  const eyebrow = createSignal("SPRINT 24.3");
  const title = createSignal("Release Checklist");
  const summary = createSignal("A more typical shipping page with rollout context, clear ownership, and a final readiness branch.");
  const statusClass = createSignal("release-badge release-badge--ready");
  const statusText = createSignal("Ready for rollout");
  const ownerLabel = createSignal("Release owner");
  const ownerValue = createSignal("Client platform");
  const riskLabel = createSignal("Primary risk");
  const riskValue = createSignal("Cache invalidation lag");
  const windowLabel = createSignal("Deployment window");
  const windowValue = createSignal("21:00-21:20 UTC");
  const primaryButtonClass = createSignal("release-button release-button--primary");
  const secondaryButtonClass = createSignal("release-button release-button--secondary");
  const branchText = createSignal("All blocking checks are green. Proceed with staged rollout.");

  return (
    <View className={pageClass}>
      <View className={shellClass}>
        <Text className="release-eyebrow">{eyebrow}</Text>
        <Text className="release-title">{title}</Text>
        <Text className="release-summary">{summary}</Text>
        <View className="release-row">
          <Text className={statusClass}>{statusText}</Text>
          <Button className={primaryButtonClass} onPress={handleOpenRunbook}>Open runbook</Button>
          <Button className={secondaryButtonClass} onPress={handleNotifyOps}>Notify ops</Button>
        </View>
        <Text className="release-branch release-branch--ready">{branchText}</Text>
        <View className="release-grid">
          <View className="release-card">
            <Text className="release-card-label">{ownerLabel}</Text>
            <Text className="release-card-value">{ownerValue}</Text>
          </View>
          <View className="release-card">
            <Text className="release-card-label">{riskLabel}</Text>
            <Text className="release-card-value">{riskValue}</Text>
          </View>
          <View className="release-card">
            <Text className="release-card-label">{windowLabel}</Text>
            <Text className="release-card-value">{windowValue}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
