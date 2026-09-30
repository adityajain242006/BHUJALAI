// Bhujal AI — prototype client.
// Copy into bhujal_app/lib/main.dart after `flutter create --platforms=web bhujal_app`.
//
// Offline-first demo flow:
//   1. "Sync" button fetches /tile/Bengaluru%20Urban once, caches JSON to localStorage.
//   2. All map interaction afterward reads only the cached JSON — zero network calls.
//   3. Tapping the map snaps to the nearest cached grid cell and shows the four
//      target outputs (success_probability, depth_m, yield_lpm, sustainability_status)
//      plus the DRILL/SURVEY/AVOID/INSUFFICIENT_DATA decision.

import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

void main() => runApp(const BhujalApp());

class BhujalApp extends StatelessWidget {
  const BhujalApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Bhujal AI',
      theme: ThemeData(colorSchemeSeed: const Color(0xFFE85D2A), useMaterial3: true),
      home: const MapScreen(),
    );
  }
}

class GridCell {
  final double lat, lon, successProbability, depthM, yieldLpm;
  final String blockCategory, decision, confidence;
  GridCell.fromJson(Map<String, dynamic> j)
      : lat = j['lat'], lon = j['lon'],
        successProbability = j['success_probability'],
        depthM = j['depth_m'], yieldLpm = j['yield_lpm'],
        blockCategory = j['block_category'], decision = j['decision'],
        confidence = j['confidence'];
}

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});
  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  static const apiBase = 'http://localhost:8000';
  List<GridCell> cells = [];
  GridCell? selected;
  bool syncing = false;
  bool synced = false;

  @override
  void initState() {
    super.initState();
    _loadCached();
  }

  Future<void> _loadCached() async {
    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString('tile_bengaluru');
    if (cached != null) {
      _applyTileJson(cached);
      setState(() => synced = true);
    }
  }

  Future<void> _sync() async {
    setState(() => syncing = true);
    try {
      final resp = await http.get(Uri.parse('$apiBase/tile/bengaluru'));
      if (resp.statusCode == 200) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('tile_bengaluru', resp.body);
        _applyTileJson(resp.body);
        setState(() => synced = true);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sync failed (offline?): $e')));
    } finally {
      setState(() => syncing = false);
    }
  }

  void _applyTileJson(String body) {
    final data = jsonDecode(body);
    final c = (data['cells'] as List).map((e) => GridCell.fromJson(e)).toList();
    setState(() => cells = c);
  }

  GridCell? _nearest(LatLng point) {
    if (cells.isEmpty) return null;
    final d = const Distance();
    GridCell? best;
    double bestDist = double.infinity;
    for (final c in cells) {
      final dist = d(point, LatLng(c.lat, c.lon));
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
    return best;
  }

  Color _decisionColor(String decision) {
    switch (decision) {
      case 'DRILL': return Colors.green;
      case 'SURVEY': return Colors.amber;
      case 'AVOID': return Colors.red;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bhujal AI — Borewell Site Recommendation'),
        actions: [
          IconButton(
            icon: Icon(synced ? Icons.cloud_done : Icons.cloud_sync),
            tooltip: synced ? 'Synced — working offline' : 'Sync tile data',
            onPressed: syncing ? null : _sync,
          ),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            options: MapOptions(
              initialCenter: const LatLng(12.97, 77.60),
              initialZoom: 11,
              onTap: (tapPos, point) => setState(() => selected = _nearest(point)),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.bhujalai.app',
              ),
              CircleLayer(
                circles: cells.map((c) => CircleMarker(
                  point: LatLng(c.lat, c.lon),
                  radius: 5,
                  color: _decisionColor(c.decision).withOpacity(0.6),
                )).toList(),
              ),
            ],
          ),
          if (!synced)
            Positioned(
              top: 12, left: 12, right: 12,
              child: Card(
                color: Colors.orange.shade100,
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text('Not synced yet. Tap the cloud icon once (needs signal) — '
                      'after that this works fully offline.'),
                ),
              ),
            ),
          if (selected != null)
            Positioned(
              bottom: 0, left: 0, right: 0,
              child: Card(
                margin: EdgeInsets.zero,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(children: [
                        Chip(
                          label: Text(selected!.decision,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          backgroundColor: _decisionColor(selected!.decision),
                        ),
                        const SizedBox(width: 8),
                        Text('confidence: ${selected!.confidence}'),
                      ]),
                      const SizedBox(height: 8),
                      Text('Success probability: ${(selected!.successProbability * 100).toStringAsFixed(0)}%'),
                      Text('Expected depth: ${selected!.depthM.toStringAsFixed(1)} m'),
                      Text('Expected yield: ${selected!.yieldLpm.toStringAsFixed(1)} L/min'),
                      Text('Groundwater status (INGRES): ${selected!.blockCategory}'),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
