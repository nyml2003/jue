import { ScrollView, Text, View, VirtualList, signal } from "@jue/jsx";

interface VirtualListItem {
  readonly id: string;
  readonly label: string;
}

export function render() {
  const pageClass = signal("virtual-lab-page");
  const shellClass = signal("virtual-lab-shell");
  const viewportClass = signal("virtual-lab-viewport");
  const title = signal("Virtual List Lab");
  const summary = signal("A virtual-list authoring canary that proves compiler descriptors can drive stable cell reuse through the existing region controller.");
  const rows = signal(Array.from({ length: 1000 }, (_, i) => ({ id: `row-${i}`, label: `Row ${i}` })));

  return (
    <View className={pageClass.get()}>
      <View className={shellClass.get()}>
        <Text className="virtual-lab-title">{title.get()}</Text>
        <Text className="virtual-lab-summary">{summary.get()}</Text>
        <ScrollView className={viewportClass.get()}>
          <View className="virtual-spacer virtual-spacer--top" />
          <VirtualList each={rows.get()} by={(row: VirtualListItem) => row.id} estimateSize={48} overscan={1}>
            {(row: VirtualListItem) => (
              <View className="virtual-row">
                <Text className="virtual-row__label">{row.label}</Text>
              </View>
            )}
          </VirtualList>
          <View className="virtual-spacer virtual-spacer--bottom" />
        </ScrollView>
      </View>
    </View>
  );
}
