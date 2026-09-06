import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserCog, KeyRound, Smartphone, LogOut, ShieldCheck, BookOpen } from 'lucide-react';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Avatar, Field, Loading } from '../components/ui';
import { ask } from '../components/confirm';
import { d, dt, label } from '../lib/format';

export default function Profile() {
  const { me, logout } = useAuth();
  const [pw, setPw] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['me-full'], queryFn: () => api.get('/auth/me') });

  const changePw = async () => {
    if (pw.newPassword.length < 6) return toast.err('Kata sandi baru minimal 6 karakter');
    if (pw.newPassword !== pw.confirm) return toast.err('Konfirmasi kata sandi tidak cocok');
    if (!(await ask.save('kata sandi akun Anda'))) return;
    setBusy(true);
    try {
      await api.post('/auth/change-password', { oldPassword: pw.oldPassword, newPassword: pw.newPassword });
      toast.ok('Kata sandi diperbarui');
      setPw({ oldPassword: '', newPassword: '', confirm: '' });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <Loading />;

  return (
    <>
      <PageHead crumb="Akun" title="Profil Saya" desc="Informasi akun dan pengaturan keamanan." />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Panel bodyClass="p-6 text-center">
          <div className="flex justify-center">
            <Avatar name={data?.name} url={data?.avatarUrl} size={92} ring="ring-2 ring-amber/30" />
          </div>
          <h2 className="mt-4 text-xl font-extrabold">{data?.name}</h2>
          <p className="num mt-0.5 text-sm text-muted">{data?.employeeId || data?.username}</p>
          <span className="chip mt-3 border-amber/40 bg-amber/10 text-amber">
            <ShieldCheck size={11} /> {label(data?.role)}
          </span>

          <div className="mt-6 space-y-2 text-left">
            {[
              { l: 'Pangkat / Jabatan', v: data?.rank || '—' },
              { l: 'Penempatan', v: data?.homeSite?.name || data?.client?.name || '—' },
              { l: 'Telepon', v: data?.phone || '—' },
              { l: 'Surel', v: data?.email || '—' },
              { l: 'Bergabung', v: d(data?.joinedAt) },
              { l: 'Masuk terakhir', v: dt(data?.lastLoginAt) },
            ].map((x) => (
              <div key={x.l} className="flex items-center justify-between rounded-xl border border-line/70 bg-abyss/40 px-4 py-2.5">
                <span className="text-[11px] uppercase tracking-[.13em] text-muted">{x.l}</span>
                <span className="text-[13px] font-semibold">{x.v}</span>
              </div>
            ))}
          </div>

          <button
            className="btn-danger mt-6 w-full"
            onClick={async () => {
              if (await ask.logout()) logout();
            }}
          >
            <LogOut size={14} /> Keluar dari Sesi
          </button>
        </Panel>

        <div className="space-y-4">
          <Panel title="Ubah Kata Sandi" icon={KeyRound}>
            <div className="space-y-4">
              <Field label="Kata sandi saat ini">
                <input type="password" className="w-full" value={pw.oldPassword} onChange={(e) => setPw({ ...pw, oldPassword: e.target.value })} />
              </Field>
              <Field label="Kata sandi baru" hint="Minimal 6 karakter.">
                <input type="password" className="w-full" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
              </Field>
              <Field label="Ulangi kata sandi baru">
                <input type="password" className="w-full" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </Field>
              <button className="btn-primary w-full" onClick={changePw} disabled={busy}>
                {busy ? 'Menyimpan…' : 'Perbarui Kata Sandi'}
              </button>
            </div>
          </Panel>

          <Panel title="Aplikasi Lapangan" icon={Smartphone}>
            <p className="text-[13px] leading-relaxed text-muted">
              Anggota di lapangan menggunakan aplikasi Android DHARMAPATI untuk presensi bergeofence,
              pemindaian titik patroli via QR/NFC, pelaporan insiden bergambar, dan tombol darurat.
            </p>
            <a href="/DHARMAPATI.apk" className="btn-ghost mt-4 w-full" download>
              <Smartphone size={14} /> Unduh Aplikasi Android (APK)
            </a>
          </Panel>

          <Panel title="Panduan Penggunaan" icon={BookOpen}>
            <p className="text-[13px] leading-relaxed text-muted">
              Panduan lengkap 51 halaman untuk pengguna web dan aplikasi lapangan: langkah demi
              langkah tiap modul, alur kerja harian, dan pemecahan masalah yang sering terjadi.
            </p>
            <a
              href="/Panduan-Penggunaan-DHARMAPATI.pdf"
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-4 w-full"
            >
              <BookOpen size={14} /> Buka Panduan Penggunaan (PDF)
            </a>
          </Panel>
        </div>
      </div>
    </>
  );
}
