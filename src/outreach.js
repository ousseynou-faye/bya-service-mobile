import {isDay} from "./model.js";

export function whatsappNumber(phone) {
  let digits = String(phone || "").trim().replace(/[\s().-]/g, "");
  if (/^[1-9]\d{8}$/.test(digits)) return "221" + digits;
  digits = digits.replace(/^(?:\+|00)/, "");
  if (digits.startsWith("221") && digits.length !== 12) return "";
  return /^[1-9]\d{7,14}$/.test(digits) && (digits.length >= 10 || /^\s*(\+|00)/.test(phone)) ? digits : "";
}

export function prepareOffer(state, data, day) {
  const client = state.contacts.find(c => c.kind === "client" && c.id === data.clientId);
  const phone = whatsappNumber(client?.phone);
  if (!phone || client?.offers !== true) throw new Error("Vérifiez le numéro et l’accord WhatsApp dans la fiche cliente.");
  const product = state.products.find(p => p.id === data.productId && p.active && p.stock > 0);
  if (!product) throw new Error("Choisissez un produit disponible en stock.");
  if (!["promo", "new"].includes(data.kind)) throw new Error("Choisissez un type de message.");
  const money = n => new Intl.NumberFormat("fr-SN").format(n) + " FCFA";
  let offer;
  if (data.kind === "promo") {
    if (!Number.isSafeInteger(data.price) || data.price <= 0 || data.price >= product.price)
      throw new Error("Le prix promotionnel doit être compris entre 1 FCFA et le prix habituel exclu.");
    if (data.until && (!isDay(data.until) || data.until < day)) throw new Error("Choisissez une date de fin à partir d’aujourd’hui.");
    const end = data.until ? " jusqu’au " + new Intl.DateTimeFormat("fr-SN", {day:"numeric", month:"long", year:"numeric", timeZone:"UTC"}).format(new Date(data.until)) : "";
    offer = "Je vous propose « " + product.name + " » à " + money(data.price) + " au lieu de " + money(product.price) + end + ".";
  } else {
    offer = "Nous venons d’accueillir « " + product.name + " » en boutique. Son prix est de " + money(product.price) + ".";
  }
  const bought = state.operations.some(o => o.kind === "sale" && !o.canceled_at && o.contact_id === client.id &&
    o.lines.some(line => line.product_id === product.id));
  const intro = bought && data.kind === "promo" ? "Comme vous avez déjà choisi ce produit chez nous, j’ai pensé à vous. " : "";
  const question = data.kind === "promo" ? "Souhaitez-vous que je vous en réserve un ?" : "Souhaitez-vous que je vous envoie une photo ?";
  return {phone, name: client.name, message: "Bonjour " + client.name + ",\n\n" + intro + offer + "\n\n" + question + "\n\n" + state.settings.shop};
}
