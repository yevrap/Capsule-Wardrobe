import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useProfiles } from '@/contexts/ProfileContext';
import { blobToUrl } from '@/utils/image';
import { TagInput } from '@/components/TagInput';
import type { Garment } from '@/types';
import styles from './OutfitForm.module.css';

export interface OutfitFormValues {
  name: string;
  garmentIds: string[];
  occasionTags: string[];
}

export function emptyOutfitFormValues(): OutfitFormValues {
  return { name: '', garmentIds: [], occasionTags: [] };
}

// ─── Garment picker item ──────────────────────────────────────────────────────

function PickerItem({
  garment,
  selected,
  onToggle,
}: {
  garment: Garment;
  selected: boolean;
  onToggle: () => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    const blob = garment.photos[0]?.thumbnail;
    if (!blob) { setThumbUrl(null); return; }
    const url = blobToUrl(blob);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [garment.photos]);

  return (
    <button
      type="button"
      className={[styles.pickerItem, selected ? styles.pickerItemSelected : ''].join(' ')}
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={`${selected ? 'Remove' : 'Add'} ${garment.name}`}
    >
      <div className={styles.pickerThumb}>
        {thumbUrl
          ? <img src={thumbUrl} alt="" className={styles.pickerThumbImg} />
          : <span className={styles.pickerPlaceholder} aria-hidden="true">◈</span>
        }
        {selected && <div className={styles.pickerCheck} aria-hidden="true">✓</div>}
      </div>
      <p className={styles.pickerName}>{garment.name}</p>
    </button>
  );
}

// ─── Outfit form ──────────────────────────────────────────────────────────────

interface Props {
  initial?: OutfitFormValues;
  onSave: (values: OutfitFormValues) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}

export function OutfitForm({ initial, onSave, onCancel, saveLabel = 'Save outfit' }: Props) {
  const { activeProfile } = useProfiles();
  const [values, setValues] = useState<OutfitFormValues>(initial ?? emptyOutfitFormValues());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const garments = useLiveQuery(
    async () => {
      if (!activeProfile) return [];
      const all = await db.garments.where('ownerId').equals(activeProfile.id).toArray();
      return all.sort((a, b) => a.name.localeCompare(b.name));
    },
    [activeProfile?.id],
  );

  function toggleGarment(id: string) {
    setValues((v) => ({
      ...v,
      garmentIds: v.garmentIds.includes(id)
        ? v.garmentIds.filter((gid) => gid !== id)
        : [...v.garmentIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) { setError('Give this outfit a name.'); return; }
    if (values.garmentIds.length === 0) { setError('Pick at least one garment.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave(values);
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = values.garmentIds.length;

  return (
    <form className="page" onSubmit={handleSubmit} noValidate>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className={styles.topBar}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <h2 className={styles.title}>{initial ? 'Edit outfit' : 'New outfit'}</h2>
        <button type="submit" className={styles.saveBtn} disabled={saving}>
          {saving ? '…' : saveLabel}
        </button>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      {/* ── Name ─────────────────────────────────────────────────────────── */}
      <div className="field" style={{ marginBottom: 24 }}>
        <label className="field-label" htmlFor="outfit-name">Name</label>
        <input
          id="outfit-name"
          type="text"
          placeholder="e.g. Friday casual"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        />
      </div>

      {/* ── Occasion tags ────────────────────────────────────────────────── */}
      <div className="field" style={{ marginBottom: 32 }}>
        <label className="field-label">Occasion tags</label>
        <TagInput
          value={values.occasionTags}
          onChange={(tags) => setValues((v) => ({ ...v, occasionTags: tags }))}
          placeholder="work, weekend, formal…"
        />
      </div>

      {/* ── Garment picker ───────────────────────────────────────────────── */}
      <div>
        <p className="field-label" style={{ marginBottom: 12 }}>
          Garments
          {selectedCount > 0 && (
            <span className={styles.selectedBadge}> · {selectedCount} selected</span>
          )}
        </p>

        {!garments || garments.length === 0 ? (
          <p className={styles.emptyPicker}>No garments yet — add some from the Wardrobe tab first.</p>
        ) : (
          <div className={styles.pickerGrid}>
            {garments.map((g) => (
              <PickerItem
                key={g.id}
                garment={g}
                selected={values.garmentIds.includes(g.id)}
                onToggle={() => toggleGarment(g.id)}
              />
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
