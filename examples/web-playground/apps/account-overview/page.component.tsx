import { Button, Input, Text, View, createSignal } from "@jue/jsx";

let openInvoicesCount = 0;
let scheduleReviewCount = 0;

function handleOpenInvoices() {
  openInvoicesCount += 1;
  console.log("Open invoices clicked");
}

function handleScheduleReview() {
  scheduleReviewCount += 1;
  console.log("Schedule review clicked");
}

function getOpenInvoicesCount() {
  return openInvoicesCount;
}

function getScheduleReviewCount() {
  return scheduleReviewCount;
}

export function render() {
  const pageClass = createSignal("account-page");
  const shellClass = createSignal("account-shell");
  const eyebrow = createSignal("CUSTOMER 2048");
  const title = createSignal("Account Overview");
  const summary = createSignal("A customer-facing summary page with explicit signals for labels, counters, and action styling.");
  const statusClass = createSignal("account-badge account-badge--healthy");
  const statusText = createSignal("Healthy renewal posture");
  const revenueLabel = createSignal("Monthly revenue");
  const revenueValue = createSignal("$48,200");
  const invoiceLabel = createSignal("Open invoices");
  const invoiceValue = createSignal("3");
  const renewalLabel = createSignal("Renewal date");
  const renewalValue = createSignal("2026-06-01");
  const primaryButtonClass = createSignal("account-button account-button--primary");
  const secondaryButtonClass = createSignal("account-button account-button--secondary");
  const noteTitle = createSignal("Next recommended action");
  const noteBody = createSignal("Finance follow-up is the fastest path to reducing friction before the renewal window opens.");
  const detailWidth = createSignal("100%");

  return (
    <View className={pageClass}>
      <View className={shellClass}>
        <Text className="account-eyebrow">{eyebrow}</Text>
        <Text className="account-title">{title}</Text>
        <Text className="account-summary">{summary}</Text>
        <View className="account-row">
          <Text className={statusClass}>{statusText}</Text>
          <Button className={primaryButtonClass} onPress={handleOpenInvoices}>Open invoices</Button>
          <Button className={secondaryButtonClass} onPress={handleScheduleReview}>Schedule review</Button>
        </View>
        <View className="account-grid">
          <View className="account-metric">
            <Text className="account-metric-label">{revenueLabel}</Text>
            <Text className="account-metric-value">{revenueValue}</Text>
          </View>
          <View className="account-metric">
            <Text className="account-metric-label">{invoiceLabel}</Text>
            <Text className="account-metric-value">{invoiceValue}</Text>
          </View>
          <View className="account-metric">
            <Text className="account-metric-label">{renewalLabel}</Text>
            <Text className="account-metric-value">{renewalValue}</Text>
          </View>
        </View>
        <View className="account-note">
          <Text className="account-note-title">{noteTitle}</Text>
          <Text className="account-note-body">{noteBody}</Text>
          <View className="account-detail-row" style={{ width: detailWidth, opacity: 0.96 }}>
            <Text className="account-detail-label">Days to renewal</Text>
            <Text className="account-detail-value">{24}</Text>
            <Input className="account-detail-input" value={"Auto-billed"} disabled />
          </View>
        </View>
      </View>
    </View>
  );
}
