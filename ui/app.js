"use strict";
import {remaining, salePayments} from "../src/model.js";

const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  cart: '<path d="M2 4h3l2.4 11h11.7l2-8H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  box: '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 9v9M3 8l9 5 9-5M7.5 5.5l9 5"/>',
  stack: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 1 1 12 0v2M17 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v2"/>',
  trend: '<path d="M3 3v18h18M7 15l4-4 3 3 6-7m-4 0h4v4"/>',
  wallet: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M21 10h-6a2.5 2.5 0 0 0 0 5h6m-5-2.5h.01M4 5l14-2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M10 3h4l.5 2.2 1.6.9 2.2-.7 2 3.5-1.7 1.5v1.9l1.7 1.5-2 3.5-2.2-.7-1.6.9-.5 2.2h-4l-.5-2.2-1.6-.9-2.2.7-2-3.5 1.7-1.5v-1.9L3.7 9l2-3.5 2.2.7 1.6-.9.5-2.3Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 10h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  receipt: '<path d="M5 3l3 2 4-2 4 2 3-2v18l-3-2-4 2-4-2-3 2V3Zm4 7h6m-6 4h6"/>',
  alert: '<path d="M10.4 4.3 3 17.2A1.8 1.8 0 0 0 4.6 20h14.8a1.8 1.8 0 0 0 1.6-2.8L13.6 4.3a1.8 1.8 0 0 0-3.2 0ZM12 9v4m0 3h.01"/>',
  leaf: '<path d="M20 4c-8-1-16 2-16 9a6 6 0 0 0 6 6c7 0 10-8 10-15ZM4 21l10-10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  close: '<path d="m6 6 12 12m0-12L6 18"/>',
  print: '<path d="M7 8V3h10v5m-10 9H3V9h18v8h-4m-10-3h10v7H7v-7Z"/>'
};

const sections = {
  dashboard: ["Vue d’ensemble", "grid"], cash: ["Caisse", "cart"],
  products: ["Produits", "box"], stock: ["Achats et stock", "stack"],
  replenish: ["À réapprovisionner", "alert"],
  contacts: ["Contacts", "people"], expenses: ["Dépenses", "wallet"],
  reports: ["Finances", "wallet"], settings: ["Paramètres", "gear"]
};

const state = {
  page: "dashboard", view: 0, data: null, periods: {},
  productQuery: "", category: "", productStatus: "active",
  ticketQuery: "", cashSales: [],
  stockFilter: "", contactKind: "client", replenishment: [],
  finance: {kind: "", status: "", report: null, preset: "month"}
};

const main = document.getElementById("main");
const dialog = document.getElementById("dialog");
const menuControls = [document.getElementById("toggle-menu"), document.getElementById("mobile-menu")];
const money = new Intl.NumberFormat("fr-SN", {maximumFractionDigits: 2});
const number = new Intl.NumberFormat("fr-SN");
const longDate = new Intl.DateTimeFormat("fr-SN", {day: "numeric", month: "long", year: "numeric", timeZone: "UTC"});
const shortDate = new Intl.DateTimeFormat("fr-SN", {day: "2-digit", month: "short", timeZone: "UTC"});
const weekday = new Intl.DateTimeFormat("fr-SN", {weekday: "short", timeZone: "UTC"});
const compactNumber = new Intl.NumberFormat("fr-SN", {notation: "compact", maximumFractionDigits: 1});
const channels = {sale: "Vente", purchase: "Achat", adjust: "Ajustement", return: "Retour"};
const journalTypes = {sale: "Vente", purchase: "Achat", expense: "Dépense", withdrawal: "Retrait", settlement: "Règlement", refund: "Remboursement"};
const financePresets = {today: "Aujourd’hui", month: "Ce mois", previous: "Mois précédent"};
let toastTimer;
let menuTrigger = menuControls[0];

function icon(name) {
  return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + icons[name] + '</svg>';
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function fcfa(value) { return money.format(value) + " FCFA"; }
function pretty(day) { return longDate.format(new Date(day + "T00:00:00Z")); }
function dayOffset(day, offset) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function requestKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
}

function button(label, action, options = {}) {
  const style = options.style || "secondary";
  return '<button type="button" class="btn ' + style + (options.small ? " small" : "") +
    '" data-action="' + esc(action) + '"' + (options.id == null ? "" : ' data-id="' + esc(options.id) + '"') +
    (options.pressed == null ? "" : ' aria-pressed="' + options.pressed + '"') +
    '>' + (options.icon ? icon(options.icon) : "") + esc(label) + '</button>';
}

function link(label, href, style = "subtle", symbol = "arrow") {
  if (href.startsWith("/api/")) {
    return '<button type="button" class="btn ' + style + '" data-download="' + esc(href) + '">' +
      (symbol ? icon(symbol) : "") + esc(label) + '</button>';
  }
  return '<a class="btn ' + style + '" href="' + esc(href) + '">' + esc(label) +
    (symbol ? icon(symbol) : "") + '</a>';
}

function badge(label, tone = "") {
  return '<span class="badge ' + tone + '">' + esc(label) + '</span>';
}

function empty(title, description = "") {
  return '<div class="empty"><p><strong>' + esc(title) + '</strong></p>' +
    (description ? '<p>' + esc(description) + '</p>' : '') + '</div>';
}

function heading(title, description, action = "") {
  return '<div class="page-heading"><div class="page-intro"><span class="section-symbol">' +
    icon(sections[state.page][1]) + '</span><div><h1>' + esc(title) + '</h1><p>' +
    esc(description) + '</p></div></div>' + (action ? '<div class="actions">' + action + '</div>' : '') + '</div>';
}

function titlebar(title, description = "", action = "") {
  return '<div class="section-heading"><div><h2>' + esc(title) + '</h2>' +
    (description ? '<p>' + esc(description) + '</p>' : '') + '</div>' + action + '</div>';
}

function table(headers, items, render, emptyMessage, emptyHint = "") {
  if (!items.length) return empty(emptyMessage, emptyHint);
  return '<div class="table-wrap" tabindex="0" role="region" aria-label="Tableau"><table role="table"><thead role="rowgroup"><tr role="row">' +
    headers.map(label => '<th role="columnheader" scope="col">' + esc(label) + '</th>').join("") +
    '</tr></thead><tbody role="rowgroup">' + items.map(item => {
      let column = 0;
      const cells = render(item).replace(/<td(?=[ >])/g, () =>
        '<td role="cell" data-label="' + esc(headers[column++]) + '"');
      return '<tr role="row">' + cells + '</tr>';
    }).join("") +
    '</tbody></table></div>';
}

const td = (html, cls = "") => '<td' + (cls ? ' class="' + cls + '"' : '') +
  '><div class="cell-value">' + html + '</div></td>';

function stat(label, value, blurb, symbol, tint = "") {
  return '<article class="stat"><div class="stat-top"><span>' + esc(label) +
    '</span><span class="stat-icon ' + tint + '">' + icon(symbol) + '</span></div><strong>' +
    esc(value) + '</strong><small>' + esc(blurb) + '</small></article>';
}

function selectOptions(options, current) {
  return options.map(([key, label]) => '<option value="' + esc(key) + '"' +
    (String(key) === String(current) ? " selected" : "") + '>' + esc(label) + '</option>').join("");
}

function field(label, input, full = false) {
  return '<label class="field' + (full ? " full" : "") + '"><span>' + esc(label) + '</span>' + input + '</label>';
}

function input(name, value, extra = "") {
  return '<input name="' + name + '" value="' + esc(value ?? "") + '" ' + extra + '>';
}

function pick(name, options, value, extra = "") {
  return '<select name="' + name + '" ' + extra + '>' + selectOptions(options, value) + '</select>';
}

function toast(message, error = false) {
  const banner = document.getElementById("toast");
  banner.textContent = message;
  banner.classList.toggle("error", error);
  banner.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { banner.hidden = true; }, 4200);
}

function api(url, data) {
  return window.byaLocal.request(url, data);
}

const activeProducts = () => state.data.products.filter(p => p.active);
const stockAlerts = () => activeProducts().filter(p => p.stock <= p.threshold)
  .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, "fr"));
const initialPeriod = () => ({start: state.data.today.slice(0, 8) + "01", end: state.data.today});
const currentPeriod = key => state.periods[key] || initialPeriod();
const queryPeriod = period => new URLSearchParams(period).toString();

function navLink(key, count) {
  const current = key === state.page || (key === "reports" && state.page === "expenses");
  return '<a class="nav-link" href="#' + key + '"' + (current ? ' aria-current="page"' : '') +
    '>' + icon(sections[key][1]) + '<span>' + sections[key][0] + '</span>' +
    (count ? '<span class="nav-count" title="' + count + ' produit(s) à surveiller">' + count + '</span>' : '') + '</a>';
}

function navigation() {
  const count = stockAlerts().length;
  document.getElementById("navigation").innerHTML =
    '<div class="nav-group"><p>Boutique</p>' + ["dashboard", "cash", "products", "stock", "replenish"]
      .map(key => navLink(key, key === "replenish" ? count : 0)).join("") + '</div>' +
    '<div class="nav-group"><p>Gestion</p>' + navLink("reports") + navLink("contacts") + '</div>';
  document.getElementById("settings-link").innerHTML = navLink("settings");
  document.getElementById("mobile-pages").innerHTML = [["dashboard", "Accueil"], ["cash", "Caisse"],
    ["products", "Produits"], ["reports", "Finances"]].map(([page, label]) => {
    const current = page === state.page || (page === "reports" && state.page === "expenses");
    return '<a href="#' + page + '"' + (current ? ' aria-current="page"' : '') + '>' +
      icon(sections[page][1]) + '<span>' + label + '</span></a>';
  }).join("");
  document.getElementById("brand-name").textContent = state.data.settings.shop;
  document.getElementById("top-shop").textContent = state.data.settings.shop;
  document.getElementById("today").innerHTML = icon("calendar") + esc(pretty(state.data.today));
  document.getElementById("section-title").textContent = sections[state.page][0];
  document.getElementById("demo-mark").hidden = !state.data.demo;
  document.getElementById("local-mode").textContent = "Données sur cet appareil";
  document.getElementById("footer").textContent = state.data.settings.shop + " · Version " + state.data.version;
  document.title = sections[state.page][0] + " — " + state.data.settings.shop;
}

