import test from "node:test";
import assert from "node:assert/strict";
import {blank, saveContact} from "../app/src/model.js";
import {backupData, backupFile} from "../app/src/backup.js";
import {prepareOffer, whatsappNumber} from "../app/src/outreach.js";

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
