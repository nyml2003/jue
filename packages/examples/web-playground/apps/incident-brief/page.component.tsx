import { Button, Text, View, signal } from "@jue/jsx";

let acknowledgeCount = 0;
let pageTimelineCount = 0;

function handleAcknowledge() {
  acknowledgeCount += 1;
  console.log("Acknowledge clicked");
}

function handlePageTimeline() {
  pageTimelineCount += 1;
  console.log("Page timeline clicked");
}

export function getAcknowledgeCount() {
  return acknowledgeCount;
}

export function getPageTimelineCount() {
  return pageTimelineCount;
}

export function render() {
  const pageClass = signal("incident-page");
  const shellClass = signal("incident-shell");
  const level = signal("SEV-2 INCIDENT");
  const title = signal("API latency brief");
  const summary = signal("A concise incident page with one conditional branch so the compiler path still exercises region lowering.");
  const statusClass = signal("incident-badge incident-badge--warning");
  const statusText = signal("Degraded but stable");
  const ownerLabel = signal("Incident owner");
  const ownerValue = signal("Platform runtime");
  const mitigationLabel = signal("Current mitigation");
  const mitigationValue = signal("Traffic shifted to warm replicas");
  const footerLabel = signal("Last update");
  const footerValue = signal("08:42 UTC");
  const acknowledgeClass = signal("incident-button incident-button--primary");
  const timelineClass = signal("incident-button incident-button--ghost");
  const calloutText = signal("Escalation remains open while p95 stays above 900 ms.");

  return (
    <View className={pageClass.get()}>
      <View className={shellClass.get()}>
        <Text className="incident-eyebrow">{level.get()}</Text>
        <Text className="incident-title">{title.get()}</Text>
        <Text className="incident-summary">{summary.get()}</Text>
        <View className="incident-row">
          <Text className={statusClass.get()}>{statusText.get()}</Text>
          <Button className={acknowledgeClass.get()} onPress={handleAcknowledge}>Acknowledge</Button>
          <Button className={timelineClass.get()} onPress={handlePageTimeline}>Page timeline</Button>
        </View>
        <Text className="incident-callout incident-callout--warning">{calloutText.get()}</Text>
        <View className="incident-grid">
          <View className="incident-card">
            <Text className="incident-card-label">{ownerLabel.get()}</Text>
            <Text className="incident-card-value">{ownerValue.get()}</Text>
          </View>
          <View className="incident-card">
            <Text className="incident-card-label">{mitigationLabel.get()}</Text>
            <Text className="incident-card-value">{mitigationValue.get()}</Text>
          </View>
          <View className="incident-card">
            <Text className="incident-card-label">{footerLabel.get()}</Text>
            <Text className="incident-card-value">{footerValue.get()}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
