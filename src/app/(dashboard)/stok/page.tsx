'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Package, ChevronDown, RefreshCw } from 'lucide-react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { FullPageLoading } from '@/components/ui/LoadingSpinner';
import { SAPWarehouse, SAPItem } from '@/types/sap';

export default function StokPage() {
  const [depolar, setDepolar] = useState<SAPWarehouse[]>([]);
  const [stoklar, setStoklar] = useState<SAPItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stokLoading, setStokLoading] = useState(false);
  const [arama, setArama] = useState('');
  const [aramaDebounced, setAramaDebounced] = useState('');
  const [acik, setAcik] = useState<Set<string>>(new Set());

  // Debounce arama
  useEffect(() => {
    const timer = setTimeout(() => setAramaDebounced(arama), 400);
    return () => clearTimeout(timer);
  }, [arama]);

  // Depolar (kod -> isim eşlemesi için)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/sap/warehouses');
        if (res.ok) setDepolar((await res.json()).value || []);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const depoAdi = useMemo(() => {
    const m: Record<string, string> = {};
    depolar.forEach((d) => (m[d.WarehouseCode] = d.WarehouseName));
    return m;
  }, [depolar]);

  const fetchStoklar = useCallback(async () => {
    setStokLoading(true);
    try {
      const params = new URLSearchParams();
      if (aramaDebounced) params.set('search', aramaDebounced);
      params.set('inStock', 'true');
      params.set('top', '100');
      const res = await fetch(`/api/sap/items?${params.toString()}`);
      if (res.ok) setStoklar((await res.json()).value || []);
    } catch {
      /* ignore */
    } finally {
      setStokLoading(false);
    }
  }, [aramaDebounced]);

  useEffect(() => {
    fetchStoklar();
  }, [fetchStoklar]);

  const toggle = (code: string) =>
    setAcik((prev) => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });

  if (loading) return <FullPageLoading />;

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stok Takibi</h1>
          <p className="text-sm text-gray-500 mt-1">Kaleme dokun → hangi depoda ne kadar var</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchStoklar} disabled={stokLoading}>
          <RefreshCw className={`w-4 h-4 ${stokLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Ürün kodu, adı veya barkod ile ara..."
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {stokLoading ? (
        <Card>
          <div className="text-center py-8 text-gray-500">
            <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Stoklar yükleniyor...
          </div>
        </Card>
      ) : stoklar.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Ürün bulunamadı</p>
            <p className="text-sm mt-1">Arama kriterlerinizi değiştirin</p>
          </div>
        </Card>
      ) : (
        <>
          <p className="text-sm text-gray-500">{stoklar.length} ürün</p>
          <div className="space-y-2">
            {stoklar.map((stok) => {
              const acikMi = acik.has(stok.ItemCode);
              const depoStoklari = (stok.ItemWarehouseInfoCollection || [])
                .filter((w) => w.InStock > 0)
                .sort((a, b) => b.InStock - a.InStock);
              return (
                <Card key={stok.ItemCode} padding={false} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(stok.ItemCode)}
                    className="w-full text-left p-3 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{stok.ItemCode}</p>
                      <p className="text-sm text-gray-600 truncate">{stok.ItemName}</p>
                      {stok.BarCode && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{stok.BarCode}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-blue-900">{stok.QuantityOnStock}</p>
                      <p className="text-xs text-gray-500">
                        {depoStoklari.length} depo
                      </p>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${acikMi ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {acikMi && (
                    <div className="border-t border-gray-100 bg-gray-50 px-3 py-2.5 space-y-1.5">
                      {depoStoklari.length === 0 ? (
                        <p className="text-xs text-gray-400 py-1">Hiçbir depoda stok yok</p>
                      ) : (
                        depoStoklari.map((w) => (
                          <div key={w.WarehouseCode} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 min-w-0 flex items-center gap-2">
                              <span className="font-mono text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 flex-shrink-0">
                                {w.WarehouseCode}
                              </span>
                              <span className="truncate">{depoAdi[w.WarehouseCode] || ''}</span>
                            </span>
                            <span className="font-semibold text-gray-900 flex-shrink-0 ml-2">{w.InStock}</span>
                          </div>
                        ))
                      )}
                      {stok.QuantityOrderedByCustomers > 0 && (
                        <div className="flex items-center justify-between text-xs text-amber-700 pt-1.5 border-t border-gray-200">
                          <span>Müşteri siparişi (rezerve)</span>
                          <span className="font-semibold">{stok.QuantityOrderedByCustomers}</span>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
