import { useRef, useState, useLayoutEffect, useEffect } from 'react';
import type { GarmentPhoto, PhotoTag } from '@/types';
import { generateId } from '@/utils/id';
import { compressOriginal, generateThumbnail, blobToUrl } from '@/utils/image';
import styles from './PhotoUploader.module.css';

const PHOTO_TAGS: PhotoTag[] = ['front', 'back', 'tag', 'detail'];

function defaultTag(index: number): PhotoTag {
  return PHOTO_TAGS[Math.min(index, PHOTO_TAGS.length - 1)];
}

interface Slot {
  id: string;
  tag: PhotoTag;
  previewUrl: string;
  processing: boolean;
  photo?: GarmentPhoto;
  error?: string;
}

interface PhotoUploaderProps {
  onChange: (photos: GarmentPhoto[]) => void;
  onProcessingChange?: (processing: boolean) => void;
  // Pre-load existing photos when editing a garment.
  initialPhotos?: GarmentPhoto[];
}

export function PhotoUploader({ onChange, onProcessingChange, initialPhotos }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Build initial slots from existing photos (edit mode).
  // blobToUrl creates an object URL we need to clean up on unmount.
  const [slots, setSlots] = useState<Slot[]>(() =>
    (initialPhotos ?? []).map((photo) => ({
      id: photo.id,
      tag: photo.tag,
      previewUrl: blobToUrl(photo.thumbnail),
      processing: false,
      photo,
    })),
  );

  // Revoke all object URLs when the component unmounts.
  // We track the set of URLs created so we only revoke what we own.
  const ownedUrls = useRef(new Set<string>());

  useEffect(() => {
    // Register initial URLs
    slots.forEach((s) => ownedUrls.current.add(s.previewUrl));
    return () => {
      ownedUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChangeRef = useRef(onChange);
  const onProcessingRef = useRef(onProcessingChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    onProcessingRef.current = onProcessingChange;
  });

  function notifyParent(nextSlots: Slot[]) {
    const completed = nextSlots.filter((s) => !s.processing && s.photo).map((s) => s.photo!);
    onChangeRef.current(completed);
    onProcessingRef.current?.(nextSlots.some((s) => s.processing));
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;

    const startIndex = slots.length;
    const newSlots: Slot[] = files.map((file, i) => {
      const url = blobToUrl(file);
      ownedUrls.current.add(url);
      return {
        id: generateId(),
        tag: defaultTag(startIndex + i),
        previewUrl: url,
        processing: true,
      };
    });

    setSlots((prev) => {
      const next = [...prev, ...newSlots];
      notifyParent(next);
      return next;
    });

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
            const next = prev.map((s) => s.id === slotId ? { ...s, processing: false, photo } : s);
            notifyParent(next);
            return next;
          });
        } catch {
          setSlots((prev) => {
            const next = prev.map((s) =>
              s.id === slotId ? { ...s, processing: false, error: 'Failed' } : s,
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
    e.target.value = '';
    void handleFiles(files);
  }

  function setTag(slotId: string, tag: PhotoTag) {
    setSlots((prev) => {
      const next = prev.map((s) => {
        if (s.id !== slotId) return s;
        return { ...s, tag, photo: s.photo ? { ...s.photo, tag } : undefined };
      });
      notifyParent(next);
      return next;
    });
  }

  function remove(slotId: string) {
    setSlots((prev) => {
      const slot = prev.find((s) => s.id === slotId);
      if (slot) {
        URL.revokeObjectURL(slot.previewUrl);
        ownedUrls.current.delete(slot.previewUrl);
      }
      const next = prev.filter((s) => s.id !== slotId);
      notifyParent(next);
      return next;
    });
  }

  const hasSlots = slots.length > 0;

  return (
    <div className={styles.uploader}>
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
              <img src={slot.previewUrl} alt={`${slot.tag} photo`} className={styles.slotImg} />

              {slot.processing && (
                <div className={styles.overlay} aria-hidden="true">
                  <span className={styles.spinner} />
                </div>
              )}

              {slot.error && (
                <div className={styles.overlayError} role="alert">⚠</div>
              )}

              <button
                className={styles.removeBtn}
                onClick={() => remove(slot.id)}
                aria-label="Remove photo"
                type="button"
              >✕</button>

              <div className={styles.tagRow}>
                {PHOTO_TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={[styles.tagChip, slot.tag === t ? styles.tagChipActive : ''].join(' ')}
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