function dashboardChart(report) {
  const max = Math.max(...report.series.map(p => p.total));
  if (!max) return dashboardEmpty("trend", "Aucune vente sur la période", "Les ventes validées apparaîtront ici.");
  const unit = 10 ** Math.floor(Math.log10(max / 3));
  const scale = Math.ceil(max / (unit * 3)) * unit * 3;
  const columns = report.series.map(point => {
    const date = new Date(point.day);
    const today = point.day === state.data.today;
    const height = point.total ? Math.max(2, point.total / scale * 120) : 2;
    return '<li class="chart-column' + (today ? ' is-today' : '') +
      '" aria-label="' + esc(pretty(point.day) + " · " + fcfa(point.total)) + '">' +
      '<svg viewBox="0 0 40 120" preserveAspectRatio="none" aria-hidden="true">' +
      '<title>' + esc(shortDate.format(date) + " · " + fcfa(point.total)) + '</title>' +
      '<rect class="' + (point.total ? "has-sales" : "no-sales") + '" x="2" y="' +
      (120 - height) + '" width="36" height="' + height + '" rx="4"/></svg>' +
      '<span aria-hidden="true">' + esc(weekday.format(date).replace(".", "")) + '</span></li>';
  }).join("");
  const axis = [scale, scale * 2 / 3, scale / 3, 0].map(n => '<span>' + esc(compactNumber.format(n)) + '</span>').join("");
  return '<div class="sales-chart"><div class="chart-scale" aria-hidden="true">' + axis +
    '</div><ol class="chart-columns" aria-label="Chiffre d’affaires en FCFA par jour">' + columns + '</ol></div>';
}

function recentSales(items) {
  return table(["Ticket", "Date", "Client", "Paiement", "Montant", "Statut", "Actions"], items, sale =>
    td("<strong>" + esc(sale.number) + "</strong>") + td(esc(pretty(sale.day))) +
    td(esc(sale.contact_name || "Client comptoir"), "wrap-cell") + td(esc(sale.method)) +
    td("<strong>" + esc(fcfa(sale.total)) + "</strong>", "numeric") +
    td(sale.canceled_at ? badge("Annulée", "bad") : sale.balance ? badge("À payer · " + fcfa(sale.balance), "warn") : badge("Soldé", "good")) +
    td(button("Voir le ticket", "detail", {id: sale.id, small: true, style: "subtle"})),
    "Aucune vente sur cette période.");
}

function dashboardEmpty(symbol, title, message) {
  return '<div class="home-empty"><span class="product-icon">' + icon(symbol) +
    '</span><strong>' + esc(title) + '</strong><p>' + esc(message) + '</p></div>';
}

function dashboardFlag() {
  if (!activeProducts().length) {
    return '<aside class="home-setup"><span class="product-icon">' + icon("box") +
      '</span><div><strong>Ajoutez votre premier produit</strong>' +
      '<p>Créez sa fiche, puis enregistrez la quantité reçue dans les achats.</p></div>' +
      button("Ajouter un produit", "new-product", {icon: "plus"}) + '</aside>';
  }
  const count = stockAlerts().length;
  return count ? '<aside class="home-setup home-stock-alert"><span class="product-icon gold">' + icon("alert") +
    '</span><div><strong>' + number.format(count) + (count === 1 ? " produit à réapprovisionner" : " produits à réapprovisionner") +
    '</strong><p>Consultez les quantités suggérées avant de préparer votre prochain achat.</p></div>' +
    link("Voir la liste", "#replenish", "secondary") + '</aside>' : "";
}

function dashboardInventory(alerts) {
  if (!alerts.length) {
    return dashboardEmpty("box", "Aucune alerte de stock", activeProducts().length ?
      "Vos produits sont au-dessus de leur seuil d’alerte." : "Ajoutez un produit pour suivre son stock.");
  }
  return '<ul class="inventory-list">' + alerts.slice(0, 4).map(p =>
    '<li><span class="product-icon ' + productTone(p) + '">' + icon(p.category === "Savons" ? "leaf" : "box") +
    '</span><div><strong>' + esc(p.name) + '</strong><span class="item-sub">' +
    esc(p.sku) + ' · Seuil ' + number.format(p.threshold) + '</span></div>' +
    badge(p.stock ? number.format(p.stock) + " en stock" : "Rupture", p.stock ? "warn" : "bad") + '</li>').join("") + '</ul>';
}

function dashboardSales(items) {
  if (!items.length) return dashboardEmpty("receipt", "Aucun ticket récent", "Vos derniers tickets apparaîtront ici.");
  return '<ul class="home-sales">' + items.slice(0, 5).map(sale =>
    '<li><span class="product-icon">' + icon("receipt") + '</span>' +
    '<div class="home-sale-info"><strong>' + esc(sale.number + " · " + (sale.contact_name || "Client comptoir")) +
    '</strong><span class="item-sub">' + esc(shortDate.format(new Date(sale.day)) + " · " + sale.method) + '</span></div>' +
    '<div class="home-sale-amount"><strong>' + esc(fcfa(sale.total)) + '</strong>' +
    (sale.canceled_at ? badge("Annulée", "bad") : "") + '</div>' +
    button("Voir le ticket", "detail", {id: sale.id, small: true, style: "subtle"}) + '</li>').join("") + '</ul>';
}

function dashboardShell() {
  return '<section class="home-cover" aria-labelledby="home-title"><div class="home-hero"><div class="home-hero-copy">' +
    '<p class="home-domain">' + esc(pretty(state.data.today)) + '</p><h1 id="home-title">Tableau de bord</h1>' +
    button("Nouvelle vente", "new-sale", {style: "primary", icon: "cart"}) + '</div>' +
    '<div class="home-visual" aria-hidden="true"></div></div>' +
    '<div class="home-tools" role="group" aria-label="Opérations de boutique">' +
    button("Nouvel achat", "new-purchase", {icon: "box"}) + button("Ajouter une dépense", "new-expense", {icon: "wallet"}) +
    '</div></section><div id="home-live" aria-busy="true"><div class="initial home-loading" role="status">Chargement de l’activité…</div></div>';
}

function dashboardActivity(report) {
  const daySales = report.sales.filter(s => s.day === state.data.today && !s.canceled_at);
  const dayRevenue = daySales.reduce((total, s) => total + s.total, 0);
  const dayCost = daySales.reduce((total, s) => total + s.cost, 0);
  const alerts = stockAlerts();
  const outOfStock = alerts.filter(p => p.stock === 0).length;
  return '<section class="home-stats">' + titlebar("Aujourd’hui") + '<div class="stats">' +
    stat("Chiffre d’affaires", fcfa(dayRevenue), "Net des remises", "wallet") +
    stat("Tickets de vente", number.format(daySales.length), "Ventes validées", "receipt", "violet") +
    stat("Marge brute", fcfa((dayRevenue * 100 - dayCost) / 100), "Après coût des produits vendus", "trend", "green") +
    stat("Stock à surveiller", number.format(alerts.length), outOfStock ? number.format(outOfStock) + " en rupture" :
      "Au seuil ou en rupture", "alert", "gold") + '</div></section>' +
    dashboardFlag() + '<div class="home-grid"><section class="panel sales-panel">' +
    titlebar("Évolution des ventes", "Chiffre d’affaires en FCFA · 7 derniers jours", link("Finances", "#reports")) +
    '<p class="chart-total"><strong>' + esc(fcfa(report.revenue)) + '</strong><span> sur la période</span></p>' +
    dashboardChart(report) + '</section>' +
    '<section class="panel inventory-panel">' + titlebar("Alertes de stock", "", link("Réapprovisionner", "#replenish")) +
    dashboardInventory(alerts) + '</section></div><section class="panel home-recent">' +
    titlebar("Dernières ventes", "", link("Historique", "#cash")) + dashboardSales(report.sales) + '</section>';
}

function dateToolbar(key) {
  const period = currentPeriod(key);
  return '<form class="toolbar" data-period="' + key + '">' +
    field("Du", input("start", period.start, 'type="date" required')) +
    field("Au", input("end", period.end, 'type="date" required')) +
    '<button class="btn secondary" type="submit">Appliquer</button>' +
    '</form>';
}

function matchingTickets() {
  const query = state.ticketQuery.trim().toLocaleLowerCase("fr");
  const matches = state.cashSales.filter(sale => [sale.number, sale.contact_name || "Client comptoir", sale.method]
    .some(value => value.toLocaleLowerCase("fr").includes(query)));
  return query && !matches.length ? empty("Aucun ticket correspondant.", "Essayez un numéro, un client ou un moyen de paiement.") : recentSales(matches);
}

let drawerDay = "";
let currentDrawer;
function paymentField(label) {
  return field(label, pick("method", [["", "Sélectionner"], ...state.data.payments.map(p => [p, p])], "", "required"));
}

const workspaceViews = {
  cash: [["day", "Journée"], ["tickets", "Tickets"]],
  stock: [["inventory", "Inventaire"], ["purchases", "Achats"], ["movements", "Mouvements"]],
  reports: [["summary", "Synthèse"], ["journal", "Journal"], ["analysis", "Analyses"]]
};
const selectedView = {cash: "day", stock: "inventory", reports: "summary"};

function viewPicker(page) {
  return '<div class="view-picker" role="group" aria-label="Vues de la rubrique">' +
    workspaceViews[page].map(([key, label]) => '<button type="button" data-view="' + key + '" aria-pressed="' +
      (key === selectedView[page]) + '">' + label + '</button>').join("") + '</div>';
}

