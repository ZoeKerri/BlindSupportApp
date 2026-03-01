import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  modeContainer: { flexDirection: 'row', backgroundColor: '#dfe4ea', padding: 8, gap: 8 },
  modeButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#fff' },
  modeActive: { backgroundColor: '#3742fa' },
  modeText: { fontSize: 15, fontWeight: '600', color: '#3742fa' },
  modeTextActive: { color: '#fff' },
  button: { flex: 2, justifyContent: 'center', alignItems: 'center' },
  cameraButton: { backgroundColor: '#ff4757' },
  galleryButton: { backgroundColor: '#2ed573' },
  buttonText: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  statusContainer: { flex: 1, backgroundColor: '#f1f2f6' },
  statusContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  statusLabel: { fontSize: 14, color: '#888', marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  statusText: { fontSize: 18, color: '#2f3542', textAlign: 'center', lineHeight: 28 },
});