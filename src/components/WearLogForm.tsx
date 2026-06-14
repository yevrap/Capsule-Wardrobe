import { useRef, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useProfiles } from '@/contexts/ProfileContext';
import { compressOriginal, generateThumbnail, blobToUrl } from '@/utils/image';
import { TagInput } from '@/components/TagInput';
import type { WearLog } from '@/types';
import styles from './WearLogForm.module.css';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

type PhotoDraft = { compressed: Blob; thumbnail: Blob; previewUrl: string };

export type WearLogSaveData = Pick<WearLog, 'date' | 'photo' | 'notes' | 'tags' | 'outfitId' | 'garmentIds'>;

interface WearLogFormProps {
  heading: string;
  initial?: {
    date?: string;
    photo?: WearLog['photo'];
    notes?: string;
    tags?: string[];
    outfitId?: string;
  };
  saveLabel?: string;
  onSave: (data: WearLogSaveData) => Promise<void>;
  onCancel: () => void;
}

export function WearLogForm({
  heading,
  initial,
  saveLabel = 'Save',
  onSave,
  onCancel,
}: WearLogFormProps) {
  const { activeProfile } = useProfiles();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [photo, setPhoto]               = useState<PhotoDraft | null>(null);
  const [existingPhoto, setExisting]    = useState(initial?.photo);
  const [existingUrl, setExistingUrl]   = useState<string | null>(null);
  const [notes, setNotes]               = useState(initial?.notes ?? '');
  const [tags, setTags]                 = useState<string[]>(initial?.tags ?? []);
  const [outfitId, setOutfitId]         = useState<string | undefined>(initial?.outfitId);
  const [processing, setProcessing]     = useState(false);
  const [saving, setSaving]             = useState(false);

  // Build preview URL for an existing (blob-stored) photo.
  useEffect(() => {
    const blob = existingPhoto?.thumbnail;
    if (!blob) { setExistingUrl(null); return; }
    const url = blobToUrl(blob);
    setExistingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [existingPhoto]);

  // Revoke draft preview URL on unmount / change.
  useEffect(() => () => { if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl); }, [photo]);

  const outfits = useLiveQuery(
    () => activeProfile
      ? db.outfits.where('ownerId').equals(activeProfile.id).reverse().sortBy('createdAt')
      : [],
    [activeProfile?.id],
  );

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProcessing(true);
    try {
      const [compressed, thumbnail] = await Promise.all([
        compressOriginal(file),
        generateThumbnail(file),
      ]);
      if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
      setPhoto({ compressed, thumbnail, previewUrl: blobToUrl(thumbnail) });
      setExisting(undefined);
    } finally {
      setProcessing(false);
    }
  }

  function removePhoto() {
    if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    setPhoto(null);
    setExisting(undefined);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        date,
        photo: photo
          ? { compressed: photo.compressed, thumbnail: photo.thumbnail }
          : existingPhoto,
        notes: notes.trim() || undefined,
        tags,
        outfitId,
        garmentIds: [],
      });
    } finally {
      setSaving(false);
    }
  }

  const displayUrl = photo?.previewUrl ?? existingUrl;
  const hasPhoto   = !!displayUrl;

  return (
    <div className={styles.wrapper}>
      <div className={styles.topBar}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          ← Back
        </button>
        <h1 className={styles.heading}>{heading}</h1>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>

        {/* ── Photo ────────────────────────────────────────────────────── */}
        <div className={styles.photoArea}>
          {hasPhoto ? (
            <>
              <img src={displayUrl!} alt="Outfit" className={styles.photoImg} />
              <button
                type="button"
                className={styles.photoRemoveBtn}
                onClick={removePhoto}
                aria-label="Remove photo"
              >
                ✕
              </button>
              <button
                type="button"
                className={styles.changePhotoBtn}
                onClick={() => photoInputRef.current?.click()}
              >
                Change photo
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.photoPlaceholder}
              onClick={() => photoInputRef.current?.click()}
              disabled={processing}
            >
              <span className={styles.photoIcon} aria-hidden="true">
                {processing ? '…' : '◎'}
              </span>
              <span className={styles.photoLabel}>
                {processing ? 'Processing…' : 'Add a photo'}
              </span>
              <span className={styles.photoHint}>camera or photo library</span>
            </button>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            aria-label="Choose outfit photo"
          />
        </div>

        {/* ── Date ─────────────────────────────────────────────────────── */}
        <div className="field">
          <label className="label" htmlFor="wl-date">Date</label>
          <input
            id="wl-date"
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* ── Notes ────────────────────────────────────────────────────── */}
        <div className="field">
          <label className="label" htmlFor="wl-notes">Notes</label>
          <textarea
            id="wl-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did this feel? Any occasion?"
            rows={3}
          />
        </div>

        {/* ── Tags ─────────────────────────────────────────────────────── */}
        <div className="field">
          <label className="label" htmlFor="wl-tags">Tags</label>
          <TagInput
            id="wl-tags"
            value={tags}
            onChange={setTags}
            placeholder="casual, work, evening…"
          />
        </div>

        {/* ── Outfit link ───────────────────────────────────────────────── */}
        {outfits && outfits.length > 0 && (
          <div className="field">
            <label className="label">Link a saved outfit</label>
            <p className={styles.fieldHint}>Optional — track which look you wore</p>
            <div className={styles.outfitPicker}>
              {outfits.map((o) => {
                const selected = outfitId === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={[
                      styles.outfitOption,
                      selected ? styles.outfitOptionSelected : '',
                    ].join(' ')}
                    onClick={() => setOutfitId(selected ? undefined : o.id)}
                  >
                    <span className={styles.outfitName}>{o.name}</span>
                    {selected && (
                      <span className={styles.outfitCheck} aria-hidden="true">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className={styles.actions}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || processing}
            style={{ flex: 1 }}
          >
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
