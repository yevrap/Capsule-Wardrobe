import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '@/db';
import { blobToUrl } from '@/utils/image';
import type { Garment } from '@/types';
import styles from './OutfitDetail.module.css';

function GarmentTile({ garment }: { garment: Garment }) {
  const navigate = useNavigate();
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
      className={styles.tile}
      onClick={() => navigate(`/item/${garment.id}`)}
      aria-label={garment.name}
    >
      <div className={styles.tileThumb}>
        {thumbUrl
          ? <img src={thumbUrl} alt={garment.name} className={styles.tileImg} />
          : <span className={styles.tilePlaceholder} aria-hidden="true">◈</span>
        }
      </div>
      <p className={styles.tileName}>{garment.name}</p>
      <p className={styles.tileCategory}>{garment.category}</p>
    </button>
  );
}

export function OutfitDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Returns undefined (loading) | null (not found) | Outfit (found).
  const outfit = useLiveQuery(
    async () => {
      if (!id) return null;
      return (await db.outfits.get(id)) ?? null;
    },
    [id],
  );

  const garments = useLiveQuery(
    async () => {
      if (!outfit) return [];
      const all = await db.garments.bulkGet(outfit.garmentIds);
      return all.filter((g): g is Garment => g !== undefined);
    },
    [outfit?.garmentIds.join(',')],
  );

  // Always show the frame with a back button — never a blank screen.
  if (outfit === undefined || !outfit) {
    return (
      <div className="page">
        <div className={styles.topBar}>
          <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
        {outfit === null && (
          <div className="empty-state"><h3>Outfit not found</h3></div>
        )}
      </div>
    );
  }

  async function handleDelete() {
    if (!outfit) return;
    await db.outfits.delete(outfit.id);
    navigate('/outfits', { replace: true });
  }

  return (
    <div className="page">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <button
          type="button"
          className={styles.editBtn}
          onClick={() => navigate(`/outfit/${outfit.id}/edit`)}
        >
          Edit
        </button>
      </div>

      {/* ── Outfit name + tags ───────────────────────────────────────────── */}
      <div className={styles.header}>
        <p className="label">Outfit</p>
        <h1 className={styles.name}>{outfit.name}</h1>
        {outfit.occasionTags.length > 0 && (
          <div className={styles.tags}>
            {outfit.occasionTags.map((tag) => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Garment grid ────────────────────────────────────────────────── */}
      <div className={styles.grid}>
        {(garments ?? []).map((g) => (
          <GarmentTile key={g.id} garment={g} />
        ))}
      </div>

      {garments?.length === 0 && outfit.garmentIds.length > 0 && (
        <p className={styles.missingNote}>
          Some garments in this outfit have been removed from your wardrobe.
        </p>
      )}

      {/* ── Delete ──────────────────────────────────────────────────────── */}
      <div className={styles.deleteArea}>
        {!confirmDelete ? (
          <button type="button" className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
            Delete outfit
          </button>
        ) : (
          <div className={styles.confirmRow}>
            <p className={styles.confirmText}>Delete this outfit permanently?</p>
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
