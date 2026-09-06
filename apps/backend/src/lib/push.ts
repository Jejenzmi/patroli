import fs from 'fs';
import admin from 'firebase-admin';
import { prisma } from './prisma';

/**
 * Pemberitahuan dorong lewat Firebase Cloud Messaging.
 *
 * Layanan latar depan menjaga aplikasi hidup selama shift, tetapi hanya
 * selama shift. Sinyal darurat pukul dua pagi harus tetap membangunkan ponsel
 * pengawas yang aplikasinya tertutup penuh — bahkan ponsel yang baru selesai
 * dinyalakan ulang. Hanya FCM yang bisa melakukannya, karena yang membangunkan
 * bukan aplikasi kita melainkan layanan Google yang memang selalu berjalan.
 *
 * Bila kredensial tidak dipasang, seluruh fungsi di berkas ini diam saja:
 * pemberitahuan tetap tersimpan di basis data dan tetap terlihat saat aplikasi
 * dibuka. Sistem tidak boleh gagal hanya karena pengiriman dorong mati.
 */

let siap = false;

export function pushAktif() {
  return siap;
}

export function siapkanPush() {
  const jalur = process.env.FIREBASE_CREDENTIALS;
  if (!jalur) {
    console.log('▸ Pemberitahuan dorong nonaktif — FIREBASE_CREDENTIALS belum diisi');
    return;
  }
  try {
    const isi = JSON.parse(fs.readFileSync(jalur, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(isi) });
    siap = true;
    console.log(`▸ Pemberitahuan dorong aktif — proyek ${isi.project_id}`);
  } catch (e: any) {
    console.warn('[push] gagal menyiapkan Firebase:', e.message);
  }
}

/** Kanal pemberitahuan di ponsel; darurat sengaja dipisah agar berbunyi nyaring. */
export type KanalPush = 'darurat' | 'umum';

export interface IsiPush {
  title: string;
  body: string;
  kanal?: KanalPush;
  data?: Record<string, string>;
}

/**
 * Mengirim ke seluruh perangkat milik daftar pengguna.
 *
 * Token yang ditolak Firebase dibersihkan: token menjadi tidak sah saat
 * aplikasi dicopot atau datanya dihapus, dan menyimpannya hanya membuat
 * pengiriman berikutnya makin lambat.
 */
export async function kirimPush(userIds: string[], isi: IsiPush) {
  if (!siap) return { terkirim: 0, gagal: 0 };
  const unik = [...new Set(userIds)].filter(Boolean);
  if (!unik.length) return { terkirim: 0, gagal: 0 };

  const pengguna = await prisma.user.findMany({
    where: { id: { in: unik }, deviceToken: { not: null } },
    select: { id: true, deviceToken: true },
  });
  const token = pengguna.map((p) => p.deviceToken!).filter(Boolean);
  if (!token.length) return { terkirim: 0, gagal: 0 };

  const darurat = isi.kanal === 'darurat';

  try {
    const hasil = await admin.messaging().sendEachForMulticast({
      tokens: token,
      notification: { title: isi.title, body: isi.body },
      data: { ...(isi.data ?? {}), kanal: isi.kanal ?? 'umum' },
      android: {
        priority: 'high',
        notification: {
          channelId: darurat ? 'dharmapati_darurat' : 'dharmapati_umum',
          sound: 'default',
          // Pemberitahuan darurat menembus ringkasan dan tetap muncul utuh.
          visibility: 'public',
          defaultVibrateTimings: true,
        },
      },
    });

    // Hanya token yang benar-benar sudah tidak terdaftar yang dibuang.
    // `invalid-argument` sengaja tidak ikut: galat itu juga muncul bila isi
    // pesannya yang keliru, dan membuangnya akan menghapus token yang sah
    // sehingga ponsel itu diam-diam berhenti menerima pemberitahuan.
    const mati: string[] = [];
    hasil.responses.forEach((r, i) => {
      const kode = String((r.error as any)?.code ?? '');
      if (!r.success && kode.includes('registration-token-not-registered')) {
        mati.push(token[i]);
      }
    });
    if (mati.length) {
      await prisma.user.updateMany({
        where: { deviceToken: { in: mati } },
        data: { deviceToken: null },
      });
    }

    return { terkirim: hasil.successCount, gagal: hasil.failureCount };
  } catch (e: any) {
    console.warn('[push] gagal mengirim:', e.message);
    return { terkirim: 0, gagal: token.length };
  }
}
