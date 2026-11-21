import test from "node:test";
import assert from "node:assert/strict";
import {addOperation, blank, saveContact, saveProduct} from "../app/src/model.js";
import {backupData, backupFile} from "../app/src/backup.js";
import {confirmOffer, prepareOffer, recordOffer, whatsappNumber} from "../app/src/outreach.js";
import {clientSummary} from "../app/src/reports.js";

test("Photo facultative, remplacement, retrait et restauration d’un ancien catalogue", () => {
  const state = blank();
  const data = {sku:"P1", name:"Pack découverte", category:"Packs", price:7000};
  const product = saveProduct(state, data);
  const old = JSON.parse(backupFile(state));
  delete old.data.offers;
  assert.deepEqual(backupData(old).offers, []);
  assert.equal(product.photo, undefined);
  const photo = "data:image/jpeg;base64,/9j/2Q==";
  saveProduct(state, {...data, photo}, product.id);
  saveProduct(state, {...data, price:6500}, product.id);
  assert.equal(backupData(JSON.parse(backupFile(state))).products[0].photo, photo);
  assert.throws(() => saveProduct(state, {...data, photo:"https://example.com/photo"}, product.id));
  saveProduct(state, {...data, photo:null}, product.id);
  assert.equal(product.photo, null);
});

test("Une offre préparée attend la confirmation et conserve le produit et les dates après restauration", () => {
  const state = blank();
  const data = {sku:"P1", name:"Pack découverte", category:"Packs", price:7000};
  const product = saveProduct(state, data);
  addOperation(state, "adjust", {request_key:"stock-test-offre-001", note:"Inventaire", lines:[{product_id:product.id,quantity:2}]});
  const a = saveContact(state, {name:"Awa", phone:"770000000", kind:"client", offers:true});
  const offer = {clientId:a.id, productId:product.id, kind:"promo", price:5500, request_key:"offre-preparee-0001"};
  const get = () => clientSummary(state, a.id).offers;
  prepareOffer(state, offer, "2026-01-10");
  assert.equal(get().length, 0);
  const draft = recordOffer(state, offer, "2026-01-10");
  recordOffer(state, offer, "2026-01-10");
  assert.equal(get().length, 1);
  assert.equal(get()[0].sentDay, null);
  assert.deepEqual(clientSummary(state, 999).offers, []);
  saveProduct(state, {...data, name:"Pack renommé"}, product.id);
  confirmOffer(state, draft.id, "2026-01-12");
  confirmOffer(state, draft.id, "2026-01-13");
  assert.deepEqual([get()[0].day, get()[0].sentDay, get()[0].productName, get()[0].price],
    ["2026-01-10", "2026-01-12", "Pack découverte", 5500]);
  const backup = JSON.parse(backupFile(state));
  assert.deepEqual(backupData(backup),state);
  backup.data.offers[0].clientId = 999;
  assert.throws(() => backupData(backup));
});

test("Numéros sénégalais et internationaux utilisés par le lien de discussion", () => {
  for (const value of ["77 000 00 00", "+221 77 000 00 00", "00221-77-000-00-00", "221770000000"])
    assert.equal(whatsappNumber(value), "221770000000");
  assert.equal(whatsappNumber("+33 6 00 00 00 00"), "33600000000");
  for (const value of ["", "77", "77a000000", "+221 123", "77/0000000"])
    assert.equal(whatsappNumber(value), "");
});

test("Une ancienne fiche reste exclue et le choix WhatsApp survit à la sauvegarde", () => {
  const state = blank();
  const data = {kind:"client", name:"Cliente exemple", phone:"770000000"};
  const client = saveContact(state, data);
  assert.throws(() => prepareOffer(state, {clientId:client.id}, "2026-01-01"), /accord/);
  saveContact(state, {...data, offers:true}, client.id);
  assert.equal(backupData(JSON.parse(backupFile(state))).contacts[0].offers, true);
  saveContact(state, {...data, offers:false}, client.id);
  assert.throws(() => prepareOffer(state, {clientId:client.id}, "2026-01-01"), /accord/);
});

test("Promotion et nouveauté utilisent le catalogue et les achats validés de la destinataire", () => {
  const state = blank();
  state.products.push({id:2, active:1, stock:4, price:7000, name:"Pack découverte"});
  const client = saveContact(state, {name:"Awa", phone:"770000000", kind:"client", offers:true});
  const sale = {kind:"sale", contact_id:client.id, lines:[{product_id:2}]};
  state.operations.push({...sale, canceled_at:"2026-01-10"}, {...sale, contact_id:99});
  const day = "2026-01-15";
  const offer = {clientId:client.id, productId:2, kind:"promo", price:5500, until:"2026-01-17"};
  const preview = () => prepareOffer(state, offer, day).message;
  assert.match(preview(), /Bonjour Awa/);
  assert.match(preview().replace(/\s/g, ""), /5500FCFAaulieude7000FCFA/);
  assert.match(preview(), /17 janvier 2026/);
  assert.doesNotMatch(preview(), /déjà choisi/);
  state.operations.push(sale);
  assert.match(preview(), /déjà choisi/);
  for (const values of [{price:7100}, {price:0}, {until:"2026-01-14"}])
    assert.throws(() => prepareOffer(state, {...offer, ...values}, day));
  const copy = structuredClone(state);
  const fresh = prepareOffer(state, {...offer, kind:"new"}, day);
  assert.match(fresh.message, /une photo/);
  assert.doesNotMatch(fresh.message, /au lieu de/);
  assert.deepEqual(state, copy);
  state.products[0].stock = 0;
  assert.throws(preview, /stock/);
});
