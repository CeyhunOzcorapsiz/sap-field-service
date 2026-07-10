'use client';

import { useState } from 'react';
import { AuthProvider } from '@/lib/contexts/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import Header from '@/components/layout/Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <AuthProvider>
      <ToastProvider>
        <div className="h-full flex">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />

          <div className="flex-1 flex flex-col min-w-0">
            <Header onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

            <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
              {children}
            </main>

            <MobileNav />
          </div>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
