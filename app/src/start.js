import {download, request} from "./local-api.js";

const status = document.getElementById("offline-status");
window.byaLocal = Object.freeze({request, download});

async function prepareOffline() {
  if (!navigator.serviceWorker) {
    status.textContent = "Ouvre l’adresse HTTPS pour préparer le mode hors connexion.";
    return;
  }
  status.textContent = "Préparation du mode hors connexion…";
  try {
    await navigator.serviceWorker.register("./sw.js", {updateViaCache: "none"});
    await navigator.serviceWorker.ready;
    status.textContent = "Application prête hors connexion";
  } catch {
    status.textContent = "Mode hors connexion indisponible. Rouvre la page avec Internet.";
  }
}

void prepareOffline();
await import("../ui/app.js");
