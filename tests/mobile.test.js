import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import {activateProduct, addExpense, addOperation, blank, cancelExpense, cancelSale, saveProduct, today} from "../app/src/model.js";
import {bootstrap, productHistory, replenishment, report} from "../app/src/reports.js";
import {backupData, backupFile} from "../app/src/backup.js";

const product = {sku: "S001", name: "Savon", category: "Savons", price: 2000, threshold: 3};
function fixture() {
  const state = blank();
  const item = saveProduct(state, product);
  addOperation(state, "purchase", {request_key: "achat-0000000000000", lines: [{product_id: item.id, quantity: 5, unit: 800}]});
  return {state, item};
}

test("Les catalogues de deux installations évoluent indépendamment", () => {
  const {state, item} = fixture();
  assert.equal(bootstrap(blank()).products.length, 0);
  assert.equal(item.stock, 5);
  assert.equal(item.average, 80_000);
  assert.throws(() => saveProduct(state, {...product, sku: "s001"}), /existe/);
  assert.throws(() => activateProduct(state, {active: 0}, item.id), /stock/);
});

test("Vente, réessai et annulation préservent le stock et les totaux", () => {
  const {state, item} = fixture();
  const sale = {request_key: "vente-0000000000000", method: "Wave", discount: 100,
    lines: [{product_id: item.id, quantity: 3, unit: 2000}]};
  const ticket = addOperation(state, "sale", sale);
  assert.equal(ticket.total, 5900);
  assert.equal(addOperation(state, "sale", sale).id, ticket.id);
  assert.throws(() => addOperation(state, "sale", {...sale, discount: 0}), /déjà servi/);
  assert.equal(item.stock, 2);
  assert.equal(replenishment(state)[0].quantity, 4);
  assert.equal(report(state).gross_margin, 3500);
  assert.equal(productHistory(state, item.id).sales.units, 3);
  cancelSale(state, {reason: "Retour"}, ticket.id);
  cancelSale(state, {reason: "Retour"}, ticket.id);
  assert.equal(item.stock, 5);
  assert.equal(productHistory(state, item.id).sales.units, 0);
  assert.equal(report(state).revenue, 0);
  assert.equal(state.movements.length, 3);
});

test("Une vente invalide ne crée ni ticket ni mouvement partiel", () => {
  const {state, item} = fixture();
  assert.throws(() => addOperation(state, "sale", {request_key: "vente-0000000000001", method: "Wave",
    lines: [{product_id: item.id, quantity: 1}, {product_id: 9, quantity: 1}]}), /introuvable/);
  assert.equal(item.stock, 5);
  assert.equal(state.operations.length, 1);
  assert.equal(state.movements.length, 1);
});

test("Une sauvegarde relit le journal et rejette un stock falsifié", () => {
  const {state, item} = fixture();
  const expense = addExpense(state, {request_key: "depense-000000000000", category: "Transport", note: "Livraison", amount: 500});
  assert.equal(report(state, today(), today()).expenses_total, 500);
  cancelExpense(state, expense.id);
  assert.equal(report(state).expenses_total, 0);
  const backup = JSON.parse(backupFile(state));
  assert.deepEqual(backupData(backup), state);
  item.stock = 42;
  assert.throws(() => backupData(JSON.parse(backupFile(state))), /incohérente/);
});

test("Le cache hors connexion couvre les fichiers et résout une publication en sous-dossier", async () => {
  const script = await readFile(new URL("../app/sw.js", import.meta.url), "utf8");
  const handlers = new Map(), cached = new Map();
  const scope = "https://example.test/bya-service-mobile/";
  const cache = {addAll: async requests => {
    for (const request of requests) {
      const path = new URL(request.url).pathname.slice(new URL(scope).pathname.length);
      cached.set(request.url, await readFile(new URL("../app/" + path, import.meta.url)));
    }
  }, match: key => cached.get(key)};
  vm.runInNewContext(script, {URL, Request, caches: {open: async () => cache},
    self: {registration: {scope}, addEventListener: (name, action) => handlers.set(name, action)}});
  let installing;
  handlers.get("install")({waitUntil: promise => { installing = promise; }});
  await installing;
  assert.equal(cached.size, 17);
  let response;
  handlers.get("fetch")({request: {url: scope, method: "GET", mode: "navigate"}, respondWith: p => { response = p; }});
  assert.match((await response).toString("utf8"), /Bya Service/);
});
