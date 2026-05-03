import { Button, Text, View, signal } from "@jue/jsx";

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

export function getOpenRunbookCount() {
  return openRunbookCount;
}

export function getNotifyOpsCount() {
  return notifyOpsCount;
}

export function render() {
  const pageClass = signal("release-page");
  const shellClass = signal("release-shell");
  const eyebrow = signal("SPRINT 24.3");
  const title = signal("Release Checklist");
  const summary = signal("A more typical shipping page with rollout context, clear ownership, and a final readiness branch.");
  const statusClass = signal("release-badge release-badge--ready");
  const statusText = signal("Ready for rollout");
  const ownerLabel = signal("Release owner");
  const ownerValue = signal("Client platform");
  const riskLabel = signal("Primary risk");
  const riskValue = signal("Cache invalidation lag");
  const windowLabel = signal("Deployment window");
  const windowValue = signal("21:00-21:20 UTC");
  const primaryButtonClass = signal("release-button release-button--primary");
  const secondaryButtonClass = signal("release-button release-button--secondary");
  const branchText = signal("All blocking checks are green. Proceed with staged rollout.");

  return (
    <View className={pageClass.get()}>
      <View className={shellClass.get()}>
        <Text className="release-eyebrow">{eyebrow.get()}</Text>
        <Text className="release-title">{title.get()}</Text>
        <Text className="release-summary">{summary.get()}</Text>
        <View className="release-row">
          <Text className={statusClass.get()}>{statusText.get()}</Text>
          <Button className={primaryButtonClass.get()} onPress={handleOpenRunbook}>Open runbook</Button>
          <Button className={secondaryButtonClass.get()} onPress={handleNotifyOps}>Notify ops</Button>
        </View>
        <Text className="release-branch release-branch--ready">{branchText.get()}</Text>
        <View className="release-grid">
          <View className="release-card">
            <Text className="release-card-label">{ownerLabel.get()}</Text>
            <Text className="release-card-value">{ownerValue.get()}</Text>
          </View>
          <View className="release-card">
            <Text className="release-card-label">{riskLabel.get()}</Text>
            <Text className="release-card-value">{riskValue.get()}</Text>
          </View>
          <View className="release-card">
            <Text className="release-card-label">{windowLabel.get()}</Text>
            <Text className="release-card-value">{windowValue.get()}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
