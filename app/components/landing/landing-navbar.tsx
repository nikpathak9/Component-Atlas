import { useEffect, useState } from "react";
import ArrowRight from "lucide-react/icons/arrow-right";
import LogOut from "lucide-react/icons/log-out";
import Menu from "lucide-react/icons/menu";
import Monitor from "lucide-react/icons/monitor";
import Moon from "lucide-react/icons/moon";
import Sun from "lucide-react/icons/sun";
import X from "lucide-react/icons/x";
import type { AuthUser } from "../../types/workspace";

type Props = {
  theme: "light" | "dark";
  authUser: AuthUser | null;
  authLoading: boolean;
  authInitials: string;
  accountOpen: boolean;
  onToggleTheme: () => void;
  onOpenWorkspace: () => void;
  onToggleAccount: () => void;
};

export function LandingNavbar({
  theme,
  authUser,
  authLoading,
  authInitials,
  accountOpen,
  onToggleTheme,
  onOpenWorkspace,
  onToggleAccount,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const handleResize = () => {
      if (window.innerWidth > 760) setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <nav className='landing-nav'>
      <a className='landing-brand' href='#top' onClick={closeMobileMenu}>
        <img className='logo' src='/component-atlas-logo.png' alt='' />
        <strong>Component Atlas</strong>
      </a>
      <button
        className='landing-mobile-toggle'
        type='button'
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-controls='landing-navigation'
        aria-expanded={mobileOpen}
        onClick={(event) => {
          event.stopPropagation();
          setMobileOpen((current) => !current);
        }}
      >
        {mobileOpen ? <X aria-hidden='true' /> : <Menu aria-hidden='true' />}
      </button>
      {mobileOpen && (
        <button
          className='landing-nav-backdrop'
          type='button'
          aria-label='Close navigation menu'
          onClick={closeMobileMenu}
        />
      )}
      <div
        className={`landing-nav-links ${mobileOpen ? "is-mobile-open" : ""}`}
        id='landing-navigation'
      >
        <div className='landing-nav-sections'>
          <a href='#product' onClick={closeMobileMenu}>Product</a>
          <a href='#how-it-works' onClick={closeMobileMenu}>How it works</a>
          <a href='#security' onClick={closeMobileMenu}>Security</a>
        </div>
        <div className='landing-nav-actions'>
          <button
            className='landing-theme-toggle'
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={onToggleTheme}
          >
            {theme === "dark" ? <Sun aria-hidden='true' /> : <Moon aria-hidden='true' />}
            <span className='mobile-action-label'>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </button>
          {authUser && (
            <button className='landing-dashboard-link' onClick={() => { closeMobileMenu(); onOpenWorkspace(); }}>
              <Monitor aria-hidden='true' /> Open dashboard
            </button>
          )}
          {!authLoading && (authUser ? (
            <div className='menu-wrap landing-account'>
              <button
                className='landing-profile'
                aria-label='Open profile menu'
                aria-haspopup='menu'
                aria-expanded={accountOpen}
                onClick={(event) => { event.stopPropagation(); onToggleAccount(); }}
              >
                {authInitials}
                <span className='mobile-action-label'>Profile</span>
              </button>
              {accountOpen && (
                <div className='popover account-menu landing-account-menu' role='menu'>
                  <strong>{authUser.displayName}</strong>
                  <span>{authUser.email}</span>
                  <a href='/login?signout=1&return_to=%2F'>
                    <LogOut aria-hidden='true' /> Log out
                  </a>
                </div>
              )}
            </div>
          ) : (
            <a className='landing-signup' href='/login?return_to=%2F'>
              Sign in <ArrowRight aria-hidden='true' />
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
