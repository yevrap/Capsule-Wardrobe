import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '@/db';
import { blobToUrl } from '@/utils/image';
import type { GarmentPhoto } from '@/types';
import styles from './ItemDetail.module.css';

function PhotoStrip({ photos }: { photos: GarmentPhoto[] }) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const objectUrls = photos.map((p) => blobToUrl(p.compressed));
    setUrls(objectUrls);
    return () => objectUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  if (urls.length === 0) return null;

  return (
    <div className={styles.photoStrip}>
      {urls.map((url, i) => (
        <img key={photos[i].id} src={url} alt={photos[i].tag} className={styles.photo} />
      ))}
    </div>
  );
}

export function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const garment = useLiveQuery(() => (id ? db.garments.get(id) : undefined), [id]);

  if (garment === undefined) return null;

  if (!garment) {
    return (
      <div className="page">
        <button className={styles.backBtn} onClick={() => navigate(-1)} type="button">← Back</button>
        <div className="empty-state"><h3>Item not found</h3></div>
      </div>
    );
  }

  async function handleDelete() {
    if (!garment) return;
    await db.garments.delete(garment.id);
    navigate('/inventory', { replace: true });
  }

  return (
    <div className="page">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} type="button">← Back</button>
        <button
          className={styles.editBtn}
          onClick={() => navigate(`/item/${garment.id}/edit`)}
          type="button"
        >
          Edit
        </button>
      </div>

      <PhotoStrip photos={garment.photos} />

      {/* ── Metadata ────────────────────────────────────────────────────── */}
      <div className={styles.meta}>
        <h1 className={styles.name}>{garment.name}</h1>
        {garment.brand && <p className={styles.brand}>{garment.brand}</p>}

        <div className={styles.chips}>
          <span className={styles.chip}>{garment.category}</span>
          {garment.size   && <span className={styles.chip}>{garment.size}</span>}
          {garment.colors.map((c) => <span key={c} className={styles.chip}>{c}</span>)}
          {garment.tags.map((t)   => <span key={t} className={styles.chip}>{t}</span>)}
        </div>

        {garment.price != null && (
          <p className={styles.price}>
            {garment.currency ?? '$'}{garment.price.toFixed(2)}
          </p>
        )}

        {garment.notes && <p className={styles.notes}>{garment.notes}</p>}

        {garment.purchaseUrl && (
          <a href={garment.purchaseUrl} target="_blank" rel="noreferrer" className={styles.buyLink}>
            View listing ↗
          </a>
        )}
      </div>

      {/* ── Delete ──────────────────────────────────────────────────────── */}
      <div className={styles.deleteArea}>
        {!confirmDelete ? (
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={() => setConfirmDelete(true)}
          >
            Delete garment
          </button>
        ) : (
          <div className={styles.confirmRow}>
            <p className={styles.confirmText}>Delete this garment permanently?</p>
            <div className={styles.confirmActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
