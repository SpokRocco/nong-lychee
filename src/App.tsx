import { useEffect, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { KioskPage } from './pages/KioskPage';
import { DashboardPage } from './pages/DashboardPage';

export type Route = 'home' | 'kiosk' | 'dashboard';

function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h === 'kiosk' ? 'kiosk' : h === 'dashboard' ? 'dashboard' : 'home';
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(parse);
  useEffect(() => {
    const f = () => setR(parse());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}

export default function App() {
  const route = useRoute();
  if (route === 'kiosk') return <KioskPage />;
  if (route === 'dashboard') return <DashboardPage />;
  return <HomePage />;
}
