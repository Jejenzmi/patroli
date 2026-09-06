import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Crosshair, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/store';
import { Field, Select, Input } from './ui';

/**
 * Alamat berjenjang: Provinsi → Kabupaten/Kota → Kecamatan → Desa/Kelurahan.
 *
 * Daftarnya diambil dari basis data sendiri (Kepmendagri 2025), bukan layanan
 * luar, sehingga pengisian alamat tetap jalan walau jaringan keluar terganggu.
 * Nama wilayah ikut disimpan bersama kodenya agar laporan tidak perlu
 * menggabung tabel hanya untuk menampilkan alamat.
 */

export interface NilaiWilayah {
  provinceCode?: string | null;
  provinceName?: string | null;
  regencyCode?: string | null;
  regencyName?: string | null;
  districtCode?: string | null;
  districtName?: string | null;
  villageCode?: string | null;
  villageName?: string | null;
  postalCode?: string | null;
  address?: string | null;
}

interface Wilayah {
  code: string;
  name: string;
  level: number;
}

function useWilayah(parent: string | null | undefined, aktif: boolean) {
  return useQuery<Wilayah[]>({
    queryKey: ['wilayah', parent ?? 'root'],
    queryFn: () => api.get(`/master/wilayah${parent ? `?parent=${parent}` : ''}`),
    enabled: aktif,
    staleTime: 60 * 60 * 1000,
  });
}

export function PilihWilayah({
  nilai,
  onChange,
  wajib,
}: {
  nilai: NilaiWilayah;
  onChange: (v: NilaiWilayah) => void;
  wajib?: boolean;
}) {
  const provinsi = useWilayah(null, true);
  const kabupaten = useWilayah(nilai.provinceCode, !!nilai.provinceCode);
  const kecamatan = useWilayah(nilai.regencyCode, !!nilai.regencyCode);
  const desa = useWilayah(nilai.districtCode, !!nilai.districtCode);

  const pilih = (
    tingkat: 'province' | 'regency' | 'district' | 'village',
    daftar: Wilayah[] | undefined,
    code: string
  ) => {
    const w = (daftar || []).find((x) => x.code === code);
    // Memilih ulang tingkat atas menghapus tingkat di bawahnya — alamat
    // setengah jadi lebih berbahaya daripada alamat kosong.
    if (tingkat === 'province')
      onChange({
        ...nilai,
        provinceCode: code || null,
        provinceName: w?.name || null,
        regencyCode: null, regencyName: null,
        districtCode: null, districtName: null,
        villageCode: null, villageName: null,
      });
    else if (tingkat === 'regency')
      onChange({
        ...nilai,
        regencyCode: code || null,
        regencyName: w?.name || null,
        districtCode: null, districtName: null,
        villageCode: null, villageName: null,
      });
    else if (tingkat === 'district')
      onChange({
        ...nilai,
        districtCode: code || null,
        districtName: w?.name || null,
        villageCode: null, villageName: null,
      });
    else onChange({ ...nilai, villageCode: code || null, villageName: w?.name || null });
  };

  const opsi = (daftar: Wilayah[] | undefined, memuat: boolean, kosong: string) =>
    memuat ? (
      <option value="">Memuat…</option>
    ) : (
      <>
        <option value="">{kosong}</option>
        {(daftar || []).map((w) => (
          <option key={w.code} value={w.code}>
            {w.name}
          </option>
        ))}
      </>
    );

  return (
    <>
      <Field label={`Provinsi${wajib ? ' *' : ''}`}>
        <Select value={nilai.provinceCode || ''} onChange={(e) => pilih('province', provinsi.data, e.target.value)}>
          {opsi(provinsi.data, provinsi.isLoading, '— pilih provinsi —')}
        </Select>
      </Field>

      <Field label={`Kabupaten / Kota${wajib ? ' *' : ''}`}>
        <Select
          value={nilai.regencyCode || ''}
          disabled={!nilai.provinceCode}
          onChange={(e) => pilih('regency', kabupaten.data, e.target.value)}
        >
          {opsi(kabupaten.data, kabupaten.isFetching, nilai.provinceCode ? '— pilih kabupaten/kota —' : 'Pilih provinsi dulu')}
        </Select>
      </Field>

      <Field label={`Kecamatan${wajib ? ' *' : ''}`}>
        <Select
          value={nilai.districtCode || ''}
          disabled={!nilai.regencyCode}
          onChange={(e) => pilih('district', kecamatan.data, e.target.value)}
        >
          {opsi(kecamatan.data, kecamatan.isFetching, nilai.regencyCode ? '— pilih kecamatan —' : 'Pilih kabupaten/kota dulu')}
        </Select>
      </Field>

      <Field label={`Desa / Kelurahan${wajib ? ' *' : ''}`}>
        <Select
          value={nilai.villageCode || ''}
          disabled={!nilai.districtCode}
          onChange={(e) => pilih('village', desa.data, e.target.value)}
        >
          {opsi(desa.data, desa.isFetching, nilai.districtCode ? '— pilih desa/kelurahan —' : 'Pilih kecamatan dulu')}
        </Select>
      </Field>

      <Field label="Alamat lengkap" className="sm:col-span-2" hint="Nama jalan, nomor, RT/RW, patokan">
        <Input
          value={nilai.address || ''}
          onChange={(e) => onChange({ ...nilai, address: e.target.value })}
          placeholder="Jl. Contoh No. 12, RT 03 / RW 05, seberang masjid"
        />
      </Field>

      <Field label="Kode pos">
        <Input
          value={nilai.postalCode || ''}
          onChange={(e) => onChange({ ...nilai, postalCode: e.target.value })}
          placeholder="41361"
        />
      </Field>
    </>
  );
}

