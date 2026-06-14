import { Link, useLocation } from 'react-router-dom';
import { useProfiles } from '@/contexts/ProfileContext';
import styles from './Nav.module.css';

const NAV_ITEMS = [
  { to: '/inventory', icon: '▤', label: 'Wardrobe', match: ['/inventory', '/add', '/item'] },
  { to: '/outfits',   icon: '◈', label: 'Outfits',  match: ['/outfits', '/outfit', '/journal'] },
  { to: '/settings',  icon: '⚙', label: 'Settings', match: ['/settings'] },
] as const;

export function Nav() {
  const { profiles, activeProfile, setActiveProfileId } = useProfiles();
  const location = useLocation();

  function isActive(match: readonly string[]): boolean {
    return match.some((prefix) => location.pathname.startsWith(prefix));
  }

  return (
    <>
      {/* ── Mobile: bottom tab bar ─────────────────────────────────────── */}
      <nav className={styles.bottomNav} aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, icon, label, match }) => (
          <Link
            key={to}
            to={to}
            className={[styles.tab, isActive(match) ? styles.tabActive : ''].join(' ')}
          >
            <span className={styles.tabIcon} aria-hidden="true">{icon}</span>
            <span className={styles.tabLabel}>{label}</span>
          </Link>
        ))}
      </nav>

      {/* ── Desktop: left sidebar ──────────────────────────────────────── */}
      <aside className={styles.sidebar} aria-label="Main navigation">
        <div className={styles.sidebarLogo}>Capsule</div>

        <nav className={styles.sidebarNav}>
          {NAV_ITEMS.map(({ to, icon, label, match }) => (
            <Link
              key={to}
              to={to}
              className={[styles.sidebarLink, isActive(match) ? styles.sidebarLinkActive : ''].join(' ')}
            >
              <span className={styles.sidebarIcon} aria-hidden="true">{icon}</span>
              {label}
            </Link>
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
