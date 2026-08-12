import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../core/theme.dart';

/// Pemindai QR titik patroli. Mengembalikan isi kode ke pemanggil.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> with SingleTickerProviderStateMixin {
  final _controller = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates);
  bool _handled = false;
  late final AnimationController _line =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat(reverse: true);

  @override
  void dispose() {
    _line.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Pindai Titik Patroli'),
        actions: [
          IconButton(
            onPressed: () => _controller.toggleTorch(),
            icon: const Icon(Icons.flashlight_on_outlined, size: 20),
          ),
          IconButton(
            onPressed: () => _controller.switchCamera(),
            icon: const Icon(Icons.cameraswitch_outlined, size: 20),
          ),
        ],
      ),
      extendBodyBehindAppBar: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: (capture) {
              if (_handled) return;
              final raw = capture.barcodes.firstOrNull?.rawValue;
              if (raw == null || raw.isEmpty) return;
              _handled = true;
              Navigator.pop(context, raw);
            },
          ),

          // Bingkai pemindaian
          Center(
            child: SizedBox(
              width: 250,
              height: 250,
              child: Stack(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: P.amber.withOpacity(.85), width: 2),
                      borderRadius: BorderRadius.circular(22),
                    ),
                  ),
                  AnimatedBuilder(
                    animation: _line,
                    builder: (_, __) => Positioned(
                      top: 12 + _line.value * 222,
                      left: 14,
                      right: 14,
                      child: Container(
                        height: 2,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [
                            Colors.transparent,
                            P.amber.withOpacity(.9),
                            Colors.transparent,
                          ]),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          Positioned(
            left: 24,
            right: 24,
            bottom: 48,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                  decoration: BoxDecoration(
                    color: P.abyss.withOpacity(.85),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: P.line),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.qr_code_2, color: P.amber, size: 20),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Arahkan kamera ke stiker QR pada titik patroli. Kode akan terbaca otomatis.',
                          style: TextStyle(color: P.ink, fontSize: 12, height: 1.45),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                TextButton.icon(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, size: 16, color: P.muted),
                  label: const Text('Batalkan', style: TextStyle(color: P.muted)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
