export const VERSION = "2.9.0";
export const PAYMENTS = ["Espèces", "Wave", "Orange Money", "Carte", "Virement"];
export const CATEGORIES = ["Savons", "Soins du visage", "Soins du corps", "Soins des pieds", "Accessoires", "Packs", "Autres"];
export const MAX_PRICE = 10_000_000;
export const MAX_QUANTITY = 100_000;
export const MAX_STOCK = 100_000_000;
export const DAY = 86_400_000;
export const today = () => new Date().toISOString().slice(0, 10);
export const offset = (day, days) => new Date(Date.parse(day) + days * DAY).toISOString().slice(0, 10);

export function blank() {
  return {schema: 1, settings: {shop: "Bya Service", phone: "", address: ""},
    products: [], contacts: [], operations: [], movements: [], expenses: [], sessions: [], withdrawals: [], offers: []};
}

export function writableDay(state, day) {
  if (state.sessions?.some(s => s.day === day && s.closed)) throw new Error("La caisse de cette date est déjà clôturée.");
}

export function payment(value) {
  if (!PAYMENTS.includes(value)) throw new Error("Sélectionne le moyen de paiement.");
  return value;
}

export function number(kind, id) {
  return {sale: "V", purchase: "A", adjust: "S", expense: "D"}[kind] + "-" + String(id).padStart(5, "0");
}

function text(data, key, label, size, required = false) {
  const raw = data[key] ?? "";
  if (typeof raw !== "string" || raw.includes("\0") || raw.trim().length > size) {
    throw new Error(`${label} doit contenir au plus ${size} caractères.`);
  }
  const value = raw.trim();
  if (required && !value) throw new Error(`Renseigne le champ « ${label} ».`);
  return value;
}

