# Sprint Tracking: On-Device ML Clothing Inventory Matching

This sprint tracking sheet is a living document to track progress on implementing on-device ML similarity matching. Check off items as they are completed.

---

## 🎯 Sprint Goal

Enable Capsule users to scan any garment using their device's camera, compute a local visual embedding, find the closest matching clothing item in IndexedDB using cosine similarity, or add a new garment with pre-computed metadata.

**Status: ✅ Complete**

---

## 📋 Task Backlog

### 🧱 Phase 1: Setup & Dependencies
- [x] Install `@xenova/transformers` library.
- [x] Verify that model assets are downloaded and cached via Hugging Face CDN (not local directories).
- [x] Define the `embedding` property type on the `Garment` interface in [src/types/index.ts](src/types/index.ts).
- [x] Bump Dexie schema version to version 3 in [src/db/index.ts](src/db/index.ts).

### ⚙️ Phase 2: Web Worker Implementation
- [x] Create [src/ml-worker.ts](src/ml-worker.ts).
- [x] Configure `allowLocalModels = false` in the worker.
- [x] Implement model initialization singleton inside the worker using `pipeline('feature-extraction', 'Xenova/mobilenet_v2_1.0_224')`.
- [x] Implement extraction handler in worker using `RawImage` and return the flat array.
- [x] Set up loading progress reporting via `LOADING_PROGRESS` events.
- [x] Bundle WASM binaries in `public/` and dynamically resolve their base path in the worker so the app works fully offline post-install.

### 🧮 Phase 3: Math & Processing Utilities
- [x] Create `calculateCosineSimilarity` function in `src/utils/math.ts`.
- [x] Implement `getModelInputData` inside [src/utils/image.ts](src/utils/image.ts) to resize blobs to 224×224 and return raw RGBA `ImageData`.

### 📸 Phase 4: Scanner UI & Workflow
- [x] Create the scanning page component [src/pages/IdentifyItem.tsx](src/pages/IdentifyItem.tsx).
- [x] Create the stylesheet [src/pages/IdentifyItem.module.css](src/pages/IdentifyItem.module.css).
- [x] Implement dual triggers: hidden `capture="environment"` input (camera) + file upload input (gallery/desktop).
- [x] Connect the Web Worker to the page: model loading banner with progress bar, extraction errors in results column.
- [x] Add routing path `/identify` in [src/App.tsx](src/App.tsx).
- [x] Add "📸 Scan Match" button in the wardrobe toolbar in [src/pages/Inventory.tsx](src/pages/Inventory.tsx).
- [x] Two-column layout on desktop (≥1024 px); single column on mobile.
- [x] Landscape-phone guard: slot switches from `aspect-ratio:1` to `vmin`-based sizing when viewport height < 600 px.
- [x] Floating "↩ Rescan" overlay chip on the preview image.
- [x] Action buttons wrap (`flex-wrap`) on narrow phones.

### 🔗 Phase 5: Integration & UX Flows
- [x] Fix stale-closure bug: `userGarmentsRef` keeps the worker message handler reading the current garment list instead of the empty list captured at mount.
- [x] Fix error state: `modelReadyRef` distinguishes model-load failures (shown in status banner) from per-image extraction failures (shown in results column).
- [x] Fix progress bar: `@xenova/transformers` reports 0–100, not 0–1; dropped the erroneous `× 100` multiplier.
- [x] Implement cosine similarity loop over all garments from IndexedDB.
- [x] "Match Found" state: shows matched garment name, brand, similarity %, and links to `/item/:id`.
- [x] "Not in wardrobe" state: contextual message distinguishes "no embeddings exist yet" from "no close match".
- [x] Pre-loaded "Add to Inventory" path: compresses photo, reuses the already-extracted embedding, navigates to `/add` with route state.
- [x] [src/pages/AddGarment.tsx](src/pages/AddGarment.tsx) reads route state and pre-populates the form photo and saves the embedding.

---

## 🧪 Verification Plan

### Step-by-Step Testing Checklist

1. **Model Cache Verification:**
   - [ ] Navigate to the `/identify` page. Verify the model loading banner is visible and the progress bar fills.
   - [ ] Refresh the page. Verify the second load is instant (reads model from Cache Storage).
   - [ ] Turn off internet (DevTools → Network → Offline). Refresh. Verify the model still loads successfully.

2. **Similarity Math Verification:**
   - `calculateCosineSimilarity([1, 0], [1, 0])` → `1.0`
   - `calculateCosineSimilarity([1, 0], [0, 1])` → `0.0`
   - `calculateCosineSimilarity([1, 1], [1, 0])` → ≈ `0.707`

3. **End-to-End Matching Verification:**
   - [ ] Scan a new shirt → choose "Add to Inventory" → save. Verify the item appears in the wardrobe with an embedding stored.
   - [ ] Navigate to Identify → scan the same shirt. Verify it matches with a score >85%.
   - [ ] Scan a clearly different item. Verify it returns "Not in wardrobe" and offers to add it.
