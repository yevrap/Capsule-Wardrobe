import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useProfiles } from '@/contexts/ProfileContext';
import styles from './Inventory.module.css';

export function Inventory() {
  const navigate = useNavigate();
  const { activeProfile, profiles, setActiveProfileId } = useProfiles();

  const garments = useLiveQuery(
    () =>
      activeProfile
        ? db.garments.where('ownerId').equals(activeProfile.id).toArray()
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

        {/* Profile switcher (mobile — sidebar handles desktop) */}
        {profiles.length > 1 && (
          <div className={styles.profilePills}>
            {profiles.map((p) => (
              <button
                key={p.id}
                className={[
                  styles.profilePill,
                  activeProfile?.id === p.id ? styles.profilePillActive : '',
                ].join(' ')}
                onClick={() => setActiveProfileId(p.id)}
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
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={() => navigate('/add')}
          >
            Add garment
          </button>
        </div>
      ) : (
        <>
          <p className={styles.count}>{count} {count === 1 ? 'item' : 'items'}</p>
          {/* Phase 1: garment grid goes here */}
          <div className={styles.grid}>
            {garments?.map((g) => (
              <div key={g.id} className={styles.gridItem}>
                <div className={styles.gridThumb} aria-label={g.name} />
                <p className={styles.gridName}>{g.name}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