function displayView(page) {
  main.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = panel.dataset.panel !== selectedView[page]; });
  main.querySelectorAll("[data-view]").forEach(control => {
    control.setAttribute("aria-pressed", String(control.dataset.view === selectedView[page]));
  });
}

main.addEventListener("click", event => {
  const control = event.target.closest("[data-view]");
  if (!control) return;
  selectedView[state.page] = control.dataset.view;
  displayView(state.page);
});

function drawerPanel(view) {
  const {day, session, expected, unknown, history, withdrawals} = view;
  const closed = session?.closed;
  const channels = closed?.channels || view.channels;
  const actions = closed ? "" : session ? button("Enregistrer un retrait", "drawer-withdraw") +
    button("Clôturer la caisse", "drawer-close", {style: "primary"}) : button("Ouvrir la caisse", "drawer-open", {style: "primary"});
  const amounts = session ? '<div class="stats">' + stat("Fonds du matin", fcfa(session.opening), "Espèces au début de la journée", "wallet") +
    stat("Espèces attendues", unknown.length ? "À vérifier" : fcfa(closed?.expected ?? expected), "Dans le tiroir", "wallet", "green") +
    (closed ? stat("Espèces comptées", fcfa(closed.counted), "À la clôture", "receipt") +
      stat("Écart de caisse", fcfa(closed.gap), closed.reason || "Comptage conforme", "stack") : "") + '</div>' : "";
  return '<section class="panel drawer-day" data-panel="day">' + titlebar("Journée de caisse", pretty(day) + " · " +
    (closed ? "Clôturée" : session ? "Ouverte" : "À ouvrir")) +
    '<div class="toolbar">' + field("Consulter une date", input("drawer-day", day, 'type="date" id="drawer-day" max="' + state.data.today + '"')) +
    (history.length ? field("Historique des clôtures", pick("drawer-history", [["", "Choisir une clôture"],
      ...history.map(d => [d, pretty(d)])], closed ? day : "", 'id="drawer-history"')) : "") +
    '<div class="actions">' + actions + '</div></div>' + amounts +
    (unknown.length ? '<p class="form-note">' + unknown.length + ' opération(s) sans moyen de paiement. ' +
      button("Préciser le paiement", "drawer-classify", {small:true}) + '</p>' : "") +
    (session ? '<details><summary>Récapitulatif par moyen de paiement</summary>' +
      table(["Moyen", "Ventes", "Achats", "Dépenses", "Retraits", "Annulations (+/−)"], channels,
        r => td(esc(r.method)) + [r.sales, r.purchases, r.expenses, r.withdrawals, r.reversals].map(n => td(esc(fcfa(n)), "numeric")).join(""), "") + '</details>' : "") +
    (withdrawals.length ? '<details><summary>Retraits de la journée</summary>' + table(["Motif", "Moyen", "Montant"], withdrawals,
      w => td(esc(w.note)) + td(esc(w.method)) + td(esc(fcfa(w.amount))), "") + '</details>' : "") + '</section>';
}

function editDrawer(action) {
  const {day, expected, unknown} = currentDrawer;
  const amount = (label, name) => field(label + " (FCFA)", input(name, "", 'type="number" min="0" step="1" inputmode="numeric" required'));
  const note = (label, name, required) => field(label, '<textarea name="' + name + '" maxlength="300" ' +
    (required ? 'required' : '') + '></textarea>', true);
  const request_key = requestKey();
  let title, fields;
  if (action === "open") {
    title = "Ouvrir la caisse";
    fields = amount("Fonds présent avant les opérations du jour", "opening");
  } else if (action === "withdraw") {
    title = "Enregistrer un retrait";
    fields = amount("Montant retiré", "amount") + paymentField("Moyen débité") + note("Motif du retrait", "note", true);
  } else if (action === "classify") {
    title = "Préciser le paiement";
    fields = field("Opération", pick("entry", unknown.map((e,i) => [i, journalTypes[e.kind] + " #" + e.id + " · " +
      (e.label || "") + " · " + fcfa(e.amount)]), 0)) + paymentField("Moyen utilisé");
  } else {
    if (unknown.length) return editDrawer("classify");
    title = "Clôturer la caisse";
    fields = '<p class="field full">Espèces attendues dans le tiroir : <strong>' + esc(fcfa(expected)) + '</strong></p>' +
      amount("Espèces réellement comptées", "counted") + '<output class="count-gap" aria-live="polite"></output>' +
      note("Explication en cas d’écart", "reason", false);
  }
  const form = dialogForm({title: title + " · " + pretty(day), fields, label: title, message: "Journée de caisse actualisée.",
    submit: data => {
      const values = formObject(data);
      for (const key of ["opening", "amount", "counted"]) if (key in values) values[key] = Number(values[key]);
      if (action === "classify") Object.assign(values, unknown[Number(values.entry)]);
      return api("/api/drawer/" + action, {...values, day, expected, request_key});
    }});
  if (action === "close") form.elements.counted.addEventListener("input", () => {
    const input = form.elements.counted;
    const gap = input.valueAsNumber - expected;
    form.querySelector("output").textContent = input.validity.valid ? "Écart : " + fcfa(gap) : "";
    form.elements.reason.required = input.validity.valid && gap !== 0;
  });
}

function renderCash(report) {
  state.cashSales = report.sales;
  return heading("Caisse", "Enregistrez les ventes et retrouvez les tickets par date.",
    button("Nouvelle vente", "new-sale", {style: "primary", icon: "plus"})) +
    viewPicker("cash") + drawerPanel(currentDrawer) +
    '<div class="stats" data-panel="tickets">' + stat("Encaissements nets", fcfa(report.collected), "Acomptes et règlements inclus, remboursements déduits", "wallet") +
    stat("Tickets validés", report.sale_count, "Hors annulations", "receipt", "green") +
    stat("Articles vendus", number.format(report.units_sold), "Quantités des tickets validés", "box", "violet") +
    stat("Panier moyen", report.sale_count ? fcfa(report.revenue / report.sale_count) : "—", "Valeur moyenne des ventes validées", "wallet", "gold") + '</div>' +
    '<section class="panel table-panel" data-panel="tickets">' + titlebar("Historique des ventes") + dateToolbar("cash") +
    '<div class="toolbar">' + field("Rechercher un ticket", input("ticket-search", state.ticketQuery,
      'id="ticket-search" type="search" placeholder="Ticket, client ou paiement"')) +
    '</div><div id="ticket-results">' + matchingTickets() + '</div></section>';
}

function productTone(p) {
  return {"Savons": "", "Packs": "violet", "Accessoires": "gold"}[p.category] ?? "green";
}

function productName(p) {
  return '<span class="row-product"><span class="product-icon ' + productTone(p) + '">' +
    icon(p.category === "Savons" ? "leaf" : "box") + '</span><span><strong>' + esc(p.name) +
    '</strong><span class="item-sub">' + esc(p.sku) + '</span></span></span>';
}

function productStatus(p) {
  if (!p.active) return badge("Archivé");
  if (!p.stock) return badge("Rupture", "bad");
  return p.stock <= p.threshold ? badge("Stock bas", "warn") : badge("Disponible", "good");
}

function productRows() {
  const normalize = value => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr");
  const query = normalize(state.productQuery.trim());
  const items = state.data.products.filter(p =>
    (state.productStatus === "all" || Boolean(p.active) === (state.productStatus === "active")) &&
    (!state.category || p.category === state.category) &&
    normalize(p.name + " " + p.sku).includes(query));
  return table(["Produit", "Catégorie", "Prix de vente", "Coût moyen", "Stock", "Statut", "Actions"], items, p =>
    td(productName(p)) + td(esc(p.category)) + td(esc(fcfa(p.price)), "numeric") +
    td(esc(p.average === 0 && p.stock === 0 ? "—" : fcfa(p.average / 100)), "numeric") +
    td(number.format(p.stock), "numeric") +
    td(productStatus(p)) +
    td('<div class="actions">' + button("Fiche", "product-history", {id: p.id, small: true, style: "subtle"}) +
      button("Modifier", "edit-product", {id: p.id, small: true, style: "subtle"}) +
      button(p.active ? "Archiver" : "Réactiver", "toggle-product", {id: p.id, small: true, style: "subtle"}) + '</div>'),
    state.data.products.length ? "Aucun produit ne correspond." : "Votre catalogue est vide.",
    state.data.products.length ? "Modifiez la recherche ou les filtres." : "Ajoutez votre premier savon ou produit cosmétique.");
}

function renderProducts() {
  const categories = Array.from(new Set([...state.data.categories, ...state.data.products.map(p => p.category)]));
  return heading("Produits", "Retrouvez vos références, vos prix et les quantités disponibles.",
    button("Ajouter un produit", "new-product", {style: "primary", icon: "plus"})) +
    '<section class="panel"><div class="toolbar">' +
    '<div class="grow">' + field("Rechercher un produit", input("product-search", state.productQuery,
      'id="product-search" type="search" placeholder="Nom ou référence"')) + '</div>' +
    field("Catégorie", pick("category-filter", [["", "Toutes"], ...categories.map(c => [c, c])],
      state.category, 'id="category-filter"')) +
    field("Statut", pick("product-status", [["active", "Actifs"], ["archived", "Archivés"], ["all", "Tous"]],
      state.productStatus, 'id="product-status"')) +
    '</div><div id="product-results">' + productRows() + '</div></section>';
}

