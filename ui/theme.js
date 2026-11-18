"use strict";

{
  const preference = "bya-theme";
  const system = matchMedia("(prefers-color-scheme: dark)");
  const choices = ["system", "light", "dark"];
  let mode = "system";
  try {
    const stored = localStorage.getItem(preference);
    if (choices.includes(stored)) mode = stored;
  } catch {
    // The theme still works when the browser blocks preference storage.
  }

  const apply = () => {
    document.documentElement.dataset.theme = mode === "system" ? (system.matches ? "dark" : "light") : mode;
  };
  apply();
  system.addEventListener("change", apply);
  window.addEventListener("storage", event => {
    if (event.key !== preference && event.key !== null) return;
    mode = choices.includes(event.newValue) ? event.newValue : "system";
    const select = document.getElementById("theme");
    if (select) select.value = mode;
    apply();
  });
  document.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("theme");
    if (!select) return;
    select.value = mode;
    select.addEventListener("change", () => {
      mode = select.value;
      apply();
      try {
        localStorage.setItem(preference, mode);
      } catch {
        // Keep the selected theme for the active page.
      }
    });
  });
}
