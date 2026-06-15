import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '@/db';
import { useProfiles } from '@/contexts/ProfileContext';
import { GarmentForm, emptyFormValues, type GarmentFormValues } from '@/components/GarmentForm';
import { generateId } from '@/utils/id';
import type { Garment } from '@/types';
import styles from './AddGarment.module.css';

export function AddGarment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeProfile } = useProfiles();

  const state = location.state as {
    preloadedPhoto?: { compressed: Blob; thumbnail: Blob };
    embedding?: number[];
  } | null;

  async function handleSave(values: GarmentFormValues) {
    if (!activeProfile) return;
    const now = new Date().toISOString();
    const garment: Garment = {
      id: generateId(),
      ownerId: activeProfile.id,
      name: values.name,
      category: values.category as Garment['category'],
      colors: values.colors,
      material: [],
      photos: values.photos,
      embedding: state?.embedding || undefined,
      brand:       values.brand      || undefined,
      size:        values.size       || undefined,
      formality: 3,
      warmth: 3,
      seasons: [],
      contexts: { work: 3, play: 3, town: 3 },
      store:       values.store      || undefined,
      purchaseUrl: values.purchaseUrl || undefined,
      price:       values.price ? parseFloat(values.price) : undefined,
      tags: values.tags,
      notes:       values.notes      || undefined,
      status: 'active',
      wearCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.garments.add(garment);
    navigate('/inventory', { replace: true });
  }

  const initialFormValues = state?.preloadedPhoto ? {
    ...emptyFormValues(),
    photos: [
      {
        id: generateId(),
        tag: 'front' as const,
        compressed: state.preloadedPhoto.compressed,
        thumbnail: state.preloadedPhoto.thumbnail,
        capturedAt: new Date().toISOString(),
      }
    ],
  } : undefined;

  return (
    <div className="page">
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} type="button">← Back</button>
        <h1>Add garment</h1>
      </header>
      <GarmentForm initial={initialFormValues} onSave={handleSave} onCancel={() => navigate(-1)} />
    </div>
  );
}
