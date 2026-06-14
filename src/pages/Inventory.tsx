import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useProfiles } from '@/contexts/ProfileContext';
import { blobToUrl } from '@/utils/image';
import type { Garment } from '@/types';
import styles from './Inventory.module.css';

// Converts the first thumbnail Blob of a garment to an object URL.
// Returns null while loading or if the garment has no photos.
function useGarmentThumb(garment: Garment): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const thumb = garment.photos[0]?.thumbnail;
    if (!thumb) { setUrl(null); return; }
    const objectUrl = blobToUrl(thumb);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [garment.photos]);

  return url;
}

function GarmentCard({ garment }: { garment: Garment }) {
  const navigate = useNavigate();
  const thumbUrl = useGarmentThumb(garment);

  return (
    <button
      className={styles.gridItem}
      onClick={() => navigate(`/item/${garment.id}`)}
      type="button"
      aria-label={garment.name}
    >
      <div className={styles.gridThumb}>
        {thumbUrl ? (
          <img src={thumbUrl} alt={garment.name} className={styles.gridThumbImg} />
        ) : (
          <span className={styles.gridThumbPlaceholder} aria-hidden="true">◈</span>
        )}
      </div>
      <p className={styles.gridName}>{garment.name}</p>
      {garment.brand && <p className={styles.gridBrand}>{garment.brand}</p>}
    </button>
  );
}

export function Inventory() {
  const navigate = useNavigate();
  const { activeProfile, profiles, setActiveProfileId } = useProfiles();

  const garments = useLiveQuery(
    () =>
      activeProfile
        ? db.garments
            .where('ownerId')
            .equals(activeProfile.id)
            .reverse()
            .sortBy('createdAt')
        : [],
    [activeProfile?.id],
  );

  const count = garments?.length ?? 0;

  return (
    <div className="page">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div>
          <p className="label">Wardrobe</p>
          <h1 className={styles.profileName}>{activeProfile?.name ?? '—'}</h1>
        </div>

        {/* Profile switcher pill row — mobile only (sidebar handles desktop) */}
        {profiles.length > 1 && (
          <div className={styles.profilePills}>
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                className={[
                  styles.profilePill,
                  activeProfile?.id === p.id ? styles.profilePillActive : '',
                ].join(' ')}
                onClick={() => setActiveProfileId(p.id)}
                aria-label={`Switch to ${p.name}`}
              >
                {p.name.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {count === 0 ? (
        <div className="empty-state">
          <span className={styles.emptyIcon} aria-hidden="true">◈</span>
          <h3>No items yet</h3>
          <p>Add your first garment to start building your wardrobe.</p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={() => navigate('/add')}
          >
            Add garment
          </button>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <p className={styles.count}>{count} {count === 1 ? 'item' : 'items'}</p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '8px 18px', fontSize: 13 }}
              onClick={() => navigate('/add')}
            >
              + Add
            </button>
          </div>

          <div className={styles.grid}>
            {garments?.map((g) => (
              <GarmentCard key={g.id} garment={g} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