/** Ringkasan alamat satu baris — dipakai tabel dan rincian. */
export function alamatRingkas(v: NilaiWilayah): string {
  return [v.address, v.villageName, v.districtName, v.regencyName, v.provinceName, v.postalCode]
    .filter(Boolean)
    .join(', ');
}

/**
 * Koordinat: diketik sendiri atau diambil dari GPS perangkat.
 * Pengambilan GPS hanya bekerja lewat HTTPS dan setelah pengguna mengizinkan.
 */
export function KoordinatSite({
  lat,
  lng,
  onChange,
}: {
  lat: string | number | null | undefined;
  lng: string | number | null | undefined;
  onChange: (lat: string, lng: string) => void;
}) {
  const [ambil, setAmbil] = useState(false);
  const [akurasi, setAkurasi] = useState<number | null>(null);

  useEffect(() => setAkurasi(null), [lat, lng]);

  const gps = () => {
    if (!navigator.geolocation) return toast.err('Peramban ini tidak mendukung GPS');
    setAmbil(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude.toFixed(6), pos.coords.longitude.toFixed(6));
        setAkurasi(Math.round(pos.coords.accuracy));
        setAmbil(false);
        toast.ok('Koordinat terisi dari GPS', `Ketelitian sekitar ${Math.round(pos.coords.accuracy)} meter`);
      },
      (e) => {
        setAmbil(false);
        toast.err(
          'Gagal mengambil GPS',
          e.code === 1
            ? 'Izin lokasi ditolak — aktifkan lewat ikon gembok di bilah alamat'
            : 'Perangkat tidak berhasil mengunci posisi. Isi manual bila perlu.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <>
      <Field label="Latitude" hint="Contoh: -6.306000">
        <Input
          type="number"
          step="0.000001"
          value={lat ?? ''}
          onChange={(e) => onChange(e.target.value, String(lng ?? ''))}
          placeholder="-6.306000"
        />
      </Field>
      <Field label="Longitude" hint="Contoh: 107.172000">
        <Input
          type="number"
          step="0.000001"
          value={lng ?? ''}
          onChange={(e) => onChange(String(lat ?? ''), e.target.value)}
          placeholder="107.172000"
        />
      </Field>
      <div className="sm:col-span-2">
        <button type="button" className="btn-ghost btn-sm w-full justify-center" onClick={gps} disabled={ambil}>
          {ambil ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
          {ambil ? 'Mengunci posisi…' : 'Ambil dari GPS perangkat ini'}
        </button>
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
          <MapPin size={11} />
          {akurasi != null
            ? `Ketelitian sekitar ${akurasi} meter — berdirilah di titik pos jaga saat mengambilnya.`
            : 'Berdirilah di lokasi pos jaga lalu tekan tombol di atas, atau ketik koordinatnya sendiri.'}
        </p>
      </div>
    </>
  );
}