function renderReplenishment(items) {
  const shortages = items.filter(p => p.stock === 0).length;
  const total = items.reduce((units, p) => units + p.quantity, 0);
  const actions = items.length ? link("Exporter la liste", "/api/replenishment/export", "secondary", "download") : "";
  const intro = heading("Réapprovisionnement", "Comparez les stocks et les seuils avant de préparer vos achats.", actions);
  if (!items.length) {
    return intro + '<section class="panel">' + dashboardEmpty("box", "Aucun produit à commander",
      activeProducts().length ? "Tous les produits actifs sont au-dessus de leur seuil." : "Ajoutez vos premiers produits au catalogue.") +
      '<div class="actions centered-actions">' + link("Ouvrir le catalogue", "#products", "secondary") + '</div></section>';
  }
  return intro + '<div class="stats">' +
    stat("Références à suivre", number.format(items.length), "Au seuil ou en rupture", "box") +
    stat("Ruptures", number.format(shortages), "Produits sans stock", "alert", "gold") +
    stat("Unités suggérées", number.format(total), "Quantités modifiables dans l’achat", "stack", "violet") +
    '</div><form class="panel replenishment-form" id="replenishment-form">' +
    titlebar("Liste d’achat", "Cible indicative par produit égale à deux fois le seuil, avec un minimum d’une unité.") +
    '<div class="replenishment-toolbar"><label class="stock-choice"><input type="checkbox" id="select-stock-all">Tout sélectionner</label>' +
    '<span id="stock-choice-count" role="status">0 produit sélectionné</span></div>' +
    table(["Choix", "Produit", "État", "Stock actuel", "Seuil", "À commander"], items, p =>
      td('<input class="stock-check" type="checkbox" name="stock-choice" value="' + p.id +
        '" aria-label="Sélectionner ' + esc(p.name + ' · ' + p.sku) + '">') +
      td(productName(p) + '<span class="item-sub">' + esc(p.category) + '</span>') +
      td(p.stock ? badge("Stock bas", "warn") : badge("Rupture", "bad")) +
      td(number.format(p.stock), "numeric") + td(number.format(p.threshold), "numeric") +
      td('<strong class="suggested-quantity">' + number.format(p.quantity) + '</strong>', "numeric"), "Aucun produit.") +
    '<div class="form-error" role="alert" hidden></div><div class="replenishment-footer">' +
    '<p class="inline-help">Vérifiez le fournisseur, les quantités et les coûts avant d’enregistrer.</p>' +
    '<button type="submit" class="btn primary" disabled>' + icon("box") + 'Préparer l’achat</button></div></form>';
}

function updateReplenishmentSelection(control) {
  const form = control.form;
  const all = form.querySelector("#select-stock-all");
  const choices = [...form.querySelectorAll('[name="stock-choice"]')];
  if (control === all) for (const choice of choices) choice.checked = all.checked;
  const count = choices.filter(choice => choice.checked).length;
  all.checked = count === choices.length;
  all.indeterminate = count > 0 && !all.checked;
  form.querySelector("#stock-choice-count").textContent = number.format(count) +
    (count <= 1 ? " produit sélectionné" : " produits sélectionnés");
  form.querySelector('[type="submit"]').disabled = count === 0;
  formError(form, count > 100 ? "Sélectionnez au maximum 100 produits par achat." : "");
}

async function showProductHistory(id) {
  showDialog("Fiche produit", '<p class="initial" data-product-load role="status">Chargement de la fiche…</p>', true);
  const marker = dialog.querySelector("[data-product-load]");
  const current = () => dialog.open && dialog.contains(marker);
  try {
    const history = await api("/api/products/" + id + "/history");
    if (current()) renderProductHistory(history);
  } catch (error) {
    if (current()) showDialog("Fiche produit", empty("La fiche n’a pas pu être chargée.", error.message) +
      '<div class="actions centered-actions">' + button("Réessayer", "product-history", {id}) + '</div>', true);
  }
}

function renderProductHistory({product, sales, movements}) {
  showDialog("Fiche produit", '<div class="product-profile-heading">' + productName(product) + productStatus(product) +
    '</div><div class="stats product-profile-stats">' +
    stat("Stock actuel", number.format(product.stock), "Seuil d’alerte · " + number.format(product.threshold), "box") +
    stat("Prix de vente", fcfa(product.price), "Coût moyen · " + fcfa(product.average / 100), "wallet", "violet") +
    stat("Unités vendues · 30 jours", number.format(sales.units), sales.last_day ? "Dernière vente · " + pretty(sales.last_day) :
      "Aucune vente validée sur la période", "trend", "green") + '</div>' +
    titlebar("Mouvements récents", "Jusqu’aux douze dernières opérations enregistrées pour ce produit.") +
    table(["Date", "Mouvement", "Variation", "Stock après", "Opération"], movements, movement =>
      td(esc(pretty(movement.day))) + td(esc(channels[movement.kind])) +
      td(badge((movement.delta > 0 ? "+" : "") + number.format(movement.delta), movement.delta > 0 ? "good" : "info")) +
      td(number.format(movement.balance), "numeric") +
      td(button("Détail", "detail", {id: movement.operation_id, small: true, style: "subtle"})), "Aucun mouvement pour ce produit.") +
    '<div class="actions dialog-actions">' + button("Voir les mouvements de stock", "product-movements", {id: product.id, icon: "arrow"}) +
    '</div>', true);
}

function openProductMovements(id) {
  selectedView.stock = "movements";
  state.stockFilter = String(id);
  dialog.close();
  if (state.page === "stock") {
    render().then(() => document.getElementById("stock-filter")?.focus());
  } else {
    location.hash = "stock";
  }
}


function renderStock(movements, report) {
  const products = activeProducts();
  const stockValue = products.reduce((total, p) => total + p.stock * p.average, 0);
  const units = products.reduce((total, p) => total + p.stock, 0);
  return heading("Achats et stock", "Réceptionnez les produits et suivez les entrées, les ventes et les ajustements.",
    button("Enregistrer un achat", "new-purchase", {style: "primary", icon: "plus"}) +
    link("Réapprovisionner", "#replenish", "secondary") + button("Ajuster le stock", "new-adjust", {icon: "stack"})) +
    '<div class="stats">' + stat("Unités en stock", number.format(units), products.length + " référence(s) active(s)", "box") +
    stat("Valeur du stock", fcfa(stockValue / 100), "Sur la base du coût moyen", "wallet", "green") +
    stat("Alertes de stock", stockAlerts().length, "Au seuil ou en rupture", "alert", "gold") + '</div>' +
    viewPicker("stock") + '<section class="panel table-panel" data-panel="inventory">' + titlebar("État des stocks") +
    table(["Produit", "Quantité", "Seuil", "Valeur au coût", "État", "Actions"],
      [...products].sort((a, b) => (a.stock === 0 ? 0 : a.stock <= a.threshold ? 1 : 2) -
        (b.stock === 0 ? 0 : b.stock <= b.threshold ? 1 : 2)), p =>
      td(productName(p)) + td(number.format(p.stock)) + td(number.format(p.threshold)) +
      td(esc(fcfa(p.average * p.stock / 100)), "numeric") +
      td(productStatus(p)) + td('<div class="actions">' + button("Compter", "count-stock", {id: p.id, small: true}) +
        button("Fiche", "product-history", {id: p.id, small: true, style: "subtle"}) + '</div>'),
    "Aucun produit actif.") + '</section>' +
    '<section class="panel table-panel" data-panel="purchases">' + titlebar("Achats enregistrés") + dateToolbar("stock") +
    table(["Référence", "Date", "Fournisseur", "Montant", "Actions"], report.purchases, item =>
      td("<strong>" + esc(item.number) + "</strong>") + td(esc(pretty(item.day))) +
      td(esc(item.contact_name || "—")) + td(esc(fcfa(item.total)), "numeric") +
      td(button("Voir l’achat", "detail", {id: item.id, small: true, style: "subtle"})),
      "Aucun achat sur cette période.") + '</section>' +
    '<section class="panel table-panel" data-panel="movements">' + titlebar("Mouvements de stock", "300 mouvements les plus récents pour le filtre choisi") +
    '<div class="toolbar">' + field("Produit", pick("stock-filter", [["", "Tous les produits"],
      ...state.data.products.map(p => [p.id, p.name + " · " + p.sku])], state.stockFilter, 'id="stock-filter"')) + '</div>' +
    table(["Date", "Produit", "Mouvement", "Variation", "Stock après", "Actions"], movements, movement =>
      td(esc(pretty(movement.day))) + td(esc(movement.name), "wrap-cell") + td(esc(channels[movement.kind])) +
      td(badge((movement.delta > 0 ? "+" : "") + movement.delta, movement.delta > 0 ? "good" : "info")) +
      td(number.format(movement.balance)) +
      td(button("Détail", "detail", {id: movement.operation_id, small: true, style: "subtle"})),
      "Aucun mouvement de stock.") + '</section>';
}

function renderContacts() {
  const kind = state.contactKind;
  const items = state.data.contacts.filter(contact => contact.kind === kind);
  const label = kind === "client" ? "client" : "fournisseur";
  return heading("Contacts", "Centralisez les coordonnées de vos clients et fournisseurs.",
    button("Ajouter un " + label, "new-contact", {style: "primary", icon: "plus"})) +
    '<section class="panel">' + '<div class="toolbar">' + field("Type de contact",
      pick("contact-kind", [["client", "Clients"], ["supplier", "Fournisseurs"]], kind, 'id="contact-kind"')) + '</div>' +
    table(["Nom", "Téléphone", "Note", ...(kind === "client" ? ["Reste à payer"] : []), "Actions"], items, item => td("<strong>" + esc(item.name) + "</strong>", "wrap-cell") +
      td(esc(item.phone || "—")) + td(esc(item.note || "—"), "wrap-cell") +
      (kind === "client" ? td(esc(fcfa(state.data.balances[item.id] || 0)), "numeric") : "") +
      td((kind === "client" ? button("Compte client", "client-account", {id: item.id, small: true}) : "") +
        button("Modifier", "edit-contact", {id: item.id, small: true, style: "subtle"})),
      "Aucun " + label + " enregistré.") + '</section>';
}

