# Sprint Tracking: On-Device ML Clothing Inventory Matching

This sprint tracking sheet is a living document to track progress on implementing on-device ML similarity matching. Check off items as they are completed.

---

## 🎯 Sprint Goal
Enable Capsule users to scan any garment using their device's camera, compute a local visual embedding, find the closest matching clothing item in IndexedDB using cosine similarity, or add a new garment with pre-computed metadata.

---

## 📋 Task Backlog

### 🧱 Phase 1: Setup & Dependencies
- [ ] Install `@xenova/transformers` library.
  - *Command:* `npm install @xenova/transformers`
- [ ] Verify that model assets are not loaded from local directories but downloaded and cached via Hugging Face CDN.
- [ ] Define the `embedding` property type on the `Garment` interface in [src/types/index.ts](file:///Users/yevster/Development/Clothes%20Inventory/src/types/index.ts).
- [ ] Bump Dexie schema version to version 3 in [src/db/index.ts](file:///Users/yevster/Development/Clothes%20Inventory/src/db/index.ts).

### ⚙️ Phase 2: Web Worker Implementation
- [ ] Create [src/ml-worker.ts](file:///Users/yevster/Development/Clothes%20Inventory/src/ml-worker.ts).
- [ ] Configure `allowLocalModels = false` in the worker.
- [ ] Implement model initialization singleton inside the worker using `pipeline('feature-extraction', 'Xenova/mobilenet_v2_1.0_224')`.
- [ ] Implement extraction handler in worker using `RawImage` and return the flat array.
- [ ] Set up loading progress reporting via `LOADING_PROGRESS` events.

### 🧮 Phase 3: Math & Processing Utilities
- [ ] Create `calculateCosineSimilarity` function in `src/utils/math.ts` to compute dot product over vector magnitudes.
- [ ] Implement `getModelInputData` inside [src/utils/image.ts](file:///Users/yevster/Development/Clothes%20Inventory/src/utils/image.ts) to resize blobs to 224x224 and fetch RGBA ImageData.
- [ ] Write unit tests or console tests verifying cosine similarity returns `1.0` for identical vectors and correct fractional matches for mock vectors.

### 📸 Phase 4: Scanner UI & Workflow
- [ ] Create the scanning page component [src/pages/IdentifyItem.tsx](file:///Users/yevster/Development/Clothes%20Inventory/src/pages/IdentifyItem.tsx).
- [ ] Create the stylesheet [src/pages/IdentifyItem.module.css](file:///Users/yevster/Development/Clothes%20Inventory/src/pages/IdentifyItem.module.css).
- [ ] Implement camera input trigger using a hidden file input with `capture="environment"`.
- [ ] Connect the Web Worker to the page: handle initializing state, download progress spinner, and extraction errors.
- [ ] Add routing path `/identify` for the scanning page in [src/App.tsx](file:///Users/yevster/Development/Clothes%20Inventory/src/App.tsx).
- [ ] Add the "📸 Scan Match" button inside the wardrobe filter toolbar in [src/pages/Inventory.tsx](file:///Users/yevster/Development/Clothes%20Inventory/src/pages/Inventory.tsx).

### 🔗 Phase 5: Integration & UX Flows
- [ ] Implement cosine similarity loop over all garments fetched from IndexedDB.
- [ ] Design and render the "Match Found" state (displaying matched garment details and linking to `/item/:id`).
- [ ] Design and render the "Unrecognized Item" state.
- [ ] Implement the pre-loaded "Add to Inventory" path:
  - Generate compressed/thumbnail blobs from photo.
  - Preload the generated embedding.
  - Navigate to `/add` passing blobs and embedding in React Router's location state.
- [ ] Update [src/pages/AddGarment.tsx](file:///Users/yevster/Development/Clothes%20Inventory/src/pages/AddGarment.tsx) to check for route state and pre-populate the form if details exist.

---

## 🧪 Verification Plan

### Step-by-Step Testing Checklist

1. **Model Cache Verification:**
   - [ ] Navigate to the `/identify` page. Verify the model loading card is visible.
   - [ ] Refresh the page. Verify the second load is instant (reads model from Cache Storage).
   - [ ] Turn off internet connection (Chrome DevTools -> Network -> Offline). Refresh. Verify the model still loads successfully.

2. **Similarity Math Verification:**
   - [ ] Pass the vectors `[1, 0]` and `[1, 0]` to `calculateCosineSimilarity`. Assert score = `1.0`.
   - [ ] Pass `[1, 0]` and `[0, 1]`. Assert score = `0.0`.
   - [ ] Pass `[1, 1]` and `[1, 0]`. Assert score ≈ `0.707`.

3. **End-to-End Matching Verification:**
   - [ ] Capture a new shirt photo, choose "Add to Inventory", save the item.
   - [ ] Navigate to the Identify page. Scan the same shirt. Verify it matches the item and prints a high similarity score ($>0.85$).
   - [ ] Scan a completely different item (e.g. your desk or a cup). Verify it returns "Unrecognized Item" and offers to add it.
