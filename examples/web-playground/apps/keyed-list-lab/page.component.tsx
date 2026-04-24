import { List, Text, View, createSignal } from "@jue/jsx";

interface KeyedListItem {
  readonly id: string;
  readonly label: string;
  readonly status: string;
}

export function render() {
  const pageClass = createSignal("keyed-lab-page");
  const shellClass = createSignal("keyed-lab-shell");
  const title = createSignal("Keyed List Lab");
  const summary = createSignal("A keyed-list authoring canary that proves compiler lowering, generated descriptors, and runtime reconcile all agree on key stability.");
  const items = createSignal([
    { id: "alpha", label: "Alpha", status: "Primary" },
    { id: "bravo", label: "Bravo", status: "Warm" },
    { id: "charlie", label: "Charlie", status: "Cold" }
  ]);

  return (
    <View className={pageClass}>
      <View className={shellClass}>
        <Text className="keyed-lab-title">{title}</Text>
        <Text className="keyed-lab-summary">{summary}</Text>
        <View className="keyed-lab-list-shell">
          <List each={items} by={(item: KeyedListItem) => item.id}>
            {(item: KeyedListItem) => (
              <View className="keyed-row">
                <Text className="keyed-row__label">{item.label}</Text>
                <Text className="keyed-row__status">{item.status}</Text>
              </View>
            )}
          </List>
        </View>
      </View>
    </View>
  );
}
