'use client';

import Link from 'next/link';
import { BarChart3, Users, Clock, Shield } from 'lucide-react';
import Card from '@/components/ui/Card';

const raporlar = [
  {
    href: '/raporlar/aylik',
    title: 'Aylık Servis Raporu',
    desc: 'Toplam servis, mesai ve genel istatistikler',
    icon: BarChart3,
    color: 'text-blue-600 bg-blue-50',
  },
  {
    href: '/raporlar/performans',
    title: 'Teknisyen Performansı',
    desc: 'TVS skorları ve bireysel karneler',
    icon: Users,
    color: 'text-blue-800 bg-blue-50',
  },
  {
    href: '/raporlar/mesai',
    title: 'Mesai Raporu',
    desc: 'İşçilik saatleri ve mesai detayları',
    icon: Clock,
    color: 'text-yellow-600 bg-yellow-50',
  },
  {
    href: '/siparis',
    title: 'Garanti & Onay',
    desc: 'Garanti servis ve kredi notu eşleştirme',
    icon: Shield,
    color: 'text-purple-600 bg-purple-50',
  },
];

export default function RaporlarPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Raporlar</h1>
        <p className="text-sm text-gray-500 mt-1">Servis operasyonu raporları ve analizler</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {raporlar.map((rapor) => (
          <Link key={rapor.href} href={rapor.href}>
            <Card hover className="h-full">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${rapor.color}`}>
                  <rapor.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{rapor.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{rapor.desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
