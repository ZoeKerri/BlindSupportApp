import { StyleSheet } from 'react-native';

export const CaptionStyles = StyleSheet.create({
  // Layout gốc
  container:        { flex: 1, backgroundColor: '#0d0d1a' },

  // Vùng chạm chính
  mainTouchArea:    {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modeIcon:         { fontSize: 64, marginBottom: 12 },
  modeText:         { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  modeHint:         { color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  modeBadge:        { marginTop: 16, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  modeBadgeText:    { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // Kết quả
  resultContainer:  { flex: 1, backgroundColor: '#0d0d1a' },
  resultContent:    { padding: 20 },
  resultText:       { color: '#e0e0e0', fontSize: 16, lineHeight: 26 },
  placeholderText:  { color: 'rgba(255,255,255,0.3)', fontSize: 15, fontStyle: 'italic' },

  // Cấu hình API (chỉ hiện online)
  configRow:        {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  configLabel:      { color: '#93c5fd', fontWeight: '600', fontSize: 13 },
  configInput:      {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, fontSize: 13,
  },

  // Thanh dưới
  bottomBar:        { flexDirection: 'row', height: 68, backgroundColor: '#0a0a14' },
  galleryBtn:       { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b' },
  modeToggleBtn:    { width: 90, justifyContent: 'center', alignItems: 'center' },
  bottomBtnText:    { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  modeToggleLabel:  { color: '#fff', fontSize: 11, marginTop: 2 },
});
