import { type FlushBindingsResult } from "@jue/runtime-core";
import { createBlueprintBuilder } from "@jue/compiler";
import { err, ok, type Result } from "@jue/shared";
import { mountTree } from "@jue/web";

const SIGNAL_PANEL_CLASS_SLOT = 0;
const SIGNAL_TAB_ONE_CLASS_SLOT = 1;
const SIGNAL_TAB_TWO_CLASS_SLOT = 2;
const SIGNAL_TAB_THREE_CLASS_SLOT = 3;
const SIGNAL_ACTIVE_LABEL_SLOT = 4;
const SIGNAL_CONTENT_CLASS_SLOT = 5;
const SIGNAL_LIST_STATUS_SLOT = 6;
const SIGNAL_LIST_TOP_SPACER_HEIGHT_SLOT = 7;
const SIGNAL_LIST_BOTTOM_SPACER_HEIGHT_SLOT = 8;

const CONTENT_REGION_SLOT = 0;
const VIRTUAL_LIST_REGION_SLOT = 1;
const TOTAL_LIST_ITEMS = 1000;
const VISIBLE_LIST_ITEMS = 12;
const VIRTUAL_ROW_HEIGHT = 44;

const TABS = [
  {
    label: "Item 1",
    title: "Component 1",
    body: "Planner view: locks the problem boundary before runtime work starts."
  },
  {
    label: "Item 2",
    title: "Component 2",
    body: "Builder view: maps static nodes, bindings, and events into a mounted tree."
  },
  {
    label: "Item 3",
    title: "Component 3",
    body: "Verifier view: checks signal updates, DOM patches, and disposal behavior."
  }
] as const;

export interface MountedTabPanel {
  selectItemOne(): Result<FlushBindingsResult, TabPanelError>;
  selectItemTwo(): Result<FlushBindingsResult, TabPanelError>;
  selectItemThree(): Result<FlushBindingsResult, TabPanelError>;
  showListWindow(start: number): Result<FlushBindingsResult, TabPanelError>;
  dispose(): Result<void, TabPanelError>;
}

export interface TabPanelError {
  readonly code: string;
  readonly message: string;
}

type MountedTree = ReturnType<typeof mountTree> extends Result<infer T, unknown> ? T : never;

