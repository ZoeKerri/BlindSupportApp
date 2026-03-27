import { StyleSheet } from 'react-native';

export const AppStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },

  // Vùng chạm chính – toàn màn hình cho người mù
  mainTouchArea: {
    flex: 5,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  mainTouchAreaBgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  mainTouchAreaBgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modeIcon: { fontSize: 72 },
  modeText: { color: '#fff', fontSize: 28, fontWeight: 'bold', letterSpacing: 2, textAlign: 'center' },
  modeHint: { color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center', lineHeight: 22, marginTop: 4 },

  // Voice listening badge
  voiceBadge: {
    position: 'absolute', bottom: 24,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
  },
  voiceBadgeText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Kết quả
  resultContainer: { flex: 2, backgroundColor: '#16213e' },
  resultContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  resultText: { fontSize: 18, color: '#e0e0e0', textAlign: 'center', lineHeight: 28 },

  // Bottom bar
  bottomBar: { flexDirection: 'row', flex: 1 },
  galleryButton: { backgroundColor: '#0f3460', justifyContent: 'center', alignItems: 'center' },
  bottomButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },

  // IoT button
  iotButton: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
  iotIcon: { fontSize: 28 },
  iotBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700', marginTop: 2 },

  // Online/Offline badge
  captureBadge: {
    marginTop: 12, paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  captureBadgeOnline:  { backgroundColor: 'rgba(16,185,129,0.25)', borderColor: '#10b981' },
  captureBadgeOffline: { backgroundColor: 'rgba(100,116,139,0.25)', borderColor: '#64748b' },
  captureBadgeText:    { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  // Alert banner (IoT)
  alertBanner: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, alignItems: 'center' },
  alertText: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
});
