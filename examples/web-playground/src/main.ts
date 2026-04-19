import { mountTabPanel } from "./tab-panel";

import "./style.css";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  document.body.innerHTML = "<p>Missing #app root element.</p>";
} else {
  const mountedResult = mountTabPanel(root);

  if (!mountedResult.ok) {
    root.textContent = mountedResult.error.message;
  }
}
