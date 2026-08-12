const BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function token() {
  return localStorage.getItem('patroli_token') || '';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(init.headers || {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('patroli_token');
    if (!location.pathname.startsWith('/masuk')) location.href = '/masuk';
    throw new ApiError('Sesi berakhir', 401);
  }
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) throw new ApiError((data as any)?.message || 'Permintaan gagal', res.status);
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>(p),
  post: <T = any>(p: string, body?: any) =>
    request<T>(p, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  put: <T = any>(p: string, body?: any) => request<T>(p, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  del: <T = any>(p: string) => request<T>(p, { method: 'DELETE' }),
  upload: async (file: File, folder = 'umum') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);
    return request<{ url: string }>('/uploads', { method: 'POST', body: fd });
  },
  downloadCsv: async (kind: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE}/reports/export/${kind}${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!res.ok) throw new ApiError('Ekspor gagal', res.status);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `patroli-${kind}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};

export const qs = (o: Record<string, any>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};
