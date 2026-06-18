import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const GENEX_URL = "https://genex.com.bo/estaciones/";
const BIOPETROL_LANDING = "https://app9.biocloud.info/saldos/";
const BIOPETROL_PRODUCTS: Record<string, { id: number; key: ProductKey }> = {
  "GASOLINA ESPECIAL": { id: 134, key: "especial_plus" },
  PREMIUM: { id: 133, key: "premium_plus" },
  DIESEL: { id: 132, key: "diesel_plus" },
};
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type ProductKey = "especial_plus" | "premium_plus" | "diesel_plus" | "gas";

type ProductStock = {
  litros: number;
  cola: string | null;
  autonomia: string | null;
  vehiculos: number;
  espera: string | null;
};

type Product = ProductStock | null;

type Station = {
  empresa: string;
  nombre: string;
  direccion: string;
  mapa: string;
  lat: number | null;
  lon: number | null;
  actualizado: string;
  productos: Record<ProductKey, Product>;
};

const PRODUCT_CLASS_TO_KEY: Record<string, ProductKey> = {
  ge: "especial_plus",
  gp: "premium_plus",
  d: "diesel_plus",
  gnv: "gas",
};

const PRODUCT_NAME_TO_KEY: Record<string, ProductKey> = {
  "G. ESPECIAL+": "especial_plus",
  "G. PREMIUM+": "premium_plus",
  "DIESEL+": "diesel_plus",
  GAS: "gas",
};

function fail(msg: string): never {
  process.stderr.write(`gasolina: ${msg}\n`);
  process.exit(1);
}

function parseIntOrThrow(raw: string, ctx: string): number {
  const cleaned = raw.replace(/[^\d-]/g, "");
  const n = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(n)) fail(`no se pudo parsear número en ${ctx}: "${raw}"`);
  return n;
}

function parseIntOrThrowThousands(raw: string, ctx: string): number {
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/[.,]/g, "");
  const n = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(n)) fail(`no se pudo parsear número en ${ctx}: "${raw}"`);
  return n;
}

function cleanWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

async function fetchText(url: string, cookieHeader?: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
      redirect: "follow",
    });
  } catch (e) {
    fail(`no se pudo conectar a ${url}: ${(e as Error).message}`);
  }
  if (!res.ok) fail(`HTTP ${res.status} al obtener ${url}`);
  return res.text();
}

function extractSetCookie(res: Response): string | undefined {
  const cookies: string[] = [];
  for (const [k, v] of res.headers.entries()) {
    if (k.toLowerCase() === "set-cookie") cookies.push(v.split(";")[0]);
  }
  return cookies.length > 0 ? cookies.join("; ") : undefined;
}

function parseGenexProduct($: cheerio.CheerioAPI, wrapper: AnyNode): Product {
  const $w = $(wrapper);
  const $row = $w.find(".product_row").first();
  const $volume = $row.find(".product_volume");
  const volumeText = cleanWhitespace($volume.text());

  if (/\[AGOTADO\]/i.test(volumeText)) return null;
  if (/\[DISPONIBLE\]/i.test(volumeText)) return null;

  const litersRaw = volumeText.replace(/litros?/i, "").trim();
  const litros = parseIntOrThrowThousands(litersRaw, "litros");

  const $queue = $row.find(".product_queue_label");
  const cola = cleanWhitespace($queue.text());

  const $second = $w.find(".product_row").eq(1);
  const $duration = $second.find(".product_duration");
  const autonomia = cleanWhitespace(
    $duration.clone().children(".icon").remove().end().text()
  ).replace(/^disponible\s*/i, "").trim();

  const $capacity = $second.find(".product_capacity");
  const capacityText = cleanWhitespace(
    $capacity.clone().children(".icon").remove().end().text()
  );
  const vehiculosMatch = capacityText.match(/para\s+(\d+)/i);
  if (!vehiculosMatch) fail(`no se pudo extraer vehiculos de "${capacityText}"`);
  const vehiculos = parseIntOrThrow(vehiculosMatch[1], "vehiculos");

  const $avg = $second.find(".product_avg_time");
  const espera = cleanWhitespace(
    $avg.clone().children(".icon").remove().end().text()
  ).replace(/^espera\s*/i, "").trim();

  return { litros, cola, autonomia, vehiculos, espera };
}

function parseGenexStation($: cheerio.CheerioAPI, row: AnyNode): Station {
  const $r = $(row);
  const $station = $r.find(".station").first();

  const nombre = cleanWhitespace($station.find(".station_name").text());
  const direccion = cleanWhitespace($station.find(".station_address").text());
  const mapa = cleanWhitespace($station.find(".station_map a").attr("href") ?? "");
  const actualizado = cleanWhitespace($station.find(".station_updated").text());

  if (!nombre) fail("estación GENEX sin nombre");

  const productos: Record<ProductKey, Product> = {
    especial_plus: null,
    premium_plus: null,
    diesel_plus: null,
    gas: null,
  };

  $r.find(".product_wrapper").each((_, w) => {
    const classes = ($(w).attr("class") ?? "").split(/\s+/);
    let key: ProductKey | undefined;
    for (const c of classes) {
      if (PRODUCT_CLASS_TO_KEY[c]) {
        key = PRODUCT_CLASS_TO_KEY[c];
        break;
      }
    }
    if (!key) {
      const name = cleanWhitespace($(w).find(".product_name").first().text());
      key = PRODUCT_NAME_TO_KEY[name];
    }
    if (!key) fail(`producto desconocido en estación GENEX "${nombre}"`);
    productos[key] = parseGenexProduct($, w);
  });

  return { empresa: "GENEX", nombre, direccion, mapa, lat: null, lon: null, actualizado, productos };
}

