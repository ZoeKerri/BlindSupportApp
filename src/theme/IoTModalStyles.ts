import { StyleSheet } from 'react-native';

export const IoTModalStyles = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  panel:         { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title:         { fontSize: 22, fontWeight: 'bold', color: '#2f3542', marginBottom: 16, textAlign: 'center' },
  status:        { fontSize: 16, color: '#2f3542', marginBottom: 4 },
  subStatus:     { fontSize: 13, color: '#888', marginBottom: 16 },
  btnRow:        { flexDirection: 'row', gap: 10, marginBottom: 16 },
  btn:           { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnText:       { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionLabel:  { fontSize: 14, color: '#555', fontWeight: '600', marginBottom: 8 },
  testBtn:       { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  testBtnText:   { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  hint:          { fontSize: 12, color: '#aaa', textAlign: 'center', lineHeight: 18 },
});
