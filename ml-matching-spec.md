# Feature Specification: On-Device ML Clothing Inventory Matching

## Context for AI Agent
You are an expert AI coding assistant (e.g., Claude, Cursor, Antigravity) working within an existing JavaScript/HTML/CSS Progressive Web App (PWA). Your objective is to implement an offline-first, on-device machine learning feature. 

This feature will allow users to take a photo of an item, extract its visual features (embedding) using a local ML model, and compare it against a local database using cosine similarity to either identify the item or prompt the user to add it to their inventory.

## Technical Constraints & Stack
- **Execution Environment:** Web Browser (PWA). Must work offline after the initial model cache.
- **ML Library:** `@xenova/transformers` (Transformers.js).
- **Storage:** `IndexedDB` (using a wrapper like `localforage` or native `idb` for async operations).
- **Architecture:** The ML inference **must** run inside a Web Worker to prevent blocking the main UI thread.
- **Model:** `Xenova/mobilenet_v2_1.0_224` (specifically loaded for `feature-extraction`).

---

## Incremental Implementation Steps

Please implement this feature strictly step-by-step. Do not proceed to the next step until the current step is fully functional and tested.

### Step 1: Web Worker Setup & Model Initialization
**Objective:** Establish a Web Worker that loads and caches the vision model.
1. Create a new file `ml-worker.js`.
2. Import `pipeline` and `env` from `@xenova/transformers`.
3. Configure `env.allowLocalModels = false` to pull from Hugging Face initially, and ensure caching is enabled.
4. Initialize a singleton `pipeline('feature-extraction', 'Xenova/mobilenet_v2_1.0_224')`.
5. Set up a `postMessage` listener to handle initialization requests and send a "ready" status back to the main thread.
**Verification:** The main thread should receive a message that the model has successfully loaded and is ready.

### Step 2: Camera UI & Image Capture
**Objective:** Allow the user to take a photo and pass it to the worker.
1. Create a hidden standard HTML5 input: `<input type="file" accept="image/*" capture="environment" id="cameraInput">`.
2. Add a UI button to trigger this input.
3. Once an image is selected, read it as a Data URL or Blob.
4. Draw the image to an offscreen HTML Canvas to resize it (e.g., max 224x224) and normalize it to save memory.
5. Send the processed image data to `ml-worker.js` via `postMessage`.
**Verification:** The worker receives the image data without memory overflow errors.

### Step 3: Feature Extraction (The Embedding)
**Objective:** Convert the image into a mathematical vector.
1. In `ml-worker.js`, receive the image data.
2. Pass the image through the initialized feature-extraction pipeline.
3. Configure the output to pool the results (e.g., `{ pooling: 'mean', normalize: true }`) to get a flat 1D array of floats.
4. Send the resulting Float32Array (the embedding vector) back to the main thread.
**Verification:** Console log the output in the main thread. It should be a 1D array of numbers.

### Step 5: Cosine Similarity Logic
**Objective:** Compare a new image against the database.
1. Write a pure mathematical function `calculateCosineSimilarity(vectorA, vectorB)` in the main thread (or a separate math utility file).
   - *Formula: Dot product of A and B divided by the product of their magnitudes.*
2. Write a `findMatch(newEmbedding)` function:
   - Fetch all items from IndexedDB.
   - Iterate through items and calculate the similarity score between `newEmbedding` and each `item.embedding`.
   - Track the highest score and the corresponding item.
**Verification:** Pass two identical vectors to ensure the score is `1.0`. Pass completely different mock vectors to ensure a lower score.

### Step 6: Match vs. Unknown UX Flow
**Objective:** Tie the logic to the user interface.
1. Define a similarity threshold constant, e.g., `const MATCH_THRESHOLD = 0.85;`.
2. When the user takes a photo:
   - Extract the feature vector (Step 3).
   - Run `findMatch` (Step 5).
3. **If `highestScore >= MATCH_THRESHOLD`**:
   - Render a success UI displaying the matched item's name and details.
4. **If `highestScore < MATCH_THRESHOLD` (or DB is empty)**:
   - Render an "Unknown Item" UI.
   - Prompt the user: "We couldn't find this. Add to inventory?"
   - If yes, proceed to the Add Item flow (Step 4) using the vector that was just generated (do not re-run the ML model).
**Verification:** End-to-end test. Snap a photo of a new shirt -> Add it. Snap a photo of the same shirt -> It identifies it. Snap a photo of pants -> It asks to add them.
