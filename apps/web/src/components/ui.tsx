import React from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Inbox, Loader2, ChevronRight } from 'lucide-react';
import { initials, label, STATUS_TONE, SEVERITY_TONE } from '../lib/format';
import { confirm as confirmDialog } from './confirm';

/* ── Panel ── */

export function Panel({
  title,
  action,
  children,
  className,
  bodyClass,
  icon: Icon,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClass?: string;
  icon?: any;
}) {
  return (
    <section className={clsx('panel', className)}>
      {title && (
        <header className="panel-head">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && <Icon size={15} className="text-amber shrink-0" />}
            <h2 className="panel-title truncate">{title}</h2>
          </div>
          {action}
        </header>
      )}
      <div className={clsx(bodyClass ?? 'panel-pad')}>{children}</div>
    </section>
  );
}

/* ── Lencana status ── */

export function Chip({
  value,
  tone,
  children,
  className,
}: {
  value?: string;
  tone?: 'severity' | 'status';
  children?: React.ReactNode;
  className?: string;
}) {
  const map = tone === 'severity' ? SEVERITY_TONE : STATUS_TONE;
  const cls = (value && map[value]) || 'text-muted border-line bg-white/5';
  return <span className={clsx('chip', cls, className)}>{children ?? label(value)}</span>;
}

/* ── Avatar ── */

export function Avatar({
  name,
  url,
  size = 36,
  ring,
}: {
  name?: string | null;
  url?: string | null;
  size?: number;
  ring?: string;
}) {
  return url ? (
    <img
      src={url}
      alt={name || ''}
      style={{ width: size, height: size }}
      className={clsx('rounded-xl object-cover border border-line', ring)}
    />
  ) : (
    <div
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      className={clsx(
        'rounded-xl grid place-items-center font-bold text-amber bg-amber/10 border border-amber/25',
        ring
      )}
    >
      {initials(name || '?')}
    </div>
  );
}

/* ── Kotak kosong / memuat ── */

export function Empty({ text = 'Belum ada data', hint }: { text?: string; hint?: string }) {
  return (
    <div className="py-14 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-line bg-panel2/60">
        <Inbox size={18} className="text-muted" />
      </div>
      <p className="text-sm text-muted">{text}</p>
      {hint && <p className="mt-1 text-xs text-muted/70">{hint}</p>}
    </div>
  );
}

export function Loading({ label: l = 'Memuat data…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted">
      <Loader2 size={16} className="animate-spin text-amber" />
      {l}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-white/[.05]', className)} />;
}

/* ── Modal ── */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  // Dirender ke <body>: pembungkus halaman memakai animasi transform, dan elemen
  // position:fixed di dalamnya akan terikat ke pembungkus itu, bukan ke jendela.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] grid place-items-center bg-void/80 backdrop-blur-sm p-4"
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={clsx(
              'panel w-full max-h-[90vh] overflow-hidden flex flex-col',
              wide ? 'max-w-4xl' : 'max-w-lg'
            )}
          >
            <div className="panel-head">
              <h3 className="panel-title">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto panel-pad flex-1">{children}</div>
            {footer && <div className="border-t border-line/70 px-5 py-4 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ── Kolom formulir ── */

export function Field({
  label: l,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label>{l}</label>
      {children}
      {hint && <p className="text-[11px] text-muted/70">{hint}</p>}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input ref={ref} {...props} className={clsx('w-full', props.className)} />
);

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx('w-full', props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx('w-full min-h-[90px]', props.className)} />;
}

export function SearchBox({
  value,
  onChange,
  placeholder = 'Cari…',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={clsx('relative', className)}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9"
      />
    </div>
  );
}

/* ── Tabel ── */

export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ── Progres ── */

export function Bar({ value, tone = 'amber' }: { value: number; tone?: 'amber' | 'cyan' | 'emerald' | 'danger' }) {
  const colors = {
    amber: 'bg-amber',
    cyan: 'bg-cyan',
    emerald: 'bg-emerald',
    danger: 'bg-danger',
  } as const;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[.06]">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className={clsx('h-full rounded-full', colors[tone])}
      />
    </div>
  );
}

/** Cincin persentase — dipakai untuk kepatuhan patroli. */
export function Ring({
  value,
  size = 92,
  stroke = 8,
  color = '#FFB020',
  label: l,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.07)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (v / 100) * c }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="num text-lg font-bold leading-none">{v.toFixed(0)}%</div>
        {l && <div className="mt-1 text-[9px] uppercase tracking-widest text-muted">{l}</div>}
      </div>
    </div>
  );
}

/* ── Kartu statistik ── */

export function Stat({
  label: l,
  value,
  sub,
  icon: Icon,
  tone = 'amber',
  onClick,
  pulse,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: any;
  tone?: 'amber' | 'cyan' | 'emerald' | 'violet' | 'danger';
  onClick?: () => void;
  pulse?: boolean;
}) {
  const tones = {
    amber: 'text-amber bg-amber/10 border-amber/25',
    cyan: 'text-cyan bg-cyan/10 border-cyan/25',
    emerald: 'text-emerald bg-emerald/10 border-emerald/25',
    violet: 'text-violet bg-violet/10 border-violet/25',
    danger: 'text-danger bg-danger/10 border-danger/30',
  } as const;
  return (
    <motion.div
      whileHover={{ y: -3 }}
      onClick={onClick}
      className={clsx(
        'panel scanline overflow-hidden panel-pad',
        onClick && 'cursor-pointer hover:border-amber/40 transition-colors'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[.15em] text-muted">{l}</p>
          <p className="num mt-2 text-[26px] font-extrabold leading-none text-ink">{value}</p>
          {sub && <p className="mt-2 text-xs text-muted">{sub}</p>}
        </div>
        {Icon && (
          <div className={clsx('relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border', tones[tone])}>
            <Icon size={17} />
            {pulse && (
              <span className={clsx('absolute inset-0 rounded-xl border animate-pulseRing', tones[tone])} />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Judul halaman ── */

export function PageHead({
  title,
  desc,
  children,
  crumb,
}: {
  title: string;
  desc?: string;
  children?: React.ReactNode;
  crumb?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {crumb && (
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[.18em] text-amber/80">
            {crumb} <ChevronRight size={11} />
          </p>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/**
 * Pembungkus dialog konfirmasi berbasis prop.
 * Tampilannya memakai dialog beranimasi terpusat di `confirm.tsx`.
 */
export function Confirm({
  open,
  onClose,
  onConfirm,
  title = 'Konfirmasi',
  message,
  danger,
  confirmLabel = 'Ya, lanjutkan',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  danger?: boolean;
  confirmLabel?: string;
}) {
  const seen = React.useRef(false);
  React.useEffect(() => {
    if (!open) {
      seen.current = false;
      return;
    }
    if (seen.current) return;
    seen.current = true;
    confirmDialog({
      title,
      message,
      confirmLabel,
      tone: danger ? 'danger' : 'warn',
    }).then((ok) => {
      onClose();
      if (ok) onConfirm();
    });
  }, [open]);
  return null;
}