export function mountTabPanel(root: Node): Result<MountedTabPanel, TabPanelError> {
  let activeTab = 0;
  let virtualListAttached = false;
  let virtualListWindowStart = 0;
  let mountedTreeRef: MountedTree | null = null;

  const selectTab = (tabIndex: number) => {
    const previousTab = activeTab;
    activeTab = tabIndex;
    return syncTabPanel(mountedTreeRef, previousTab, activeTab);
  };

  const builder = createTabPanelBuilder({
    selectItemOne: () => {
      void selectTab(0);
    },
    selectItemTwo: () => {
      void selectTab(1);
    },
    selectItemThree: () => {
      void selectTab(2);
    },
    handleVirtualListScroll: (event: unknown) => {
      const scrollTop = readScrollTop(event);
      if (scrollTop === null) {
        return;
      }

      void showVirtualListWindow(Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT));
    }
  });
  const loweredResult = builder.buildBlueprint();
  if (!loweredResult.ok) {
    return err(loweredResult.error);
  }

  const mountedTreeResult = mountTree({
    blueprint: loweredResult.value.blueprint,
    root,
    signalCount: loweredResult.value.signalCount,
    initialSignalValues: loweredResult.value.initialSignalValues
  });

  if (!mountedTreeResult.ok) {
    return err(mountedTreeResult.error);
  }

  const mountedTree = mountedTreeResult.value;
  mountedTreeRef = mountedTree;

  const initialFlushResult = mountedTree.flushInitialBindings();
  if (!initialFlushResult.ok) {
    return err(initialFlushResult.error);
  }

  const initialRegionResult = mountedTree.regions.conditional(CONTENT_REGION_SLOT).attach(activeTab);
  if (!initialRegionResult.ok) {
    return err(initialRegionResult.error);
  }

  return ok({
    selectItemOne() {
      return selectTab(0);
    },
    selectItemTwo() {
      return selectTab(1);
    },
    selectItemThree() {
      return selectTab(2);
    },
    showListWindow(start) {
      return showVirtualListWindow(start);
    },
    dispose() {
      return mountedTree.dispose();
    }
  });

  function syncTabPanel(
    mountedTree: MountedTree | null,
    previousTab: number,
    nextTab: number
  ): Result<FlushBindingsResult, TabPanelError> {
    if (mountedTree === null) {
      return err({
        code: "TAB_PANEL_NOT_MOUNTED",
        message: "Tab panel signals cannot be written before mountTree() succeeds."
      });
    }

    const listSignalResult = mountedTree.setSignals(createVirtualListSignals(virtualListWindowStart));
    if (!listSignalResult.ok) {
      return err(listSignalResult.error);
    }

    if (previousTab === 1 && nextTab !== 1 && virtualListAttached) {
      const clearResult = mountedTree.regions.virtualList(VIRTUAL_LIST_REGION_SLOT).clear();
      if (!clearResult.ok) {
        return err(clearResult.error);
      }
      virtualListAttached = false;
    }

    const signalResult = mountedTree.setSignals([
      [SIGNAL_ACTIVE_LABEL_SLOT, `Active: ${TABS[nextTab]?.label ?? TABS[0].label}`],
      [SIGNAL_TAB_ONE_CLASS_SLOT, getTabClassName(nextTab, 0)],
      [SIGNAL_TAB_TWO_CLASS_SLOT, getTabClassName(nextTab, 1)],
      [SIGNAL_TAB_THREE_CLASS_SLOT, getTabClassName(nextTab, 2)]
    ]);
    if (!signalResult.ok) {
      return err(signalResult.error);
    }

    const regionResult = mountedTree.regions.conditional(CONTENT_REGION_SLOT).switchTo(nextTab);
    if (!regionResult.ok) {
      return err(regionResult.error);
    }

    if (nextTab !== 1) {
      return regionResult;
    }

    virtualListWindowStart = 0;
    const listSignalsResult = mountedTree.setSignals(createVirtualListSignals(virtualListWindowStart));
    if (!listSignalsResult.ok) {
      return err(listSignalsResult.error);
    }

    const attachResult = mountedTree.regions.virtualList(VIRTUAL_LIST_REGION_SLOT).attach(
      createVirtualListWindow(virtualListWindowStart)
    );
    if (!attachResult.ok) {
      return err(attachResult.error);
    }

    virtualListAttached = true;
    return attachResult;
  }

  function showVirtualListWindow(start: number): Result<FlushBindingsResult, TabPanelError> {
    if (mountedTreeRef === null) {
      return err({
        code: "TAB_PANEL_NOT_MOUNTED",
        message: "Tab panel virtual list cannot be updated before mountTree() succeeds."
      });
    }

    if (activeTab !== 1 || !virtualListAttached) {
      const selectResult = selectTab(1);
      if (!selectResult.ok) {
        return selectResult;
      }
    }

    virtualListWindowStart = clampVirtualListWindowStart(start);
    const listSignalsResult = mountedTreeRef.setSignals(createVirtualListSignals(virtualListWindowStart));
    if (!listSignalsResult.ok) {
      return err(listSignalsResult.error);
    }

    const updateResult = mountedTreeRef.regions.virtualList(VIRTUAL_LIST_REGION_SLOT).updateWindow(
      createVirtualListWindow(virtualListWindowStart)
    );

    return updateResult.ok ? updateResult : err(updateResult.error);
  }
}

