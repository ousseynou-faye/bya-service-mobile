import {MAX_PRICE, MAX_QUANTITY, MAX_STOCK, PAYMENTS, isDay} from "./model.js";

const bounded = (value, lower, upper) => Number.isSafeInteger(value) && value >= lower && value <= upper;
const string = (value, size) => typeof value === "string" && value.length <= size;
const require = condition => { if (!condition) throw new Error("Sauvegarde mobile invalide ou incohérente."); };

export function backupFile(state) {
  return JSON.stringify({format: "bya-service-mobile", exported_at: new Date().toISOString(), data: state});
}

export function backupData(raw) {
  require(raw?.format === "bya-service-mobile" && raw.data?.schema === 1);
  const {schema, settings, products, contacts, operations, movements, expenses} = raw.data;
  require(settings && string(settings.shop, 100) && settings.shop.trim() && string(settings.phone, 50) && string(settings.address, 200));
  for (const list of [products, contacts, operations, movements, expenses]) {
    require(Array.isArray(list) && list.every(row => row && bounded(row.id, 1, 2_147_483_647)));
    require(new Set(list.map(row => row.id)).size === list.length);
  }
  require(products.every(p => string(p.sku, 40) && p.sku && string(p.name, 120) && p.name && string(p.category, 60) &&
    bounded(p.price, 0, MAX_PRICE) && bounded(p.threshold, 0, MAX_QUANTITY) && bounded(p.average, 0, MAX_PRICE * 100) &&
    bounded(p.stock, 0, MAX_STOCK) && (p.active === 1 || (p.active === 0 && p.stock === 0))));
  require(new Set(products.map(p => p.sku.toLowerCase())).size === products.length);
  require(contacts.every(c => ["client", "supplier"].includes(c.kind) && string(c.name, 120) && c.name &&
    string(c.phone, 40) && string(c.note, 300)));
  for (const list of [operations, expenses]) {
    require(list.every(o => /^[A-Za-z0-9-]{16,64}$/.test(o.request_key) && string(o.signature, 100_000) && isDay(o.day) &&
      (o.canceled_at === null || (string(o.canceled_at, 40) && isDay(o.canceled_at.slice(0, 10))))));
    require(new Set(list.map(o => o.request_key)).size === list.length);
  }
  require(expenses.every(e => string(e.category, 60) && string(e.note, 300) && bounded(e.amount, 1, MAX_PRICE)));
  const knownProducts = new Map(products.map(p => [p.id, p]));
  const knownContacts = new Map(contacts.map(c => [c.id, c]));
  const expected = new Map();
  for (const o of operations) {
    require(["sale", "purchase", "adjust"].includes(o.kind) && string(o.note, 300) && string(o.contact_name, 120) &&
      string(o.shop, 100) && string(o.shop_phone, 50) && string(o.shop_address, 200));
    require(o.kind === "sale" ? PAYMENTS.includes(o.method) : o.method === "" && o.canceled_at === null);
    require(o.contact_id === null || knownContacts.get(o.contact_id)?.kind === (o.kind === "sale" ? "client" : "supplier"));
    require(o.canceled_at === null ? o.cancel_reason === null : string(o.cancel_reason, 300));
    require(Array.isArray(o.lines) && o.lines.length >= 1 && o.lines.length <= (o.kind === "adjust" ? 1 : 100));
    let subtotal = 0;
    for (const line of o.lines) {
      require(line && knownProducts.has(line.product_id) && string(line.name, 120) && string(line.sku, 40) &&
        bounded(line.quantity, o.kind === "adjust" ? -MAX_STOCK : 1, o.kind === "adjust" ? MAX_STOCK : MAX_QUANTITY) && line.quantity !== 0 &&
        bounded(line.unit, 0, MAX_PRICE) && bounded(line.cost, 0, MAX_PRICE * 100));
      const key = `${o.id}/${line.product_id}/${o.kind}`;
      require(!expected.has(key));
      expected.set(key, {delta: o.kind === "sale" ? -line.quantity : line.quantity, day: o.day});
      if (o.canceled_at) expected.set(`${o.id}/${line.product_id}/return`, {delta: line.quantity, day: o.canceled_at.slice(0, 10)});
      subtotal += line.quantity * line.unit;
    }
    require(bounded(o.discount, 0, o.kind === "sale" ? subtotal : 0) && o.total === subtotal - o.discount);
  }
  const balances = new Map();
  for (const m of [...movements].sort((a, b) => a.id - b.id)) {
    const key = `${m.operation_id}/${m.product_id}/${m.kind}`;
    const match = expected.get(key);
    require(match && match.delta === m.delta && match.day === m.day);
    expected.delete(key);
    const balance = (balances.get(m.product_id) ?? 0) + m.delta;
    require(balance === m.balance && bounded(balance, 0, MAX_STOCK));
    balances.set(m.product_id, balance);
  }
  require(!expected.size && products.every(p => (balances.get(p.id) ?? 0) === p.stock));
  return {schema, settings, products, contacts, operations, movements, expenses};
}
