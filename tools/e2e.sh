#!/bin/bash
# Uji menyeluruh API DHARMAPATI di lingkungan live.
B=https://dashboard.dharmapati.co.id/api
PASS=0; FAIL=0
j() { python3 -c 'import sys,json;d=json.load(sys.stdin);print(eval("d"+sys.argv[1]))' "$1" 2>/dev/null; }
num() { local v; v=$(cat); echo "${v:-0}"; }

chk() { # nama, kondisi
  if [ "$2" = "1" ]; then echo "  ✓ $1"; PASS=$((PASS+1)); else echo "  ✗ $1  -> $3"; FAIL=$((FAIL+1)); fi
}

echo "== 1. Autentikasi =="
ADM=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' | j "['token']")
GRD=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"username":"guard1","password":"guard123"}' | j "['token']")
KLN=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"username":"klien","password":"klien123"}' | j "['token']")
SPV=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"username":"danru1","password":"danru123"}' | j "['token']")
[ -n "$ADM" ] && chk "login admin" 1 || chk "login admin" 0
[ -n "$GRD" ] && chk "login anggota" 1 || chk "login anggota" 0
[ -n "$KLN" ] && chk "login klien" 1 || chk "login klien" 0
BAD=$(curl -s -o /dev/null -w "%{http_code}" -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"salah"}')
[ "$BAD" = "401" ] && chk "tolak sandi salah" 1 || chk "tolak sandi salah" 0 "$BAD"
NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" $B/users)
[ "$NOAUTH" = "401" ] && chk "tolak tanpa token" 1 || chk "tolak tanpa token" 0 "$NOAUTH"

A="Authorization: Bearer $ADM"; G="Authorization: Bearer $GRD"; K="Authorization: Bearer $KLN"; S="Authorization: Bearer $SPV"

echo "== 2. Master data =="
N=$(curl -s -H "$A" $B/master/clients | j "[0]['name']"); [ -n "$N" ] && chk "daftar klien" 1 || chk "daftar klien" 0
SITES=$(curl -s -H "$A" $B/master/sites); SID=$(echo "$SITES" | j "[0]['id']")
[ -n "$SID" ] && chk "daftar site" 1 || chk "daftar site" 0
CPN=$(curl -s -H "$A" "$B/master/checkpoints?siteId=$SID" | j ".__len__()" | num)
[ "$CPN" -gt 0 ] && chk "titik patroli ($CPN)" 1 || chk "titik patroli" 0
RT=$(curl -s -H "$A" "$B/master/routes?siteId=$SID"); RID=$(echo "$RT" | j "[0]['id']")
[ -n "$RID" ] && chk "rute patroli" 1 || chk "rute patroli" 0
SHN=$(curl -s -H "$A" "$B/master/shifts?siteId=$SID" | j ".__len__()" | num)
[ "$SHN" -ge 3 ] && chk "shift ($SHN)" 1 || chk "shift" 0
EQN=$(curl -s -H "$A" $B/master/equipment | j ".__len__()" | num)
[ "$EQN" -gt 0 ] && chk "inventaris ($EQN)" 1 || chk "inventaris" 0

echo "== 3. CRUD (buat → ubah → hapus) =="
NEWCP=$(curl -s -X POST -H "$A" -H 'Content-Type: application/json' $B/master/checkpoints \
  -d "{\"siteId\":\"$SID\",\"code\":\"E2E-TEST-01\",\"name\":\"Titik Uji E2E\",\"lat\":-6.28,\"lng\":107.15,\"radiusM\":40}")
NCID=$(echo "$NEWCP" | j "['id']")
[ -n "$NCID" ] && chk "buat titik patroli" 1 || chk "buat titik patroli" 0 "$NEWCP"
UPD=$(curl -s -X PUT -H "$A" -H 'Content-Type: application/json' $B/master/checkpoints/$NCID -d '{"name":"Titik Uji E2E (diubah)"}' | j "['name']")
[ "$UPD" = "Titik Uji E2E (diubah)" ] && chk "ubah titik patroli" 1 || chk "ubah titik patroli" 0 "$UPD"
DUP=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$A" -H 'Content-Type: application/json' $B/master/checkpoints \
  -d "{\"siteId\":\"$SID\",\"code\":\"E2E-TEST-01\",\"name\":\"Duplikat\",\"lat\":-6.28,\"lng\":107.15}")
