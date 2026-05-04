import { Button, Text, View, signal } from "@jue/jsx";
import { createStream } from "@jue/stream";

type ActionKind = "win" | "follow_up" | "risk";

interface ActivityEvent {
  readonly kind: ActionKind;
  readonly momentumDelta: number;
  readonly recommendation: string;
}

const pageClass = signal("stream-lab-page");
const shellClass = signal("stream-lab-shell");
const eyebrow = signal("CUSTOMER MOMENTUM");
const title = signal("Stream Lab");
const summary = signal("A user-facing demo that proves stream events can update authored signals without page-level business glue.");
const momentum = signal(0);
const wins = signal(0);
const followUps = signal(0);
const risks = signal(0);
const headline = signal("Starting clean");
const recommendation = signal("Log the first moment to unlock a next-step suggestion.");
const activity = signal("No moments recorded yet.");

const actionController = createStream<ActivityEvent>();
let runtimeStarted = false;
let actionSubscriptions: Array<{ unsubscribe(): void }> = [];

function handleWin() {
  actionController.emit({
    kind: "win",
    momentumDelta: 3,
    recommendation: "Convert the win into visible progress before momentum cools down."
  });
}

function handleFollowUp() {
  actionController.emit({
    kind: "follow_up",
    momentumDelta: 2,
    recommendation: "Attach a due date and the next customer-facing checkpoint."
  });
}

function handleRisk() {
  actionController.emit({
    kind: "risk",
    momentumDelta: -2,
    recommendation: "Send a customer-facing note with owner, timing, and confidence."
  });
}

function mount() {
  if (runtimeStarted) {
    return;
  }

  runtimeStarted = true;
  actionSubscriptions = [
    actionController.stream.subscribe(event => {
      momentum.update(value => Math.max(0, value + event.momentumDelta));

      if (event.kind === "win") {
        wins.update(value => value + 1);
      } else if (event.kind === "follow_up") {
        followUps.update(value => value + 1);
      } else {
        risks.update(value => value + 1);
      }

      if (risks.get() > wins.get() + followUps.get()) {
        headline.set("Protect the next customer moment");
      } else if (momentum.get() >= 5 || wins.get() >= 2) {
        headline.set("Momentum is compounding");
      } else {
        headline.set("Steady delivery rhythm");
      }

      recommendation.set(event.recommendation);
      activity.set(`Latest: ${event.kind}.`);
    })
  ];
}

function dispose() {
  actionSubscriptions.forEach(subscription => subscription.unsubscribe());
  actionSubscriptions = [];
  runtimeStarted = false;
}

export function render() {
  return (
    <View className={pageClass.get()}>
      <View className={shellClass.get()}>
        <View className="stream-lab-hero">
          <Text className="stream-lab-eyebrow">{eyebrow.get()}</Text>
          <Text className="stream-lab-title">{title.get()}</Text>
          <Text className="stream-lab-summary">{summary.get()}</Text>
        </View>

        <View className="stream-lab-actions">
          <Button className="stream-lab-button stream-lab-button--win" onPress={handleWin}>Closed a blocker</Button>
          <Button className="stream-lab-button stream-lab-button--follow-up" onPress={handleFollowUp}>Sent follow-up</Button>
          <Button className="stream-lab-button stream-lab-button--risk" onPress={handleRisk}>Flagged risk</Button>
        </View>

        <View className="stream-lab-metrics">
          <View className="stream-lab-metric-card">
            <Text className="stream-lab-metric-label">Momentum</Text>
            <Text className="stream-lab-metric-value stream-lab-metric-value--momentum">{momentum.get()}</Text>
          </View>
          <View className="stream-lab-metric-card">
            <Text className="stream-lab-metric-label">Wins today</Text>
            <Text className="stream-lab-metric-value stream-lab-metric-value--wins">{wins.get()}</Text>
          </View>
          <View className="stream-lab-metric-card">
            <Text className="stream-lab-metric-label">Follow-ups sent</Text>
            <Text className="stream-lab-metric-value stream-lab-metric-value--follow-ups">{followUps.get()}</Text>
          </View>
          <View className="stream-lab-metric-card">
            <Text className="stream-lab-metric-label">Open risks</Text>
            <Text className="stream-lab-metric-value stream-lab-metric-value--risks">{risks.get()}</Text>
          </View>
        </View>

        <View className="stream-lab-panels">
          <View className="stream-lab-panel stream-lab-panel--guidance">
            <Text className="stream-lab-panel-label">Live guidance</Text>
            <Text className="stream-lab-status">{headline.get()}</Text>
            <Text className="stream-lab-recommendation">{recommendation.get()}</Text>
            <Text className="stream-lab-last-action">{activity.get()}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export const handlers = {
  mount,
  dispose
};
