import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';

export function DesktopHeader() {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const initials = user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || '?';

  return (
    <header className="desktop-header">
      <div className="desktop-header-content">
        <button className="desktop-logo" onClick={() => navigate('/dashboard')}>
          Flexer
        </button>

        <nav className="desktop-nav">
          <button onClick={() => navigate('/dashboard')} className="desktop-nav-link">
            Dashboard
          </button>
          <button onClick={() => navigate('/plan')} className="desktop-nav-link">
            My Plan
          </button>
        </nav>

        <div className="desktop-profile" ref={dropdownRef}>
          <button 
            className="profile-trigger"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <span className="profile-avatar">{initials.toUpperCase()}</span>
            <span className="profile-label">Profile</span>
            <span className="profile-chevron">{dropdownOpen ? '▲' : '▼'}</span>
          </button>

          {dropdownOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-header">
                <span className="profile-email">
                  {user?.emailAddresses?.[0]?.emailAddress || 'User'}
                </span>
              </div>
              <button 
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/profile');
                }}
                className="profile-dropdown-item"
              >
                <span className="dropdown-icon">⚙️</span>
                Settings
              </button>
              <div className="profile-dropdown-divider" />
              <button 
                onClick={handleSignOut}
                className="profile-dropdown-item profile-dropdown-signout"
              >
                <span className="dropdown-icon">🚪</span>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