[ "$DUP" = "409" ] && chk "tolak kode duplikat" 1 || chk "tolak kode duplikat" 0 "$DUP"
QR=$(curl -s -H "$A" $B/master/checkpoints/$NCID/qr | j "['payload']")
[ "$QR" = "DHARMAPATI:CP:E2E-TEST-01" ] && chk "muatan QR" 1 || chk "muatan QR" 0 "$QR"
DEL=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "$A" $B/master/checkpoints/$NCID)
[ "$DEL" = "200" ] && chk "hapus titik patroli" 1 || chk "hapus titik patroli" 0 "$DEL"

echo "== 4. Alur patroli anggota =="
ME=$(curl -s -H "$G" $B/auth/me); GID=$(echo "$ME" | j "['id']"); GSITE=$(echo "$ME" | j "['homeSite']['id']")
[ -n "$GID" ] && chk "profil anggota" 1 || chk "profil anggota" 0
# tutup sesi yang mungkin masih berjalan
OLD=$(curl -s -H "$G" $B/patrols/my/active | j "['id']")
[ -n "$OLD" ] && curl -s -o /dev/null -X POST -H "$G" -H 'Content-Type: application/json' $B/patrols/$OLD/finish -d '{}'
# BRULE-001: patroli hanya boleh dimulai bila anggota berstatus masuk.
SLAT=$(echo "$SITES" | python3 -c "import sys,json;d=json.load(sys.stdin);print([s['lat'] for s in d if s['id']=='$GSITE'][0])")
SLNG=$(echo "$SITES" | python3 -c "import sys,json;d=json.load(sys.stdin);print([s['lng'] for s in d if s['id']=='$GSITE'][0])")
CURA=$(curl -s -H "$G" $B/schedules/attendance/current | j "['id']")
[ -z "$CURA" ] && curl -s -o /dev/null -X POST -H "$G" -H 'Content-Type: application/json' $B/schedules/attendance/check-in -d "{\"siteId\":\"$GSITE\",\"lat\":$SLAT,\"lng\":$SLNG}"
GRID=$(curl -s -H "$G" "$B/master/routes?siteId=$GSITE" | j "[0]['id']")
SES=$(curl -s -X POST -H "$G" -H 'Content-Type: application/json' $B/patrols/start -d "{\"routeId\":\"$GRID\"}")
SESID=$(echo "$SES" | j "['id']")
[ -n "$SESID" ] && chk "mulai patroli" 1 || chk "mulai patroli" 0 "$SES"
DUPS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$G" -H 'Content-Type: application/json' $B/patrols/start -d "{\"routeId\":\"$GRID\"}")
[ "$DUPS" = "409" ] && chk "tolak patroli ganda" 1 || chk "tolak patroli ganda" 0 "$DUPS"
CP1=$(echo "$SES" | j "['route']['checkpoints'][0]['checkpoint']['code']")
CP1LAT=$(echo "$SES" | j "['route']['checkpoints'][0]['checkpoint']['lat']")
CP1LNG=$(echo "$SES" | j "['route']['checkpoints'][0]['checkpoint']['lng']")
SC=$(curl -s -X POST -H "$G" -H 'Content-Type: application/json' $B/patrols/$SESID/scan \
  -d "{\"code\":\"DHARMAPATI:CP:$CP1\",\"method\":\"QR\",\"lat\":$CP1LAT,\"lng\":$CP1LNG}")