function renderExpenses(report) {
  return heading("Dépenses", "Enregistrez les frais de la boutique, comme le transport et l’emballage.",
    button("Ajouter une dépense", "new-expense", {style: "primary", icon: "plus"})) +
    '<div class="stats">' + stat("Dépenses de la période", fcfa(report.expenses_total), "Hors achats de marchandises", "wallet") + '</div>' +
    '<section class="panel table-panel">' + titlebar("Journal des dépenses") + dateToolbar("expenses") +
    table(["Date", "Catégorie", "Libellé", "Montant", "Statut", "Actions"], report.expenses, item =>
      td(esc(pretty(item.day))) + td(esc(item.category)) + td(esc(item.note), "wrap-cell") +
      td(esc(fcfa(item.amount)), "numeric") + td(item.canceled_at ? badge("Annulée", "bad") : badge("Validée", "good")) +
      td(item.canceled_at ? "" : button("Annuler", "cancel-expense", {id: item.id, small: true, style: "subtle"})),
      "Aucune dépense sur cette période.") + '</section>';
}

function financeJournal(report) {
  const {kind, status} = state.finance;
  const entries = report.journal.filter(entry => (!kind || entry.kind === kind) && (!status || entry.status === status));
  return table(["Date", "Opération", "Contact ou catégorie", "Montant", "Impact sur le flux", "Statut", "Actions"], entries, entry => {
    const canceled = entry.status === "canceled";
    const action = entry.kind === "withdrawal" ? "" : entry.kind === "expense" ? (canceled ? "" : button("Annuler", "cancel-expense",
      {id: entry.id, small: true, style: "subtle"})) : button("Détail", "detail", {id: entry.id, small: true, style: "subtle"});
    return td(esc(pretty(entry.day))) + td('<strong>' + esc(journalTypes[entry.kind] + ' · ' + entry.number) + '</strong>' +
      (entry.note ? '<span class="item-sub">' + esc(entry.note) + '</span>' : ''), "wrap-cell") +
      td(esc(entry.party || "—") + (entry.method ? '<span class="item-sub">' + esc(entry.method) + '</span>' : ''), "wrap-cell") +
      td(esc(fcfa(entry.amount)), "numeric") + td(esc((entry.flow > 0 ? "+" : "") + fcfa(entry.flow)), "numeric") +
      td(canceled ? badge("Annulée", "bad") : badge(entry.kind === "purchase" ? "Validé" : "Validée", "good")) + td(action);
  }, "Aucune opération pour ces filtres.", "Modifiez la période, le type ou le statut pour élargir la recherche.");
}

function financeExportUrl() {
  const {kind, status} = state.finance;
  return "/api/export?" + queryPeriod({...currentPeriod("reports"), kind, status});
}

function renderReports(report) {
  const period = currentPeriod("reports");
  const {kind, status} = state.finance;
  const income = Object.entries(report.channels).filter(([, amount]) => amount !== 0);
  const matchingPresets = Object.keys(financePresets).filter(preset => {
    const range = financeRange(preset);
    return range.start === period.start && range.end === period.end;
  });
  const activePreset = matchingPresets.includes(state.finance.preset) ? state.finance.preset : matchingPresets[0];
  return heading("Gestion financière", "Suivez vos ventes, vos frais et vos achats en FCFA.",
    button("Ajouter une dépense", "new-expense", {style: "primary", icon: "plus"})) +
    '<section class="panel finance-period" aria-label="Période financière">' +
    titlebar("Période", pretty(period.start) + " au " + pretty(period.end)) +
    '<div class="actions finance-presets">' + Object.entries(financePresets).map(([preset, label]) =>
      button(label, "finance-" + preset, {small: true, pressed: preset === activePreset})).join("") + '</div>' +
    '<details class="period-custom"' + (activePreset ? '' : ' open') + '><summary>Dates personnalisées</summary>' +
    dateToolbar("reports") + '</details></section>' + viewPicker("reports") +
    '<div class="stats" data-panel="summary">' + stat("Encaissements nets", fcfa(report.collected), "Acomptes et règlements inclus, remboursements déduits", "wallet") +
    stat("Dépenses d’exploitation", fcfa(report.expenses_total), "Transport, emballage et autres frais", "receipt", "gold") +
    stat("Achats de marchandises", fcfa(report.purchases_total), "Commandes enregistrées sur la période", "box", "violet") +
    stat("Flux net de la période", fcfa(report.net_flow), "Encaissements moins achats, frais et retraits", "trend", report.net_flow < 0 ? "negative" : "green") + '</div>' +
    '<div class="split finance-breakdown" data-panel="summary"><section class="panel">' + titlebar("Résultat d’exploitation", "Calculé à partir du coût des produits vendus") +
    '<dl class="finance-summary"><div><dt>Ventes avant remise</dt><dd>' + esc(fcfa(report.gross_sales)) + '</dd></div>' +
    '<div><dt>Remises accordées</dt><dd>' + esc(fcfa(report.discounts)) + '</dd></div>' +
    '<div><dt>Ventes après remise</dt><dd>' + esc(fcfa(report.revenue)) + '</dd></div>' +
    '<div><dt>Coût des produits vendus</dt><dd>' + esc(fcfa(report.cost_of_sales)) + '</dd></div>' +
    '<div><dt>Marge brute</dt><dd>' + esc(fcfa(report.gross_margin)) + '</dd></div>' +
    '<div><dt>Frais d’exploitation</dt><dd>' + esc(fcfa(report.expenses_total)) + '</dd></div>' +
    '<div class="finance-total"><dt>Résultat estimé</dt><dd>' + esc(fcfa(report.result)) + '</dd></div></dl></section>' +
    '<section class="panel table-panel">' + titlebar("Encaissements par moyen") +
    table(["Moyen de paiement", "Montant"], income, ([method, amount]) =>
      td(esc(method)) + td(esc(fcfa(amount)), "numeric"), "Aucun encaissement sur cette période.") + '</section></div>' +
    '<section class="panel table-panel" data-panel="journal">' + titlebar("Journal financier", "Le CSV reprend la période et les filtres du journal.") +
    '<div class="toolbar finance-journal-tools">' + field("Type d’opération", pick("finance-kind", [["", "Tous les types"],
      ...Object.entries(journalTypes)], kind, 'id="finance-kind"')) + field("Statut", pick("finance-status",
      [["", "Tous les statuts"], ["valid", "Validées"], ["canceled", "Annulées"]], status, 'id="finance-status"')) +
    '<span id="finance-export">' + link("Exporter le CSV", financeExportUrl(), "secondary", "download") + '</span></div>' +
    '<div id="finance-journal" aria-live="polite">' + financeJournal(report) + '</div></section>' +
    '<div class="split finance-breakdown" data-panel="analysis"><section class="panel table-panel">' + titlebar("Dépenses par catégorie") +
    table(["Catégorie", "Montant"], report.expense_categories, ([category, amount]) =>
      td(esc(category), "wrap-cell") + td(esc(fcfa(amount)), "numeric"), "Aucune dépense validée sur cette période.") + '</section>' +
    '<section class="panel table-panel">' + titlebar("Produits les plus vendus", "Classés par unités vendues") +
    table(["Produit", "Unités", "Ventes avant remise"], report.top, item =>
      td(esc(item.name), "wrap-cell") + td(number.format(item.quantity), "numeric") +
      td(esc(fcfa(item.gross)), "numeric"), "Aucune vente sur la période.") + '</section></div>';
}

function financeRange(preset) {
  const month = initialPeriod();
  if (preset === "today") return {start: month.end, end: month.end};
  if (preset === "previous") {
    const last = dayOffset(month.start, -1);
    return {start: last.slice(0, 8) + "01", end: last};
  }
  return month;
}

function setFinancePeriod(preset) {
  state.finance.preset = preset;
  state.periods.reports = financeRange(preset);
  return render().then(() => main.querySelector('[data-action="finance-' + preset + '"]')?.focus());
}

function renderSettings() {
  const values = state.data.settings;
  return heading("Paramètres", "Personnalisez vos tickets et protégez les données de la boutique.") +
    '<div class="split"><section class="panel">' + titlebar("Identité de la boutique", "Ces coordonnées figurent sur les nouveaux tickets.") +
    '<form class="form-grid" id="settings-form">' + field("Nom de la boutique", input("shop", values.shop, 'required maxlength="100"'), true) +
    field("Téléphone", input("phone", values.phone, 'type="tel" maxlength="50"'), true) +
    field("Adresse", input("address", values.address, 'maxlength="200"'), true) +
    '<div class="form-error" role="alert" hidden></div><div class="form-footer">' +
    '<button type="submit" class="btn primary">Enregistrer</button></div></form></section>' +
    '<section class="panel">' + titlebar("Sauvegarde et restauration") +
    '<p class="form-note">Téléchargez une copie complète de la boutique. Conservez-la sur un autre support.</p>' +
    '<div class="actions">' + link("Télécharger la sauvegarde", "/api/backup", "secondary", "download") +
    button("Restaurer une copie", "restore") + link("Copie avant restauration", "/api/before-restore", "subtle", "download") +
    button("Protéger le stockage", "protect-storage", {style: "subtle"}) + '</div><hr class="divider"><p class="inline-help">' +
    'La restauration remplace les données de cet appareil et garde une copie de sécurité locale.' +
    '</p></section></div>';
}

async function refresh() {
  state.data = await api("/api/bootstrap");
  navigation();
}

