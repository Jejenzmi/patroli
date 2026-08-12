import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

/**
 * Menahan galat render agar layar tidak berubah putih di lapangan.
 * Pengguna tetap mendapat jalan keluar: muat ulang atau kembali ke beranda.
 */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[render]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="panel w-full max-w-md panel-pad text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-danger/40 bg-danger/10">
            <AlertOctagon size={24} className="text-danger" />
          </div>
          <h1 className="mt-5 text-lg font-extrabold">Terjadi gangguan pada tampilan</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Halaman ini gagal dimuat. Data operasional Anda aman — silakan muat ulang halaman.
          </p>
          <pre className="mt-4 max-h-28 overflow-auto rounded-xl border border-line bg-abyss/60 p-3 text-left text-[11px] text-muted">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div className="mt-5 flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => (location.href = '/')}>
              Ke Pusat Komando
            </button>
            <button className="btn-primary flex-1" onClick={() => location.reload()}>
              <RotateCcw size={14} /> Muat Ulang
            </button>
          </div>
        </div>
      </div>
    );
  }
}
