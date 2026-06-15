# Implementation Guide: On-Device ML Clothing Inventory Matching

This guide provides a detailed, codebase-specific plan for AI agents to implement the offline clothing matching feature in the **Capsule** Progressive Web App (PWA).

---

## 🛠 Tech Stack & Dependencies

1. **ML Library:** `@xenova/transformers` (v2.x) - runs MobileNetV2 locally inside a Web Worker.
2. **Database:** `Dexie` (IndexedDB) for storing and querying garment metadata and visual embeddings.
3. **Routing:** `react-router-dom` (v6.x) for screen navigation and passing pre-loaded state.

To install the required package:
```bash
npm install @xenova/transformers
```

---

## 📂 File Architecture

The implementation will introduce or modify the following files:

```
src/
├── types/
│   └── index.ts                 # [MODIFY] Add embedding to Garment type
├── db/
│   └── index.ts                 # [MODIFY] Dexie schema versioning
├── ml-worker.ts                 # [NEW] Web Worker for ONNX model inference
├── utils/
│   ├── math.ts                  # [NEW] Cosine similarity calculations
│   └── image.ts                 # [MODIFY] Canvas operations for sizing
├── pages/
│   ├── IdentifyItem.tsx         # [NEW] Scanner UI, camera input, and matching layout
│   ├── IdentifyItem.module.css  # [NEW] Styles for identification page
│   ├── AddGarment.tsx           # [MODIFY] Accept preloaded photo and embedding from route state
│   └── Inventory.tsx            # [MODIFY] Add "Identify / Scan" button
```

---

## ⚙️ Detailed Implementation Steps

### Step 1: Database & Types Update

We must extend the `Garment` interface to store the mathematical embedding.

#### 1. Modify `src/types/index.ts`
Add the optional `embedding` field:
```typescript
export interface Garment {
  id: string;
  ownerId: string;
  name: string;
  category: GarmentCategory;
  // ... existing fields ...
  photos: GarmentPhoto[];
  embedding?: number[]; // [ADDED] 1D feature extraction vector of size 1280 (MobileNetV2 output)
  status: GarmentStatus;
  // ... rest of fields
}
```

#### 2. Modify `src/db/index.ts`
We do not need to add `embedding` to the store indexes since we fetch all items to calculate similarity in-memory (highly performant for typical wardrobe sizes of $<1000$ items). However, we will bump the schema version to version 3 to track database structure cleanly.
```diff
     this.version(2).stores({
       wearLogs: 'id, ownerId, date, outfitId, *tags, [ownerId+date]',
     });
+
+    // Version 3: Added support for Garment embeddings (stored as number[] properties)
+    this.version(3).stores({});
```

---

### Step 2: Web Worker Setup (`src/ml-worker.ts`)

To avoid freezing the UI thread during ONNX model execution, we initialize and run `@xenova/transformers` inside a Web Worker.

#### Create `src/ml-worker.ts`
```typescript
import { pipeline, env, RawImage } from '@xenova/transformers';

// Configure transformers env to use CDN instead of local models,
// enabling automatic caching via the Cache API (named 'transformers-cache').
env.allowLocalModels = false;

let extractor: any = null;

// Singleton helper to load the model once
async function getExtractor(onProgress: (progress: number) => void) {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/mobilenet_v2_1.0_224', {
      progress_callback: (data: any) => {
        if (data.status === 'progress') {
          onProgress(data.progress);
        }
      }
    });
  }
  return extractor;
}

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === 'INIT') {
    try {
      await getExtractor((progress) => {
        self.postMessage({ type: 'LOADING_PROGRESS', payload: progress });
      });
      self.postMessage({ type: 'READY' });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', payload: `Failed to load model: ${err.message}` });
    }
  }

  if (type === 'EXTRACT_EMBEDDING') {
    try {
      const { width, height, data } = payload; // data is Uint8ClampedArray from ImageData
      
      // Load raw image tensor (RGBA, 4 channels)
      const rawImage = new RawImage(new Uint8Array(data), width, height, 4);
      
      const extractorInstance = await getExtractor(() => {});
      
      // Execute inference with mean pooling and normalization to obtain 1D vector
      const output = await extractorInstance(rawImage, {
        pooling: 'mean',
        normalize: true,
      });

      // output.data is a Float32Array
      const embedding = Array.from(output.data);
      
      self.postMessage({ type: 'EMBEDDING_SUCCESS', payload: embedding });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', payload: `Extraction failed: ${err.message}` });
    }
  }
};
```

---

### Step 3: Cosine Similarity Utility (`src/utils/math.ts`)

