# Phase 8.10 — PWA + Offline Polish Tasks

**Spec**: `.specs/features/8.10-pwa-offline/spec.md`  
**Status**: Done

---

## Execution Plan

```
T1 → T2 → T3 → T4 → T5
```

---

## Task Breakdown

### T1: PWA manifest + icons

**Where**: `public/manifest.json`, `public/icon-192.png`, `public/icon-512.png`, `index.html`
**Requirement**: PWA-01, PWA-03

**Done when**:
- [ ] `manifest.json` with name, icons, display, colors
- [ ] SVG icon → 192 and 512 PNG generated
- [ ] `index.html` links manifest + apple meta tags + theme-color
- [ ] Gate: `npx vite build`

---

### T2: Service worker

**Where**: `public/sw.js`, `src/main.tsx`
**Requirement**: PWA-02

**Done when**:
- [ ] `sw.js` with install (precache), fetch (cache-first for static), activate (cache cleanup)
- [ ] SW registered in `main.tsx`
- [ ] Only caches same-origin static assets, not API calls
- [ ] Gate: `npx vite build`

---

### T3: Offline indicator

**Where**: `src/ui/hooks/useOnlineStatus.ts`, `src/ui/components/OfflineBanner.tsx`, `src/ui/components/Layout.tsx`
**Requirement**: PWA-04

**Done when**:
- [ ] `useOnlineStatus()` hook → boolean, listens to online/offline events
- [ ] `OfflineBanner` shows "You are offline" when disconnected
- [ ] Banner integrated into Layout
- [ ] Gate: `npx tsc --noEmit && npx vite build`

---

### T4: Final gate

**Requirement**: All

**Done when**:
- [ ] `npx tsc --noEmit && npx vite build && npx vitest run` — all pass
- [ ] Update STATE.md, ROADMAP.md, tasks.md
