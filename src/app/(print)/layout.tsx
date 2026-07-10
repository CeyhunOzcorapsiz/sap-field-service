// Yazdirma sayfalari icin sade layout - sidebar/header yok
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
