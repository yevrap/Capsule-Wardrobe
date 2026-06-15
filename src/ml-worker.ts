import { pipeline, env, RawImage } from '@xenova/transformers';

// Configure transformers env to use CDN instead of local models,
// enabling automatic caching via the Cache API (named 'transformers-cache').
env.allowLocalModels = false;

// Detect the base path dynamically from the worker location to load WASM locally
const workerUrl = self.location.href;
let baseWasmPath = '/';
if (workerUrl.includes('/assets/')) {
  // Production build (inside /assets/ folder)
  baseWasmPath = workerUrl.substring(0, workerUrl.indexOf('/assets/')) + '/';
} else {
  // Development server
  baseWasmPath = '/';
}
env.backends.onnx.wasm.wasmPaths = baseWasmPath;

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
      const { width, height, data } = payload; // data is ArrayBuffer or Uint8ClampedArray from ImageData
      
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
