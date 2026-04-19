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

const CONTENT_REGION_SLOT = 0;

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
  dispose(): Result<void, TabPanelError>;
}

export interface TabPanelError {
  readonly code: string;
  readonly message: string;
}

type MountedTree = ReturnType<typeof mountTree> extends Result<infer T, unknown> ? T : never;

export function mountTabPanel(root: Node): Result<MountedTabPanel, TabPanelError> {
  let activeTab = 0;
  let mountedTreeRef: MountedTree | null = null;

  const selectTab = (tabIndex: number) => {
    activeTab = tabIndex;
    return writeTabSignals(mountedTreeRef, activeTab);
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
    dispose() {
      return mountedTree.dispose();
    }
  });
}

function writeTabSignals(
  mountedTree: MountedTree | null,
  activeTab: number
): Result<FlushBindingsResult, TabPanelError> {
  if (mountedTree === null) {
    return err({
      code: "TAB_PANEL_NOT_MOUNTED",
      message: "Tab panel signals cannot be written before mountTree() succeeds."
    });
  }

  const signalResult = mountedTree.setSignals([
    [SIGNAL_ACTIVE_LABEL_SLOT, `Active: ${TABS[activeTab]?.label ?? TABS[0].label}`],
    [SIGNAL_TAB_ONE_CLASS_SLOT, getTabClassName(activeTab, 0)],
    [SIGNAL_TAB_TWO_CLASS_SLOT, getTabClassName(activeTab, 1)],
    [SIGNAL_TAB_THREE_CLASS_SLOT, getTabClassName(activeTab, 2)]
  ]);
  if (!signalResult.ok) {
    return err(signalResult.error);
  }

  const regionResult = mountedTree.regions.conditional(CONTENT_REGION_SLOT).switchTo(activeTab);
  return regionResult.ok ? regionResult : err(regionResult.error);
}

function createTabPanelBuilder(handlers: {
  readonly selectItemOne: () => void;
  readonly selectItemTwo: () => void;
  readonly selectItemThree: () => void;
}) {
  const builder = createBlueprintBuilder();
  builder.setSignalCount(6);
  builder.setInitialSignalValues([
    "tab-panel",
    "tab-panel-item tab-panel-item--active",
    "tab-panel-item",
    "tab-panel-item",
    "Active: Item 1",
    "tab-panel-content"
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
  const contentTwo = appendTabContent(builder, panel, TABS[1].title, TABS[1].body);
  const contentThree = appendTabContent(builder, panel, TABS[2].title, TABS[2].body);

  builder.bindProp(panel, "className", SIGNAL_PANEL_CLASS_SLOT);
  builder.bindProp(itemOne, "className", SIGNAL_TAB_ONE_CLASS_SLOT);
  builder.bindProp(itemTwo, "className", SIGNAL_TAB_TWO_CLASS_SLOT);
  builder.bindProp(itemThree, "className", SIGNAL_TAB_THREE_CLASS_SLOT);
  builder.bindProp(contentOne.element, "className", SIGNAL_CONTENT_CLASS_SLOT);
  builder.bindProp(contentTwo.element, "className", SIGNAL_CONTENT_CLASS_SLOT);
  builder.bindProp(contentThree.element, "className", SIGNAL_CONTENT_CLASS_SLOT);
  builder.bindText(activeLabel.textNode, SIGNAL_ACTIVE_LABEL_SLOT);
  builder.bindEvent(itemOne, "onPress", handlers.selectItemOne);
  builder.bindEvent(itemTwo, "onPress", handlers.selectItemTwo);
  builder.bindEvent(itemThree, "onPress", handlers.selectItemThree);
  builder.defineConditionalRegion({
    anchorStartNode: contentOne.element,
    anchorEndNode: contentThree.endNode,
    branches: [
      { startNode: contentOne.element, endNode: contentOne.endNode },
      { startNode: contentTwo.element, endNode: contentTwo.endNode },
      { startNode: contentThree.element, endNode: contentThree.endNode }
    ]
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
