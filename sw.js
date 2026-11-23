// MedFeed service worker: lets the installed app open without a connection.
// Network first, so a new version always wins when online; the saved copy is only a fallback.
// Only this site's own files are cached. Database requests (Supabase) are never touched here;
// the app keeps its own offline copy of posts.
const CACHE = "medfeed-shell-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // Build files with a content hash in their name never change, so the browser's copy is fine.
  // Everything else (the main page, manifest, icons) is re-checked with GitHub every time:
  // GitHub Pages lets browsers reuse files for 10 minutes, which would hide a fresh update.
  // (A page-load request can't be re-issued with new options, so it is fetched again by its address.)
  const hashed = /[.-][0-9a-f]{16,}\./.test(new URL(req.url).pathname);
  e.respondWith(
    (hashed ? fetch(req) : fetch(req.url, { cache: "no-cache", credentials: "same-origin" }))
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("./") : undefined))
          .then((hit) => hit || Response.error())
      )
  );
});