#### Create `src/utils/math.ts`
Write a pure, optimized utility to compare two vectors.
```typescript
/**
 * Computes the cosine similarity between two numeric vectors.
 * Returns a value between -1.0 and 1.0 (where 1.0 is identical).
 */
export function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

---

### Step 4: Camera & Sizing Adjustments (`src/utils/image.ts`)

We need a canvas resizing function to downscale incoming images to $224 \times 224$ pixels (the exact input dimensions expected by MobileNetV2) and extract `ImageData` for Web Worker transfer.

#### Modify `src/utils/image.ts`
Add the following helper:
```typescript
/**
 * Downscales a file or blob to 224x224 and returns its raw RGBA ImageData.
 */
export function getModelInputData(fileOrBlob: File | Blob): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(fileOrBlob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 224;
      canvas.height = 224;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      // Draw and stretch/crop to fill 224x224 square (MobileNet standard input)
      ctx.drawImage(img, 0, 0, 224, 224);
      URL.revokeObjectURL(objectUrl);

      try {
        const imageData = ctx.getImageData(0, 0, 224, 224);
        resolve(imageData);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image failed to load for model preprocessing'));
    };

    img.src = objectUrl;
  });
}
```

---

### Step 5: Scanning & Identification Page (`src/pages/IdentifyItem.tsx`)

This page handles model loading, image capture, embedding extraction, database query, cosine matching, and UI flows.

#### Create `src/pages/IdentifyItem.tsx`
Provide a visually premium experience aligning with Capsule's dark styling:
```typescript
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useProfiles } from '@/contexts/ProfileContext';
import { calculateCosineSimilarity } from '@/utils/math';
import { getModelInputData, compressOriginal, generateThumbnail } from '@/utils/image';
import type { Garment } from '@/types';
import styles from './IdentifyItem.module.css';

const MATCH_THRESHOLD = 0.85;

interface MatchResult {
  garment: Garment;
  score: number;
}