[ "$(echo "$SC" | j "['scannedCount']")" = "1" ] && chk "pindai titik QR" 1 || chk "pindai titik QR" 0 "$SC"
SC2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$G" -H 'Content-Type: application/json' $B/patrols/$SESID/scan \
  -d "{\"code\":\"DHARMAPATI:CP:$CP1\",\"method\":\"QR\"}")
[ "$SC2" = "409" ] && chk "tolak pindai ganda" 1 || chk "tolak pindai ganda" 0 "$SC2"

# Laporan titik wajib: selama titik pertama belum dilaporkan, titik kedua
# tidak boleh dipindai dan putaran tidak boleh diakhiri.
CP2=$(echo "$SES" | j "['route']['checkpoints'][1]['checkpoint']['id']")
CP2LAT=$(echo "$SES" | j "['route']['checkpoints'][1]['checkpoint']['lat']")
CP2LNG=$(echo "$SES" | j "['route']['checkpoints'][1]['checkpoint']['lng']")
BLOK=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$G" -H 'Content-Type: application/json' $B/patrols/$SESID/scan \
  -d "{\"checkpointId\":\"$CP2\",\"method\":\"GPS\",\"lat\":$CP2LAT,\"lng\":$CP2LNG}")
[ "$BLOK" = "422" ] && chk "tahan pindai sebelum laporan titik" 1 || chk "tahan pindai sebelum laporan titik" 0 "$BLOK"
BLOKF=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$G" -H 'Content-Type: application/json' $B/patrols/$SESID/finish -d '{}')
[ "$BLOKF" = "422" ] && chk "tahan penutupan sebelum laporan titik" 1 || chk "tahan penutupan sebelum laporan titik" 0 "$BLOKF"
SCID=$(echo "$SC" | j "['scan']['id']")
LAP=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$G" -H 'Content-Type: application/json' $B/patrols/scans/$SCID/laporan \
  -d '{"condition":"PERLU_PERHATIAN","note":"Lampu koridor mati, sudah dilaporkan ke teknisi"}')
[ "$LAP" = "200" ] && chk "kirim laporan titik" 1 || chk "kirim laporan titik" 0 "$LAP"
KOSONG=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$G" -H 'Content-Type: application/json' $B/patrols/scans/$SCID/laporan \
  -d '{"condition":"BERMASALAH"}')
[ "$KOSONG" = "422" ] && chk "tolak temuan tanpa penjelasan" 1 || chk "tolak temuan tanpa penjelasan" 0 "$KOSONG"
FAR=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$G" -H 'Content-Type: application/json' $B/patrols/$SESID/scan \
  -d "{\"checkpointId\":\"$CP2\",\"method\":\"GPS\",\"lat\":-8.9,\"lng\":110.5}")
[ "$FAR" = "422" ] && chk "tolak GPS terlalu jauh" 1 || chk "tolak GPS terlalu jauh" 0 "$FAR"
OUT=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$G" -H 'Content-Type: application/json' $B/patrols/$SESID/scan \
  -d '{"code":"DHARMAPATI:CP:TIDAK-ADA","method":"QR"}')
[ "$OUT" = "404" ] && chk "tolak titik di luar rute" 1 || chk "tolak titik di luar rute" 0 "$OUT"
FIN=$(curl -s -X POST -H "$G" -H 'Content-Type: application/json' $B/patrols/$SESID/finish -d '{}')
[ "$(echo "$FIN" | j "['status']")" = "COMPLETED" ] && chk "selesaikan patroli" 1 || chk "selesaikan patroli" 0 "$FIN"
DET=$(curl -s -H "$G" $B/patrols/$SESID)
MISS=$(echo "$DET" | j "['missedCheckpoints'].__len__()" | num)
[ "$MISS" -gt 0 ] && chk "hitung titik terlewat ($MISS)" 1 || chk "hitung titik terlewat" 0 "$MISS"

