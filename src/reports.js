import {CATEGORIES, DAY, MAX_QUANTITY, PAYMENTS, VERSION, find, isDay, number, offset, today} from "./model.js";

const alphabetical = (a, b) => a.name.localeCompare(b.name, "fr", {sensitivity: "base"}) || a.id - b.id;
const recent = (a, b) => b.day.localeCompare(a.day) || b.id - a.id;

export function bootstrap(state) {
  return {today: today(), version: VERSION, demo: false, settings: state.settings, payments: PAYMENTS,
    categories: CATEGORIES, products: [...state.products].sort(alphabetical), contacts: [...state.contacts].sort(alphabetical)};
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
      status: canceled_at ? "canceled" : "valid", flow: canceled_at ? 0 : kind === "sale" ? total : -total});
    if (kind === "purchase") {
      purchases_total += total;
      purchases.push(item);
      continue;
    }
    const lineCost = lines.reduce((sum, line) => sum + BigInt(line.cost) * BigInt(line.quantity), 0n);
    sales.push({...item, cost: Number(lineCost)});
    if (canceled_at) continue;
    revenue += total;
    discounts += operation.discount || 0;
    cost += lineCost;
    sale_count++;
    channels[method] += total;
    series[(Date.parse(day) - Date.parse(start)) / DAY].total += total;
    for (const line of lines) {
      units_sold += line.quantity;
      const row = best.get(line.product_id) ?? {product_id: line.product_id, name: products.get(line.product_id).name, quantity: 0, gross: 0};
      row.quantity += line.quantity;
      row.gross += line.quantity * line.unit;
      best.set(line.product_id, row);
    }
  }
  for (const {id, day, category, note, amount, canceled_at} of expenses) {
    journal.push({kind: "expense", id, day, number: number("expense", id), party: category, method: "", note,
      amount, status: canceled_at ? "canceled" : "valid", flow: canceled_at ? 0 : -amount});
    if (!canceled_at) {
      expenses_total += amount;
      categories.set(category, (categories.get(category) ?? 0) + amount);
    }
  }
  const gross = BigInt(revenue) * 100n - cost;
  const top = [...best.values()].sort((a, b) => b.quantity - a.quantity || alphabetical(a, b)).slice(0, 5);
  const expense_categories = [...categories].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
  return {revenue, discounts, units_sold, gross_sales: revenue + discounts,
    gross_margin: Number(gross) / 100, cost_of_sales: Number(cost) / 100,
    expenses_total, purchases_total, net_flow: revenue - expenses_total - purchases_total,
    result: Number(gross - BigInt(expenses_total) * 100n) / 100,
    journal: journal.sort(recent), expense_categories, sale_count, sales, purchases, expenses, series, channels, top};
}
