'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wrench, Package, BarChart3, User, HardHat } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/contexts/AuthContext';
import { UserRole } from '@/types/auth';

export default function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isTeknisyen = user?.role === UserRole.TEKNISYEN;

  const items = isTeknisyen
    ? [
        { href: '/teknisyen', label: 'Servisler', icon: HardHat },
        { href: '/stok', label: 'Stok', icon: Package },
        { href: '/ayarlar', label: 'Profil', icon: User },
      ]
    : [
        { href: '/', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/servis', label: 'Servis', icon: Wrench },
        { href: '/stok', label: 'Stok', icon: Package },
        { href: '/raporlar', label: 'Raporlar', icon: BarChart3 },
        { href: '/ayarlar', label: 'Profil', icon: User },
      ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2 py-1',
                isActive ? 'text-blue-800' : 'text-gray-500',
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