export function IdentifyItem() {
  const navigate = useNavigate();
  const { activeProfile } = useProfiles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [worker, setWorker] = useState<Worker | null>(null);
  const [modelState, setModelState] = useState<'uninitialized' | 'loading' | 'ready' | 'error'>('uninitialized');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [processingState, setProcessingState] = useState<'idle' | 'resizing' | 'embedding' | 'matching'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [selectedPhoto, setSelectedPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  // Fetch all user garments to match against
  const userGarments = useLiveQuery(
    () => (activeProfile ? db.garments.where('ownerId').equals(activeProfile.id).toArray() : []),
    [activeProfile?.id]
  );

  // Initialize Worker
  useEffect(() => {
    const mlWorker = new Worker(new URL('../ml-worker.ts', import.meta.url), { type: 'module' });
    setWorker(mlWorker);

    mlWorker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'READY') {
        setModelState('ready');
      } else if (type === 'LOADING_PROGRESS') {
        setModelState('loading');
        setLoadingProgress(payload);
      } else if (type === 'EMBEDDING_SUCCESS') {
        runMatching(payload);
      } else if (type === 'ERROR') {
        setProcessingState('idle');
        setErrorMsg(payload);
      }
    };

    // Trigger initialization
    setModelState('loading');
    mlWorker.postMessage({ type: 'INIT' });

    return () => {
      mlWorker.terminate();
    };
  }, []);

  // Handle image selection
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setMatchResult(null);
    setSelectedPhoto(file);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    if (modelState !== 'ready') {
      setErrorMsg('Model is still downloading. Please wait.');
      return;
    }

    try {
      setProcessingState('resizing');
      // 1. Process image to 224x224 raw bytes
      const imageData = await getModelInputData(file);
      
      // 2. Transfer to Worker for inference
      setProcessingState('embedding');
      worker?.postMessage({
        type: 'EXTRACT_EMBEDDING',
        payload: {
          width: imageData.width,
          height: imageData.height,
          data: imageData.data.buffer
        }
      }, [imageData.data.buffer]);
      
    } catch (err: any) {
      setProcessingState('idle');
      setErrorMsg(`Pre-processing failed: ${err.message}`);
    }
  }

  // Calculate similarity against all database garments
  async function runMatching(newEmbedding: number[]) {
    if (!userGarments || userGarments.length === 0) {
      setProcessingState('idle');
      setMatchResult(null);
      return;
    }

    setProcessingState('matching');
    let bestMatch: Garment | null = null;
    let highestScore = -1;

    for (const garment of userGarments) {
      if (garment.embedding && garment.embedding.length > 0) {
        try {
          const score = calculateCosineSimilarity(newEmbedding, garment.embedding);
          if (score > highestScore) {
            highestScore = score;
            bestMatch = garment;
          }
        } catch (e) {
          console.error(`Error matching ${garment.name}:`, e);
        }
      }
    }

    setProcessingState('idle');
    if (bestMatch && highestScore >= MATCH_THRESHOLD) {
      setMatchResult({ garment: bestMatch, score: highestScore });
    } else {
      setMatchResult(null); // Unknown item
    }
  }

  // Pre-loaded add-to-inventory path
  async function handleAddToInventory() {
    if (!selectedPhoto || !worker) return;

    try {
      // Compress for saving
      const [compressed, thumbnail] = await Promise.all([
        compressOriginal(selectedPhoto as File),
        generateThumbnail(selectedPhoto)
      ]);

      // Re-extract the embedding for saving (converting to Array from worker output flow)
      setProcessingState('embedding');
      
      // To get the embedding for the new garment database record,
      // we navigate to AddGarment and pass the generated details in state
      const imgData = await getModelInputData(selectedPhoto);
      
      const onEmbeddingRetrieved = (e: MessageEvent) => {
        const { type, payload } = e.data;
        if (type === 'EMBEDDING_SUCCESS') {
          worker.removeEventListener('message', onEmbeddingRetrieved);
          navigate('/add', {
            state: {
              preloadedPhoto: { compressed, thumbnail },
              embedding: payload
            }
          });
        }
      };

      worker.addEventListener('message', onEmbeddingRetrieved);
      worker.postMessage({
        type: 'EXTRACT_EMBEDDING',
        payload: {
          width: imgData.width,
          height: imgData.height,
          data: imgData.data.buffer
        }
      }, [imgData.data.buffer]);

    } catch (e: any) {
      setErrorMsg(`Pre-population failed: ${e.message}`);
    }
  }

  // Clean up Object URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="page">
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} type="button">← Back</button>
        <h1>Identify Item</h1>
      </header>

      <div className={styles.container}>
        {/* ML Status Card */}
        {modelState !== 'ready' && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h3>🧠 Preparing Local AI Model</h3>
            <p style={{ color: 'var(--c-text-muted)', fontSize: 13, marginTop: 4 }}>
              Setting up secure, offline feature extraction. First load downloads ~13MB.
            </p>
            {modelState === 'loading' && (
              <div className={styles.progressContainer}>
                <div className={styles.progressBar} style={{ width: `${modelState === 'ready' ? 100 : Math.round(loadingProgress * 100)}%` }} />
              </div>
            )}
            {modelState === 'error' && <p className={styles.errorText}>{errorMsg}</p>}
          </div>
        )}

        {/* Input trigger */}
        <input
          ref={fileInputRef}
          id="cameraInput"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <div className={styles.scanSlot}>
          {previewUrl ? (
            <img src={previewUrl} alt="Captured garment" className={styles.previewImg} />
          ) : (
            <button
              type="button"
              className={styles.cameraTrigger}
              onClick={() => fileInputRef.current?.click()}
              disabled={modelState !== 'ready'}
            >
              <span className={styles.cameraIcon}>📸</span>
              <span>Take photo to identify</span>
            </button>
          )}
        </div>

        {processingState !== 'idle' && (
          <div className={styles.processingOverlay}>
            <span className="spinner" />
            <p>{processingState === 'resizing' ? 'Analyzing pixels...' : processingState === 'embedding' ? 'Extracting visual features...' : 'Searching wardrobe...'}</p>
          </div>
        )}

        {/* Results Block */}
        {selectedPhoto && processingState === 'idle' && (
          <div className={styles.resultsArea}>
            {matchResult ? (
              <div className="card" style={{ border: '1px solid var(--c-success)' }}>
                <span className={styles.matchBadge}>✓ Match Found ({Math.round(matchResult.score * 100)}%)</span>
                <h3 style={{ marginTop: 8 }}>{matchResult.garment.name}</h3>
                <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>Brand: {matchResult.garment.brand || 'Unbranded'}</p>
                <div className={styles.actionRow} style={{ marginTop: 16 }}>
                  <button type="button" className="btn btn-primary" onClick={() => navigate(`/item/${matchResult.garment.id}`)}>
                    View Item details
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
                    Scan another
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ border: '1px solid var(--c-warning)' }}>
                <h3>🔍 Unrecognized Item</h3>
                <p style={{ color: 'var(--c-text-muted)', fontSize: 13, marginTop: 4 }}>
                  No garments matching this picture were found. Would you like to add it to your inventory?
                </p>
                <div className={styles.actionRow} style={{ marginTop: 16 }}>
                  <button type="button" className="btn btn-primary" onClick={handleAddToInventory}>
                    Add to Inventory
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
                    Try again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Step 6: Layout Styles (`src/pages/IdentifyItem.module.css`)

Create a styling system complementing the high-quality typography and colors.

#### Create `src/pages/IdentifyItem.module.css`
```css
.header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.backBtn {
  font-size: 14px;
  color: var(--c-text-muted);
}

.container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.progressContainer {
  width: 100%;
  height: 6px;
  background: var(--c-border);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 12px;
}

.progressBar {
  height: 100%;
  background: var(--c-accent);
  transition: width 0.3s ease;
}

.scanSlot {
  width: 100%;
  aspect-ratio: 1;
  background: var(--c-surface);
  border: 2px dashed var(--c-border);
  border-radius: var(--r-lg);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.cameraTrigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--c-text-muted);
}

.cameraIcon {
  font-size: 40px;
}

.previewImg {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.processingOverlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--c-text-muted);
}

.matchBadge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--c-success);
}

.actionRow {
  display: flex;
  gap: 12px;
}

.errorText {
  color: var(--c-danger);
  font-size: 12px;
  margin-top: 8px;
}
```

---

### Step 7: Hooking up Preloaded Photos in Add Garment (`src/pages/AddGarment.tsx`)

#### Modify `src/pages/AddGarment.tsx`
We must fetch any preloaded images and vectors sent via React Router's location state, and pass them to the `GarmentForm` initialization.
```typescript
import { useLocation, useNavigate } from 'react-router-dom';
// ... other imports ...

export function AddGarment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeProfile } = useProfiles();

  // Extract pre-loaded information from the scanning state if present
  const state = location.state as {
    preloadedPhoto?: { compressed: Blob; thumbnail: Blob };
    embedding?: number[];
  } | null;

  async function handleSave(values: GarmentFormValues) {
    if (!activeProfile) return;
    const now = new Date().toISOString();
    const garment: Garment = {
      id: generateId(),
      ownerId: activeProfile.id,
      name: values.name,
      category: values.category as Garment['category'],
      colors: values.colors,
      material: [],
      photos: values.photos,
      embedding: state?.embedding || undefined, // [ADDED] Attach generated vector
      brand:       values.brand      || undefined,
      size:        values.size       || undefined,
      formality: 3,
      warmth: 3,
      seasons: [],
      contexts: { work: 3, play: 3, town: 3 },
      store:       values.store      || undefined,
      purchaseUrl: values.purchaseUrl || undefined,
      price:       values.price ? parseFloat(values.price) : undefined,
      tags: values.tags,
      notes:       values.notes      || undefined,
      status: 'active',
      wearCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.garments.add(garment);
    navigate('/inventory', { replace: true });
  }

  // Build initial values if we have a pre-loaded photo
  const initialFormValues = state?.preloadedPhoto ? {
    ...emptyFormValues(),
    photos: [
      {
        id: generateId(),
        tag: 'front' as const,
        compressed: state.preloadedPhoto.compressed,
        thumbnail: state.preloadedPhoto.thumbnail,
        capturedAt: new Date().toISOString()
      }
    ]
  } : undefined;

  return (
    <div className="page">
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} type="button">← Back</button>
        <h1>Add garment</h1>
      </header>
      <GarmentForm 
        initial={initialFormValues}
        onSave={handleSave} 
        onCancel={() => navigate(-1)} 
      />
    </div>
  );
}
```

---

### Step 8: Adding Router Paths & Scanning triggers

#### 1. Modify `src/App.tsx`
Add route mapping:
```typescript
import { IdentifyItem } from '@/pages/IdentifyItem';

// ... in AppRoutes Routes block ...
<Route path="/inventory"       element={<Inventory />} />
<Route path="/identify"        element={<IdentifyItem />} />
<Route path="/add"             element={<AddGarment />} />
```

#### 2. Modify `src/pages/Inventory.tsx`
Add the trigger to scan next to the manual Add button:
```typescript
          <div className={styles.toolbar}>
            <p className={styles.count}>
              {activeFilterCount > 0 && showing !== total
                ? `${showing} of ${total}`
                : `${total} ${total === 1 ? 'item' : 'items'}`}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost"
                style={{ padding: '8px 14px', fontSize: 13, minHeight: 'auto' }}
                onClick={() => navigate('/identify')}>
                📸 Scan Match
              </button>
              <button type="button" className="btn btn-primary"
                style={{ padding: '8px 18px', fontSize: 13, minHeight: 'auto' }}
                onClick={() => navigate('/add')}>
                + Add
              </button>
            </div>
          </div>
```