export function integer(value, label, min = 0, max = MAX_PRICE) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label} doit être un entier entre ${min} et ${max}.`);
  }
  return value;
}

export function isDay(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && offset(value, 0) === value;
}

function operationDay(data) {
  const day = data.day || today();
  if (!isDay(day) || day > today()) throw new Error("Saisis une date valide, au plus tard aujourd’hui.");
  return day;
}

function nextId(items) {
  return items.reduce((id, item) => Math.max(id, item.id), 0) + 1;
}

export function find(items, id, message) {
  const item = items.find(row => row.id === id);
  if (!item) throw new Error(message);
  return item;
}

export function validPhoto(value) {
  return typeof value === "string" && value.length <= 400000 &&
    /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function saveProduct(state, data, id) {
  const values = {sku: text(data, "sku", "Référence", 40, true), name: text(data, "name", "Nom", 120, true),
    category: text(data, "category", "Catégorie", 60, true), price: integer(data.price, "Prix"),
    threshold: integer(data.threshold ?? 5, "Seuil d’alerte", 0, MAX_QUANTITY)};
  if (data.photo !== undefined) {
    if (data.photo !== null && !validPhoto(data.photo)) throw new Error("Choisissez une photo valide et réessayez.");
    values.photo = data.photo;
  }
  if (state.products.some(p => p.id !== id && p.sku.toLowerCase() === values.sku.toLowerCase())) {
    throw new Error("Cette référence existe déjà.");
  }
  if (id) return Object.assign(find(state.products, id, "Produit introuvable."), values);
  const product = {id: nextId(state.products), ...values, stock: 0, average: 0, active: 1};
  state.products.push(product);
  return product;
}

export function activateProduct(state, data, id) {
  const product = find(state.products, id, "Produit introuvable.");
  const active = integer(data.active, "Statut", 0, 1);
  if (!active && product.stock) throw new Error("Ramène le stock à zéro avant d’archiver ce produit.");
  product.active = active;
  return {ok: true};
}

export function saveContact(state, data, id) {
  const kind = data.kind;
  if (kind !== "client" && kind !== "supplier") throw new Error("Type de contact invalide.");
  const values = {kind, name: text(data, "name", "Nom", 120, true),
    phone: text(data, "phone", "Téléphone", 40), note: text(data, "note", "Note", 300)};
  if (kind === "client" && data.offers !== undefined) values.offers = data.offers === true;
  if (id) return Object.assign(find(state.contacts.filter(c => c.kind === kind), id, "Contact introuvable."), values);
  const contact = {id: nextId(state.contacts), ...values};
  state.contacts.push(contact);
  return contact;
}

export function saveSettings(state, data) {
  state.settings = {shop: text(data, "shop", "Nom de la boutique", 100, true),
    phone: text(data, "phone", "Téléphone", 50), address: text(data, "address", "Adresse", 200)};
  return state.settings;
}

export function attempt(items, kind, data) {
  const request_key = text(data, "request_key", "Identifiant", 64, true);
  if (!/^[A-Za-z0-9-]{16,64}$/.test(request_key)) throw new Error("Identifiant d’opération invalide.");
  const signature = JSON.stringify([kind, data], (_, value) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
  const previous = items.find(item => item.request_key === request_key);
  if (previous && previous.signature !== signature) throw new Error("Cette tentative a déjà servi. Vérifie l’historique.");
  return {request_key, signature, previous};
}

function costAverage(stock, average, quantity, incoming) {
  const total = BigInt(stock + quantity);
  return Number((BigInt(stock) * BigInt(average) + BigInt(quantity) * BigInt(incoming) + total / 2n) / total);
}

function move(state, product, operation, delta, average, kind, day = operation.day) {
  product.stock += delta;
  product.average = average;
  const id = nextId(state.movements);
  state.movements.push({id, operation_id: operation.id, product_id: product.id, delta, balance: product.stock, kind, day});
}

export function detail(state, id) {
  const {request_key, signature, ...display} = find(state.operations, id, "Opération introuvable.");
  return {...display, number: number(display.kind, id)};
}

export function salePayments(sale) {
  return [{day: sale.day, method: sale.method, amount: sale.credit?.deposit ?? sale.total},
    ...(sale.credit?.payments || [])];
}

export function remaining(sale) {
  return sale.canceled_at ? 0 : sale.total - salePayments(sale).reduce((sum, p) => sum + p.amount, 0);
}

export function settleSale(state, data, id) {
  const sale = find(state.operations, id, "Ticket introuvable.");
  if (!sale.credit) throw new Error("Ce ticket est déjà payé intégralement.");
  const {request_key, signature, previous} = attempt(sale.credit.payments, "settle", data);
  if (previous) return detail(state, id);
  if (sale.canceled_at) throw new Error("Ce ticket est annulé.");
  const day = operationDay(data);
  if (day < sale.day) throw new Error("Le règlement doit être daté du jour de la vente ou après.");
  writableDay(state, day);
  const amount = integer(data.amount, "Montant du règlement", 1, remaining(sale));
  sale.credit.payments.push({day, amount, method: payment(data.method), request_key, signature});
  return detail(state, id);
}

export function addOperation(state, kind, data) {
  const {request_key, signature, previous} = attempt(state.operations, kind, data);
  if (previous) return detail(state, previous.id);
  const day = operationDay(data);
  const note = text(data, "note", "Note ou motif", 300, kind === "adjust");
  if (kind !== "adjust") writableDay(state, day);
  const method = kind === "adjust" ? "" : payment(data.method);
  const contactKind = kind === "sale" ? "client" : "supplier";
  const contact = data.contact_id && kind !== "adjust"
    ? find(state.contacts.filter(c => c.kind === contactKind), data.contact_id, "Contact introuvable.") : null;
  if (!Array.isArray(data.lines) || !data.lines.length || data.lines.length > 100 || (kind === "adjust" && data.lines.length !== 1)) {
    throw new Error(kind === "adjust" ? "Ajuste un produit à la fois." : "Saisis entre 1 et 100 produits.");
  }
  const seen = new Set();
  const entries = data.lines.map(input => {
    const product = find(state.products.filter(p => p.active), input.product_id, "Produit introuvable ou archivé.");
    if (seen.has(product.id)) throw new Error("Regroupe les quantités d’un même produit sur une ligne.");
    seen.add(product.id);
    if (kind === "adjust" && input.expected_stock !== undefined && input.expected_stock !== product.stock) {
      throw new Error("Le stock a changé depuis le comptage. Ferme la fiche, actualise le stock et recompte le produit.");
    }
    const limit = kind === "adjust" && input.expected_stock !== undefined ? MAX_STOCK : MAX_QUANTITY;
    const quantity = integer(input.quantity, "Quantité", kind === "adjust" ? -limit : 1, limit);
    if (!quantity) throw new Error("La variation doit être différente de zéro.");
    const delta = kind === "sale" ? -quantity : quantity;
    if (product.stock + delta < 0) throw new Error(`Stock insuffisant pour « ${product.name} ».`);
    if (product.stock + delta > MAX_STOCK) throw new Error(`Stock maximal dépassé pour « ${product.name} ».`);
    const unit = kind === "purchase" ? integer(input.unit, "Coût unitaire") : kind === "sale" ? product.price : 0;
    if (kind === "sale" && input.unit !== undefined && input.unit !== unit) {
      throw new Error(`Le prix de « ${product.name} » a changé. Rouvre la caisse.`);
    }
    const cost = kind === "purchase" ? unit * 100 : product.average;
    return {product, delta, line: {product_id: product.id, name: product.name, sku: product.sku, quantity, unit, cost}};
  });
  const subtotal = entries.reduce((sum, {line}) => sum + line.unit * line.quantity, 0);
  const discount = kind === "sale" ? integer(data.discount ?? 0, "Remise", 0, subtotal) : 0;
  const {shop, phone, address} = state.settings;
  const operation = {id: nextId(state.operations), kind, request_key, signature, day, note, method,
    contact_id: contact?.id ?? null, contact_name: contact?.name ?? "", shop, shop_phone: phone, shop_address: address,
    lines: entries.map(entry => entry.line), discount, total: subtotal - discount, canceled_at: null, cancel_reason: null};
  if (kind === "sale" && data.payment_mode === "partial") {
    if (!contact) throw new Error("Choisis une cliente pour cette vente à crédit.");
    if (operation.total <= 0) throw new Error("Le total de la vente doit être positif.");
    const deposit = integer(data.deposit, "Acompte", 0, operation.total - 1);
    const due = data.due || "";
    if (due && (!isDay(due) || due < day)) throw new Error("L’échéance doit être à partir du jour de la vente.");
    operation.credit = {deposit, due, payments: []};
  }
  for (const {product, delta, line} of entries) {
    const average = kind === "purchase" ? costAverage(product.stock, product.average, delta, line.cost) : product.average;
    move(state, product, operation, delta, average, kind);
  }
  state.operations.push(operation);
  return detail(state, operation.id);
}

export function cancelSale(state, data, id) {
  const reason = text(data, "reason", "Motif d’annulation", 300, true);
  const operation = find(state.operations, id, "Vente introuvable.");
  if (operation.kind !== "sale") throw new Error("Seuls les tickets de vente peuvent être annulés.");
  if (operation.canceled_at) return detail(state, id);
  writableDay(state, today());
  const items = operation.lines.map(line => {
    const product = find(state.products, line.product_id, "Produit introuvable.");
    if (product.stock + line.quantity > MAX_STOCK) throw new Error("Stock maximal dépassé.");
    return {product, line};
  });
  const canceled = new Date().toISOString();
  for (const {product, line} of items) {
    const average = costAverage(product.stock, product.average, line.quantity, line.cost);
    move(state, product, operation, line.quantity, average, "return", canceled.slice(0, 10));
    product.active = 1;
  }
  operation.canceled_at = canceled;
  operation.cancel_reason = reason;
  return detail(state, id);
}

export function addExpense(state, data) {
  const {request_key, signature, previous} = attempt(state.expenses, "expense", data);
  if (previous) return {id: previous.id};
  const id = nextId(state.expenses);
  const day = operationDay(data);
  writableDay(state, day);
  state.expenses.push({id, request_key, signature, day, method: payment(data.method),
    category: text(data, "category", "Catégorie", 60, true), note: text(data, "note", "Libellé", 300, true),
    amount: integer(data.amount, "Montant", 1), canceled_at: null});
  return {id};
}

export function cancelExpense(state, id) {
  const expense = find(state.expenses, id, "Dépense introuvable.");
  if (!expense.canceled_at) writableDay(state, today());
  expense.canceled_at ??= new Date().toISOString();
  return {ok: true};
}