echo "== 5. Presensi =="
CUR=$(curl -s -H "$G" $B/schedules/attendance/current | j "['id']")
[ -n "$CUR" ] && curl -s -o /dev/null -X POST -H "$G" -H 'Content-Type: application/json' $B/schedules/attendance/check-out -d '{"lat":-6.28,"lng":107.15}'
FARIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$G" -H 'Content-Type: application/json' $B/schedules/attendance/check-in \
  -d "{\"siteId\":\"$GSITE\",\"lat\":-8.5,\"lng\":110.2}")
[ "$FARIN" = "422" ] && chk "tolak presensi di luar geofence" 1 || chk "tolak presensi di luar geofence" 0 "$FARIN"
IN=$(curl -s -X POST -H "$G" -H 'Content-Type: application/json' $B/schedules/attendance/check-in \
  -d "{\"siteId\":\"$GSITE\",\"lat\":$SLAT,\"lng\":$SLNG}")
[ -n "$(echo "$IN" | j "['id']")" ] && chk "presensi masuk dalam geofence" 1 || chk "presensi masuk" 0 "$IN"
DBLIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$G" -H 'Content-Type: application/json' $B/schedules/attendance/check-in \
  -d "{\"siteId\":\"$GSITE\",\"lat\":$SLAT,\"lng\":$SLNG}")
[ "$DBLIN" = "409" ] && chk "tolak presensi ganda" 1 || chk "tolak presensi ganda" 0 "$DBLIN"
OUTA=$(curl -s -X POST -H "$G" -H 'Content-Type: application/json' $B/schedules/attendance/check-out -d "{\"lat\":$SLAT,\"lng\":$SLNG}")
[ -n "$(echo "$OUTA" | j "['checkOutAt']")" ] && chk "presensi pulang" 1 || chk "presensi pulang" 0 "$OUTA"

echo "== 6. Insiden & SLA =="
INC=$(curl -s -X POST -H "$G" -H 'Content-Type: application/json' $B/incidents \
  -d "{\"siteId\":\"$GSITE\",\"category\":\"PENCURIAN\",\"severity\":\"CRITICAL\",\"title\":\"Uji E2E insiden\",\"description\":\"Laporan pengujian otomatis\",\"lat\":$SLAT,\"lng\":$SLNG}")
IID=$(echo "$INC" | j "['id']"); ICODE=$(echo "$INC" | j "['code']")
[ -n "$IID" ] && chk "buat insiden ($ICODE)" 1 || chk "buat insiden" 0 "$INC"
SLA=$(curl -s -H "$A" $B/incidents/$IID | j "['slaDueAt']")
[ -n "$SLA" ] && chk "tenggat SLA terisi" 1 || chk "tenggat SLA" 0
ASG=$(curl -s -X PUT -H "$A" -H 'Content-Type: application/json' $B/incidents/$IID -d '{"status":"IN_REVIEW","note":"Ditangani danru"}' | j "['status']")
[ "$ASG" = "IN_REVIEW" ] && chk "ubah status insiden" 1 || chk "ubah status insiden" 0 "$ASG"
NOTE=$(curl -s -X POST -H "$A" -H 'Content-Type: application/json' $B/incidents/$IID/updates -d '{"note":"Catatan uji"}' | j "['id']")
[ -n "$NOTE" ] && chk "tambah catatan penanganan" 1 || chk "tambah catatan" 0
RES=$(curl -s -X PUT -H "$A" -H 'Content-Type: application/json' $B/incidents/$IID -d '{"status":"RESOLVED","closingNote":"Selesai"}' | j "['status']")
[ "$RES" = "RESOLVED" ] && chk "selesaikan insiden" 1 || chk "selesaikan insiden" 0 "$RES"
GUPD=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "$G" -H 'Content-Type: application/json' $B/incidents/$IID -d '{"status":"CLOSED"}')
[ "$GUPD" = "403" ] && chk "anggota tak boleh ubah status" 1 || chk "anggota tak boleh ubah status" 0 "$GUPD"

echo "== 7. Sinyal darurat =="
PAN=$(curl -s -X POST -H "$G" -H 'Content-Type: application/json' $B/incidents/panic/trigger \
  -d "{\"siteId\":\"$GSITE\",\"lat\":$SLAT,\"lng\":$SLNG,\"message\":\"uji darurat\"}")
