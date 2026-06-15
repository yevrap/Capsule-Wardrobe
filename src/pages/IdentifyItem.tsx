import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const location = useLocation();
  const { activeProfile } = useProfiles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [worker, setWorker] = useState<Worker | null>(null);
  const [modelState, setModelState] = useState<'uninitialized' | 'loading' | 'ready' | 'error'>('uninitialized');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [processingState, setProcessingState] = useState<'idle' | 'resizing' | 'embedding' | 'matching'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedEmbedding, setExtractedEmbedding] = useState<number[] | null>(null);
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
        setExtractedEmbedding(payload);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-run if sourcePhoto is provided in router location state
  useEffect(() => {
    const state = location.state as {
      sourcePhoto?: Blob | File;
    } | null;

    if (modelState === 'ready' && state?.sourcePhoto && !selectedPhoto) {
      const file = state.sourcePhoto instanceof File 
        ? state.sourcePhoto 
        : new File([state.sourcePhoto], 'scanned-garment.jpg', { type: 'image/jpeg' });
      
      setSelectedPhoto(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      const runAutoExtraction = async () => {
        try {
          setProcessingState('resizing');
          const imageData = await getModelInputData(file);
          
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
      };

      void runAutoExtraction();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelState, location.state, worker]);

  // Handle image selection
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setMatchResult(null);
    setExtractedEmbedding(null);
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
    if (!selectedPhoto || !extractedEmbedding) return;

    try {
      setProcessingState('resizing');
      // Compress for saving
      const [compressed, thumbnail] = await Promise.all([
        compressOriginal(selectedPhoto),
        generateThumbnail(selectedPhoto)
      ]);

      navigate('/add', {
        state: {
          preloadedPhoto: { compressed, thumbnail },
          embedding: extractedEmbedding
        }
      });
    } catch (e: any) {
      setErrorMsg(`Pre-population failed: ${e.message}`);
    } finally {
      setProcessingState('idle');
    }
  }

  // Clean up Object URL and reset page state
  function handleReset() {
    setSelectedPhoto(null);
    setPreviewUrl(null);
    setMatchResult(null);
    setExtractedEmbedding(null);
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
                <div className={styles.progressBar} style={{ width: `${Math.round(loadingProgress * 100)}%` }} />
              </div>
            )}
            {modelState === 'error' && <p className={styles.errorText}>{errorMsg}</p>}
          </div>
        )}

        {/* Hidden triggers */}
        <input
          ref={cameraInputRef}
          id="cameraInput"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <input
          ref={fileInputRef}
          id="fileInput"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <div className={styles.scanSlot}>
          {previewUrl ? (
            <img src={previewUrl} alt="Captured garment" className={styles.previewImg} />
          ) : (
            <div className={styles.triggerGroup}>
              <button
                type="button"
                className={styles.cameraTrigger}
                onClick={() => cameraInputRef.current?.click()}
                disabled={modelState !== 'ready'}
              >
                <span className={styles.cameraIcon}>📸</span>
                <span>Take Photo</span>
              </button>
              <div className={styles.triggerDivider} />
              <button
                type="button"
                className={styles.cameraTrigger}
                onClick={() => fileInputRef.current?.click()}
                disabled={modelState !== 'ready'}
              >
                <span className={styles.cameraIcon}>📁</span>
                <span>Upload Image</span>
              </button>
            </div>
          )}
        </div>

        {processingState !== 'idle' && (
          <div className={styles.processingOverlay}>
            <span className={styles.spinner} />
            <p style={{ marginTop: 10 }}>
              {processingState === 'resizing'
                ? 'Analyzing pixels...'
                : processingState === 'embedding'
                ? 'Extracting visual features...'
                : 'Searching wardrobe...'}
            </p>
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
                  <button type="button" className="btn btn-ghost" onClick={handleReset}>
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
                  <button type="button" className="btn btn-ghost" onClick={handleReset}>
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
