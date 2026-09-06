/**
 * Layanan pengenalan wajah DHARMAPATI.
 *
 * Dipisah dari backend agar pustaka model yang berat tidak membebani API utama.
 * Menerima gambar, mendeteksi wajah, lalu mengembalikan vektor ciri 128 dimensi.
 * Pencocokan (jarak euclidean) dilakukan di sisi backend.
 */
const express = require('express');
const multer = require('multer');
const tf = require('@tensorflow/tfjs-node');
const faceapi = require('@vladmandic/face-api');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const PORT = Number(process.env.PORT || 5028);
const MODEL_DIR = process.env.MODEL_DIR || path.join(__dirname, 'node_modules/@vladmandic/face-api/model');

let siap = false;

async function muatModel() {
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);
  siap = true;
  console.log('▸ Model pengenalan wajah dimuat dari', MODEL_DIR);
}

/** Menghitung vektor ciri dari satu gambar. */
async function ciriWajah(buffer) {
  const tensor = tf.node.decodeImage(buffer, 3);
  try {
    const hasil = await faceapi
      .detectSingleFace(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!hasil) return { terdeteksi: false };
    return {
      terdeteksi: true,
      descriptor: Array.from(hasil.descriptor),
      confidence: Number(hasil.detection.score.toFixed(4)),
    };
  } finally {
    tensor.dispose();
  }
}

app.get('/health', (_req, res) => res.json({ status: siap ? 'ok' : 'memuat', service: 'patroli-face' }));

app.post('/descriptor', upload.single('file'), async (req, res) => {
  if (!siap) return res.status(503).json({ message: 'Model belum siap' });
  if (!req.file) return res.status(400).json({ message: 'Berkas gambar tidak ditemukan' });
  try {
    const hasil = await ciriWajah(req.file.buffer);
    if (!hasil.terdeteksi)
      return res.status(422).json({ message: 'Wajah tidak terdeteksi pada foto', terdeteksi: false });
    res.json(hasil);
  } catch (e) {
    console.error('[face]', e);
    res.status(500).json({ message: 'Gagal memproses gambar: ' + e.message });
  }
});

muatModel()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`▸ Layanan wajah siap di :${PORT}`)))
  .catch((e) => {
    console.error('[face] gagal memuat model:', e);
    process.exit(1);
  });
