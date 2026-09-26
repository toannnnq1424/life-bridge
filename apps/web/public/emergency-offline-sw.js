"use strict";

const CACHE_NAME = "lifebridge-emergency-shell-v1";
const SHELL_ASSETS = ["/emergency-offline.html", "/emergency-offline.css", "/emergency-offline.js"];
const EMERGENCY_PLAN_ROUTE = /^\/households\/[^/]+\/emergency-plan\/?$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("lifebridge-emergency-shell-"))
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(url.pathname, { cacheName: CACHE_NAME }).then((cached) => {
        return cached ?? Response.error();
      }),
    );
    return;
  }
  if (request.mode !== "navigate" || !EMERGENCY_PLAN_ROUTE.test(url.pathname)) return;
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match("/emergency-offline.html", {
        cacheName: CACHE_NAME,
      });
      return cached ?? Response.error();
    }),
  );
});
