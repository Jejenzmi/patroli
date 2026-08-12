import { create } from 'zustand';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  AlertTriangle, Trash2, Save, LogOut, ShieldCheck, HelpCircle, Info, X,
} from 'lucide-react';

/**
 * Dialog konfirmasi terpusat.
 *
 * Dipakai lewat `await confirm({...})` dari mana pun, tanpa perlu menambah
 * state di tiap halaman. Satu <ConfirmHost/> dirender di kerangka aplikasi.
 */

export type ConfirmTone = 'danger' | 'warn' | 'save' | 'logout' | 'info';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Rincian tambahan, mis. nama data yang terdampak. */
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve?: (v: boolean) => void;
}

const useConfirmStore = create<ConfirmState>(() => ({
  open: false,
  title: '',
  message: '',
}));

/** Menampilkan dialog dan menunggu jawaban pengguna. */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.setState({ ...opts, open: true, resolve });
  });
}

/** Pintasan untuk pola yang paling sering dipakai. */
export const ask = {
  save: (what: string, detail?: string) =>
    confirm({
      title: 'Simpan perubahan?',
      message: `Perubahan pada ${what} akan disimpan dan langsung berlaku bagi seluruh pengguna.`,
      detail,
      confirmLabel: 'Ya, simpan',
      tone: 'save',
    }),
  create: (what: string, detail?: string) =>
    confirm({
      title: `Simpan ${what}?`,
      message: `Data ${what} baru akan ditambahkan ke sistem.`,
      detail,
      confirmLabel: 'Ya, simpan',
      tone: 'save',
    }),
  remove: (what: string, detail?: string) =>
    confirm({
      title: `Hapus ${what}?`,
      message: `Tindakan ini tidak dapat dibatalkan. Pastikan data ini memang sudah tidak diperlukan.`,
      detail,
      confirmLabel: 'Ya, hapus',
      tone: 'danger',
    }),
  action: (title: string, message: string, confirmLabel = 'Ya, lanjutkan', detail?: string) =>
    confirm({ title, message, detail, confirmLabel, tone: 'warn' }),
  logout: () =>
    confirm({
      title: 'Keluar dari pusat komando?',
      message: 'Sesi Anda akan diakhiri dan Anda perlu masuk kembali untuk melanjutkan pemantauan.',
      confirmLabel: 'Ya, keluar',
      tone: 'logout',
    }),
};

const TONES: Record<ConfirmTone, { icon: any; ring: string; text: string; btn: string; glow: string }> = {
  danger: {
    icon: Trash2,
    ring: 'border-danger/45 bg-danger/12',
    text: 'text-danger',
    btn: 'bg-danger text-white hover:bg-danger/85',
    glow: 'shadow-[0_0_60px_-12px_rgba(255,90,90,.55)]',
  },
  warn: {
    icon: AlertTriangle,
    ring: 'border-amber/45 bg-amber/12',
    text: 'text-amber',
    btn: 'bg-amber text-black hover:bg-amber-soft',
    glow: 'shadow-[0_0_60px_-12px_rgba(255,176,32,.5)]',
  },
  save: {
    icon: Save,
    ring: 'border-cyan/45 bg-cyan/12',
    text: 'text-cyan',
    btn: 'bg-cyan text-black hover:bg-cyan-soft',
    glow: 'shadow-[0_0_60px_-12px_rgba(34,211,238,.5)]',
  },
  logout: {
    icon: LogOut,
    ring: 'border-violet/45 bg-violet/12',
    text: 'text-violet',
    btn: 'bg-violet text-black hover:bg-violet/85',
    glow: 'shadow-[0_0_60px_-12px_rgba(167,139,250,.5)]',
  },
  info: {
    icon: Info,
    ring: 'border-emerald/45 bg-emerald/12',
    text: 'text-emerald',
    btn: 'bg-emerald text-black hover:bg-emerald/85',
    glow: 'shadow-[0_0_60px_-12px_rgba(52,211,153,.5)]',
  },
};

export function ConfirmHost() {
  const s = useConfirmStore();
  const tone = TONES[s.tone || 'warn'];
  const Icon = tone.icon;

  const close = (v: boolean) => {
    s.resolve?.(v);
    useConfirmStore.setState({ open: false, resolve: undefined });
  };

  return (
    <AnimatePresence>
      {s.open && (
        <motion.div
          key="confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[3000] grid place-items-center bg-void/85 p-4 backdrop-blur-md"
          onMouseDown={(e) => e.target === e.currentTarget && close(false)}
        >
          <motion.div
            key="confirm-panel"
            initial={{ opacity: 0, y: 26, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            onKeyDown={(e) => e.key === 'Escape' && close(false)}
            className={clsx('panel w-full max-w-[430px] overflow-hidden', tone.glow)}
          >
            {/* Pita aksen di kepala dialog */}
            <div className={clsx('h-1 w-full', tone.text.replace('text-', 'bg-'))} />

            <button
              onClick={() => close(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-muted transition hover:bg-white/5 hover:text-ink"
            >
              <X size={15} />
            </button>

            <div className="px-6 pb-6 pt-7 text-center">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.06, type: 'spring', stiffness: 420, damping: 18 }}
                className="relative mx-auto grid h-14 w-14 place-items-center"
              >
                <span className={clsx('absolute inset-0 rounded-2xl border animate-pulseRing', tone.ring)} />
                <span className={clsx('grid h-14 w-14 place-items-center rounded-2xl border', tone.ring, tone.text)}>
                  <Icon size={24} />
                </span>
              </motion.div>

              <motion.h3
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-5 text-[17px] font-extrabold tracking-tight text-ink"
              >
                {s.title}
              </motion.h3>

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 }}
                className="mt-2 text-[13px] leading-relaxed text-muted"
              >
                {s.message}
              </motion.p>

              {s.detail && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                  className="mt-4 rounded-xl border border-line/80 bg-abyss/60 px-4 py-3 text-left"
                >
                  <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink/85">
                    <HelpCircle size={13} className={clsx('mt-0.5 shrink-0', tone.text)} />
                    {s.detail}
                  </p>
                </motion.div>
              )}
            </div>

            <div className="flex gap-2.5 border-t border-line/70 bg-abyss/40 px-6 py-4">
              <button className="btn-ghost flex-1" onClick={() => close(false)}>
                {s.cancelLabel || 'Batal'}
              </button>
              <button
                autoFocus
                className={clsx(
                  'btn flex-1 font-bold shadow-[0_10px_30px_-14px_rgba(0,0,0,.9)]',
                  tone.btn
                )}
                onClick={() => close(true)}
              >
                <ShieldCheck size={15} />
                {s.confirmLabel || 'Ya, lanjutkan'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
