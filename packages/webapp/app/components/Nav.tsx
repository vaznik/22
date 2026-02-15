'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

type IconProps = { size?: number; className?: string };

function IconGrid({ size = 22, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" stroke="currentColor" strokeWidth="1.6" opacity="0.92" />
    </svg>
  );
}

function IconPlus({ size = 22, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
    </svg>
  );
}

function IconCoin({ size = 22, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 20.5c4.7 0 8.5-3.1 8.5-7s-3.8-7-8.5-7-8.5 3.1-8.5 7 3.8 7 8.5 7Z" stroke="currentColor" strokeWidth="1.5" opacity="0.92" />
      <path d="M7.8 13.5c1.1 1.6 3.2 2.7 5.6 2.7 2.4 0 4.5-1.1 5.6-2.7" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <path d="M9.6 10.3h4.8" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
    </svg>
  );
}

function IconUser({ size = 22, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 12a4.1 4.1 0 1 0 0-8.2A4.1 4.1 0 0 0 12 12Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 20.2c1.7-3.3 4.3-5 7.5-5s5.8 1.7 7.5 5" stroke="currentColor" strokeWidth="1.6" opacity="0.75" />
    </svg>
  );
}

const tabs = [
  { href: '/', label: 'Lobby', icon: IconGrid },
  { href: '/create', label: 'Create', icon: IconPlus },
  { href: '/staking', label: 'Staking', icon: IconCoin },
  { href: '/profile', label: 'Profile', icon: IconUser },
];

export function Nav() {
  const p = usePathname();
  return (
    <div className="navWrap">
      <div className="navBar">
        {tabs.map((t) => {
          const active = p === t.href || (t.href !== '/' && p.startsWith(t.href));
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} className={'navItem ' + (active ? 'active' : '')}>
              <Icon size={22} />
              <div className="navLabel">{t.label}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
