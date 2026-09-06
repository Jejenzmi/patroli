import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Loader2, Eye, EyeOff, Radar, MapPinned, Siren, QrCode } from 'lucide-react';
import { useAuth } from '../lib/store';

const HIGHLIGHTS = [
  { icon: QrCode, title: 'Bukti patroli yang tak bisa dikarang', body: 'Setiap titik diverifikasi lewat QR/NFC plus koordinat GPS dan stempel waktu.' },
  { icon: Radar, title: 'Pantauan langsung dari satu layar', body: 'Posisi anggota, patroli berjalan, dan insiden mengalir realtime ke pusat komando.' },
  { icon: Siren, title: 'Respons darurat terukur', body: 'Tombol panik, eskalasi insiden, dan tenggat SLA yang terpantau otomatis.' },
];

export default function Login() {
  const { me, login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % HIGHLIGHTS.length), 4200);
    return () => clearInterval(id);
  }, []);

  if (me) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await login(username.trim(), password);
      nav('/', { replace: true });
    } catch (e: any) {
      setErr(e.message || 'Gagal masuk');
    } finally {
      setBusy(false);
    }
  };

  const Hi = HIGHLIGHTS[tick].icon;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
      {/* Panel kiri: identitas sistem */}
      <div className="relative hidden overflow-hidden border-r border-line/60 lg:block">
        <div className="absolute inset-0 bg-grid [background-size:38px_38px] opacity-60" />
        <div className="absolute -left-40 top-1/4 h-[520px] w-[520px] rounded-full bg-amber/10 blur-[130px]" />
        <div className="absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-cyan/10 blur-[120px]" />

        {/* Sapuan radar dekoratif */}
        <div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-full border border-amber/[.07]"
              style={{ transform: `scale(${i / 4})` }}
            />
          ))}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, rgba(255,176,32,.16), transparent 28%)',
              maskImage: 'radial-gradient(circle, black 62%, transparent 63%)',
              WebkitMaskImage: 'radial-gradient(circle, black 62%, transparent 63%)',
            }}
          />
        </div>

        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <img src="/merek/logo.png" alt="Dharmapati" className="h-14 w-auto" />
            <div className="leading-tight">
              <p className="text-lg font-extrabold tracking-[.22em]">DHARMAPATI</p>
              <p className="text-[10px] uppercase tracking-[.2em] text-muted">Security Command Center</p>
            </div>
          </div>

          <div className="max-w-lg">
            <h1 className="text-[42px] font-extrabold leading-[1.08] tracking-tight">
              Pengamanan yang{' '}
              <span className="bg-gradient-to-r from-amber via-amber-soft to-cyan bg-clip-text text-transparent">
                terbukti, bukan sekadar dilaporkan.
              </span>
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Sistem manajemen satuan pengamanan dan pelacakan patroli: jadwal jaga, presensi bergeofence,
              pemindaian titik, insiden, tamu, hingga laporan kepatuhan untuk klien.
            </p>

            <motion.div
              key={tick}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="panel mt-8 flex items-start gap-4 panel-pad"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan/25 bg-cyan/10">
                <Hi size={18} className="text-cyan" />
              </div>
              <div>
                <p className="text-sm font-bold">{HIGHLIGHTS[tick].title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{HIGHLIGHTS[tick].body}</p>
              </div>
            </motion.div>
            <div className="mt-4 flex gap-1.5">
              {HIGHLIGHTS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-500 ${i === tick ? 'w-8 bg-amber' : 'w-3 bg-line'}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 text-[11px] uppercase tracking-[.18em] text-muted/70">
            <span className="flex items-center gap-1.5"><MapPinned size={12} /> Geofence GPS</span>
            <span className="flex items-center gap-1.5"><QrCode size={12} /> QR &amp; NFC</span>
            <span className="flex items-center gap-1.5"><Radar size={12} /> Realtime</span>
          </div>
        </div>
      </div>

      {/* Panel kanan: formulir */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="mb-8 lg:hidden flex items-center gap-3">
            <img src="/merek/logo.png" alt="Dharmapati" className="h-12 w-auto" />
            <p className="text-lg font-extrabold tracking-[.22em]">DHARMAPATI</p>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight">Masuk ke pusat komando</h2>
          <p className="mt-1.5 text-sm text-muted">Gunakan akun yang diberikan administrator satuan.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <label>Nama pengguna / NIP</label>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nama pengguna atau NIP"
                className="w-full"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label>Kata sandi</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-amber"
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {err && (
              <motion.p
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
              >
                {err}
              </motion.p>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {busy ? 'Memverifikasi…' : 'Masuk'}
            </button>
          </form>

          <p className="mt-8 text-center text-[11.5px] leading-relaxed text-muted">
            Lupa kata sandi atau belum punya akun? Hubungi administrator satuan.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
