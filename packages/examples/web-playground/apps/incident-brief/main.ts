import { mountIncidentBrief } from "./page";
import "./page.css";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  document.body.innerHTML = "<p>Missing #app root element.</p>";
} else {
  const mountedResult = mountIncidentBrief(root);
  if (!mountedResult.ok) {
    root.textContent = mountedResult.error.message;
  }
}

