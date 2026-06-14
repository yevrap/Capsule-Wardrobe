import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { GarmentForm, formValuesFromGarment, type GarmentFormValues } from '@/components/GarmentForm';
import styles from './EditGarment.module.css';

export function EditGarment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const garment = useLiveQuery(() => (id ? db.garments.get(id) : undefined), [id]);

  if (garment === undefined) return null; // loading

  if (!garment) {
    return (
      <div className="page">
        <div className="empty-state"><h3>Item not found</h3></div>
      </div>
    );
  }

  async function handleSave(values: GarmentFormValues) {
    if (!garment) return;
    const now = new Date().toISOString();
    await db.garments.update(garment.id, {
      name:        values.name,
      category:    values.category as typeof garment.category,
      photos:      values.photos,
      colors:      values.colors,
      tags:        values.tags,
      brand:       values.brand       || undefined,
      size:        values.size        || undefined,
      notes:       values.notes       || undefined,
      store:       values.store       || undefined,
      purchaseUrl: values.purchaseUrl || undefined,
      price:       values.price ? parseFloat(values.price) : undefined,
      updatedAt:   now,
    });
    navigate(`/item/${garment.id}`, { replace: true });
  }

  return (
    <div className="page">
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} type="button">← Back</button>
        <h1>Edit garment</h1>
      </header>
      <GarmentForm
        initial={formValuesFromGarment(garment)}
        onSave={handleSave}
        onCancel={() => navigate(-1)}
        saveLabel="Save changes"
      />
    </div>
  );
}
