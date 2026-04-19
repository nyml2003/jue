import { Lane } from "@jue/shared";

import "./style.css";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  document.body.innerHTML = "<p>Missing #app root element.</p>";
} else {
  root.innerHTML = `
    <section class="card">
      <h1>jue scaffold ready</h1>
      <p>Workspace, TypeScript, esbuild, Vite, Vitest and ESLint are scaffolded.</p>
      <p>Initial visible lane value: <strong>${Lane.VISIBLE_UPDATE}</strong></p>
    </section>
  `;
}
