import { useProfiles } from '@/contexts/ProfileContext';
import styles from './ProfileSwitcher.module.css';

export function ProfileSwitcher() {
  const { profiles, activeProfile, setActiveProfileId } = useProfiles();

  if (profiles.length < 2) return null;

  return (
    <div className={styles.row} role="group" aria-label="Switch profile">
      {profiles.map((p) => {
        const active = p.id === activeProfile?.id;
        return (
          <button
            key={p.id}
            type="button"
            className={[styles.chip, active ? styles.chipActive : ''].join(' ')}
            onClick={() => setActiveProfileId(p.id)}
            aria-pressed={active}
          >
            <span className={styles.initial} aria-hidden="true">
              {p.name.charAt(0).toUpperCase()}
            </span>
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