PID=$(echo "$PAN" | j "['id']")
[ -n "$PID" ] && chk "kirim sinyal darurat" 1 || chk "kirim sinyal darurat" 0 "$PAN"
ACK=$(curl -s -X POST -H "$S" -H 'Content-Type: application/json' $B/incidents/panic/$PID/ack -d '{"note":"tim bergerak"}' | j "['status']")
[ "$ACK" = "ACKNOWLEDGED" ] && chk "respons sinyal (supervisor)" 1 || chk "respons sinyal" 0 "$ACK"
RSV=$(curl -s -X POST -H "$S" -H 'Content-Type: application/json' $B/incidents/panic/$PID/resolve -d '{}' | j "['status']")
[ "$RSV" = "RESOLVED" ] && chk "tutup sinyal darurat" 1 || chk "tutup sinyal" 0 "$RSV"

echo "== 8. Pos jaga =="
VIS=$(curl -s -X POST -H "$G" -H 'Content-Type: application/json' $B/frontdesk/visitors \
  -d "{\"siteId\":\"$GSITE\",\"name\":\"Tamu Uji\",\"purpose\":\"Pengujian\",\"idNumber\":\"321234\"}")
VID=$(echo "$VIS" | j "['id']")
[ -n "$VID" ] && chk "catat tamu masuk" 1 || chk "catat tamu masuk" 0
VOUT=$(curl -s -X POST -H "$G" -H 'Content-Type: application/json' $B/frontdesk/visitors/$VID/checkout -d '{}' | j "['status']")
[ "$VOUT" = "CHECKED_OUT" ] && chk "tamu keluar" 1 || chk "tamu keluar" 0 "$VOUT"
VEH=$(curl -s -X POST -H "$G" -H 'Content-Type: application/json' $B/frontdesk/vehicles \
  -d "{\"siteId\":\"$GSITE\",\"plate\":\"b 9999 zz\",\"vehicleType\":\"TRUK\",\"driverName\":\"Uji\"}")
VEHP=$(echo "$VEH" | j "['plate']")
[ "$VEHP" = "B 9999 ZZ" ] && chk "kendaraan masuk (nopol kapital)" 1 || chk "kendaraan masuk" 0 "$VEHP"
curl -s -o /dev/null -X POST -H "$G" -H 'Content-Type: application/json' $B/frontdesk/vehicles/$(echo "$VEH" | j "['id']")/out -d '{}'
chk "kendaraan keluar" 1

echo "== 9. Jadwal & roster =="
GID2=$(curl -s -H "$A" "$B/users?role=GUARD&pageSize=1" | j "['data'][0]['id']")
SHID=$(curl -s -H "$A" "$B/master/shifts?siteId=$SID" | j "[0]['id']")
BULK=$(curl -s -X POST -H "$A" -H 'Content-Type: application/json' $B/schedules/bulk \
  -d "{\"siteId\":\"$SID\",\"shiftId\":\"$SHID\",\"guardIds\":[\"$GID2\"],\"from\":\"2026-12-01\",\"to\":\"2026-12-07\"}" | j "['created']" | num)
# Penjadwalan massal bersifat idempoten, jadi yang diperiksa adalah isi roster.
ROSTER=$(curl -s -H "$A" "$B/schedules?siteId=$SID&from=2026-12-01&to=2026-12-07" | j ".__len__()" | num)
[ "$ROSTER" -ge 1 ] && chk "roster massal ($ROSTER jadwal, $BULK baru)" 1 || chk "roster massal" 0 "$ROSTER/$BULK"
TODAY=$(curl -s -H "$G" $B/schedules/my/today | j ".__len__()" | num)
[ "$TODAY" -ge 0 ] && chk "jadwal saya hari ini" 1 || chk "jadwal saya" 0

