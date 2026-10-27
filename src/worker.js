/* Europe Trip: static app plus a small shared store so everyone's phone shows the same added stops,
   day plans and ticks. Everything lives in one KV value: { key: { v, ts } }, newest change wins. */
const FEED = "/cal/ed3056321e507c456ba8.ics";
const OK_KEY = /^(plan|dayplan|pick|cal):[\w:-]{1,40}$|^uk-eta$/;
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function load(env) { return (await env.SHARED.get("state", "json")) || {}; }

/* ---------- a photo for a saved place ----------
   1. Wikipedia: a search for the name and city, kept only if the article sits within ~1.5 km of the place
      (covers landmarks, museums, churches and some famous restaurants). English first, then the local language.
   2. The cover of the TikTok it was saved from, but only when that video is about this one place
      (the app says so with u=). TikTok cover links expire, so the image itself is kept.
   Results (or "nothing found") are remembered in KV so each place is looked up once. */
const LANG = { Italy: "it", Switzerland: "de", Germany: "de", France: "fr", Greece: "el" };
const UA = { "user-agent": "EuropeTripApp/1.0 (family trip planner; europe-family-trip.app)" };
const kmBetween = (a, b, c, d) => { const R = 6371, p = Math.PI / 180, x = Math.sin((c - a) * p / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin((d - b) * p / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
async function wikiPhoto(lang, name, city, lat, lng) {
  const q = new URLSearchParams({ action: "query", format: "json", generator: "search", gsrsearch: `${name} ${city}`, gsrlimit: "4", prop: "pageimages|coordinates", piprop: "thumbnail", pithumbsize: "640", origin: "*" });
  const r = await fetch(`https://${lang}.wikipedia.org/w/api.php?${q}`, { headers: UA }); if (!r.ok) return null;
  const pages = Object.values(((await r.json()).query || {}).pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  const words = norm(name).split(" ").filter(w => w.length > 2);
  for (const pg of pages) {
    if (!pg.thumbnail || !pg.coordinates || !pg.coordinates[0]) continue;
    const d = kmBetween(lat, lng, pg.coordinates[0].lat, pg.coordinates[0].lon), t = norm(pg.title);
    const hit = words.length ? words.filter(w => t.includes(w)).length / words.length : 0;
    if (d < 1.5 && (hit >= 0.5 || d < 0.15)) return pg.thumbnail.source;
  }
  return null;
}
/* the place's own website, found through OpenStreetMap (free, no key): its share image (og:image) is usually the room or the food */
async function osmWebsite(name, lat, lng) {
  const q = `[out:json][timeout:12];nwr(around:90,${lat},${lng})["name"];out tags 40;`;
  const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), headers: { ...UA, "content-type": "application/x-www-form-urlencoded" } });
  if (!r.ok) return null;
  const want = norm(name).split(" ").filter(w => w.length > 2 && !["ristorante", "restaurant", "trattoria", "caffe", "cafe", "bar", "the", "roma", "rome"].includes(w));
  let best = null, bestScore = 0;
  for (const el of (await r.json()).elements || []) {
    const t = el.tags || {}, n = norm(t.name), site = t.website || t["contact:website"] || t.url;
    if (!site) continue;
    const sc = want.length ? want.filter(w => n.includes(w)).length / want.length : 0;
    if (sc > bestScore) { best = site; bestScore = sc; }
  }
  return bestScore >= 0.5 ? best : null;
}
async function siteImage(site) {
  const u = /^https?:/.test(site) ? site : "https://" + site;
  const r = await fetch(u, { headers: { ...UA, accept: "text/html" }, redirect: "follow", cf: { cacheTtl: 86400 } }); if (!r.ok) return null;
  const html = (await r.text()).slice(0, 300000);
  const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*>/i);
  const c = m && m[0].match(/content=["']([^"']+)["']/i); if (!c) return null;
  const img = new URL(c[1].replace(/&amp;/g, "&"), r.url).href;
  return /logo|favicon|\.svg(\?|$)|placeholder/i.test(img) ? null : img;
}
async function grab(src) {
  const img = await fetch(src, { headers: UA }); if (!img.ok) return null;
  const type = img.headers.get("content-type") || "image/jpeg"; if (!/^image\//.test(type)) return null;
  const buf = await img.arrayBuffer(); return buf.byteLength > 8000 && buf.byteLength < 3e6 ? { buf, type } : null;
}
/* Google Places (key kept as a Worker secret): the place's first photo, which is usually the one the business chose */
/* Google Places (key kept as a Worker secret). The place's photo list is looked up once and remembered;
   photo 0 is usually the one the business chose, the rest are the room, the food and so on. */
async function googleNames(env, id, name, city, lat, lng) {
  const k = "gp:" + id, have = await env.SHARED.get(k, "json"); if (have) return have;
  if (!env.GOOGLE_PLACES_KEY) return [];
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", { method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": env.GOOGLE_PLACES_KEY, "X-Goog-FieldMask": "places.displayName,places.location,places.photos" },
    body: JSON.stringify({ textQuery: `${name} ${city}`.trim(), maxResultCount: 3, locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 800 } } }) });
  if (!r.ok) return [];
  const places = ((await r.json()).places || []).filter(p => p.photos && p.photos.length && p.location)
    .map(p => ({ p, d: kmBetween(lat, lng, p.location.latitude, p.location.longitude) })).filter(x => x.d < 1.2).sort((a, b) => a.d - b.d);
  const names = places.length ? places[0].p.photos.slice(0, 8).map(x => x.name) : [];
  await env.SHARED.put(k, JSON.stringify(names), { expirationTtl: 30 * 86400 });
  return names;
}
async function googleMedia(env, pname) {
  const m = await fetch(`https://places.googleapis.com/v1/${pname}/media?maxWidthPx=1000&skipHttpRedirect=true&key=${env.GOOGLE_PLACES_KEY}`);
  if (!m.ok) return null; return (await m.json()).photoUri || null;
}
async function tiktokCover(u) {
  const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`, { headers: UA }); if (!r.ok) return null;
  const j = await r.json(); return j.thumbnail_url || null;
}
async function photo(url, env, ctx) {
  const id = (url.searchParams.get("id") || "").slice(0, 60), idx = Math.max(0, Math.min(7, +url.searchParams.get("i") || 0)), key = "photo3:" + id + (idx ? ":" + idx : "");
  if (!/^[\w-]{8,60}$/.test(id)) return new Response("bad id", { status: 400 });
  const { value: hit, metadata } = await env.SHARED.getWithMetadata(key, "arrayBuffer"), meta = metadata || {};
  if (hit) {
    if (meta.none) return new Response("no photo", { status: 404, headers: { "cache-control": "public, max-age=86400" } });
    if (meta.redirect) return Response.redirect(meta.redirect, 302);
    return new Response(hit, { headers: { "content-type": meta.type || "image/jpeg", "cache-control": "public, max-age=2592000" } });
  }
  const name = url.searchParams.get("n") || "", city = url.searchParams.get("c") || "", country = url.searchParams.get("co") || "";
  const lat = +url.searchParams.get("lat"), lng = +url.searchParams.get("lng"), tt = url.searchParams.get("u") || "";
  const keep = got => { ctx.waitUntil(env.SHARED.put(key, got.buf, { metadata: { type: got.type } })); return new Response(got.buf, { headers: { "content-type": got.type, "cache-control": "public, max-age=2592000" } }); };
  /* 0. Google Places, when the key is set (the only source for photos after the first) */
  try { const names = await googleNames(env, id, name, city === "Other" ? "" : city, lat, lng); const g = names[idx] && await googleMedia(env, names[idx]); const got = g && await grab(g); if (got) return keep(got); } catch (e) {}
  if (idx) return new Response("no photo", { status: 404 });
  /* 1. the post it was saved from, when that post is about this one place */
  if (/^https:\/\/www\.tiktok\.com\//.test(tt)) { try { const cover = await tiktokCover(tt); const got = cover && await grab(cover); if (got) return keep(got); } catch (e) {} }
  /* 2. Wikipedia, for landmarks */
  try {
    for (const lang of ["en", LANG[country]].filter((x, i, a) => x && a.indexOf(x) === i)) { const src = await wikiPhoto(lang, name, city === "Other" ? "" : city, lat, lng); if (src) { ctx.waitUntil(env.SHARED.put(key, "1", { metadata: { redirect: src } })); return Response.redirect(src, 302); } }
  } catch (e) {}
  /* 3. the place's own website */
  try { const site = await osmWebsite(name, lat, lng); const img = site && await siteImage(site); const got = img && await grab(img); if (got) return keep(got); } catch (e) {}
  ctx.waitUntil(env.SHARED.put(key, "0", { metadata: { none: 1 }, expirationTtl: 7 * 86400 }));
  return new Response("no photo", { status: 404, headers: { "cache-control": "public, max-age=3600" } });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === "/api/state") {
      if (req.method === "GET") return json(await load(env));
      if (req.method === "POST") {
        const body = await req.text(); if (body.length > 200000) return json({ error: "too big" }, 413);
        let changes; try { changes = JSON.parse(body).changes; } catch (e) { return json({ error: "bad json" }, 400); }
        if (!Array.isArray(changes)) return json({ error: "no changes" }, 400);
        const st = await load(env); let n = 0;
        for (const c of changes.slice(0, 200)) {
          if (!c || !OK_KEY.test(c.k) || typeof c.ts !== "number" || (c.v != null && (typeof c.v !== "string" || c.v.length > 20000))) continue;
          if (!st[c.k] || c.ts >= st[c.k].ts) { st[c.k] = { v: c.v == null ? null : c.v, ts: Math.min(c.ts, Date.now() + 6e4) }; n++; }
        }
        if (n) await env.SHARED.put("state", JSON.stringify(st));
        return json(st);
      }
      return json({ error: "method" }, 405);
    }
    if (url.pathname === "/api/photo") return photo(url, env, ctx);
    if (url.pathname === "/api/photos") {
      const id = (url.searchParams.get("id") || "").slice(0, 60); if (!/^[\w-]{8,60}$/.test(id)) return json({ count: 0 }, 400);
      let names = []; try { names = await googleNames(env, id, url.searchParams.get("n") || "", (c => c === "Other" ? "" : c)(url.searchParams.get("c") || ""), +url.searchParams.get("lat"), +url.searchParams.get("lng")); } catch (e) {}
      return new Response(JSON.stringify({ count: names.length }), { headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" } });
    }
    if (url.pathname === FEED) {
      /* the trip feed, plus the stops people have added */
      const base = await env.ASSETS.fetch(req); let ics = await base.text();
      const st = await load(env), esc = t => String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
      const fold = l => { const o = []; let x = l; while (x.length > 74) { o.push(x.slice(0, 74)); x = " " + x.slice(74); } o.push(x); return o.join("\r\n"); };
      const ev = [];
      Object.entries(st).filter(([k, o]) => k.startsWith("cal:") && o.v).forEach(([k, o]) => {
        let list = []; try { list = JSON.parse(o.v); } catch (e) {}
        list.forEach(x => { if (!/^\d{8}T\d{6}Z$/.test(x.s) || !/^\d{8}T\d{6}Z$/.test(x.e)) return;
          ev.push("BEGIN:VEVENT", `UID:${esc(x.u)}@europe-family-trip.app`, `DTSTAMP:${new Date(o.ts).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`, `DTSTART:${x.s}`, `DTEND:${x.e}`, `SUMMARY:${esc(x.t)}`);
          if (x.l) ev.push(`LOCATION:${esc(x.l)}`);
          if (x.a) ev.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(x.t)}`, `TRIGGER:-PT${+x.a}M`, "END:VALARM");
          ev.push("END:VEVENT"); });
      });
      if (ev.length) ics = ics.replace(/END:VCALENDAR\s*$/, ev.map(fold).join("\r\n") + "\r\nEND:VCALENDAR\r\n");
      return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-cache" } });
    }
    return env.ASSETS.fetch(req);
  },
};
