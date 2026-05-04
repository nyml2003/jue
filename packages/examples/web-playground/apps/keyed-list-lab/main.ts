import { mountKeyedListLab } from "./page";
import "./page.css";

type KeyedListLabWindow = typeof globalThis & {
  __JUE_KEYED_LIST_LAB__?: {
    applyScenario(name: KeyedListScenario): void;
    readOrder(): string[];
  };
};
type KeyedListScenario = "baseline" | "reordered" | "trimmed";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  document.body.innerHTML = "<p>Missing #app root element.</p>";
} else {
  const mountedResult = mountKeyedListLab(root);
  if (!mountedResult.ok) {
    root.textContent = mountedResult.error.message;
  } else {
    const globalWindow = globalThis as KeyedListLabWindow;
    globalWindow.__JUE_KEYED_LIST_LAB__ = {
      applyScenario(name) {
        mountedResult.value.applyScenario(name);
      },
      readOrder() {
        return mountedResult.value.readOrder();
      }
    };
  }
}