async function render(quiet = false) {
  const view = ++state.view;
  const page = state.page;
  const dashboard = page === "dashboard";
  if (dashboard) {
    if (main.dataset.page !== page) main.innerHTML = dashboardShell();

  } else if (!quiet) {
    main.innerHTML = '<div class="initial" role="status">Chargement…</div>';
  }
  main.dataset.page = page;
  try {
    let html;
    if (page === "products") html = renderProducts();
    else if (page === "contacts") html = renderContacts();
    else if (page === "settings") html = renderSettings();
    else if (page === "replenish") {
      const items = await api("/api/replenishment");
      if (view !== state.view) return;
      state.replenishment = items;
      html = renderReplenishment(items);
    }
    else {
      const period = dashboard ?
        {start: dayOffset(state.data.today, -6), end: state.data.today} : currentPeriod(page);
      const request = api("/api/report?" + queryPeriod(period));
      if (page === "stock") {
        const [report, movements] = await Promise.all([request, api("/api/movements?" +
          new URLSearchParams(state.stockFilter ? {product_id: state.stockFilter} : {}))]);
        html = renderStock(movements, report);
      } else {
        const report = await request;
        if (view !== state.view) return;
        if (page === "cash") {
          const drawer = await api("/api/drawer?" + new URLSearchParams({day: drawerDay || state.data.today}));
          if (view !== state.view) return;
          currentDrawer = drawer;
        }
        if (page === "reports") state.finance.report = report;
        html = {dashboard: dashboardActivity, cash: renderCash, expenses: renderExpenses, reports: renderReports}[page](report);
      }
    }
    if (view !== state.view) return;
    if (dashboard) {
      const activity = document.getElementById("home-live");
      activity.innerHTML = html;
      activity.setAttribute("aria-busy", "false");
    } else {
      main.innerHTML = html;
      if (workspaceViews[page]) displayView(page);
    }
  } catch (error) {
    if (view !== state.view) return;
    const target = dashboard ? document.getElementById("home-live") : main;
    target.innerHTML = '<section class="panel load-error">' + empty("L’activité n’a pas pu être chargée.", error.message) +
      '<div class="actions">' + button("Réessayer", "reload") + '</div></section>';
    if (dashboard) target.setAttribute("aria-busy", "false");
  }
}

function setMenu(open, restoreFocus = false) {
  document.getElementById("sidebar").classList.toggle("open", open);
  document.getElementById("nav-shade").hidden = !open;
  for (const button of menuControls) {
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
  }
  if (restoreFocus) menuTrigger.focus();
}

function navigate(event) {
  const key = location.hash.slice(1);
  if (key === "main") return;
  state.page = Object.hasOwn(sections, key) ? key : "dashboard";
  setMenu(false);
  if (state.data) {
    navigation();
    render();
    if (event) {
      window.scrollTo(0, 0);
      main.focus({preventScroll: true});
    }
  }
}

function showDialog(title, body, wide = false) {
  dialog.classList.toggle("wide", wide);
  dialog.innerHTML = '<div class="dialog-head"><h2 id="dialog-title">' + esc(title) +
    '</h2><button type="button" class="icon-button" aria-label="Fermer" data-action="close-dialog">' +
    icon("close") + '</button></div><div class="dialog-body">' + body + '</div>';
  if (!dialog.open) dialog.showModal();
  else dialog.querySelector('.dialog-head button').focus();
}

function formHtml(fields, label, danger = false) {
  return '<form class="form-grid">' + fields + '<div class="form-error" role="alert" hidden></div>' +
    '<div class="form-footer"><button type="button" data-action="close-dialog" class="btn secondary">Fermer</button>' +
    '<button type="submit" class="btn ' + (danger ? "danger" : "primary") + '">' + esc(label) +
    '</button></div></form>';
}

function formError(form, message) {
  const error = form.querySelector(".form-error");
  error.textContent = message;
  error.hidden = !message;
}

function dialogForm({title, fields, label, submit, message, danger = false, wide = false, after}) {
  showDialog(title, formHtml(fields, label, danger), wide);
  const form = dialog.querySelector("form");
  let saving = false;
  form.addEventListener("input", () => { form.dataset.dirty = "true"; });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    formError(form, "");
    try {
      const result = await submit(new FormData(form), form);
      dialog.close();
      toast(typeof message === "function" ? message(result) : message);
      try {
        await refresh();
        await render(true);
        if (after) after(result);
      } catch (error) {
        toast("L’opération est enregistrée. Rechargez la page pour actualiser les données.", true);
      }
    } catch (error) {
      formError(form, error.message);
    } finally {
      saving = false;
      submitButton.disabled = false;
    }
  });
  return form;
}

function closeDialog() {
  const form = dialog.querySelector("form");
  if (form?.querySelector('[type="submit"]:disabled')) return;
  if (form?.dataset.dirty && !confirm("Fermer et perdre la saisie en cours ?")) return;
  dialog.close();
}

dialog.addEventListener("cancel", event => {
  event.preventDefault();
  closeDialog();
});

const formObject = form => Object.fromEntries(form.entries());

function editProduct(id) {
  const item = state.data.products.find(p => p.id === id) || {};
  const options = state.data.categories.map(c => '<option value="' + esc(c) + '"></option>').join("");
  dialogForm({title: id ? "Modifier le produit" : "Ajouter un produit",
    fields: field("Nom du produit", input("name", item.name, 'maxlength="120" required'), true) +
      field("Référence", input("sku", item.sku, 'maxlength="40" required placeholder="Ex. SAV-001"')) +
      field("Catégorie", input("category", item.category, 'list="categories" maxlength="60" required') +
        '<datalist id="categories">' + options + '</datalist>') +
      field("Prix de vente (FCFA)", input("price", item.price, 'type="number" min="0" max="10000000" step="1" required')) +
      field("Seuil d’alerte", input("threshold", item.threshold ?? 5, 'type="number" min="0" max="100000" step="1" required')) +
      (!id ? '<p class="field full inline-help">Le stock démarre à zéro. Enregistrez un achat pour saisir la première entrée.</p>' : ''),
    label: "Enregistrer le produit",
    submit: form => api("/api/products" + (id ? "/" + id : ""), {...formObject(form),
      price: Number(form.get("price")), threshold: Number(form.get("threshold"))}),
    message: id ? "Produit mis à jour." : "Produit ajouté au catalogue."});
}

function toggleProduct(id) {
  const item = state.data.products.find(p => p.id === id);
  if (!item) return;
  dialogForm({title: item.active ? "Archiver le produit" : "Réactiver le produit",
    fields: '<p class="field full">' + esc(item.active ? "Archiver « " + item.name + " » ? Son historique sera conservé." :
      "Remettre « " + item.name + " » dans le catalogue actif ?") + '</p>',
    label: item.active ? "Archiver" : "Réactiver", danger: Boolean(item.active),
    submit: () => api("/api/products/" + id + "/active", {active: item.active ? 0 : 1}),
    message: item.active ? "Produit archivé." : "Produit réactivé."});
}

function editContact(id) {
  const item = state.data.contacts.find(p => p.id === id) || {};
  const kind = item.kind || state.contactKind;
  const label = kind === "client" ? "client" : "fournisseur";
  dialogForm({title: (id ? "Modifier le " : "Ajouter un ") + label,
    fields: field("Nom", input("name", item.name, 'maxlength="120" required'), true) +
      field("Téléphone", input("phone", item.phone, 'type="tel" maxlength="40"'), true) +
      field("Note", '<textarea name="note" maxlength="300">' + esc(item.note) + '</textarea>', true),
    label: "Enregistrer", submit: form => api("/api/contacts" + (id ? "/" + id : ""), {...formObject(form), kind}),
    message: "Contact enregistré."});
}

function addExpense() {
  const request_key = requestKey();
  dialogForm({title: "Ajouter une dépense",
    fields: field("Date", input("day", state.data.today, 'type="date" required max="' + state.data.today + '"')) +
      field("Montant (FCFA)", input("amount", "", 'type="number" min="1" max="10000000" step="1" required')) +
      paymentField("Payé depuis") +
      field("Catégorie", input("category", "", 'list="expense-categories" maxlength="60" required') +
        '<datalist id="expense-categories"><option>Transport</option><option>Emballage</option><option>Loyer</option>' +
        '<option>Communication</option><option>Autres</option></datalist>', true) +
      field("Libellé", '<textarea name="note" maxlength="300" required></textarea>', true),
    label: "Valider la dépense", submit: form => api("/api/expenses", {...formObject(form), request_key,
      amount: Number(form.get("amount"))}), message: "Dépense enregistrée."});
}

function cancelExpense(id) {
  dialogForm({title: "Annuler la dépense",
    fields: '<p class="field full">La dépense restera dans le journal avec le statut « Annulée » et sera exclue du total.</p>',
    label: "Confirmer l’annulation", danger: true,
    submit: () => api("/api/expenses/" + id + "/cancel", {}), message: "Dépense annulée."});
}

function restore() {
  dialogForm({title: "Restaurer une sauvegarde",
    fields: '<p class="field full form-note">Les données de cet appareil seront remplacées par celles du fichier choisi.</p>' +
      field("Sauvegarde Bya Service Mobile", '<input name="backup" type="file" accept=".json,application/json" required>', true) +
      field("Confirmation", '<span class="inline-help">Saisissez RESTAURER pour confirmer.</span>' +
        input("confirmation", "", 'required pattern="RESTAURER" autocomplete="off"'), true),
    label: "Restaurer les données", danger: true,
    submit: form => {
      const file = form.get("backup");
      if (file.size > 100 * 1024 * 1024) throw new Error("La taille maximale est de 100 Mo.");
      return api("/api/restore", file);
    },
    message: "Sauvegarde restaurée. La copie précédente a été conservée."});
}


const orderLabels = {
  sale: ["Nouvelle vente", "Valider la vente", "Vente enregistrée."],
  purchase: ["Enregistrer un achat", "Valider l’achat", "Achat enregistré. Le stock a été mis à jour."],
  adjust: ["Ajuster le stock", "Valider l’ajustement", "Stock ajusté."]
};

