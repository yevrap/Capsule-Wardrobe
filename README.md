# Capsule

A local-first wardrobe inventory PWA for families. Dark, editorial, offline-first.

**Live app → [yevrap.github.io/Capsule-Wardrobe](https://yevrap.github.io/Capsule-Wardrobe/)**

---

## What it does

- Catalogue your wardrobe with photos, tags, brand, price, notes
- Multiple profiles — one app for the whole family
- Create and save outfits from items in your wardrobe
- Search and filter by category, tag, or text
- Full backup and restore per profile (ZIP file, works on iOS, Android, and desktop)
- Installs as a PWA on iPhone, Android, Mac, and web
- Manage profiles and check for app updates from the Settings tab

## Local development

```bash
npm install
npm run dev        # dev server at localhost:5173
npm run build      # production build → dist/
npm run preview    # serve dist/ to test the PWA service worker
npm run typecheck  # TypeScript check (no emit)
```

## Stack

Vite + React 18 + TypeScript · Dexie 4 (IndexedDB) · CSS Modules · vite-plugin-pwa · HashRouter

## Deployment

Push to `main`. GitHub Actions builds and deploys to `gh-pages` automatically.
