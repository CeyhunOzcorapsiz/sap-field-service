'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wrench,
  Package,
  BarChart3,
  ClipboardCheck,
  Settings,
  LogOut,
  ChevronLeft,
  HardHat,
  CalendarDays,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/contexts/AuthContext';
import { UserRole } from '@/types/auth';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.YONETIM, UserRole.BOLGE_SORUMLUSU] },
  { href: '/teknisyen', label: 'Servislerim', icon: HardHat, roles: [UserRole.TEKNISYEN] },
  { href: '/servis', label: 'Servis Yönetimi', icon: Wrench },
  { href: '/planlama', label: 'Haftalık Plan', icon: CalendarDays },
  { href: '/stok', label: 'Stok', icon: Package },
  { href: '/raporlar', label: 'Raporlar', icon: BarChart3, roles: [UserRole.YONETIM, UserRole.BOLGE_SORUMLUSU, UserRole.SIPARIS_YONETIMI] },
  { href: '/siparis', label: 'Sipariş Onay', icon: ClipboardCheck, roles: [UserRole.SIPARIS_YONETIMI, UserRole.YONETIM] },
  { href: '/ayarlar', label: 'Ayarlar', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const filteredItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <aside
      className={clsx(
        'hidden lg:flex flex-col bg-white border-r border-gray-200 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        {!collapsed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo.png" alt="Field Service Co." className="h-8 w-auto object-contain" />
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className={clsx('w-5 h-5 text-gray-500 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-gray-200">
        {!collapsed && user && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-gray-900 truncate">{user.fullName}</p>
            <p className="text-xs text-gray-500 truncate">{user.role}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          title={collapsed ? 'Çıkış' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Çıkış Yap</span>}
        </button>
      </div>
    </aside>
  );
}