function orderForm(kind, initialLines = []) {
  const list = activeProducts();
  const sale = kind === "sale";
  const adjust = kind === "adjust";
  if (!list.length || (sale && !list.some(p => p.stock))) {
    showDialog(orderLabels[kind][0], empty(
      !list.length ? "Aucun produit actif dans le catalogue." : "Aucun article disponible en stock.",
      !list.length ? "Ajoutez une fiche produit pour commencer." : "Enregistrez une entrée de stock avant d’encaisser.") +
      '<div class="actions dialog-actions">' + button(!list.length ? "Ajouter un produit" : "Enregistrer un achat",
        !list.length ? "new-product" : "new-purchase", {style: "primary", icon: "plus"}) + '</div>');
    return;
  }

  const request_key = requestKey();
  const contactType = sale ? "client" : "supplier";
  const people = state.data.contacts.filter(p => p.kind === contactType);
  const possible = sale ? list.filter(p => p.stock > 0) : list;
  const [title, label, message] = orderLabels[kind];
  const form = dialogForm({title, label, message, wide: true,
    fields: '<div class="field full"><div id="order-lines"></div>' +
      (!adjust ? '<div class="actions">' + button("Ajouter une ligne", "add-line", {icon: "plus", small: true}) + '</div>' :
        '<span class="inline-help">Saisissez une quantité positive pour une entrée, négative pour une sortie.</span>') +
      '</div>' +
      field("Date", input("day", state.data.today, 'type="date" required max="' + state.data.today + '"')) +
      (sale ? field("Conditions de paiement", pick("payment_mode", [["full", "Paiement intégral"], ["partial", "Paiement partiel / à crédit"]], "full")) +
        field("Montant reçu aujourd’hui (FCFA)", input("deposit", 0, 'type="number" min="0" step="1" inputmode="numeric"')) +
        field("Échéance (facultative)", input("due", "", 'type="date"')) +
        field("Paiement reçu par", pick("method", state.data.payments.map(p => [p, p]), state.data.payments[0])) : "") +
      (kind === "purchase" ? paymentField("Achat payé depuis") : "") +
      (!adjust ? field(sale ? "Client" : "Fournisseur", pick("contact_id", [["", sale ? "Client comptoir" : "Sans fournisseur"],
        ...people.map(p => [p.id, p.name])], "")) : "") +
      (sale ? field("Remise (FCFA)", input("discount", 0, 'type="number" min="0" step="1" required')) : "") +
      field(adjust ? "Motif de l’ajustement" : "Note", '<textarea name="note" maxlength="300" ' +
        (adjust ? 'required placeholder="Ex. inventaire physique, casse"' : '') + '></textarea>', true) +
      (!adjust ? '<div class="field full order-total"><span>' + (sale ? "Total de la vente" : "Total de l’achat") +
        '</span><strong id="order-total" aria-live="polite">' + fcfa(0) + '</strong></div>' : ''),
    submit: (data, current) => {
      const entries = [...current.querySelectorAll(".entry")];
      const lines = entries.map(entry => {
        const product_id = Number(entry.querySelector("select").value);
        const quantity = Number(entry.querySelector('[name="quantity"]').value);
        const line = {product_id, quantity};
        if (sale) line.unit = possible.find(p => p.id === product_id).price;
        else if (!adjust) line.unit = Number(entry.querySelector('[name="unit"]').value);
        return line;
      });
      return api("/api/operations/" + kind, {
        request_key, lines, day: data.get("day"), note: data.get("note"),
        method: data.get("method") || "", contact_id: Number(data.get("contact_id")) || null,
        discount: Number(data.get("discount")) || 0,
        ...(sale && data.get("payment_mode") === "partial" ? {payment_mode: "partial", deposit: Number(data.get("deposit")), due: data.get("due")} : {})
      });
    },
    after: sale ? item => receipt(item) : undefined
  });

  const container = form.querySelector("#order-lines");
  const update = () => {
    let sum = 0;
    const entries = [...container.querySelectorAll(".entry")];
    for (const entry of entries) {
      const selected = possible.find(p => p.id === Number(entry.querySelector("select").value));
      const qty = Number(entry.querySelector('[name="quantity"]').value);
      if (sale) {
        entry.querySelector(".preview-price").textContent = selected ? fcfa(selected.price) + " / u." : "—";
        sum += (selected?.price || 0) * qty;
      } else if (!adjust) {
        sum += Number(entry.querySelector('[name="unit"]').value) * qty;
      }
      entry.querySelector('[data-remove-line]').disabled = entries.length === 1;
    }
    const target = form.querySelector("#order-total");
    const total = sum - (Number(form.elements.discount?.value) || 0);
    if (target) target.textContent = fcfa(total);
    if (sale) {
      const partial = form.elements.payment_mode.value === "partial";
      for (const el of [form.elements.deposit, form.elements.due]) {
        el.disabled = !partial;
        el.closest("label").hidden = !partial;
      }
      form.elements.contact_id.required = partial;
      form.elements.deposit.required = partial;
      form.elements.deposit.max = Math.max(total - 1, 0);
      form.elements.due.min = form.elements.day.value;
      if (partial) target.textContent += " · Reste " + fcfa(Math.max(0, total - Number(form.elements.deposit.value)));
    }
  };
  const addLine = (focus = false, preset = {}) => {
    if (container.children.length >= 100) {
      formError(form, "La limite est de 100 lignes par opération.");
      return;
    }
    const row = document.createElement("div");
    row.className = "entry";
    row.innerHTML =
      field("Produit", pick("product_id", [["", "Sélectionner un produit"], ...possible.map(p => [p.id,
        p.name + " · " + p.sku + (sale ? " (" + p.stock + " en stock)" : "")])], preset.id ?? "", 'required')) +
      field("Quantité", input("quantity", preset.quantity ?? 1, 'type="number" step="1" min="' + (adjust ? -100000 : 1) +
        '" max="100000" required' + (adjust ? "" : ' inputmode="numeric"'))) +
      (sale ? '<div class="field"><span>Prix unitaire</span><span class="preview-price">—</span></div>' : adjust ? '<span></span>' :
        field("Coût unitaire (FCFA)", input("unit", "", 'type="number" inputmode="numeric" min="0" max="10000000" required'))) +
      '<button type="button" class="icon-button" data-remove-line aria-label="Retirer cette ligne">' + icon("close") + '</button>';
    container.append(row);
    row.querySelector("[data-remove-line]").addEventListener("click", () => {
      row.remove();
      form.dataset.dirty = "true";
      update();
      container.querySelector("select")?.focus();
    });
    if (focus) {
      form.dataset.dirty = "true";
      row.querySelector("select").focus();
      update();
    }
  };
  if (initialLines.length) {
    for (const line of initialLines) addLine(false, line);
  } else {
    addLine();
  }
  update();
  form.addEventListener("input", update);
  form.querySelector('[data-action="add-line"]')?.addEventListener("click", () => addLine(true));
  container.querySelector("select").focus();
}

function receipt(item) {
  const sale = item.kind === "sale";
  const adjust = item.kind === "adjust";
  const title = {sale: "Ticket de vente", purchase: "Détail de l’achat", adjust: "Ajustement de stock"}[item.kind];
  const settings = sale ? {shop: item.shop, phone: item.shop_phone, address: item.shop_address} : state.data.settings;
  const subtitle = [settings.address, settings.phone].filter(Boolean).join(" · ");
  const itemTable = table(adjust ? ["Produit", "Variation"] : ["Produit", "Qté", "Prix unitaire", "Montant"],
    item.lines, line =>
      td('<strong>' + esc(line.name) + '</strong><span class="item-sub">' + esc(line.sku) + '</span>', "wrap-cell") +
      td(number.format(line.quantity), "numeric") +
      (adjust ? "" : td(esc(fcfa(line.unit)), "numeric") + td(esc(fcfa(line.unit * line.quantity)), "numeric")),
    "Aucun produit.");
  const cancellation = item.canceled_at ?
    '<p class="form-error">' + esc("Annulée le " + pretty(item.canceled_at.slice(0, 10)) + " · " + item.cancel_reason) + '</p>' : "";
  showDialog(title + " " + item.number,
    '<div class="receipt-title"><h3>' + esc(settings.shop) + '</h3>' +
    (subtitle ? '<p>' + esc(subtitle) + '</p>' : "") +
    '<p class="muted">' + esc(title + " " + item.number) + '</p></div>' +
    '<div class="receipt-meta"><span>' + esc(pretty(item.day)) + '</span>' +
    (sale ? '<span>' + esc(item.contact_name || "Client comptoir") + '</span><span>' + esc(item.method) + '</span>' :
      item.contact_name ? '<span>' + esc(item.contact_name) + '</span>' : '') +
    '</div>' + cancellation + itemTable +
    (item.note ? '<p class="substat">' + esc(item.note) + '</p>' : "") +
    (item.discount ? '<p class="substat"><span>Remise</span><strong>' + esc(fcfa(item.discount)) + '</strong></p>' : "") +
    (adjust ? "" : '<div class="order-total"><span>' + (sale ? "Total de la vente" : "Total de l’achat") +
      '</span><strong>' + esc(fcfa(item.total)) + '</strong></div>') +
    (item.credit ? creditDetails(item) : "") +
    '<div class="actions dialog-actions no-print">' +
    (item.credit && remaining(item) ? button("Enregistrer un règlement", "settle-sale", {id: item.id}) : "") +
    (sale && !item.canceled_at ? button("Annuler la vente", "cancel-sale", {id: item.id, style: "danger"}) : '') +
    (!adjust ? button("Imprimer", "print", {icon: "print", style: "primary"}) : '') + '</div>', true);
}

function cancelSale(id) {
  dialogForm({title: "Annuler la vente",
    fields: '<p class="field full">Les articles seront remis en stock. Le ticket restera disponible avec le statut « Annulée ». ' +
      'Les sommes déjà reçues seront déduites de la caisse du jour, par moyen de paiement. Remboursez chaque somme par le moyen utilisé.</p>' +
      field("Motif d’annulation", '<textarea name="reason" maxlength="300" required></textarea>', true),
    label: "Confirmer l’annulation", danger: true,
    submit: form => api("/api/operations/" + id + "/cancel", formObject(form)), message: "Vente annulée. Le stock a été recrédité.",
    after: receipt});
}

