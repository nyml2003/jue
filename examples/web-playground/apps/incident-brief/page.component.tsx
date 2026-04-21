import { Button, Text, View, createSignal } from "@jue/jsx";

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

function getAcknowledgeCount() {
  return acknowledgeCount;
}

function getPageTimelineCount() {
  return pageTimelineCount;
}

export function render() {
  const pageClass = createSignal("incident-page");
  const shellClass = createSignal("incident-shell");
  const level = createSignal("SEV-2 INCIDENT");
  const title = createSignal("API latency brief");
  const summary = createSignal("A concise incident page with one conditional branch so the compiler path still exercises region lowering.");
  const statusClass = createSignal("incident-badge incident-badge--warning");
  const statusText = createSignal("Degraded but stable");
  const ownerLabel = createSignal("Incident owner");
  const ownerValue = createSignal("Platform runtime");
  const mitigationLabel = createSignal("Current mitigation");
  const mitigationValue = createSignal("Traffic shifted to warm replicas");
  const footerLabel = createSignal("Last update");
  const footerValue = createSignal("08:42 UTC");
  const acknowledgeClass = createSignal("incident-button incident-button--primary");
  const timelineClass = createSignal("incident-button incident-button--ghost");
  const calloutText = createSignal("Escalation remains open while p95 stays above 900 ms.");

  return (
    <View className={pageClass}>
      <View className={shellClass}>
        <Text className="incident-eyebrow">{level}</Text>
        <Text className="incident-title">{title}</Text>
        <Text className="incident-summary">{summary}</Text>
        <View className="incident-row">
          <Text className={statusClass}>{statusText}</Text>
          <Button className={acknowledgeClass} onPress={handleAcknowledge}>Acknowledge</Button>
          <Button className={timelineClass} onPress={handlePageTimeline}>Page timeline</Button>
        </View>
        <Text className="incident-callout incident-callout--warning">{calloutText}</Text>
        <View className="incident-grid">
          <View className="incident-card">
            <Text className="incident-card-label">{ownerLabel}</Text>
            <Text className="incident-card-value">{ownerValue}</Text>
          </View>
          <View className="incident-card">
            <Text className="incident-card-label">{mitigationLabel}</Text>
            <Text className="incident-card-value">{mitigationValue}</Text>
          </View>
          <View className="incident-card">
            <Text className="incident-card-label">{footerLabel}</Text>
            <Text className="incident-card-value">{footerValue}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
