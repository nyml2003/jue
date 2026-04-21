import { Button, ScrollView, Text, View, createSignal } from "@jue/jsx";

let primaryActionCount = 0;
let syncActionCount = 0;
let escalateActionCount = 0;

function handlePrimaryAction() {
  primaryActionCount += 1;
  console.log("Primary action executed");
}

function handleSyncAction() {
  syncActionCount += 1;
  console.log("Sync action executed");
}

function handleEscalateAction() {
  escalateActionCount += 1;
  console.log("Escalate action executed");
}

function getPrimaryActionCount() {
  return primaryActionCount;
}

function getSyncActionCount() {
  return syncActionCount;
}

function getEscalateActionCount() {
  return escalateActionCount;
}

export function render() {
  const pageClass = createSignal("ops-deck");
  const shellClass = createSignal("ops-shell");
  const heroKicker = createSignal("ORBITAL CONTROL");
  const heroTitle = createSignal("Fleet Readiness Deck");
  const heroCopy = createSignal("A compiled TSX operations page that renders through Blueprint tables, keeps host primitives explicit, and preserves module-scoped action handlers.");
  const metricOneLabel = createSignal("Active missions");
  const metricOneValue = createSignal("128");
  const metricTwoLabel = createSignal("Crew latency");
  const metricTwoValue = createSignal("14 ms");
  const metricThreeLabel = createSignal("Dock capacity");
  const metricThreeValue = createSignal("72%");
  const statusClass = createSignal("ops-badge ops-badge--steady");
  const statusText = createSignal("Nominal orbit");
  const leftTitle = createSignal("Recovery lane");
  const leftBody = createSignal("Three damaged relays are queued for cold-swap. The current plan keeps the comms mesh stable while repair crews rotate.");
  const centerTitle = createSignal("Convoy sync");
  const centerBody = createSignal("Two escort wings are staging for the outer-ring convoy. Navigation windows are locked, but fuel arbitration still needs final sign-off.");
  const rightTitle = createSignal("Signal hygiene");
  const rightBody = createSignal("The Babel frontend is now generating executable modules at build time. Browser bundles no longer carry parser/traverse overhead.");
  const panelTitle = createSignal("Operator directives");
  const panelBody = createSignal("This pane is intentionally dense: multiple cards, metrics, sections, and button handlers authored as TSX, emitted as TS/JS, then mounted through the runtime.");
  const timelineTitle = createSignal("Next window");
  const timelineItemOne = createSignal("06:30 UTC  |  Relay swap starts");
  const timelineItemTwo = createSignal("07:10 UTC  |  Convoy escort sync");
  const timelineItemThree = createSignal("08:00 UTC  |  Dock pressure rebalance");
  const buttonPrimaryClass = createSignal("ops-button ops-button--primary");
  const buttonSecondaryClass = createSignal("ops-button ops-button--secondary");
  const buttonGhostClass = createSignal("ops-button ops-button--ghost");
  const footerLabel = createSignal("Compiled from .tsx to executable module output.");
  const footerValue = createSignal("Signal slots, event refs, and host nodes stay explicit.");

  return (
    <View className={pageClass}>
      <ScrollView className={shellClass}>
        <View className="ops-hero">
          <Text className="ops-kicker">{heroKicker}</Text>
          <Text className="ops-title">{heroTitle}</Text>
          <Text className="ops-copy">{heroCopy}</Text>
          <View className="ops-hero-row">
            <Text className={statusClass}>{statusText}</Text>
            <Button className={buttonPrimaryClass} onPress={handlePrimaryAction}>Arm response</Button>
            <Button className={buttonSecondaryClass} onPress={handleSyncAction}>Sync convoy</Button>
            <Button className={buttonGhostClass} onPress={handleEscalateAction}>Escalate lane</Button>
          </View>
        </View>

        <View className="ops-metrics">
          <View className="ops-metric-card">
            <Text className="ops-metric-label">{metricOneLabel}</Text>
            <Text className="ops-metric-value">{metricOneValue}</Text>
          </View>
          <View className="ops-metric-card">
            <Text className="ops-metric-label">{metricTwoLabel}</Text>
            <Text className="ops-metric-value">{metricTwoValue}</Text>
          </View>
          <View className="ops-metric-card">
            <Text className="ops-metric-label">{metricThreeLabel}</Text>
            <Text className="ops-metric-value">{metricThreeValue}</Text>
          </View>
        </View>

        <View className="ops-grid">
          <View className="ops-story-card">
            <Text className="ops-story-title">{leftTitle}</Text>
            <Text className="ops-story-body">{leftBody}</Text>
          </View>
          <View className="ops-story-card">
            <Text className="ops-story-title">{centerTitle}</Text>
            <Text className="ops-story-body">{centerBody}</Text>
          </View>
          <View className="ops-story-card">
            <Text className="ops-story-title">{rightTitle}</Text>
            <Text className="ops-story-body">{rightBody}</Text>
          </View>
        </View>

        <View className="ops-panel">
          <View className="ops-panel-main">
            <Text className="ops-panel-title">{panelTitle}</Text>
            <Text className="ops-panel-body">{panelBody}</Text>
          </View>
          <View className="ops-timeline">
            <Text className="ops-panel-title">{timelineTitle}</Text>
            <Text className="ops-timeline-item">{timelineItemOne}</Text>
            <Text className="ops-timeline-item">{timelineItemTwo}</Text>
            <Text className="ops-timeline-item">{timelineItemThree}</Text>
          </View>
        </View>

        <View className="ops-footer">
          <Text className="ops-footer-label">{footerLabel}</Text>
          <Text className="ops-footer-value">{footerValue}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
