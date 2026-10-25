/* Europe Trip: static app plus a small shared store so everyone's phone shows the same added stops,
   day plans and ticks. Everything lives in one KV value: { key: { v, ts } }, newest change wins. */
const FEED = "/cal/ed3056321e507c456ba8.ics";
const OK_KEY = /^(plan|dayplan|pick|cal):[\w:-]{1,40}$|^uk-eta$/;
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function load(env) { return (await env.SHARED.get("state", "json")) || {}; }

export default {
  async fetch(req, env) {
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
