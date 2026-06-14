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
        <img
          key={photos[i].id}
          src={url}
          alt={photos[i].tag}
          className={styles.photo}
        />
      ))}
    </div>
  );
}

export function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const garment = useLiveQuery(
    () => (id ? db.garments.get(id) : undefined),
    [id],
  );

  if (garment === undefined) return null; // loading

  if (garment === null || !garment) {
    return (
      <div className="page">
        <button className={styles.backBtn} onClick={() => navigate(-1)} type="button">← Back</button>
        <div className="empty-state"><h3>Item not found</h3></div>
      </div>
    );
  }

  return (
    <div className="page">
      <button className={styles.backBtn} onClick={() => navigate(-1)} type="button">← Back</button>

      <PhotoStrip photos={garment.photos} />

      <div className={styles.meta}>
        <h1 className={styles.name}>{garment.name}</h1>
        {garment.brand && <p className={styles.brand}>{garment.brand}</p>}

        <div className={styles.chips}>
          <span className={styles.chip}>{garment.category}</span>
          {garment.size && <span className={styles.chip}>{garment.size}</span>}
          {garment.colors.map((c) => (
            <span key={c} className={styles.chip}>{c}</span>
          ))}
          {garment.tags.map((t) => (
            <span key={t} className={styles.chip}>{t}</span>
          ))}
        </div>

        {garment.price != null && (
          <p className={styles.price}>
            {garment.currency ?? '$'}{garment.price.toFixed(2)}
          </p>
        )}

        {garment.notes && <p className={styles.notes}>{garment.notes}</p>}

        {garment.purchaseUrl && (
          <a
            href={garment.purchaseUrl}
            target="_blank"
            rel="noreferrer"
            className={styles.buyLink}
          >
            View listing ↗
          </a>
        )}
      </div>

      {/* Phase 2: edit, delete, wear log actions go here */}
    </div>
  );
}
