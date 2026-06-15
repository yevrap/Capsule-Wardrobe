# Capsule — Agent Context

A local-first PWA wardrobe inventory app. One codebase covers iOS, Android, Mac, and web.
Built for a family of three: self, partner, child (baby).

Live: **https://yevrap.github.io/Capsule-Wardrobe/**

---

## Stack

| Layer       | Choice                  | Notes                                                    |
|-------------|-------------------------|----------------------------------------------------------|
| UI          | React 18 + TypeScript   | Strict mode on. No `any`. Functional components only.    |
| Build       | Vite 5                  | `@` alias → `src/`. PWA via `vite-plugin-pwa` + Workbox.|
| Storage     | Dexie 4 (IndexedDB)     | No backend. All data lives on device.                    |
| Routing     | React Router v6         | `HashRouter` — required for GitHub Pages.                |
| Styling     | CSS Modules + global.css| No Tailwind, no CSS-in-JS. Tokens in `global.css`.       |
| Images      | Canvas API              | Compress originals at 1200px/85%, thumbnails at 400px/75%.|

---

## Repository layout

```
ml-implementation-guide.md — implementation guide for local ML matching
ml-sprint-tracking.md      — task tracking for local ML matching sprint
src/
  types/index.ts          — all domain types (single source of truth)
  db/index.ts             — CapsuleDB (Dexie) + schema
  ml-worker.ts            — Web Worker for local ONNX model feature extraction
  contexts/
    ProfileContext.tsx    — active profile, profile list, onboarding gate
  utils/
    id.ts                 — generateId() via crypto.randomUUID()
    image.ts              — compressOriginal(), generateThumbnail(), blobToUrl(), getModelInputData()
    math.ts               — calculateCosineSimilarity()
    export.ts             — exportProfile() — ZIP export via JSZip
    import.ts             — previewImport(), runImport() — ZIP import
  components/
    Nav.tsx + Nav.module.css         — bottom tab bar (mobile) / sidebar (desktop)
    Layout.tsx + Layout.module.css   — wraps Nav around page content
    GarmentForm.tsx + .module.css    — shared Add/Edit garment form
    OutfitForm.tsx + .module.css     — shared Add/Edit outfit form
    PhotoUploader.tsx + .module.css  — multi-photo upload with compression
    TagInput.tsx + .module.css       — chip-based tag input
    UpdatePrompt.tsx + .module.css   — floating banner when a SW update is ready
  hooks/
    useInventoryFilter.ts — search + category + tag filter logic
  pages/
    Onboarding.tsx + .module.css   — one-tap welcome; creates a default profile
    Inventory.tsx + .module.css    — garment grid with search, category, tag filter
    IdentifyItem.tsx + .module.css — [NEW] ML matching page and layout
    AddGarment.tsx                 — wraps GarmentForm for new item creation
    ItemDetail.tsx + .module.css   — full item view with photo strip + delete
    EditGarment.tsx + .module.css  — wraps GarmentForm for editing an existing item
    Outfits.tsx + .module.css      — outfit grid; tap to view, + to create
    AddOutfit.tsx                  — wraps OutfitForm for new outfit creation
    OutfitDetail.tsx + .module.css — outfit view with garment tiles + delete
    EditOutfit.tsx                 — wraps OutfitForm for editing an existing outfit
    SettingsPage.tsx + .module.css — profile management, app updates, export/import
  styles/
    global.css            — design tokens + reset + reusable classes
```

---

## Phase status

| Phase | Status           | Description                                              |
|-------|------------------|----------------------------------------------------------|
| 0     | ✅ complete       | PWA shell, DB schema, onboarding, nav                    |
| 1     | ✅ complete       | Photo upload, garment form, inventory grid, search/filter, export/import, edit/delete, Settings page, profile management |
| 2     | 🔄 in progress   | Outfits ✅ (list, create, detail, edit, delete) · wear log, cost-per-wear next |
| 3     | later            | Scores, weather fit, insights dashboard                  |
| 4     | later            | Comparison quiz + Elo preference ranking                 |
| 5     | 🔄 planned       | On-device ML clothing similarity matching (this sprint)  |
| 6     | later            | AI virtual try-on                                        |
| 7     | later            | Baby growth tracking, optional sync                      |

---

## Data model (quick reference)

All types live in `src/types/index.ts`. Key relationships:

- `Profile` → identified by `id`; `role: 'self' | 'partner' | 'child'` is in the schema but **not exposed in UI** — all new profiles default to `'self'`. The name is the only user-visible identifier.
- `Garment` → `ownerId` references `Profile.id`; `photos: GarmentPhoto[]` stores Blobs
- `Outfit` → `garmentIds[]` references garments; `ownerId` references Profile
- `WearLog` → records a wear event per day; links garments + optional outfit
- `Store` → preferred retailer list (Phase 3)

`GarmentPhoto` stores two Blobs per photo:
- `compressed` — 1200px / 85% JPEG (used for AI try-on / image editing)
- `thumbnail`  — 400px / 75% JPEG (used for grid rendering)

