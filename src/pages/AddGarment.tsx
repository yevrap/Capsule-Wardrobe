import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db';
import { useProfiles } from '@/contexts/ProfileContext';
import { PhotoUploader } from '@/components/PhotoUploader';
import { TagInput } from '@/components/TagInput';
import { generateId } from '@/utils/id';
import type { Garment, GarmentCategory, GarmentPhoto } from '@/types';
import styles from './AddGarment.module.css';

const CATEGORIES: { value: GarmentCategory; label: string }[] = [
  { value: 'top',       label: 'Top' },
  { value: 'bottom',    label: 'Bottom' },
  { value: 'dress',     label: 'Dress' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'footwear',  label: 'Footwear' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'underlayer', label: 'Underlayer' },
];

export function AddGarment() {
  const navigate = useNavigate();
  const { activeProfile } = useProfiles();

  // Photos
  const [photos, setPhotos] = useState<GarmentPhoto[]>([]);
  const [photosProcessing, setPhotosProcessing] = useState(false);

  // Required fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GarmentCategory | ''>('');

  // Optional core fields
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Optional purchase info
  const [store, setStore] = useState('');
  const [purchaseUrl, setPurchaseUrl] = useState('');
  const [price, setPrice] = useState('');

  // Form state
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  function validate() {
    const errors: Partial<Record<string, string>> = {};
    if (!name.trim())  errors.name     = 'Name is required';
    if (!category)     errors.category = 'Category is required';
    return errors;
  }

  async function save() {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (!activeProfile) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const garment: Garment = {
        id: generateId(),
        ownerId: activeProfile.id,
        name: name.trim(),
        category: category as GarmentCategory,
        colors,
        material: [],
        photos,
        brand: brand.trim() || undefined,
        size: size.trim() || undefined,
        formality: 3,
        warmth: 3,
        seasons: [],
        contexts: { work: 3, play: 3, town: 3 },
        store: store.trim() || undefined,
        purchaseUrl: purchaseUrl.trim() || undefined,
        price: price ? parseFloat(price) : undefined,
        tags,
        notes: notes.trim() || undefined,
        status: 'active',
        wearCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      await db.garments.add(garment);
      navigate('/inventory', { replace: true });
    } catch (err) {
      console.error('Failed to save garment:', err);
    } finally {
      setSaving(false);
    }
  }

  const canSave = !photosProcessing && !saving;

  return (
    <div className="page">
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} type="button">
          ← Back
        </button>
        <h1>Add garment</h1>
      </header>

      <div className={styles.form}>

        {/* ── Photos ───────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Photos</h2>
          <PhotoUploader
            onChange={setPhotos}
            onProcessingChange={setPhotosProcessing}
          />
          {photosProcessing && (
            <p className={styles.hint}>Compressing photos…</p>
          )}
        </section>

        {/* ── Required fields ───────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Details</h2>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="garment-name">
              Name <span className={styles.required}>*</span>
            </label>
            <input
              id="garment-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
              }}
              placeholder="e.g. White linen shirt"
              autoComplete="off"
            />
            {fieldErrors.name && <p className={styles.fieldError}>{fieldErrors.name}</p>}
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Category <span className={styles.required}>*</span>
            </span>
            <div className={styles.chipRow}>
              {CATEGORIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={[
                    styles.categoryChip,
                    category === value ? styles.categoryChipActive : '',
                  ].join(' ')}
                  onClick={() => {
                    setCategory(value);
                    if (fieldErrors.category) setFieldErrors((p) => ({ ...p, category: undefined }));
                  }}
                  aria-pressed={category === value}
                >
                  {label}
                </button>
              ))}
            </div>
            {fieldErrors.category && (
              <p className={styles.fieldError}>{fieldErrors.category}</p>
            )}
          </div>
        </section>

        {/* ── Optional fields ───────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>More info</h2>

          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="garment-brand">Brand</label>
              <input
                id="garment-brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Uniqlo"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="garment-size">Size</label>
              <input
                id="garment-size"
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g. M, 32, 10"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Colors</label>
            <TagInput
              value={colors}
              onChange={setColors}
              placeholder="Type a color and press Enter"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Tags</label>
            <TagInput
              value={tags}
              onChange={setTags}
              placeholder="e.g. casual, summer, favourite"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="garment-notes">Notes</label>
            <textarea
              id="garment-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about fit, styling, care…"
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>
        </section>

        {/* ── Purchase info ─────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Purchase</h2>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="garment-store">Store</label>
            <input
              id="garment-store"
              type="text"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              placeholder="e.g. SSENSE, Zara"
            />
          </div>

          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="garment-price">Price</label>
              <input
                id="garment-price"
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="garment-url">Buy link</label>
              <input
                id="garment-url"
                type="url"
                value={purchaseUrl}
                onChange={(e) => setPurchaseUrl(e.target.value)}
                placeholder="https://…"
                inputMode="url"
              />
            </div>
          </div>
        </section>

        {/* ── Save ──────────────────────────────────────────────────────── */}
        <div className={styles.saveRow}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={save}
            disabled={!canSave}
          >
            {saving ? 'Saving…' : photosProcessing ? 'Wait for photos…' : 'Save garment'}
          </button>
        </div>

      </div>
    </div>
  );
}