function createTabPanelBuilder(handlers: {
  readonly selectItemOne: () => void;
  readonly selectItemTwo: () => void;
  readonly selectItemThree: () => void;
  readonly handleVirtualListScroll: (event: unknown) => void;
}) {
  const builder = createBlueprintBuilder();
  builder.setSignalCount(9);
  builder.setInitialSignalValues([
    "tab-panel",
    "tab-panel-item tab-panel-item--active",
    "tab-panel-item",
    "tab-panel-item",
    "Active: Item 1",
    "tab-panel-content",
    getVirtualListStatusLabel(0),
    "0px",
    `${(TOTAL_LIST_ITEMS - VISIBLE_LIST_ITEMS) * VIRTUAL_ROW_HEIGHT}px`
  ]);

  const panel = builder.element("View");
  appendTextElement(builder, panel, "Tab panel");
  appendTextElement(builder, panel, "Three static component panels, one active tab signal.");

  const tabs = builder.element("View");
  ensureBuilderAppend(builder.append(panel, tabs));
  const itemOne = appendButton(builder, tabs, TABS[0].label);
  const itemTwo = appendButton(builder, tabs, TABS[1].label);
  const itemThree = appendButton(builder, tabs, TABS[2].label);

  const activeLabel = appendTextElement(builder, panel, "");
  const contentOne = appendTabContent(builder, panel, TABS[0].title, TABS[0].body);
  const contentTwo = appendTabContentWithVirtualList(builder, panel, TABS[1].title, TABS[1].body);
  const contentThree = appendTabContent(builder, panel, TABS[2].title, TABS[2].body);

  builder.bindProp(panel, "className", SIGNAL_PANEL_CLASS_SLOT);
  builder.bindProp(itemOne, "className", SIGNAL_TAB_ONE_CLASS_SLOT);
  builder.bindProp(itemTwo, "className", SIGNAL_TAB_TWO_CLASS_SLOT);
  builder.bindProp(itemThree, "className", SIGNAL_TAB_THREE_CLASS_SLOT);
  builder.bindProp(contentOne.element, "className", SIGNAL_CONTENT_CLASS_SLOT);
  builder.bindProp(contentTwo.element, "className", SIGNAL_CONTENT_CLASS_SLOT);
  builder.bindProp(contentThree.element, "className", SIGNAL_CONTENT_CLASS_SLOT);
  builder.bindText(activeLabel.textNode, SIGNAL_ACTIVE_LABEL_SLOT);
  builder.bindText(contentTwo.listStatusTextNode, SIGNAL_LIST_STATUS_SLOT);
  builder.bindStyle(contentTwo.topSpacer, "height", SIGNAL_LIST_TOP_SPACER_HEIGHT_SLOT);
  builder.bindStyle(contentTwo.bottomSpacer, "height", SIGNAL_LIST_BOTTOM_SPACER_HEIGHT_SLOT);
  builder.bindEvent(itemOne, "onPress", handlers.selectItemOne);
  builder.bindEvent(itemTwo, "onPress", handlers.selectItemTwo);
  builder.bindEvent(itemThree, "onPress", handlers.selectItemThree);
  builder.bindEvent(contentTwo.viewport, "onScroll", handlers.handleVirtualListScroll);
  builder.defineConditionalRegion({
    anchorStartNode: contentOne.element,
    anchorEndNode: contentThree.endNode,
    branches: [
      { startNode: contentOne.element, endNode: contentOne.endNode },
      { startNode: contentTwo.element, endNode: contentTwo.endNode },
      { startNode: contentThree.element, endNode: contentThree.endNode }
    ]
  });
  builder.defineVirtualListRegion({
    anchorStartNode: contentTwo.listStatusTextNode,
    anchorEndNode: contentTwo.endNode
  });

  return builder;
}

function appendTabContent(
  builder: ReturnType<typeof createBlueprintBuilder>,
  parent: number,
  title: string,
  body: string
): { readonly element: number; readonly endNode: number } {
  const content = builder.element("View");
  ensureBuilderAppend(builder.append(parent, content));
  appendTextElement(builder, content, title);
  const bodyText = appendTextElement(builder, content, body);
  return {
    element: content,
    endNode: bodyText.textNode
  };
}

function appendTabContentWithVirtualList(
  builder: ReturnType<typeof createBlueprintBuilder>,
  parent: number,
  title: string,
  body: string
): {
  readonly element: number;
  readonly viewport: number;
  readonly listStatusTextNode: number;
  readonly topSpacer: number;
  readonly bottomSpacer: number;
  readonly endNode: number;
} {
  const content = builder.element("View");
  ensureBuilderAppend(builder.append(parent, content));
  appendTextElement(builder, content, title);
  appendTextElement(builder, content, body);
  appendTextElement(builder, content, `Virtual list: ${TOTAL_LIST_ITEMS} items, ${VISIBLE_LIST_ITEMS} visible cells.`);
  const listStatus = appendTextElement(builder, content, "");
  const viewport = builder.element("View");
  const topSpacer = builder.element("View");
  const bottomSpacer = builder.element("View");
  ensureBuilderAppend(builder.append(content, viewport));
  ensureBuilderAppend(builder.append(viewport, topSpacer));
  ensureBuilderAppend(builder.append(viewport, bottomSpacer));

  return {
    element: content,
    viewport,
    listStatusTextNode: listStatus.textNode,
    topSpacer,
    bottomSpacer,
    endNode: bottomSpacer
  };
}

