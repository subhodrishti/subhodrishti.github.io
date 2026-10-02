/* Cache the shell and local art after the first successful visit. Network
   requests (maps, fonts, livestreams) are left alone, avoiding stale data. */
const CACHE = "subh-sneha-invite-v8";
const LOCAL = [
  "./", "index.html", "css/styles.css", "js/config.js", "js/strings.js", "js/util.js", "js/invites.js", "js/main.js",
  "js/petals.js", "js/confetti.js", "js/audio.js", "js/ambient.js", "js/avatar-frame.js", "js/transitions.js",
  "js/alpha-video.js", "js/wardrobe.js", "js/curtain.js", "js/countdown.js", "js/families.js", "js/rituals.js", "js/contact.js", "js/wedding-day.js", "js/gallery.js",
  "js/events.js", "js/polls.js", "js/rsvp.js", "assets/avatars/sangeet.webp", "assets/avatars/haldi.webp",
  "assets/avatars/biye.webp", "assets/avatars/reception.webp", "assets/audio/shankh.mp3", "assets/audio/shehnai.mp3",
  "assets/decor/velvet.webp", "assets/decor/tassel.webp", "assets/decor/paan-left.webp", "assets/decor/paan-right.webp",
];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(LOCAL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  // Clips stream in byte ranges, which the cache can't store and Safari needs; leave them to the network.
  if (event.request.headers.has("range") || url.pathname.endsWith(".mp4")) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response;
  })));
});
