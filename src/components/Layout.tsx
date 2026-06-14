import { type ReactNode } from 'react';
import { Nav } from './Nav';

interface LayoutProps {
  children: ReactNode;
}

// Layout wraps every authenticated page with the persistent Nav.
// Pages use the `.page` class from global.css for their own padding.
export function Layout({ children }: LayoutProps) {
  return (
    <>
      <Nav />
      <main>{children}</main>
    </>
  );
}
