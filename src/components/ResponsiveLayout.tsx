import { useEffect, useRef, type ReactNode } from "react";
import { SignedIn, useAuth } from "@clerk/clerk-react";
import { Link, useLocation } from "react-router-dom";
import { DesktopHeader } from "./DesktopHeader";
interface ResponsiveLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
}
export function ResponsiveLayout({
  children,
  showHeader = true,
}: ResponsiveLayoutProps) {
  const { pathname } = useLocation();
  const { isSignedIn } = useAuth();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    main.current?.focus();
  }, [pathname]);
  const withNavigation = showHeader && isSignedIn;
  return (
    <div
      className={`training-shell ${withNavigation ? "with-navigation" : ""}`}
    >
      <a className="training-skip" href="#main-content">
        Skip to content
      </a>
      {showHeader && (
        <SignedIn>
          <DesktopHeader />
        </SignedIn>
      )}
      <div className="training-workspace">
        <header className="training-topline">
          <Link
            to={isSignedIn ? "/dashboard" : "/"}
            className="mobile-brand"
            aria-label="Flexer home"
          >
            flexer.
          </Link>
          <span className="training-motto">TRAIN WITH INTENTION</span>
          <Link to="/profile" className="topline-account">
            Your training, your pace
          </Link>
        </header>
        <main
          ref={main}
          id="main-content"
          className="responsive-main"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
