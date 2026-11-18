import {activateProduct, addExpense, addOperation, cancelExpense, cancelSale, detail,
  saveContact, saveProduct, saveSettings, today} from "./model.js";
import {bootstrap, movements, productHistory, replenishment, report} from "./reports.js";
import {backupData, backupFile} from "./backup.js";
import {restoreState, transact} from "./storage.js";

function read(state, url) {
  const {pathname, searchParams} = url;
  if (pathname === "/api/bootstrap") return bootstrap(state);
  if (pathname === "/api/replenishment") return replenishment(state);
  if (pathname === "/api/movements") return movements(state, Number(searchParams.get("product_id")));
  if (pathname === "/api/report") return report(state, searchParams.get("start") ?? undefined, searchParams.get("end") ?? undefined);
  const history = pathname.match(/^\/api\/products\/(\d+)\/history$/);
  if (history) return productHistory(state, Number(history[1]));
  const operation = pathname.match(/^\/api\/operations\/(\d+)$/);
  if (operation) return detail(state, Number(operation[1]));
  throw new Error("Page introuvable.");
}

function write(state, pathname, data) {
  const [segment, key, action] = pathname.slice(5).split("/");
  const id = Number(key);
  switch (segment) {
    case "products": return action === "active" ? activateProduct(state, data, id) : saveProduct(state, data, id);
    case "contacts": return saveContact(state, data, id);
    case "settings": return saveSettings(state, data);
    case "expenses": return action === "cancel" ? cancelExpense(state, id) : addExpense(state, data);
    case "operations":
      if (action === "cancel") return cancelSale(state, data, id);
      if (["sale", "purchase", "adjust"].includes(key)) return addOperation(state, key, data);
      break;
  }
  throw new Error("Opération introuvable.");
}

export async function request(path, data) {
  const url = new URL(path, location.origin);
  if (url.pathname === "/api/restore") {
    let raw;
    try { raw = JSON.parse(await data.text()); } catch { throw new Error("Choisis une sauvegarde mobile au format JSON."); }
    return restoreState(backupData(raw));
  }
  return data === undefined ? transact(false, state => read(state, url)) : transact(true, state => write(state, url.pathname, data));
}

function csvCell(value) {
  let cell = String(value ?? "");
  if (typeof value === "string" && /^[=+@-]/.test(value.trimStart())) cell = "'" + cell;
  return '"' + cell.replaceAll('"', '""') + '"';
}

const csv = rows => "\ufeff" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");

export async function download(path) {
  const url = new URL(path, location.origin);
  let content, filename, type = "text/csv;charset=utf-8";
  switch (url.pathname) {
    case "/api/backup":
    case "/api/before-restore": {
      const previous = url.pathname === "/api/before-restore";
      content = await transact(false, state => {
        if (!state) throw new Error("Aucune copie avant restauration sur cet appareil.");
        return backupFile(state);
      }, previous ? "before-restore" : "data");
      filename = `bya-${previous ? "avant-restauration" : "sauvegarde"}-${today()}.json`;
      type = "application/json";
      break;
    }
    case "/api/replenishment/export": {
      const rows = await transact(false, replenishment);
      content = csv([["Référence", "Produit", "Catégorie", "Stock actuel", "Seuil", "Quantité suggérée"],
        ...rows.map(p => [p.sku, p.name, p.category, p.stock, p.threshold, p.quantity])]);
      filename = `bya-reapprovisionnement-${today()}.csv`;
      break;
    }
    case "/api/export": {
      const {searchParams: params} = url;
      const data = await transact(false, state => read(state, new URL("/api/report?" + params, location.origin)));
      const kind = params.get("kind"), status = params.get("status");
      const labels = {sale: "Vente", purchase: "Achat", expense: "Dépense"};
      const rows = data.journal.filter(row => (!kind || kind === row.kind) && (!status || status === row.status));
      content = csv([["Date", "Type", "Référence", "Contact ou catégorie", "Paiement", "Montant (FCFA)", "État", "Libellé", "Flux (FCFA)"],
        ...rows.map(r => [r.day, labels[r.kind], r.number, r.party, r.method, r.amount,
          r.status === "canceled" ? "Annulé" : "Validé", r.note, r.flow])]);
      filename = `bya-finances-${today()}.csv`;
      break;
    }
    default: throw new Error("Fichier introuvable.");
  }
  const uri = URL.createObjectURL(new Blob([content], {type}));
  const anchor = document.createElement("a");
  anchor.href = uri;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(uri), 30_000);
}