---

## Dexie schema versioning

Schema lives in `src/db/index.ts`. **Never edit an existing `.version()` block** —
always add a new `.version(N).stores({...})` with only the changed tables.
Dexie applies migrations incrementally.

---

## Design system

Dark editorial aesthetic. Tokens defined in `src/styles/global.css` under `:root`.

Key variables:
```
--c-bg         #0A0A0A   page background
--c-surface    #141414   cards, inputs
--c-border     #2A2A2A   dividers
--c-text       #F0EDE8   primary text (warm white)
--c-text-muted #6B6B6B   secondary labels
--c-accent     #C8B89A   warm cream — CTAs, active states
```

Rules:
- Always use CSS variables. Never hard-code colours.
- One CSS Module per component file (e.g. `Nav.module.css` next to `Nav.tsx`).
- Reusable utility classes (`.btn`, `.card`, `.page`, `.empty-state`, `.field`) live in `global.css`.
- Mobile-first media queries: `@media (min-width: 768px)` for desktop.
- Bottom tab bar on mobile, left sidebar on desktop — both live in `Nav.tsx`.

---

## Mobile / PWA conventions

**iOS Safari:**
- All `input`, `textarea`, `select` must be `font-size: 16px` minimum — below 16px triggers automatic zoom on focus.
- `html { overflow-x: hidden }` locks the page against horizontal rubber-band scroll. Internally scrollable elements (filter rows, photo strips) use `overflow-x: auto` on their own container — they are unaffected.
- Don't use negative margins to achieve full-bleed layout when `overflow-x: hidden` is set on `html` — the content gets clipped. Instead, structure pages so full-width sections have no horizontal padding at the layout level (see `ItemDetail` — it uses its own `.detail` container, not the global `.page` class, so each sub-section controls its own padding).
- `touch-action: manipulation` on `button` and `a` prevents the 300ms tap delay and double-tap zoom.
- `env(safe-area-inset-*)` must be applied to anything that touches the screen edges (bottom nav, page bottom padding).

**Android:**
- Web Share API with `type: 'application/zip'` causes Android to immediately open the file with its file manager/unzipper before the user can save it. Use `type: 'application/octet-stream'` instead — the user gets the native share sheet and can choose where to save.
- The `<a download>` fallback (for desktop and Android Chrome when Web Share is unavailable) should use the original `blob` directly, not the share-targeted `File` object.

**PWA install:**
- Manifest is generated by `vite-plugin-pwa`. Icons must be at `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` (180×180).
- `overscroll-behavior: none` on `body` prevents iOS rubber-band from showing the background color behind the app shell.

---

## Routing

`HashRouter` is intentional — GitHub Pages has no server-side rewrite capability.
Route table lives in `App.tsx`. The `ProfileProvider` gates all routes:
- No profiles in DB → `Onboarding` regardless of URL
- Profiles exist → normal route table with `Layout`

---

## Image handling

Use `compressOriginal(file)` and `generateThumbnail(file | blob)` from `src/utils/image.ts`.
Store both Blobs on `GarmentPhoto`. Dexie stores Blobs natively in IndexedDB.
Call `blobToUrl(blob)` + `URL.revokeObjectURL()` in component effects to display photos.
Track all created object URLs and revoke them in useEffect cleanup or component unmount
to prevent memory leaks.

---

## Export / Import

`src/utils/export.ts` — `exportProfile(profileId, onProgress?)` builds a ZIP and calls
`triggerDownload()`. The download tries Web Share API first (mobile), falls back to `<a download>`.

`src/utils/import.ts` — `previewImport(file)` validates the ZIP without writing.
`runImport(file, onProgress?)` upserts via `db.profiles.put()` + `db.garments.bulkPut()`.
Re-importing the same backup is safe (idempotent).

---

## Dev commands

```bash
npm run dev        # Vite dev server at localhost:5173
npm run build      # TypeScript check + Vite production build → dist/
npm run preview    # Serve dist/ locally to test PWA
npm run typecheck  # tsc --noEmit (no build artefacts)
```

---

## GitHub Pages deployment

Push to `main`. The workflow at `.github/workflows/deploy.yml` builds with
`VITE_BASE_PATH=/<repo-name>/` and deploys `dist/` to the `gh-pages` branch.

Before first deploy:
1. Create the GitHub repo
2. Push this code to `main`
3. In GitHub repo → Settings → Pages → Source: `gh-pages` branch

---

## Conventions

- `generateId()` from `src/utils/id.ts` for all new records. Never use `Math.random()`.
- Dates: ISO 8601. Day-only fields use `YYYY-MM-DD`. Timestamps use full ISO datetime.
- All DB writes go through `db` from `src/db/index.ts`. No raw IndexedDB calls.
- New pages get their own `PageName.tsx` + `PageName.module.css` in `src/pages/`.
- TypeScript `vite-env.d.ts` declares `module '*.module.css'` — required for TS to accept CSS Module imports.
