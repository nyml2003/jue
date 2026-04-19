import { mountText } from "@jue/web";

import "./style.css";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  document.body.innerHTML = "<p>Missing #app root element.</p>";
} else {
  const card = document.createElement("section");
  card.className = "card";

  const title = document.createElement("h1");
  title.textContent = "jue text path";

  const summary = document.createElement("p");
  summary.textContent = "This demo runs the minimal runtime path from signal write to DOM text commit.";

  const row = document.createElement("div");
  row.className = "row";

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = "Count:";

  const value = document.createElement("strong");
  value.className = "value";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "button";
  button.textContent = "Increment";

  row.append(label, value, button);
  card.append(title, summary, row);
  root.append(card);

  const mountedResult = mountText(value, 0);

  if (!mountedResult.ok) {
    root.textContent = mountedResult.error.message;
  } else {
    let count = 0;

    button.addEventListener("click", () => {
      count += 1;
      mountedResult.value.set(count);
    });
  }
}
