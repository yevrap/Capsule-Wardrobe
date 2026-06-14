import { type ReactNode } from 'react';
import { Nav } from './Nav';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

// Main content appears before Nav in the DOM.
// On mobile (flex-column): content fills available height, Nav sits at the bottom.
// On desktop (flex-row): Nav renders the sidebar with order:-1 so it appears left of content.
export function Layout({ children }: LayoutProps) {
  return (
    <div className={styles.shell}>
      <main className={styles.content}>
        {children}
      </main>
      <Nav />
    </div>
  );
}
