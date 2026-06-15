import {
  pipeline,
  env,
  RawImage,
  type ImageFeatureExtractionPipeline,
  type Tensor,
} from '@xenova/transformers';

// Detect the app base URL from the worker's own URL.
// In production the worker is at /assets/ml-worker-xxx.js, so strip /assets/...
// In Vite dev mode it falls back to the origin root.
const workerUrl = self.location.href;
const appBase = workerUrl.includes('/assets/')
  ? workerUrl.substring(0, workerUrl.indexOf('/assets/')) + '/'
  : new URL('/', self.location.href).href;

// Load the model from the bundled /models/ directory instead of Hugging Face CDN.
// Keeps the app fully offline-capable and avoids HF auth requirements.
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = `${appBase}models/`;
env.backends.onnx.wasm.wasmPaths = appBase;

// Force single-threaded WASM. GitHub Pages doesn't send the COOP/COEP headers
// that iOS Safari requires to enable SharedArrayBuffer (needed for multi-threading).
// Without this, the runtime tries the threaded path, fails to get SharedArrayBuffer,
// and throws "Can't create a session" instead of falling back gracefully.
env.backends.onnx.wasm.numThreads = 1;

const MODEL_ID = 'onnx-community/mobilenet_v2_1.0_224';

let extractor: ImageFeatureExtractionPipeline | null = null;

async function getExtractor(
  onProgress: (progress: number) => void,
): Promise<ImageFeatureExtractionPipeline> {
  if (!extractor) {
    extractor = await pipeline('image-feature-extraction', MODEL_ID, {
      progress_callback: (data: { status: string; progress?: number }) => {
        if (data.status === 'progress' && data.progress != null) {
          onProgress(data.progress);
        }
      },
    });
  }
  return extractor;
}

self.onmessage = async (event: MessageEvent<{ type: string; payload?: unknown }>) => {
  const { type, payload } = event.data;

  if (type === 'INIT') {
    try {
      await getExtractor((progress) => {
        self.postMessage({ type: 'LOADING_PROGRESS', payload: progress });
      });
      self.postMessage({ type: 'READY' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'ERROR', payload: `Failed to load model: ${msg}` });
    }
  }

  if (type === 'EXTRACT_EMBEDDING') {
    try {
      const { width, height, data } = payload as {
        width: number;
        height: number;
        data: ArrayBuffer;
      };

      // RawImage expects a Uint8Array; ImageData.buffer contains the raw RGBA bytes.
      const rawImage = new RawImage(new Uint8Array(data), width, height, 4);
      const pipe = await getExtractor(() => {});

      // MobileNetV2 with image-feature-extraction returns a Tensor.
      // We cast data to Float32Array — the actual element type for float models.
      const output = (await pipe(rawImage)) as Tensor;
      const embedding = Array.from(output.data as Float32Array);

      self.postMessage({ type: 'EMBEDDING_SUCCESS', payload: embedding });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'ERROR', payload: `Extraction failed: ${msg}` });
    }
  }
};
