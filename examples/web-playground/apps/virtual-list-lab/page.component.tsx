import { ScrollView, Text, View, VirtualList, createSignal } from "@jue/jsx";

interface VirtualListItem {
  readonly id: string;
  readonly label: string;
}

export function render() {
  const pageClass = createSignal("virtual-lab-page");
  const shellClass = createSignal("virtual-lab-shell");
  const viewportClass = createSignal("virtual-lab-viewport");
  const title = createSignal("Virtual List Lab");
  const summary = createSignal("A virtual-list authoring canary that proves compiler descriptors can drive stable cell reuse through the existing region controller.");
  const rows = createSignal(Array.from({ length: 1000 }, (_, i) => ({ id: `row-${i}`, label: `Row ${i}` })));

  return (
    <View className={pageClass}>
      <View className={shellClass}>
        <Text className="virtual-lab-title">{title}</Text>
        <Text className="virtual-lab-summary">{summary}</Text>
        <ScrollView className={viewportClass}>
          <View className="virtual-spacer virtual-spacer--top" />
          <VirtualList each={rows} by={(row: VirtualListItem) => row.id} estimateSize={() => 48} overscan={1}>
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
