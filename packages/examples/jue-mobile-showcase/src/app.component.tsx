import { Show, Text, View, signal } from "@jue/jsx";

const screenClass = signal("mobile-screen");
const cardClass = signal("mobile-card");
const eyebrowClass = signal("mobile-eyebrow");
const titleClass = signal("mobile-title");
const summaryClass = signal("mobile-summary");
const pillClassLive = signal("mobile-pill mobile-pill--live");
const pillClassPaused = signal("mobile-pill mobile-pill--paused");
const statGridClass = signal("mobile-stats");
const statCardClass = signal("mobile-stat-card");
const statLabelClass = signal("mobile-stat-label");
const statValueClass = signal("mobile-stat-value");
const noteClass = signal("mobile-note");

const eyebrow = signal("MOBILE SHOWCASE");
const title = signal("North Pier pickup window");
const summary = signal("A single TSX source compiled into both a browser mount and a WeChat miniprogram skyline scaffold.");
const statusLive = signal(true);
const liveLabel = signal("Skyline-ready");
const pausedLabel = signal("Paused");
const nextSlotLabel = signal("Next slot");
const nextSlotValue = signal("08:45");
const queueLabel = signal("Queue");
const queueValue = signal("12 riders");
const note = signal("No browser-only glue exists inside this component source.");

export function App() {
  return (
    <View className={screenClass.get()}>
      <View className={cardClass.get()}>
        <Text className={eyebrowClass.get()}>{eyebrow.get()}</Text>
        <Text className={titleClass.get()}>{title.get()}</Text>
        <Text className={summaryClass.get()}>{summary.get()}</Text>

        <Show
          when={statusLive.get()}
          fallback={<Text className={pillClassPaused.get()}>{pausedLabel.get()}</Text>}
        >
          <Text className={pillClassLive.get()}>{liveLabel.get()}</Text>
        </Show>

        <View className={statGridClass.get()}>
          <View className={statCardClass.get()}>
            <Text className={statLabelClass.get()}>{nextSlotLabel.get()}</Text>
            <Text className={statValueClass.get()}>{nextSlotValue.get()}</Text>
          </View>
          <View className={statCardClass.get()}>
            <Text className={statLabelClass.get()}>{queueLabel.get()}</Text>
            <Text className={statValueClass.get()}>{queueValue.get()}</Text>
          </View>
        </View>

        <Text className={noteClass.get()}>{note.get()}</Text>
      </View>
    </View>
  );
}
