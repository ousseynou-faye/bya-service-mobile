import {blank} from "./model.js";

const name = "bya-service-mobile:" + new URL("../", import.meta.url).pathname;
let database;

function open() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("boutique");
      request.onsuccess = () => {
        const connection = request.result;
        connection.onversionchange = () => { connection.close(); database = undefined; };
        resolve(connection);
      };
      request.onerror = () => reject(new Error("Impossible d’ouvrir le stockage de cet appareil."));
    }).catch(error => { database = undefined; throw error; });
  }
  return database;
}

export async function transact(write, action, key = "data") {
  const connection = await open();
  return new Promise((resolve, reject) => {
    const tx = connection.transaction("boutique", write ? "readwrite" : "readonly");
    const store = tx.objectStore("boutique");
    const request = store.get(key);
    let result, failure;
    request.onsuccess = () => {
      const current = request.result ?? (key === "data" ? blank() : null);
      try {
        result = action(current, store);
        if (write) store.put(current, key);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure ?? new Error("Enregistrement impossible. Vérifie l’espace de stockage de l’appareil."));
  });
}

export function restoreState(replacement) {
  return transact(true, (current, store) => {
    store.put(current, "before-restore");
    Object.assign(current, replacement);
    return {ok: true};
  });
}
