import { Button, Input, Text, View, signal } from "@jue/jsx";

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

export function getOpenInvoicesCount() {
  return openInvoicesCount;
}

export function getScheduleReviewCount() {
  return scheduleReviewCount;
}

export function render() {
  const pageClass = signal("account-page");
  const shellClass = signal("account-shell");
  const eyebrow = signal("CUSTOMER 2048");
  const title = signal("Account Overview");
  const summary = signal("A customer-facing summary page with explicit signals for labels, counters, and action styling.");
  const statusClass = signal("account-badge account-badge--healthy");
  const statusText = signal("Healthy renewal posture");
  const revenueLabel = signal("Monthly revenue");
  const revenueValue = signal("$48,200");
  const invoiceLabel = signal("Open invoices");
  const invoiceValue = signal("3");
  const renewalLabel = signal("Renewal date");
  const renewalValue = signal("2026-06-01");
  const primaryButtonClass = signal("account-button account-button--primary");
  const secondaryButtonClass = signal("account-button account-button--secondary");
  const noteTitle = signal("Next recommended action");
  const noteBody = signal("Finance follow-up is the fastest path to reducing friction before the renewal window opens.");
  const detailWidth = signal("100%");

  return (
    <View className={pageClass.get()}>
      <View className={shellClass.get()}>
        <Text className="account-eyebrow">{eyebrow.get()}</Text>
        <Text className="account-title">{title.get()}</Text>
        <Text className="account-summary">{summary.get()}</Text>
        <View className="account-row">
          <Text className={statusClass.get()}>{statusText.get()}</Text>
          <Button className={primaryButtonClass.get()} onPress={handleOpenInvoices}>Open invoices</Button>
          <Button className={secondaryButtonClass.get()} onPress={handleScheduleReview}>Schedule review</Button>
        </View>
        <View className="account-grid">
          <View className="account-metric">
            <Text className="account-metric-label">{revenueLabel.get()}</Text>
            <Text className="account-metric-value">{revenueValue.get()}</Text>
          </View>
          <View className="account-metric">
            <Text className="account-metric-label">{invoiceLabel.get()}</Text>
            <Text className="account-metric-value">{invoiceValue.get()}</Text>
          </View>
          <View className="account-metric">
            <Text className="account-metric-label">{renewalLabel.get()}</Text>
            <Text className="account-metric-value">{renewalValue.get()}</Text>
          </View>
        </View>
        <View className="account-note">
          <Text className="account-note-title">{noteTitle.get()}</Text>
          <Text className="account-note-body">{noteBody.get()}</Text>
          <View className="account-detail-row" style={{ width: detailWidth.get(), opacity: 0.96 }}>
            <Text className="account-detail-label">Days to renewal</Text>
            <Text className="account-detail-value">{24}</Text>
            <Input className="account-detail-input" value={"Auto-billed"} disabled />
          </View>
        </View>
      </View>
    </View>
  );
}
