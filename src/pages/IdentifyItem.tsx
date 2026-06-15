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
  const [modelState, setModelState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [processingState, setProcessingState] = useState<'idle' | 'resizing' | 'embedding' | 'matching'>('idle');
  const [modelErrorMsg, setModelErrorMsg] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedEmbedding, setExtractedEmbedding] = useState<number[] | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  const userGarments = useLiveQuery(
    () => (activeProfile ? db.garments.where('ownerId').equals(activeProfile.id).toArray() : []),
    [activeProfile?.id],
  );

  // Ref so the worker message handler always reads the freshest garment list,
  // avoiding the stale closure that would occur if we captured userGarments at mount time.
  const userGarmentsRef = useRef(userGarments);
  useEffect(() => { userGarmentsRef.current = userGarments; }, [userGarments]);

  // Tracks whether the model has ever been ready — lets the ERROR handler
  // distinguish a model-load failure from a per-image extraction failure without
  // reading modelState (which would be stale inside the useEffect closure).
  const modelReadyRef = useRef(false);

  // Initialize worker once on mount
  useEffect(() => {
    const mlWorker = new Worker(new URL('../ml-worker.ts', import.meta.url), { type: 'module' });
    setWorker(mlWorker);

    mlWorker.onmessage = (e: MessageEvent<{ type: string; payload: unknown }>) => {
      const { type, payload } = e.data;

      if (type === 'READY') {
        modelReadyRef.current = true;
        setModelState('ready');
      } else if (type === 'LOADING_PROGRESS') {
        // @xenova/transformers reports progress as 0–100, not 0–1
        setLoadingProgress(payload as number);
      } else if (type === 'EMBEDDING_SUCCESS') {
        const embedding = payload as number[];
        setExtractedEmbedding(embedding);
        runMatchingFromRef(embedding);
      } else if (type === 'ERROR') {
        const msg = payload as string;
        setProcessingState('idle');
        if (modelReadyRef.current) {
          setExtractionError(msg);
        } else {
          setModelState('error');
          setModelErrorMsg(msg);
        }
      }
    };

    mlWorker.postMessage({ type: 'INIT' });
    return () => mlWorker.terminate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-run when navigated here with a pre-loaded photo from another page
  useEffect(() => {
    const state = location.state as { sourcePhoto?: Blob | File } | null;
    if (modelState === 'ready' && state?.sourcePhoto && !selectedPhoto) {
      const file =
        state.sourcePhoto instanceof File
          ? state.sourcePhoto
          : new File([state.sourcePhoto], 'scanned-garment.jpg', { type: 'image/jpeg' });
      triggerExtraction(file);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelState, location.state, worker]);

  function triggerExtraction(file: File) {
    setSelectedPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
    setExtractionError(null);
    setMatchResult(null);
    setExtractedEmbedding(null);

    const run = async () => {
      try {
        setProcessingState('resizing');
        const imageData = await getModelInputData(file);
        setProcessingState('embedding');
        worker?.postMessage(
          {
            type: 'EXTRACT_EMBEDDING',
            payload: { width: imageData.width, height: imageData.height, data: imageData.data.buffer },
          },
          [imageData.data.buffer],
        );
      } catch (err: unknown) {
        setProcessingState('idle');
        const msg = err instanceof Error ? err.message : String(err);
        setExtractionError(`Image processing failed: ${msg}`);
      }
    };
    void run();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // allow re-selecting the same file next time

    if (modelState !== 'ready') {
      setExtractionError('Model is still loading — please wait a moment.');
      return;
    }
    triggerExtraction(file);
  }

  function runMatchingFromRef(newEmbedding: number[]) {
    const garments = userGarmentsRef.current;
    if (!garments || garments.length === 0) {
      setProcessingState('idle');
      setMatchResult(null);
      return;
    }

    setProcessingState('matching');
    let bestMatch: Garment | null = null;
    let highestScore = -1;

    for (const garment of garments) {
      if (garment.embedding && garment.embedding.length > 0) {
        try {
          const score = calculateCosineSimilarity(newEmbedding, garment.embedding);
          if (score > highestScore) {
            highestScore = score;
            bestMatch = garment;
          }
        } catch {
          // dimension mismatch — skip this garment
        }
      }
    }

    setProcessingState('idle');
    setMatchResult(
      bestMatch && highestScore >= MATCH_THRESHOLD
        ? { garment: bestMatch, score: highestScore }
        : null,
    );
  }

  async function handleAddToInventory() {
    if (!selectedPhoto || !extractedEmbedding) return;

    try {
      setProcessingState('resizing');
      const [compressed, thumbnail] = await Promise.all([
        compressOriginal(selectedPhoto),
        generateThumbnail(selectedPhoto),
      ]);
      navigate('/add', {
        state: { preloadedPhoto: { compressed, thumbnail }, embedding: extractedEmbedding },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setExtractionError(`Could not prepare photo: ${msg}`);
      setProcessingState('idle');
    }
  }

  function handleReset() {
    // setPreviewUrl(null) triggers the cleanup effect which revokes the old URL
    setSelectedPhoto(null);
    setPreviewUrl(null);
    setMatchResult(null);
    setExtractedEmbedding(null);
    setExtractionError(null);
  }

  // Revoke object URL when previewUrl changes or component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isProcessing = processingState !== 'idle';
  const hasEmbeddedGarments = userGarments?.some(g => g.embedding);

  const processingLabel =
    processingState === 'resizing'  ? 'Analyzing image…' :
    processingState === 'embedding' ? 'Extracting visual features…' :
                                      'Searching wardrobe…';

  return (
    <div className="page">
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} type="button">
          ← Back
        </button>
        <h1>Identify Item</h1>
      </header>

      {/* Model status banner — full width, visible only while loading or on error */}
      {modelState !== 'ready' && (
        <div className={`card ${styles.statusCard}`}>
          {modelState === 'error' ? (
            <>
              <p className={styles.statusTitle}>Model failed to load</p>
              <p className={styles.errorText}>{modelErrorMsg}</p>
            </>
          ) : (
            <>
              <p className={styles.statusTitle}>Preparing on-device AI</p>
              <p className={styles.statusSub}>
                First load downloads ~13 MB and caches for offline use.
              </p>
              <div className={styles.progressContainer}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${Math.round(loadingProgress)}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Main layout: single column on mobile, two columns on wide screens */}
      <div className={styles.layout}>

        {/* ── Scan area (left on desktop, top on mobile) ── */}
        <div className={styles.scanArea}>
          {/* Camera input — opens native camera on mobile */}
          <input
            ref={cameraInputRef}
            id="cameraInput"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {/* File input — opens gallery/file picker */}
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
              <>
                <img src={previewUrl} alt="Captured garment" className={styles.previewImg} />
                {!isProcessing && (
                  <button type="button" className={styles.rescanBtn} onClick={handleReset}>
                    ↩ Rescan
                  </button>
                )}
              </>
            ) : (
              <div className={styles.triggerGroup}>
                <button
                  type="button"
                  className={styles.triggerBtn}
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={modelState !== 'ready'}
                >
                  <span className={styles.triggerIcon}>📸</span>
                  <span>Take Photo</span>
                </button>
                <div className={styles.triggerDivider} />
                <button
                  type="button"
                  className={styles.triggerBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={modelState !== 'ready'}
                >
                  <span className={styles.triggerIcon}>📁</span>
                  <span>Upload Image</span>
                </button>
              </div>
            )}
          </div>

          {isProcessing && (
            <div className={styles.processingBanner}>
              <span className={styles.spinner} />
              <span>{processingLabel}</span>
            </div>
          )}
        </div>

        {/* ── Results column (right on desktop, below on mobile) ── */}
        <div className={styles.resultsColumn}>
          {!selectedPhoto && !isProcessing && !extractionError && (
            <p className={styles.emptyHint}>
              Take or upload a photo to match it against your wardrobe.
            </p>
          )}

          {extractionError && (
            <div className="card" style={{ borderColor: 'var(--c-danger)' }}>
              <p className={styles.errorText}>{extractionError}</p>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 12 }}
                onClick={handleReset}
              >
                Try again
              </button>
            </div>
          )}

          {selectedPhoto && !isProcessing && !extractionError && (
            matchResult ? (
              <div className="card" style={{ borderColor: 'var(--c-success)' }}>
                <span className={styles.matchBadge}>
                  Match · {Math.round(matchResult.score * 100)}%
                </span>
                <h3 style={{ marginTop: 8 }}>{matchResult.garment.name}</h3>
                {matchResult.garment.brand && (
                  <p style={{ color: 'var(--c-text-muted)', fontSize: 13, marginTop: 4 }}>
                    {matchResult.garment.brand}
                  </p>
                )}
                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate(`/item/${matchResult.garment.id}`)}
                  >
                    View item
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={handleReset}>
                    Scan another
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ borderColor: 'var(--c-warning)' }}>
                <h3>Not in wardrobe</h3>
                <p style={{ color: 'var(--c-text-muted)', fontSize: 13, marginTop: 6 }}>
                  {hasEmbeddedGarments
                    ? 'No close match found. Add this item to your inventory?'
                    : 'No scan data exists yet. Add this item — future scans will match against it.'}
                </p>
                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => { void handleAddToInventory(); }}
                  >
                    Add to inventory
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={handleReset}>
                    Try again
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
