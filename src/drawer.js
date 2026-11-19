import {attempt, integer, isDay, payment, PAYMENTS, today, writableDay} from "./model.js";

const money = (value, label) => integer(value, label, 0, Number.MAX_SAFE_INTEGER);

export function drawer(state, day = today()) {
  if (!isDay(day) || day > today()) throw new Error("Date de caisse invalide.");
  const session = state.sessions?.find(s => s.day === day);
  const channels = PAYMENTS.map(method => ({method, sales: 0, purchases: 0, expenses: 0, withdrawals: 0, reversals: 0}));
  const unknown = [];
  function record(entry, kind, amount, column) {
    const reversal = entry.canceled_at?.slice(0, 10) === day;
    if (entry.day !== day && !reversal) return;
    const row = channels.find(r => r.method === entry.method);
    if (!row) { unknown.push({kind, id: entry.id, label: entry.note || entry.contact_name, amount}); return; }
    if (entry.day === day) row[column] += amount;
    if (reversal) row.reversals += column === "sales" ? -amount : amount;
  }
  for (const o of state.operations) {
    if (o.kind !== "adjust") record(o, o.kind, o.total, o.kind === "sale" ? "sales" : "purchases");
  }
  for (const e of state.expenses) record(e, "expense", e.amount, "expenses");
  const withdrawals = (state.withdrawals || []).filter(w => w.day === day);
  for (const w of withdrawals) record(w, "withdrawal", w.amount, "withdrawals");
  const cash = channels[0];
  const expected = (session?.opening || 0) + cash.sales - cash.purchases - cash.expenses - cash.withdrawals + cash.reversals;
  return {day, session, channels, unknown, expected, withdrawals,
    history: (state.sessions || []).filter(s => s.closed).map(s => s.day).sort().reverse()};
}

export function changeDrawer(state, action, data) {
  const view = drawer(state, data.day);
  const {day, session, expected, unknown, channels} = view;
  if (action === "open") {
    const opening = money(data.opening, "Fonds initial");
    if (session) {
      if (!session.closed && session.opening === opening) return {ok: true};
      throw new Error("Cette journée de caisse existe déjà.");
    }
    (state.sessions ??= []).push({day, opening, closed: null});
    return {ok: true};
  }
  if (action === "withdraw") {
    const items = state.withdrawals ??= [];
    const {request_key, signature, previous} = attempt(items, "withdraw", data);
    if (previous) return {id: previous.id};
    writableDay(state, day);
    if (!session) throw new Error("Ouvre la journée de caisse.");
    const amount = integer(data.amount, "Retrait", 1, Number.MAX_SAFE_INTEGER);
    const method = payment(data.method);
    const note = String(data.note || "").trim();
    if (!note || note.length > 300) throw new Error("Précise le motif du retrait (300 caractères maximum).");
    const id = items.reduce((max, w) => Math.max(max, w.id), 0) + 1;
    items.push({id, request_key, signature, day, amount, method, note});
    return {id};
  }
  if (action === "classify") {
    writableDay(state, day);
    if (!unknown.some(e => e.kind === data.kind && e.id === data.id)) throw new Error("Cette opération a changé. Actualise la caisse.");
    const list = data.kind === "expense" ? state.expenses : state.operations;
    list.find(e => e.id === data.id).method = payment(data.method);
    return {ok: true};
  }
  if (action !== "close" || !session) throw new Error("Ouvre la journée de caisse.");
  writableDay(state, day);
  if (unknown.length) throw new Error("Précise le paiement des anciennes sorties avant la clôture.");
  if (expected !== data.expected) throw new Error("Les espèces attendues ont changé. Rouvre la clôture pour vérifier le montant.");
  const counted = money(data.counted, "Espèces comptées");
  const gap = counted - expected;
  const reason = String(data.reason || "").trim();
  if ((gap && !reason) || reason.length > 300) throw new Error("Explique l’écart en 300 caractères maximum.");
  session.closed = {expected, counted, gap, reason, channels, at: new Date().toISOString()};
  return session;
}
