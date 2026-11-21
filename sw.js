// ---------------------------------------------------------------------
// Service Worker der Productivity-App.
//
// Zwei Regeln:
//  - Seite und Datendatei: erst das Netz, sonst der zuletzt geladene
//    Stand. So zeigt die App im Funkloch oder bei ausgeschaltetem PC den
//    letzten Stand - verschluesselt im Speicher, entschluesselt erst beim
//    Anzeigen.
//  - Alles andere (Symbole, Schrift): aus dem Speicher, sonst Netz.
//
// Die Datendatei wird unter einem festen Namen gemerkt, weil die App sie
// mit wechselndem ?t=... abruft, damit kein Zwischenspeicher dazwischenfunkt.
// ---------------------------------------------------------------------
const SPEICHER = "productivity-v4";
const SCHALE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SPEICHER).then((c) => c.addAll(SCHALE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== SPEICHER).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  const eigen = u.origin === self.location.origin;
  const istDaten = eigen && u.pathname.endsWith("/daten.enc");
  const istSeite = eigen && (e.request.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith("/index.html"));

  if (istDaten || istSeite) {
    const schluessel = istDaten ? "daten.enc" : "index.html";
    // "no-cache" = beim Server nachfragen: GitHub Pages erlaubt dem Browser
    // sonst 10 Minuten lang die alte Seite, und ein Update kaeme verspaetet an.
    e.respondWith(
      fetch(istSeite ? new Request(e.request.url, {cache: "no-cache", credentials: "same-origin"}) : e.request)
        .then((r) => { if (r.ok) { const k = r.clone(); caches.open(SPEICHER).then((c) => c.put(schluessel, k)); } return r; })
        .catch(() => caches.match(schluessel))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      if (res.ok || res.type === "opaque") { const k = res.clone(); caches.open(SPEICHER).then((c) => c.put(e.request, k)); }
      return res;
    }))
  );
});
