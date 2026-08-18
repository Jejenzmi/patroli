/// Model ringkas yang memetakan respons API PATROLI.
class MeUser {
  final String id, name, username, role;
  final String? employeeId, rank, phone, avatarUrl;
  final SiteLite? homeSite;

  /// Wajah sudah didaftarkan pengawas sehingga presensi wajib berswafoto.
  final bool faceEnrolled;

  MeUser({
    required this.id,
    required this.name,
    required this.username,
    required this.role,
    this.employeeId,
    this.rank,
    this.phone,
    this.avatarUrl,
    this.homeSite,
    this.faceEnrolled = false,
  });

  factory MeUser.fromJson(Map<String, dynamic> j) => MeUser(
        id: j['id'],
        name: j['name'] ?? '',
        username: j['username'] ?? '',
        role: j['role'] ?? 'GUARD',
        employeeId: j['employeeId'],
        rank: j['rank'],
        phone: j['phone'],
        avatarUrl: j['avatarUrl'],
        homeSite: j['homeSite'] != null ? SiteLite.fromJson(j['homeSite']) : null,
        faceEnrolled: j['faceEnrolledAt'] != null || j['faceEnrolled'] == true,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'username': username,
        'role': role,
        'employeeId': employeeId,
        'rank': rank,
        'phone': phone,
        'avatarUrl': avatarUrl,
        'homeSite': homeSite?.toJson(),
        'faceEnrolled': faceEnrolled,
      };
}

class SiteLite {
  final String id, name;
  final double? lat, lng;
  final int? radiusM;
  SiteLite({required this.id, required this.name, this.lat, this.lng, this.radiusM});

  factory SiteLite.fromJson(Map<String, dynamic> j) => SiteLite(
        id: j['id'],
        name: j['name'] ?? '',
        lat: (j['lat'] as num?)?.toDouble(),
        lng: (j['lng'] as num?)?.toDouble(),
        radiusM: j['radiusM'],
      );

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'lat': lat, 'lng': lng, 'radiusM': radiusM};
}

class Checkpoint {
  final String id, code, name;
  final double lat, lng;
  final int radiusM;
  final int orderIndex;
  final int targetMinute;
  Checkpoint({
    required this.id,
    required this.code,
    required this.name,
    required this.lat,
    required this.lng,
    required this.radiusM,
    this.orderIndex = 0,
    this.targetMinute = 0,
  });

  /// Menerima bentuk RouteCheckpoint {orderIndex, checkpoint:{…}} maupun Checkpoint polos.
  factory Checkpoint.fromRouteLink(Map<String, dynamic> j) {
    final c = (j['checkpoint'] ?? j) as Map<String, dynamic>;
    return Checkpoint(
      id: c['id'],
      code: c['code'] ?? '',
      name: c['name'] ?? '',
      lat: (c['lat'] as num).toDouble(),
      lng: (c['lng'] as num).toDouble(),
      radiusM: c['radiusM'] ?? 30,
      orderIndex: j['orderIndex'] ?? 0,
      targetMinute: j['targetMinute'] ?? 0,
    );
  }
}

class PatrolRouteModel {
  final String id, name;
  final int expectedDurationMin;
  final bool enforceOrder, requirePhoto;
  final List<Checkpoint> checkpoints;
  PatrolRouteModel({
    required this.id,
    required this.name,
    required this.expectedDurationMin,
    required this.enforceOrder,
    required this.requirePhoto,
    required this.checkpoints,
  });

  factory PatrolRouteModel.fromJson(Map<String, dynamic> j) => PatrolRouteModel(
        id: j['id'],
        name: j['name'] ?? '',
        expectedDurationMin: j['expectedDurationMin'] ?? 45,
        enforceOrder: j['enforceOrder'] ?? false,
        requirePhoto: j['requirePhoto'] ?? false,
        checkpoints: ((j['checkpoints'] ?? []) as List)
            .map((e) => Checkpoint.fromRouteLink(e as Map<String, dynamic>))
            .toList()
          ..sort((a, b) => a.orderIndex.compareTo(b.orderIndex)),
      );
}

class ScheduleModel {
  final String id;
  final DateTime date;
  final String status;
  final SiteLite site;
  final String shiftName, startTime, endTime;
  final PatrolRouteModel? route;
  final Map<String, dynamic>? attendance;

  ScheduleModel({
    required this.id,
    required this.date,
    required this.status,
    required this.site,
    required this.shiftName,
    required this.startTime,
    required this.endTime,
    this.route,
    this.attendance,
  });

  factory ScheduleModel.fromJson(Map<String, dynamic> j) => ScheduleModel(
        id: j['id'],
        date: DateTime.parse(j['date']),
        status: j['status'] ?? 'PLANNED',
        site: SiteLite.fromJson(j['site']),
        shiftName: j['shift']?['name'] ?? '',
        startTime: j['shift']?['startTime'] ?? '',
        endTime: j['shift']?['endTime'] ?? '',
        route: j['route'] != null ? PatrolRouteModel.fromJson(j['route']) : null,
        attendance: j['attendance'],
      );
}

class PatrolSessionModel {
  final String id;
  final DateTime startedAt;
  final String status;
  final int totalCheckpoints, scannedCount;
  final PatrolRouteModel route;
  final SiteLite site;
  final Set<String> scannedIds;

  PatrolSessionModel({
    required this.id,
    required this.startedAt,
    required this.status,
    required this.totalCheckpoints,
    required this.scannedCount,
    required this.route,
    required this.site,
    required this.scannedIds,
  });

  factory PatrolSessionModel.fromJson(Map<String, dynamic> j) => PatrolSessionModel(
        id: j['id'],
        startedAt: DateTime.parse(j['startedAt']),
        status: j['status'] ?? 'IN_PROGRESS',
        totalCheckpoints: j['totalCheckpoints'] ?? 0,
        scannedCount: j['scannedCount'] ?? 0,
        route: PatrolRouteModel.fromJson(j['route']),
        site: SiteLite.fromJson(j['site']),
        scannedIds: ((j['scans'] ?? []) as List).map((s) => s['checkpointId'] as String).toSet(),
      );
}

class IncidentModel {
  final String id, code, title, category, severity, status;
  final String? description, siteName;
  final DateTime occurredAt;

  IncidentModel({
    required this.id,
    required this.code,
    required this.title,
    required this.category,
    required this.severity,
    required this.status,
    required this.occurredAt,
    this.description,
    this.siteName,
  });

  factory IncidentModel.fromJson(Map<String, dynamic> j) => IncidentModel(
        id: j['id'],
        code: j['code'] ?? '',
        title: j['title'] ?? '',
        category: j['category'] ?? '',
        severity: j['severity'] ?? 'MEDIUM',
        status: j['status'] ?? 'OPEN',
        occurredAt: DateTime.parse(j['occurredAt']),
        description: j['description'],
        siteName: j['site']?['name'],
      );
}
