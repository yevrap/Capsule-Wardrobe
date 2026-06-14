# Capsule — Antigravity

*The "why" behind every major decision. Read this before adding a feature or
refactoring. If a decision here seems wrong for the task at hand, document the
new reasoning rather than silently overriding it.*

---

## Core bets

### 1. Local-first, no backend

All data lives in IndexedDB (Dexie). No API keys, no monthly bill, no auth,
no network dependency. The trade-off is that data is trapped on one device
until export/import is built — which is why export lands in Phase 1, not Phase 3.

If sync ever happens it should be an additive layer (e.g. CRDTs over a user-owned
storage bucket), not a rewrite. Design features to work offline-first.

### 2. Photos stored with two resolutions

Every `GarmentPhoto` carries:
- `compressed` — 1200px wide / 85% JPEG: high enough for AI image-editing APIs
  (virtual try-on, garment extraction) without storing phone-camera originals
  that would fill up IndexedDB fast.
- `thumbnail` — 400px wide / 75% JPEG: fast to decode and display in grids.

Do not store raw camera originals. Do not generate more than these two variants
in Phase 0–4. If an AI feature needs a different resolution, derive it at request
time from `compressed`.

### 3. Multi-profile data model from day one

`ownerId` is on every `Garment`, `Outfit`, and `WearLog`. The family wardrobe
(self / partner / child) is the intended end state. Retrofitting ownerId later
means a schema migration on real user data — painful. The UI for switching
profiles can arrive later; the data layer cannot.

### 4. Scoring is rule-based, not AI

Phases 2–4 scoring (cost-per-wear, pair compatibility, Elo preference) is
pure arithmetic — transparent, fast, offline, and tunable. AI assist (Phase 5)
augments metadata entry, it does not replace scoring. Keep scores deterministic
so users can predict and trust them.

### 5. HashRouter for routing

GitHub Pages serves from a subdirectory (`/<repo>/`) and does not support
server-side rewrites. `HashRouter` (`/#/path`) requires zero server config.
`BrowserRouter` would need a 404.html redirect hack that breaks on some hosts.
Don't change the router without a concrete plan for the deployment target.

---

## Design principles

### Dark editorial, not dark mode

The palette (`#0A0A0A` background, `#C8B89A` accent) is an aesthetic choice, not
a system-dark-mode response. It references fashion photography and editorial
layouts. Keep contrast high — `--c-text` (`#F0EDE8`) on `--c-bg` (`#0A0A0A`)
is >16:1. Never reduce contrast for "softer" looks.

### Typography hierarchy

- `h1`: `font-weight: 200`, very large, wide letter-spacing. Editorial headline.
- `h2`: `font-weight: 300–400`. Section titles.
- `.label`: uppercase, small, spaced — metadata, not content.
- Body: `15px`, `line-height: 1.5`. Comfortable for reading on phone.

Don't add bold body text or dense paragraphs. If there's a lot to say, use a
list or a card, not a wall of prose.

### Mobile-first layout

The bottom tab bar is the primary navigation surface. The sidebar is a
desktop enhancement. All layout decisions start from a 375px-wide phone screen.
Use `min-width` media queries only.

Safe areas (`env(safe-area-inset-*)`) are applied everywhere fixed/sticky
elements touch the screen edges. Don't skip these — the app installs to the
iOS home screen and runs in `standalone` mode.

### Spacing rhythm

Multiples of 4px: 4, 8, 12, 16, 20, 24, 32, 40, 48...
Padding inside cards: `20px`. Page padding: `24px` mobile, `40px` desktop.
Gap between list items: `12–16px`. Gap between sections: `32–40px`.

---

## What not to do

| Temptation                        | Why to resist it                                         |
|-----------------------------------|----------------------------------------------------------|
| Add Tailwind                      | CSS Modules + global tokens are already set up. Tailwind would split styling across two systems. |
| Add a state management library    | React Context + Dexie `useLiveQuery` covers all current needs. Redux/Zustand adds ceremony for no gain at this scale. |
| Add a backend "just for sync"     | Export/import is the v1 sync story. A backend adds auth, infra cost, and a new failure mode. Revisit in Phase 7 only if export stops being enough. |
| Store raw camera files            | Phone photos are 5–12 MB each. 100 garments = 500 MB–1.2 GB. Compress on intake, always. |
| Hardcode colours                  | Always use CSS variables. Dark editorial feel requires all colours to be tuneable from one place. |
| Skip `ownerId` on a new table     | Every user-owned record needs `ownerId`. Adding it later = migration + data loss risk. |
| Use `Math.random()` for IDs       | Use `crypto.randomUUID()` via `generateId()`. Crypto IDs have collision guarantees; Math.random does not. |
| Put business logic in components  | Scoring, filtering, and export logic belong in `src/utils/`. Components render; utilities compute. |

---

## Extending the scoring system (Phase 3+)

All scoring weights live in one config object (to be created in `src/scoring/config.ts`).
No weight should be buried inside a scoring function. The shape:

```ts
export const SCORING_CONFIG = {
  pairCompatibility: {
    colorHarmony:        0.4,
    formalityProximity:  0.3,
    seasonOverlap:       0.2,
    categoryConflict:   -0.3, // penalty
  },
  weatherFit: {
    warmthRange: 5, // denominator for normalisation
  },
  elo: {
    kFactor: 32,
  },
};
```

When adding a new score, add its weights here first, then implement the function
in `src/scoring/`. Never magic-number a weight inline.

---

## Export / import design (Phase 1)

Per-profile export produces a ZIP containing:
- `profile.json` — profile record
- `garments.json` — all garments (Blob references replaced with filenames)
- `images/` — one folder per garment, files named `<photoId>-compressed.jpg` and
  `<photoId>-thumbnail.jpg`
- `outfits.json`, `wearlogs.json`

Import reads the ZIP, reconstructs Blobs, and writes to Dexie. The profile `id`
is preserved so re-importing doesn't create duplicates (upsert, not insert).

This format is also the migration path if sync is ever added — a sync backend
can consume and produce the same ZIP schema.

---

## Agent guidance

When adding a feature:
1. Check `src/types/index.ts` first. If the domain type doesn't exist, add it there
   before writing any component or DB code.
2. Bump the Dexie schema version in `src/db/index.ts` if you add a table or index.
   Never mutate an existing `.version()` block.
3. Place page-level components in `src/pages/`, shared UI in `src/components/`,
   pure logic in `src/utils/` or `src/scoring/`.
4. Use `generateId()` for all new records. Use ISO 8601 for all dates.
5. Run `npm run typecheck` before considering any change done.
6. Ask before adding a new npm dependency. The current set is intentionally minimal.
