import { List, Text, View, signal } from "@jue/jsx";

interface KeyedListItem {
  readonly id: string;
  readonly label: string;
  readonly status: string;
}

export function render() {
  const pageClass = signal("keyed-lab-page");
  const shellClass = signal("keyed-lab-shell");
  const title = signal("Keyed List Lab");
  const summary = signal("A keyed-list authoring canary that proves compiler lowering, generated descriptors, and runtime reconcile all agree on key stability.");
  const items = signal([
    { id: "alpha", label: "Alpha", status: "Primary" },
    { id: "bravo", label: "Bravo", status: "Warm" },
    { id: "charlie", label: "Charlie", status: "Cold" }
  ]);

  return (
    <View className={pageClass.get()}>
      <View className={shellClass.get()}>
        <Text className="keyed-lab-title">{title.get()}</Text>
        <Text className="keyed-lab-summary">{summary.get()}</Text>
        <View className="keyed-lab-list-shell">
          <List each={items.get()} by={(item: KeyedListItem) => item.id}>
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
