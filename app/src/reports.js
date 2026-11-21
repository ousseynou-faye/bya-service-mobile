import {CATEGORIES, DAY, MAX_QUANTITY, PAYMENTS, VERSION, find, isDay, number, offset, remaining, salePayments, today} from "./model.js";

const alphabetical = (a, b) => a.name.localeCompare(b.name, "fr", {sensitivity: "base"}) || a.id - b.id;
const recent = (a, b) => b.day.localeCompare(a.day) || b.id - a.id;

export function stockLevel(p) {
  if (!p.stock) return "empty";
  return p.stock <= p.threshold ? "low" : "available";
}

export function stockTotals(products) {
  let units = 0n, cost = 0n, retail = 0n, zeroCost = 0;
  for (const p of products) {
    if (!p.active) continue;
    const qty = BigInt(p.stock);
    units += qty;
    cost += qty * BigInt(p.average);
    retail += qty * BigInt(p.price);
    if (p.stock > 0 && !p.average) zeroCost++;
  }
  return {units, cost, retail, zeroCost};
}

export function bootstrap(state) {
  const balances = {};
  const day = today(), expected = [];
  const names = new Map(state.contacts.map(c => [c.id, c.name]));
  for (const o of state.operations) {
    if (!o.credit) continue;
    const balance = remaining(o);
    balances[o.contact_id] = (balances[o.contact_id] || 0) + balance;
    if (balance > 0 && o.credit.due && o.credit.due <= day) {
      expected.push({id: o.id, name: names.get(o.contact_id) || o.contact_name,
        number: number("sale", o.id), due: o.credit.due, balance});
    }
  }
  expected.sort((a, b) => a.due.localeCompare(b.due) || a.id - b.id);
  return {today: day, version: VERSION, demo: false, balances, expected, settings: state.settings, payments: PAYMENTS,
    categories: CATEGORIES, products: [...state.products].sort(alphabetical), contacts: [...state.contacts].sort(alphabetical)};
}

export function clientSummary(state, id) {
  const sales = state.operations.filter(o => o.kind === "sale" && o.contact_id === id).sort(recent);
  const credits = sales.filter(o => o.credit).map(o => ({id: o.id, number: number("sale", o.id),
    due: o.credit.due, total: o.total, canceled: Boolean(o.canceled_at), balance: remaining(o)}));
  const open = credits.filter(s => s.balance > 0);
  const due = open.map(s => s.due).filter(Boolean).sort()[0];
  const purchases = sales.filter(o => !o.canceled_at).slice(0, 5).map(o => ({
    id: o.id, day: o.day, total: o.total, articles: o.lines.map(l => l.quantity + " × " + l.name).join(", ")
  }));
  const offers = (state.offers || []).filter(o => o.clientId === id).sort(recent);
  return {credits, purchases, offers, due, total: open.reduce((sum, s) => sum + s.balance, 0)};
}

export function replenishment(state) {
  return state.products.filter(p => p.active && p.stock <= p.threshold)
    .sort((a, b) => a.stock - b.stock || alphabetical(a, b))
    .map(p => ({...p, quantity: Math.min(MAX_QUANTITY, Math.max(1, 2 * p.threshold) - p.stock)}));
}

export function movements(state, productId, limit = 300) {
  const products = new Map(state.products.map(p => [p.id, p]));
  return state.movements.filter(m => !productId || m.product_id === productId)
    .sort((a, b) => b.id - a.id).slice(0, limit)
    .map(m => ({...m, name: products.get(m.product_id).name, sku: products.get(m.product_id).sku}));
}

export function productHistory(state, id) {
  const product = find(state.products, id, "Produit introuvable.");
  const end = today(), start = offset(end, -29);
  let units = 0, last_day = null;
  for (const sale of state.operations) {
    if (sale.kind !== "sale" || sale.canceled_at || sale.day < start || sale.day > end) continue;
    const line = sale.lines.find(row => row.product_id === id);
    if (line) {
      units += line.quantity;
      if (!last_day || sale.day > last_day) last_day = sale.day;
    }
  }
  return {product, sales: {units, last_day}, movements: movements(state, id, 12)};
}