function createVirtualListWindow(start: number) {
  const windowStart = clampVirtualListWindowStart(start);

  return {
    itemCount: TOTAL_LIST_ITEMS,
    windowStart,
    cells: Array.from({ length: VISIBLE_LIST_ITEMS }, (_, offset) => {
      const itemIndex = windowStart + offset;
      return createVirtualListCell(`Row ${String(itemIndex + 1).padStart(4, "0")} / ${TOTAL_LIST_ITEMS}`);
    })
  };
}

function createVirtualListCell(label: string) {
  const builder = createBlueprintBuilder();
  builder.setSignalCount(2);
  builder.setInitialSignalValues(["tab-panel-list-row", label]);

  const row = builder.element("View");
  const text = builder.text("");
  ensureBuilderAppend(builder.append(row, text));
  builder.bindProp(row, "className", 0);
  builder.bindText(text, 1);

  const lowered = builder.buildBlueprint();
  if (!lowered.ok) {
    throw new Error(`[tab-panel] ${lowered.error.code}: ${lowered.error.message}`);
  }

  return {
    blueprint: lowered.value.blueprint,
    signalCount: lowered.value.signalCount,
    initialSignalValues: lowered.value.initialSignalValues
  };
}

function clampVirtualListWindowStart(start: number): number {
  if (!Number.isFinite(start)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.trunc(start), TOTAL_LIST_ITEMS - VISIBLE_LIST_ITEMS));
}

function createVirtualListSignals(start: number) {
  const windowStart = clampVirtualListWindowStart(start);
  const topHeight = windowStart * VIRTUAL_ROW_HEIGHT;
  const bottomHeight = (TOTAL_LIST_ITEMS - windowStart - VISIBLE_LIST_ITEMS) * VIRTUAL_ROW_HEIGHT;

  return [
    [SIGNAL_LIST_STATUS_SLOT, getVirtualListStatusLabel(windowStart)],
    [SIGNAL_LIST_TOP_SPACER_HEIGHT_SLOT, `${topHeight}px`],
    [SIGNAL_LIST_BOTTOM_SPACER_HEIGHT_SLOT, `${Math.max(0, bottomHeight)}px`]
  ] as const;
}

function getVirtualListStatusLabel(start: number): string {
  const windowStart = clampVirtualListWindowStart(start);
  return `Showing ${windowStart + 1}-${windowStart + VISIBLE_LIST_ITEMS} of ${TOTAL_LIST_ITEMS}`;
}

function readScrollTop(event: unknown): number | null {
  if (
    typeof event === "object" &&
    event !== null &&
    "currentTarget" in event &&
    typeof event.currentTarget === "object" &&
    event.currentTarget !== null &&
    "scrollTop" in event.currentTarget &&
    typeof event.currentTarget.scrollTop === "number"
  ) {
    return event.currentTarget.scrollTop;
  }

  return null;
}

function appendTextElement(
  builder: ReturnType<typeof createBlueprintBuilder>,
  parent: number,
  text: string
): { readonly element: number; readonly textNode: number } {
  const element = builder.element("Text");
  const textNode = builder.text(text);
  ensureBuilderAppend(builder.append(parent, element));
  ensureBuilderAppend(builder.append(element, textNode));
  return {
    element,
    textNode
  };
}

function appendButton(
  builder: ReturnType<typeof createBlueprintBuilder>,
  parent: number,
  text: string
): number {
  const button = builder.element("Button");
  const buttonText = builder.text(text);
  ensureBuilderAppend(builder.append(parent, button));
  ensureBuilderAppend(builder.append(button, buttonText));
  return button;
}

function getTabClassName(activeTab: number, tabIndex: number): string {
  return activeTab === tabIndex
    ? "tab-panel-item tab-panel-item--active"
    : "tab-panel-item";
}

function ensureBuilderAppend(result: Result<void, { code: string; message: string }>): void {
  if (result.ok) {
    return;
  }

  throw new Error(`[tab-panel] ${result.error.code}: ${result.error.message}`);
}
