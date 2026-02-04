import { ReactNode } from 'react';
import { SignedIn } from '@clerk/clerk-react';
import { DesktopHeader } from './DesktopHeader';

interface ResponsiveLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
}

export function ResponsiveLayout({ children, showHeader = true }: ResponsiveLayoutProps) {
  return (
    <div className="responsive-layout">
      {showHeader && (
        <SignedIn>
          <DesktopHeader />
        </SignedIn>
      )}
      <main className="responsive-main">
        {children}
      </main>
    </div>
  );
}
