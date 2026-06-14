# Capsule — Agent Context

A local-first PWA wardrobe inventory app. One codebase covers iOS, Android, Mac, and web.
Built for a family of three: self, partner, child (baby).

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
src/
  types/index.ts          — all domain types (single source of truth)
  db/index.ts             — CapsuleDB (Dexie) + schema
  contexts/
    ProfileContext.tsx    — active profile, profile list, onboarding gate
  utils/
    id.ts                 — generateId() via crypto.randomUUID()
    image.ts              — compressOriginal(), generateThumbnail()
  components/
    Nav.tsx + Nav.module.css      — bottom tab bar (mobile) / sidebar (desktop)
    Layout.tsx                    — wraps Nav around page content
  pages/
    Onboarding.tsx + .module.css  — welcome → profile setup → done
    Inventory.tsx + .module.css   — garment grid with profile switcher
    AddGarment.tsx                — Phase 1 stub
    Outfits.tsx                   — Phase 2 stub
  styles/
    global.css            — design tokens + reset + reusable classes
```

---

## Data model (quick reference)

All types live in `src/types/index.ts`. Key relationships:

- `Profile` → identified by `id`, role: `'self' | 'partner' | 'child'`
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

PWA icons: generate `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png`
(180×180) from `public/icon.svg` and commit them to `public/`.

---

## Phase roadmap

| Phase | Status  | Description                                              |
|-------|---------|----------------------------------------------------------|
| 0     | ✅ done  | Scaffold: PWA shell, DB schema, onboarding, nav          |
| 1     | next    | Add garment form, photo capture, inventory grid + filter |
| 2     | later   | Outfits, wear log, cost-per-wear                         |
| 3     | later   | Scores, weather fit, insights dashboard                  |
| 4     | later   | Comparison quiz + Elo preference ranking                 |
| 5     | later   | AI auto-tagging + tag OCR                               |
| 6     | later   | AI virtual try-on                                        |
| 7     | later   | Multi-profile UI, baby growth tracking, optional sync    |

---

## Conventions

- `generateId()` from `src/utils/id.ts` for all new records. Never use `Math.random()`.
- Dates: ISO 8601. Day-only fields use `YYYY-MM-DD`. Timestamps use full ISO datetime.
- All DB writes go through `db` from `src/db/index.ts`. No raw IndexedDB calls.
- New pages get their own `PageName.tsx` + `PageName.module.css` in `src/pages/`.
- Export/import (Phase 1): JSON for structured data + ZIP of image Blobs per profile.
