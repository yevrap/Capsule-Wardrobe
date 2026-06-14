import { NavLink } from 'react-router-dom';
import { useProfiles } from '@/contexts/ProfileContext';
import styles from './Nav.module.css';

const NAV_ITEMS = [
  { to: '/inventory', icon: '▤', label: 'Wardrobe' },
  { to: '/add',       icon: '+', label: 'Add' },
  { to: '/outfits',   icon: '◈', label: 'Outfits' },
] as const;

export function Nav() {
  const { profiles, activeProfile, setActiveProfileId } = useProfiles();

  return (
    <>
      {/* ── Mobile: bottom tab bar ─────────────────────────────────────── */}
      <nav className={styles.bottomNav} aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [styles.tab, isActive ? styles.tabActive : ''].join(' ')
            }
          >
            <span className={styles.tabIcon} aria-hidden="true">{icon}</span>
            <span className={styles.tabLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Desktop: left sidebar ──────────────────────────────────────── */}
      <aside className={styles.sidebar} aria-label="Main navigation">
        <div className={styles.sidebarLogo}>Capsule</div>

        <nav className={styles.sidebarNav}>
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [styles.sidebarLink, isActive ? styles.sidebarLinkActive : ''].join(' ')
              }
            >
              <span className={styles.sidebarIcon} aria-hidden="true">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Profile switcher */}
        {profiles.length > 1 && (
          <div className={styles.profileSwitcher}>
            <p className={styles.profileSwitcherLabel}>Profile</p>
            {profiles.map((profile) => (
              <button
                key={profile.id}
                className={[
                  styles.profileBtn,
                  activeProfile?.id === profile.id ? styles.profileBtnActive : '',
                ].join(' ')}
                onClick={() => setActiveProfileId(profile.id)}
              >
                <span className={styles.profileAvatar}>
                  {profile.name.charAt(0).toUpperCase()}
                </span>
                {profile.name}
              </button>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}
