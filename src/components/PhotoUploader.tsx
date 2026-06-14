import { useRef, useState, useLayoutEffect } from 'react';
import type { GarmentPhoto, PhotoTag } from '@/types';
import { generateId } from '@/utils/id';
import { compressOriginal, generateThumbnail } from '@/utils/image';
import styles from './PhotoUploader.module.css';

const PHOTO_TAGS: PhotoTag[] = ['front', 'back', 'tag', 'detail'];

// Default tag for the Nth photo added (cycles through front/back/tag/detail,
// then falls back to 'detail' for any extras).
function defaultTag(index: number): PhotoTag {
  return PHOTO_TAGS[Math.min(index, PHOTO_TAGS.length - 1)];
}

interface Slot {
  id: string;
  tag: PhotoTag;
  previewUrl: string; // object URL for instant display before compression
  processing: boolean;
  photo?: GarmentPhoto; // set once compression is complete
  error?: string;
}

interface PhotoUploaderProps {
  // Called with the full list of completed GarmentPhotos after each change.
  // Will not include photos still processing.
  onChange: (photos: GarmentPhoto[]) => void;
  // Whether any photos are still compressing — parent uses this to gate save.
  onProcessingChange?: (processing: boolean) => void;
}

export function PhotoUploader({ onChange, onProcessingChange }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [slots, setSlots] = useState<Slot[]>([]);

  // Keep a stable ref to callbacks so effects don't need them in deps.
  const onChangeRef = useRef(onChange);
  const onProcessingRef = useRef(onProcessingChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    onProcessingRef.current = onProcessingChange;
  });

  function notifyParent(nextSlots: Slot[]) {
    const completed = nextSlots
      .filter((s) => !s.processing && s.photo)
      .map((s) => s.photo!);
    onChangeRef.current(completed);

    const anyProcessing = nextSlots.some((s) => s.processing);
    onProcessingRef.current?.(anyProcessing);
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;

    const startIndex = slots.length;

    // Create slots immediately for instant visual feedback.
    const newSlots: Slot[] = files.map((file, i) => ({
      id: generateId(),
      tag: defaultTag(startIndex + i),
      previewUrl: URL.createObjectURL(file),
      processing: true,
    }));

    setSlots((prev) => {
      const next = [...prev, ...newSlots];
      notifyParent(next);
      return next;
    });

    // Compress each photo. We fire them all and update slots as each finishes.
    await Promise.all(
      files.map(async (file, i) => {
        const slotId = newSlots[i].id;
        try {
          const [compressed, thumbnail] = await Promise.all([
            compressOriginal(file),
            generateThumbnail(file),
          ]);
          const photo: GarmentPhoto = {
            id: slotId,
            tag: newSlots[i].tag,
            compressed,
            thumbnail,
            capturedAt: new Date().toISOString(),
          };
          setSlots((prev) => {
            const next = prev.map((s) =>
              s.id === slotId ? { ...s, processing: false, photo } : s,
            );
            notifyParent(next);
            return next;
          });
        } catch {
          setSlots((prev) => {
            const next = prev.map((s) =>
              s.id === slotId
                ? { ...s, processing: false, error: 'Failed to process' }
                : s,
            );
            notifyParent(next);
            return next;
          });
        }
      }),
    );
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Reset so the same file can be selected again later.
    e.target.value = '';
    void handleFiles(files);
  }

  function setTag(slotId: string, tag: PhotoTag) {
    setSlots((prev) => {
      const next = prev.map((s) => {
        if (s.id !== slotId) return s;
        const updatedPhoto = s.photo ? { ...s.photo, tag } : undefined;
        return { ...s, tag, photo: updatedPhoto };
      });
      notifyParent(next);
      return next;
    });
  }

  function remove(slotId: string) {
    setSlots((prev) => {
      const slot = prev.find((s) => s.id === slotId);
      if (slot) URL.revokeObjectURL(slot.previewUrl);
      const next = prev.filter((s) => s.id !== slotId);
      notifyParent(next);
      return next;
    });
  }

  const hasSlots = slots.length > 0;

  return (
    <div className={styles.uploader}>
      {/* Hidden file input — `multiple` lets users pick several at once.
          No `capture` attribute so iOS shows "Photo Library" option.       */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
        className={styles.hiddenInput}
        aria-label="Select photos from library"
      />

      {hasSlots && (
        <div className={styles.grid}>
          {slots.map((slot) => (
            <div key={slot.id} className={styles.slot}>
              <img
                src={slot.previewUrl}
                alt={`${slot.tag} photo`}
                className={styles.slotImg}
              />

              {/* Spinner while compressing */}
              {slot.processing && (
                <div className={styles.overlay} aria-hidden="true">
                  <span className={styles.spinner} />
                </div>
              )}

              {/* Error state */}
              {slot.error && (
                <div className={styles.overlayError} role="alert">
                  <span>⚠</span>
                </div>
              )}

              <button
                className={styles.removeBtn}
                onClick={() => remove(slot.id)}
                aria-label="Remove photo"
                type="button"
              >
                ✕
              </button>

              {/* Tag chips below each photo */}
              <div className={styles.tagRow}>
                {PHOTO_TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={[
                      styles.tagChip,
                      slot.tag === t ? styles.tagChipActive : '',
                    ].join(' ')}
                    onClick={() => setTag(slot.id, t)}
                    aria-pressed={slot.tag === t}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className={[styles.addBtn, hasSlots ? styles.addBtnCompact : ''].join(' ')}
        onClick={() => inputRef.current?.click()}
      >
        <span className={styles.addIcon} aria-hidden="true">+</span>
        {hasSlots ? 'Add more photos' : 'Add photos from library'}
      </button>
    </div>
  );
}