export function report(state, start = offset(today(), -29), end = today()) {
  if (!isDay(start) || !isDay(end)) throw new Error("Saisis des dates valides.");
  const days = (Date.parse(end) - Date.parse(start)) / DAY;
  if (days < 0 || days > 366) throw new Error("Choisis une période de 367 jours maximum.");
  const inRange = item => item.day >= start && item.day <= end;
  const inPeriod = state.operations.filter(inRange).sort(recent);
  const expenses = state.expenses.filter(inRange).sort(recent);
  const sales = [], purchases = [], journal = [];
  const series = Array.from({length: days + 1}, (_, day) => ({day: offset(start, day), total: 0}));
  const channels = Object.fromEntries(PAYMENTS.map(method => [method, 0]));
  const best = new Map(), categories = new Map();
  const products = new Map(state.products.map(p => [p.id, p]));
  let revenue = 0, cost = 0n, sale_count = 0, purchases_total = 0, expenses_total = 0;
  let discounts = 0, units_sold = 0;
  for (const operation of inPeriod) {
    const {id, kind, day, contact_name, method, total, note, canceled_at, lines} = operation;
    if (kind === "adjust") continue;
    const item = {id, day, contact_name, method, note, total, canceled_at, number: number(kind, id)};
    journal.push({kind, id, day, number: item.number, party: contact_name, method, note, amount: total,
      status: canceled_at ? "canceled" : "valid", flow: kind === "sale" ? (operation.credit?.deposit ?? total) : -total});
    if (kind === "purchase") {
      purchases_total += total;
      purchases.push(item);
      continue;
    }
    const lineCost = lines.reduce((sum, line) => sum + BigInt(line.cost) * BigInt(line.quantity), 0n);
    sales.push({...item, balance: remaining(operation), cost: Number(lineCost)});
    if (canceled_at) continue;
    revenue += total;
    discounts += operation.discount || 0;
    cost += lineCost;
    sale_count++;
    series[(Date.parse(day) - Date.parse(start)) / DAY].total += total;
    for (const line of lines) {
      units_sold += line.quantity;
      const row = best.get(line.product_id) ?? {product_id: line.product_id, name: products.get(line.product_id).name, quantity: 0, gross: 0};
      row.quantity += line.quantity;
      row.gross += line.quantity * line.unit;
      best.set(line.product_id, row);
    }
  }
  for (const sale of state.operations) {
    if (sale.kind !== "sale") continue;
    const ref = number("sale", sale.id);
    const refundDay = sale.canceled_at?.slice(0, 10);
    for (const [i, p] of salePayments(sale).entries()) {
      const entry = {id: sale.id, number: ref, party: sale.contact_name, method: p.method, amount: p.amount, note: "", status: "valid"};
      if (inRange(p)) {
        channels[p.method] += p.amount;
        if (i > 0) journal.push({...entry, kind: "settlement", day: p.day, flow: p.amount});
      }
      if (p.amount && refundDay >= start && refundDay <= end) {
        channels[p.method] -= p.amount;
        journal.push({...entry, kind: "refund", day: refundDay, flow: -p.amount});
      }
    }
  }
  const collected = Object.values(channels).reduce((sum, n) => sum + n, 0);
  for (const {id, day, category, note, amount, canceled_at, method} of expenses) {
    journal.push({kind: "expense", id, day, number: number("expense", id), party: category, method: method || "", note,
      amount, status: canceled_at ? "canceled" : "valid", flow: canceled_at ? 0 : -amount});
    if (!canceled_at) {
      expenses_total += amount;
      categories.set(category, (categories.get(category) ?? 0) + amount);
    }
  }
  let withdrawals_total = 0;
  for (const w of (state.withdrawals || []).filter(inRange)) {
    withdrawals_total += w.amount;
    journal.push({kind: "withdrawal", id: w.id, day: w.day, number: "R-" + w.id, party: "", method: w.method,
      note: w.note, amount: w.amount, status: "valid", flow: -w.amount});
  }
  const gross = BigInt(revenue) * 100n - cost;
  const top = [...best.values()].sort((a, b) => b.quantity - a.quantity || alphabetical(a, b)).slice(0, 5);
  const expense_categories = [...categories].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
  return {revenue, collected, discounts, units_sold, gross_sales: revenue + discounts,
    gross_margin: Number(gross) / 100, cost_of_sales: Number(cost) / 100,
    expenses_total, purchases_total, withdrawals_total, net_flow: collected - expenses_total - purchases_total - withdrawals_total,
    result: Number(gross - BigInt(expenses_total) * 100n) / 100,
    journal: journal.sort(recent), expense_categories, sale_count, sales, purchases, expenses, series, channels, top};
}
