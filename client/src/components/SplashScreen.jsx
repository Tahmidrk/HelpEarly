import { useEffect, useState } from 'react';

const SPLASH_VISIBLE_MS = 1850;
const SPLASH_EXIT_MS = 650;

export default function SplashScreen() {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => {
      setIsLeaving(true);
    }, SPLASH_VISIBLE_MS);

    const unmountTimer = window.setTimeout(() => {
      setIsMounted(false);
    }, SPLASH_VISIBLE_MS + SPLASH_EXIT_MS);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(unmountTimer);
    };
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <div className={`splash-screen${isLeaving ? ' splash-screen--leaving' : ''}`} aria-label="Loading At Your Service">
      <div className="splash-orbit splash-orbit-one" />
      <div className="splash-orbit splash-orbit-two" />
      <div className="splash-card">
        <div className="splash-logo-ring">
          <img src="/logo.svg" alt="At Your Service" className="splash-logo" />
        </div>
        <p className="splash-eyebrow">Local services, made simple</p>
        <h1 className="splash-title">At Your Service</h1>
        <div className="splash-loader" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
