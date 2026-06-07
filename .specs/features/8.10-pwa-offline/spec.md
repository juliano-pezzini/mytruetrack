# Phase 8.10 — PWA + Offline Polish

## Goal

Make mytruetrack installable as a Progressive Web App. Cache the app shell for offline use, add a web manifest with icons, add meta tags for mobile, and show an offline indicator when the network is unavailable.

## Requirements

### PWA-01: Web App Manifest

`public/manifest.json` with:
- `name`: "mytruetrack"
- `short_name`: "mytruetrack"
- `start_url`: "/"
- `display`: "standalone"
- `background_color`: "#f9fafb" (gray-50)
- `theme_color`: "#2563eb" (blue-600)
- `icons`: 192x192 and 512x512 PNG (generated SVG → PNG)

Link manifest in `index.html`.

### PWA-02: Service Worker

A simple cache-first service worker that:
1. On install: pre-caches the app shell (index.html, JS, CSS, WASM files)
2. On fetch: serve from cache first, fall back to network
3. On activate: clean up old caches
4. Does NOT intercept API calls (WebDAV, Google Drive) — only static assets

Use Vite's `vite-plugin-pwa` or a hand-rolled SW registered from `main.tsx`.

### PWA-03: Meta tags + install

Add to `index.html`:
- `<meta name="theme-color" content="#2563eb">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
- `<link rel="apple-touch-icon" href="/icon-192.png">`

### PWA-04: Offline indicator

Show a small banner when `navigator.onLine === false`. Dismiss when back online. Lightweight — just a `useOnlineStatus` hook + conditional banner in Layout.

## Non-requirements

- Push notifications (no backend)
- Background sync API (manual push/pull is sufficient)
- Cross-browser QA beyond basic smoke (deferred)

## Files

| File | Purpose |
|------|---------|
| `public/manifest.json` | Web app manifest |
| `public/icon-192.png` | App icon 192x192 |
| `public/icon-512.png` | App icon 512x512 |
| `public/sw.js` | Service worker |
| `src/ui/hooks/useOnlineStatus.ts` | Online/offline hook |
| `src/ui/components/OfflineBanner.tsx` | Offline indicator |
| `index.html` | Updated with manifest link + meta tags |
| `src/main.tsx` | SW registration |
