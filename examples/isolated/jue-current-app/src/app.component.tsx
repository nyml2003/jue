import { Button, Show, Text, View, signal } from "@jue/jsx";

const pageClass = signal("demo-card");
const eyebrow = signal("CURRENT JUE FLOW");
const title = signal("Independent runtime mount");
const summary = signal("This isolated project shows the current authoring loop: write TSX, compile it into a generated module, then mount a runtime instance.");
const wins = signal(0);
const note = signal("Press the button in either mount to prove each runtime keeps its own state.");
const blockerOpen = signal(true);
const blockerTitle = signal("Risk branch is active");
const blockerBody = signal("This Show branch is driven by authored signals, not page-level DOM glue.");
const healthyTitle = signal("Healthy branch is active");
const healthyBody = signal("Toggle risk to switch the branch through the shared compiler/runtime path.");

function handleWin() {
  wins.update(value => value + 1);
  note.set(`Local wins recorded: ${wins.get()}.`);
}

function handleToggleRisk() {
  blockerOpen.update(value => !value);
}

export function render() {
  return (
    <View className={pageClass.get()}>
      <Text className="demo-eyebrow">{eyebrow.get()}</Text>
      <Text className="demo-title">{title.get()}</Text>
      <Text className="demo-summary">{summary.get()}</Text>

      <View className="demo-actions">
        <Button className="demo-button demo-button--primary" onPress={handleWin}>Log win</Button>
        <Button className="demo-button demo-button--secondary" onPress={handleToggleRisk}>Toggle risk</Button>
      </View>

      <Text className="demo-count">Wins in this mount: {wins.get()}</Text>
      <Text className="demo-note">{note.get()}</Text>

      <Show
        when={blockerOpen.get()}
        fallback={
          <View className="demo-banner demo-banner--safe">
            <Text className="demo-banner-title">{healthyTitle.get()}</Text>
            <Text className="demo-banner-body">{healthyBody.get()}</Text>
          </View>
        }
      >
        <View className="demo-banner demo-banner--risk">
          <Text className="demo-banner-title">{blockerTitle.get()}</Text>
          <Text className="demo-banner-body">{blockerBody.get()}</Text>
        </View>
      </Show>
    </View>
  );
}
