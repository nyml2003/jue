import { mountVirtualListLab } from "./page";
import "./page.css";

type VirtualListLabWindow = typeof globalThis & {
  __JUE_VIRTUAL_LIST_LAB__?: {
    setWindowStart(windowStart: number): void;
    readVisibleLabels(): string[];
    readReuseIds(): string[];
  };
};

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  document.body.innerHTML = "<p>Missing #app root element.</p>";
} else {
  const mountedResult = mountVirtualListLab(root);
  if (!mountedResult.ok) {
    root.textContent = mountedResult.error.message;
  } else {
    const globalWindow = globalThis as VirtualListLabWindow;
    globalWindow.__JUE_VIRTUAL_LIST_LAB__ = {
      setWindowStart(windowStart) {
        mountedResult.value.setWindowStart(windowStart);
      },
      readVisibleLabels() {
        return mountedResult.value.readVisibleLabels();
      },
      readReuseIds() {
        return mountedResult.value.readReuseIds();
      }
    };
  }
}
