import { Monitor, BarChart3, Home } from 'lucide-react';
import { SCHOOL } from '../lib/config';
import type { Route } from '../App';

export function Logo({ size = 40 }: { size?: number }) {
  return <img src="/favicon.svg" width={size} height={size} alt="โลโก้น้องลิ้นจี่" />;
}

export function Header({ route }: { route: Route }) {
  const link = (href: string, label: string, Icon: typeof Home, active: boolean) => (
    <a
      href={href}
      className={`btn ${active ? 'btn-primary' : 'btn-ghost'}`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={16} aria-hidden /> <span className="hidden sm:inline">{label}</span>
    </a>
  );
  return (
    <header className="sticky top-0 z-20 border-b border-lychee-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Logo />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight text-lychee-700 sm:text-lg">
            {SCHOOL.mascotName} AI Mascot
          </h1>
          <p className="truncate text-xs text-lychee-900/70">
            {SCHOOL.name} · สพป.น่าน เขต 1
          </p>
        </div>
        <nav className="flex gap-2" aria-label="เมนูหลัก">
          {link('#/', 'น้องลิ้นจี่', Home, route === 'home')}
          {link('#/kiosk', 'Smart Kiosk', Monitor, route === 'kiosk')}
          {link('#/dashboard', 'ผู้บริหาร', BarChart3, route === 'dashboard')}
        </nav>
      </div>
    </header>
  );
}