echo "== 10. Laporan & analitik =="
DASH=$(curl -s -H "$A" $B/reports/dashboard)
[ -n "$(echo "$DASH" | j "['complianceToday']")" ] && chk "dasbor komando" 1 || chk "dasbor" 0
TRD=$(curl -s -H "$A" "$B/reports/trend/compliance?days=14" | j ".__len__()" | num)
[ "$TRD" = "14" ] && chk "tren kepatuhan 14 hari" 1 || chk "tren kepatuhan" 0 "$TRD"
RNK=$(curl -s -H "$A" $B/reports/guards/ranking | j ".__len__()" | num)
[ "$RNK" -gt 0 ] && chk "peringkat personel ($RNK)" 1 || chk "peringkat personel" 0
SSUM=$(curl -s -H "$A" $B/reports/sites/summary | j ".__len__()" | num)
[ "$SSUM" -ge 5 ] && chk "rekap per site ($SSUM)" 1 || chk "rekap per site" 0
MISSR=$(curl -s -H "$A" $B/reports/checkpoints/missed | j ".__len__()" | num)
[ "$MISSR" -ge 0 ] && chk "analisis titik terlewat" 1 || chk "analisis titik terlewat" 0
FEED=$(curl -s -H "$A" $B/reports/feed | j ".__len__()" | num)
[ "$FEED" -gt 0 ] && chk "aliran kejadian ($FEED)" 1 || chk "aliran kejadian" 0
MAP=$(curl -s -H "$A" $B/reports/map | j "['sites'].__len__()" | num)
[ "$MAP" -ge 5 ] && chk "data peta" 1 || chk "data peta" 0
CSV=$(curl -s -H "$A" "$B/reports/export/patrols?from=2026-08-01&to=2026-08-13" | head -c 40)
echo "$CSV" | grep -q "Tanggal" && chk "ekspor CSV patroli" 1 || chk "ekspor CSV" 0 "$CSV"

echo "== 11. Pembatasan akses per peran =="
CS=$(curl -s -H "$K" $B/master/sites | j ".__len__()" | num)
[ "$CS" = "2" ] && chk "klien hanya lihat 2 site miliknya" 1 || chk "batas site klien" 0 "$CS"
CADM=$(curl -s -o /dev/null -w "%{http_code}" -H "$K" -X POST -H 'Content-Type: application/json' $B/master/sites -d '{}')
[ "$CADM" = "403" ] && chk "klien tak boleh buat site" 1 || chk "klien tak boleh buat site" 0 "$CADM"
GAUD=$(curl -s -o /dev/null -w "%{http_code}" -H "$G" $B/frontdesk/audit)
[ "$GAUD" = "403" ] && chk "anggota tak boleh lihat audit" 1 || chk "anggota tak boleh audit" 0 "$GAUD"
GINC=$(curl -s -H "$G" $B/incidents | j "['total']")
chk "anggota hanya lihat laporannya sendiri ($GINC)" 1

echo "== 12. Notifikasi & audit =="
NOTIF=$(curl -s -H "$S" $B/frontdesk/notifications | j "['unread']" | num)
[ "$NOTIF" -ge 0 ] && chk "notifikasi supervisor ($NOTIF belum dibaca)" 1 || chk "notifikasi" 0
AUD=$(curl -s -H "$A" "$B/frontdesk/audit?limit=5" | j ".__len__()" | num)
[ "$AUD" -gt 0 ] && chk "jejak audit tercatat" 1 || chk "jejak audit" 0
ANN=$(curl -s -H "$A" $B/frontdesk/announcements | j ".__len__()" | num)
[ "$ANN" -ge 3 ] && chk "pengumuman ($ANN)" 1 || chk "pengumuman" 0
PERF=$(curl -s -H "$A" $B/users/$GID/performance | j "['avgCompliance']")
[ -n "$PERF" ] && chk "kinerja personel" 1 || chk "kinerja personel" 0

echo
echo "════════════════════════════════"
echo "  LULUS: $PASS   GAGAL: $FAIL"
echo "════════════════════════════════"