function countStock(id) {
  const product = activeProducts().find(item => item.id === id);
  if (!product) throw new Error("Ce produit est indisponible. Actualisez le catalogue.");
  const expected = product.stock;
  const request_key = requestKey();
  const form = dialogForm({
    title: "Compter le stock",
    fields: '<div class="field full count-product"><strong>' + esc(product.name) + '</strong><span>' +
      esc(product.sku) + ' · Stock enregistré : ' + number.format(expected) + '</span></div>' +
      field("Quantité comptée", input("counted", "", 'type="number" inputmode="numeric" min="0" max="100000000" step="1" required')) +
      '<output class="count-gap" aria-live="polite"></output>' +
      field("Note de comptage", '<textarea name="note" maxlength="200" placeholder="Ex. vérification du rayon"></textarea>', true),
    label: "Valider le comptage",
    submit: async data => {
      const counted = Number(data.get("counted"));
      const quantity = counted - expected;
      if (!quantity) {
        const current = await api("/api/products/" + id + "/history");
        if (current.product.stock !== expected) throw new Error("Le stock a changé. Actualisez la page et recommencez.");
        return false;
      }
      await api("/api/operations/adjust", {request_key, lines: [{product_id: id, quantity, expected_stock: expected}],
        note: ("Inventaire physique " + expected + " → " + counted + ". " + data.get("note")).trim()});
      return true;
    },
    message: changed => changed ? "Écart enregistré dans les mouvements de stock." : "Quantité confirmée. Stock conforme."
  });
  form.elements.counted.addEventListener("input", () => {
    const count = form.elements.counted;
    const gap = count.valueAsNumber - expected;
    form.querySelector("output").textContent = count.validity.valid ? "Écart : " + (gap > 0 ? "+" : "") + number.format(gap) : "";
  });
}

function creditDetails(sale) {
  const payments = salePayments(sale);
  return '<section>' + titlebar(sale.canceled_at ? "Crédit annulé" : remaining(sale) ? "Reste à payer · " + fcfa(remaining(sale)) : "Soldé",
    sale.credit.due ? "Échéance du " + pretty(sale.credit.due) : "") +
    table(["Date", "Opération", "Moyen", "Montant reçu"], payments.map((p, i) => ({...p, initial: i === 0}))
      .sort((a, b) => a.day.localeCompare(b.day)), p =>
      td(esc(pretty(p.day))) + td(p.initial ? "Acompte" : "Règlement") + td(p.amount ? esc(p.method) : "—") +
      td(esc(fcfa(p.amount)), "numeric"), "") + '</section>';
}

async function clientAccount(id) {
  const sales = await api("/api/client-credit?id=" + id);
  const client = state.data.contacts.find(c => c.id === id);
  const total = sales.reduce((sum, s) => sum + s.balance, 0);
  showDialog("Compte de " + client.name, titlebar("Reste à payer · " + fcfa(total)) +
    table(["Ticket", "Échéance", "Montant", "Solde", "Actions"], sales, s =>
      td(esc(s.number)) + td(s.credit.due ? esc(pretty(s.credit.due)) : "—") + td(esc(fcfa(s.total))) +
      td(s.canceled_at ? "Annulé" : s.balance ? esc(fcfa(s.balance)) : "Soldé") +
      td(button("Historique", "detail", {id: s.id, small: true}) +
        (s.balance ? button("Enregistrer un règlement", "settle-sale", {id: s.id, small: true}) : "")),
    "Aucune vente à crédit pour cette cliente.") + '<div class="actions">' + button("Fermer", "close-dialog") + '</div>', true);
}

async function settleTicket(id) {
  const item = await api("/api/operations/" + id);
  const balance = remaining(item);
  const request_key = requestKey();
  dialogForm({title: "Enregistrer un règlement · " + item.number, label: "Valider le règlement",
    fields: '<p class="field full">' + esc(item.contact_name + " · Reste à payer " + fcfa(balance)) + '</p>' +
      field("Montant reçu (FCFA)", input("amount", balance, 'type="number" min="1" max="' + balance + '" step="1" required')) +
      field("Date du règlement", input("day", state.data.today, 'type="date" min="' + item.day + '" max="' + state.data.today + '" required')) +
      paymentField("Moyen de paiement"), submit: form => api("/api/operations/" + id + "/settle",
        {...formObject(form), request_key, amount: Number(form.get("amount"))}), message: "Règlement enregistré.", after: receipt});
}

const commands = {
  "client-account": clientAccount, "settle-sale": settleTicket,
  "drawer-open": () => editDrawer("open"), "drawer-close": () => editDrawer("close"),
  "drawer-withdraw": () => editDrawer("withdraw"), "drawer-classify": () => editDrawer("classify"),
  "count-stock": countStock,
  "new-product": () => editProduct(),
  "edit-product": editProduct, "toggle-product": toggleProduct,
  "product-history": showProductHistory, "product-movements": openProductMovements,
  "new-contact": () => editContact(), "edit-contact": editContact,
  "new-expense": addExpense, "cancel-expense": cancelExpense,
  "finance-today": () => setFinancePeriod("today"),
  "finance-month": () => setFinancePeriod("month"),
  "finance-previous": () => setFinancePeriod("previous"),
  "new-sale": () => orderForm("sale"),
  "new-purchase": () => orderForm("purchase"),
  "new-adjust": () => orderForm("adjust"),
  "cancel-sale": cancelSale, detail: async id => receipt(await api("/api/operations/" + id)),
  print: () => window.print(), "close-dialog": closeDialog, restore,
  "protect-storage": async () => {
    const saved = await navigator.storage?.persist?.();
    toast(saved ? "Stockage persistant activé sur cet appareil." : "Le navigateur gère la conservation. Garde une sauvegarde.");
  },
  reload: async () => { await refresh(); await render(); }
};

document.addEventListener("click", async event => {
  const exportButton = event.target.closest("[data-download]");
  if (exportButton) {
    exportButton.disabled = true;
    try { await window.byaLocal.download(exportButton.dataset.download); }
    catch (error) { toast(error.message, true); }
    finally { exportButton.disabled = false; }
    return;
  }
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const command = commands[control.dataset.action];
  if (!command) return;
  try {
    await command(Number(control.dataset.id));
  } catch (error) {
    toast(error.message, true);
  }
});

for (const control of menuControls) {
  control.addEventListener("click", event => {
    menuTrigger = event.currentTarget;
    const open = menuTrigger.getAttribute("aria-expanded") === "false";
    setMenu(open);
    if (open) (document.querySelector("#sidebar a[aria-current=page]") || document.querySelector("#sidebar .brand")).focus();
  });
}

document.getElementById("nav-shade").addEventListener("click", () => setMenu(false, true));
document.getElementById("sidebar").addEventListener("click", event => {
  if (event.target.closest("a")?.hash === location.hash && !document.getElementById("nav-shade").hidden) {
    setMenu(false, true);
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !dialog.open && !document.getElementById("nav-shade").hidden) {
    setMenu(false, true);
  }
});

main.addEventListener("input", event => {
  if (event.target.id === "ticket-search") {
    state.ticketQuery = event.target.value;
    document.getElementById("ticket-results").innerHTML = matchingTickets();
  }
  if (event.target.id === "product-search") {
    state.productQuery = event.target.value;
    document.getElementById("product-results").innerHTML = productRows();
  }
});

main.addEventListener("change", event => {
  const {id, value} = event.target;
  if ((id === "drawer-day" || id === "drawer-history") && value && event.target.validity.valid) {
    drawerDay = value;
    void render(true);
  }
  if (event.target.form?.id === "replenishment-form") updateReplenishmentSelection(event.target);
  if (id === "finance-kind" || id === "finance-status") {
    state.finance[id === "finance-kind" ? "kind" : "status"] = value;
    document.getElementById("finance-journal").innerHTML = financeJournal(state.finance.report);
    document.querySelector("#finance-export [data-download]").dataset.download = financeExportUrl();
  }
  if (id === "category-filter" || id === "product-status") {
    if (id === "category-filter") state.category = value;
    else state.productStatus = value;
    document.getElementById("product-results").innerHTML = productRows();
  }
  if (id === "contact-kind") {
    state.contactKind = value;
    render(true).then(() => document.getElementById("contact-kind")?.focus());
  }
  if (id === "stock-filter") {
    state.stockFilter = value;
    render(true).then(() => document.getElementById("stock-filter")?.focus());
  }
});

main.addEventListener("submit", async event => {
  const form = event.target;
  event.preventDefault();
  const fields = new FormData(form);
  if (form.id === "replenishment-form") {
    const selected = new Set(fields.getAll("stock-choice").map(Number));
    const lines = state.replenishment.filter(p => selected.has(p.id));
    if (!lines.length || lines.length > 100) {
      formError(form, "Sélectionnez entre 1 et 100 produits.");
      return;
    }
    const available = new Set(activeProducts().map(p => p.id));
    if (lines.some(line => !available.has(line.id))) {
      formError(form, "Le catalogue a changé. Rechargez la page avant de préparer l’achat.");
      return;
    }
    orderForm("purchase", lines);
  } else if (form.dataset.period) {
    const {start, end} = formObject(fields);
    const diff = (Date.parse(end) - Date.parse(start)) / 86400000;
    if (diff < 0 || diff > 366 || !Number.isFinite(diff)) {
      toast("Choisissez une période de 367 jours maximum, du début à la fin.", true);
      return;
    }
    state.periods[form.dataset.period] = {start, end};
    if (form.dataset.period === "reports") {
      await render();
      main.querySelector('.finance-period [type="submit"]')?.focus();
    } else {
      await render(true);
    }
  } else if (form.id === "settings-form") {
    if (form.querySelector('[type="submit"]').disabled) return;
    form.querySelector('[type="submit"]').disabled = true;
    formError(form, "");
    try {
      state.data.settings = await api("/api/settings", formObject(fields));
      navigation();
      toast("Paramètres enregistrés.");
    } catch (error) {
      formError(form, error.message);
    } finally {
      form.querySelector('[type="submit"]').disabled = false;
    }
  }
});

window.addEventListener("hashchange", navigate);
navigate();
refresh().then(() => render()).catch(error => {
  main.innerHTML = empty("Impossible d’ouvrir la boutique.", error.message) +
    '<div class="actions">' + button("Réessayer", "reload") + '</div>';
});
