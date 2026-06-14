import { useState } from 'react';
import { PhotoUploader } from './PhotoUploader';
import { TagInput } from './TagInput';
import type { Garment, GarmentCategory, GarmentPhoto } from '@/types';
import styles from './GarmentForm.module.css';

export const CATEGORIES: { value: GarmentCategory; label: string }[] = [
  { value: 'top',        label: 'Top' },
  { value: 'bottom',     label: 'Bottom' },
  { value: 'dress',      label: 'Dress' },
  { value: 'outerwear',  label: 'Outerwear' },
  { value: 'footwear',   label: 'Footwear' },
  { value: 'accessory',  label: 'Accessory' },
  { value: 'underlayer', label: 'Underlayer' },
];

// The plain data the form hands back — no Dexie-specific fields.
export interface GarmentFormValues {
  photos: GarmentPhoto[];
  name: string;
  category: GarmentCategory | '';
  brand: string;
  size: string;
  colors: string[];
  tags: string[];
  notes: string;
  store: string;
  purchaseUrl: string;
  price: string;
}

export function emptyFormValues(): GarmentFormValues {
  return {
    photos: [], name: '', category: '', brand: '', size: '',
    colors: [], tags: [], notes: '', store: '', purchaseUrl: '', price: '',
  };
}

// Build initial values from an existing Garment (edit mode).
export function formValuesFromGarment(g: Garment): GarmentFormValues {
  return {
    photos:     g.photos,
    name:       g.name,
    category:   g.category,
    brand:      g.brand      ?? '',
    size:       g.size       ?? '',
    colors:     g.colors,
    tags:       g.tags,
    notes:      g.notes      ?? '',
    store:      g.store      ?? '',
    purchaseUrl: g.purchaseUrl ?? '',
    price:      g.price != null ? String(g.price) : '',
  };
}

interface GarmentFormProps {
  initial?: GarmentFormValues;
  onSave: (values: GarmentFormValues) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}

export function GarmentForm({ initial, onSave, onCancel, saveLabel = 'Save garment' }: GarmentFormProps) {
  const init = initial ?? emptyFormValues();

  const [photos, setPhotos]           = useState<GarmentPhoto[]>(init.photos);
  const [photosProcessing, setPhotosProcessing] = useState(false);
  const [name, setName]               = useState(init.name);
  const [category, setCategory]       = useState<GarmentCategory | ''>(init.category);
  const [brand, setBrand]             = useState(init.brand);
  const [size, setSize]               = useState(init.size);
  const [colors, setColors]           = useState<string[]>(init.colors);
  const [tags, setTags]               = useState<string[]>(init.tags);
  const [notes, setNotes]             = useState(init.notes);
  const [store, setStore]             = useState(init.store);
  const [purchaseUrl, setPurchaseUrl] = useState(init.purchaseUrl);
  const [price, setPrice]             = useState(init.price);
  const [saving, setSaving]           = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  function clearError(key: string) {
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate() {
    const errors: Partial<Record<string, string>> = {};
    if (!name.trim())  errors.name     = 'Name is required';
    if (!category)     errors.category = 'Please select a category';
    return errors;
  }

  async function handleSave() {
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setSaving(true);
    try {
      await onSave({ photos, name: name.trim(), category, brand: brand.trim(),
        size: size.trim(), colors, tags, notes: notes.trim(),
        store: store.trim(), purchaseUrl: purchaseUrl.trim(), price });
    } finally {
      setSaving(false);
    }
  }

  const canSave = !photosProcessing && !saving;

  return (
    <div className={styles.form}>

      {/* ── Photos ─────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Photos</h2>
        <PhotoUploader
          initialPhotos={init.photos.length > 0 ? init.photos : undefined}
          onChange={setPhotos}
          onProcessingChange={setPhotosProcessing}
        />
        {photosProcessing && <p className={styles.hint}>Compressing photos…</p>}
      </section>

      {/* ── Required ────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Details</h2>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="gf-name">
            Name <span className={styles.req}>*</span>
          </label>
          <input
            id="gf-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); clearError('name'); }}
            placeholder="e.g. White linen shirt"
            autoComplete="off"
          />
          {fieldErrors.name && <p className={styles.fieldError}>{fieldErrors.name}</p>}
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Category <span className={styles.req}>*</span></span>
          <div className={styles.chipRow}>
            {CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={[styles.chip, category === value ? styles.chipActive : ''].join(' ')}
                onClick={() => { setCategory(value); clearError('category'); }}
                aria-pressed={category === value}
              >
                {label}
              </button>
            ))}
          </div>
          {fieldErrors.category && <p className={styles.fieldError}>{fieldErrors.category}</p>}
        </div>
      </section>

      {/* ── More info ───────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>More info</h2>

        <div className={styles.twoCol}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="gf-brand">Brand</label>
            <input id="gf-brand" type="text" value={brand}
              onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Uniqlo" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="gf-size">Size</label>
            <input id="gf-size" type="text" value={size}
              onChange={(e) => setSize(e.target.value)} placeholder="M, 32, 10…" />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Colors</label>
          <TagInput value={colors} onChange={setColors} placeholder="Type and press Enter" />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Tags</label>
          <TagInput value={tags} onChange={setTags} placeholder="e.g. casual, summer, favourite" />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="gf-notes">Notes</label>
          <textarea id="gf-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Fit, styling, care…" rows={3} style={{ resize: 'vertical' }} />
        </div>
      </section>

      {/* ── Purchase ────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Purchase</h2>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="gf-store">Store</label>
          <input id="gf-store" type="text" value={store}
            onChange={(e) => setStore(e.target.value)} placeholder="e.g. SSENSE, Zara" />
        </div>

        <div className={styles.twoCol}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="gf-price">Price</label>
            <input id="gf-price" type="number" inputMode="decimal" value={price}
              onChange={(e) => setPrice(e.target.value)} placeholder="0.00" min="0" step="0.01" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="gf-url">Buy link</label>
            <input id="gf-url" type="url" value={purchaseUrl} inputMode="url"
              onChange={(e) => setPurchaseUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
      </section>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className={styles.actions}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 1 }}
          onClick={handleSave}
          disabled={!canSave}
        >
          {saving ? 'Saving…' : photosProcessing ? 'Wait for photos…' : saveLabel}
        </button>
      </div>

    </div>
  );
}