async function resolveGenexCoords(shortUrl: string): Promise<{ lat: number; lon: number } | null> {
  if (!shortUrl) return null;
  try {
    const res = await fetch(shortUrl, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "manual",
    });
    const location = res.headers.get("location");
    if (!location) return null;
    const place = location.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (place) return { lat: Number.parseFloat(place[1]), lon: Number.parseFloat(place[2]) };
    const center = location.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (center) return { lat: Number.parseFloat(center[1]), lon: Number.parseFloat(center[2]) };
    return null;
  } catch {
    return null;
  }
}

async function scrapeGenex(): Promise<Station[]> {
  const res = await fetch(GENEX_URL, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) fail(`HTTP ${res.status} al obtener ${GENEX_URL}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const rows = $("tr[data-wcpt-product-id]").toArray();
  if (rows.length === 0) fail("no se encontraron estaciones GENEX (HTML cambió?)");

  const stations = rows.map((r) => parseGenexStation($, r));
  await Promise.all(
    stations.map(async (s) => {
      const c = await resolveGenexCoords(s.mapa);
      if (c) {
        s.lat = c.lat;
        s.lon = c.lon;
      }
    })
  );
  return stations;
}

function parseBiopetrolStation(
  $: cheerio.CheerioAPI,
  card: AnyNode,
  modal: AnyNode | undefined,
  productKey: ProductKey,
  timestamp: string
): Station | null {
  const $c = $(card);
  const nombre = cleanWhitespace($c.find(".bg-oscuro-1").first().text());
  if (!nombre) return null;

  const $address = $c.find(".alert-secondary").first();
  const direccion = cleanWhitespace($address.text());

  let mapa = "";
  let lat: number | null = null;
  let lon: number | null = null;
  if (modal) {
    const onclick = $(modal).find("[onclick]").first().attr("onclick");
    const m = onclick?.match(/invokeCSCode\('(-?\d+\.\d+),(-?\d+\.\d+)'\)/);
    if (m) {
      lat = Number.parseFloat(m[1]);
      lon = Number.parseFloat(m[2]);
      mapa = `https://www.google.com/maps?q=${m[1]},${m[2]}`;
    }
  }

  const values = $c.find(".text-right").toArray().map((v) => cleanWhitespace($(v).text()));

  const litrosRaw = values[0] ?? "";
  const vehiculosRaw = values[1] ?? "";
  if (!litrosRaw) return null;

  const litros = parseIntOrThrowThousands(litrosRaw, `litros ${nombre}`);
  const vehiculos = parseIntOrThrow(vehiculosRaw, `vehiculos ${nombre}`);

  const stock: ProductStock = {
    litros,
    cola: null,
    autonomia: null,
    vehiculos,
    espera: null,
  };

  const productos: Record<ProductKey, Product> = {
    especial_plus: null,
    premium_plus: null,
    diesel_plus: null,
    gas: null,
  };
  productos[productKey] = stock;

  return {
    empresa: "BIOPETROL",
    nombre,
    direccion,
    mapa,
    lat,
    lon,
    actualizado: timestamp,
    productos,
  };
}

async function scrapeBiopetrol(): Promise<Station[]> {
  let cookie: string | undefined;
  try {
    const r = await fetch(BIOPETROL_LANDING, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!r.ok) fail(`HTTP ${r.status} al obtener ${BIOPETROL_LANDING}`);
    cookie = extractSetCookie(r);
    await r.text();
  } catch (e) {
    fail(`no se pudo conectar a ${BIOPETROL_LANDING}: ${(e as Error).message}`);
  }

  const byName = new Map<string, Station>();
  const products = Object.entries(BIOPETROL_PRODUCTS);

  for (const [name, { id, key }] of products) {
    const url = `https://app9.biocloud.info/saldos/main/donde/${id}`;
    const html = await fetchText(url, cookie);
    const $ = cheerio.load(html);

    const timestampMatch = html.match(/Última medición\s*([^<]+)/);
    const timestamp = timestampMatch ? cleanWhitespace(timestampMatch[1]) : "";

    const cards = $(".btn-bio-app.rounded").toArray();
    if (cards.length === 0) continue;

    for (const card of cards) {
      const $card = $(card);
      const target = $card.find("[data-target]").first().attr("data-target");
      let modal: AnyNode | undefined;
      if (target) {
        const selector = target.replace(/^\./, ".") + " [onclick]";
        const $on = $(selector).first();
        if ($on.length) {
          modal = $on.parent().toArray()[0] ?? $on.toArray()[0];
        }
        if (!modal) {
          modal = $(target).toArray()[0];
        }
      }
      const s = parseBiopetrolStation($, card, modal, key, timestamp);
      if (!s) continue;

      const existing = byName.get(s.nombre);
      if (existing) {
        existing.productos[key] = s.productos[key];
      } else {
        byName.set(s.nombre, s);
      }
    }
  }

  const stations = [...byName.values()];
  if (stations.length === 0) {
    fail("no se encontraron estaciones Biopetrol (HTML cambió?)");
  }

  return stations;
}

async function main(): Promise<void> {
  const genex = await scrapeGenex();
  const biopetrol = await scrapeBiopetrol();
  const all = [...genex, ...biopetrol];
  const out = process.argv[2] ?? "dashboard/static/data.json";
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(all, null, 2) + "\n");
  process.stdout.write(`gasolina: ${all.length} estaciones → ${out}\n`);
}

main();
