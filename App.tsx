import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, ScrollView } from 'react-native';
import { useAppController } from './src/hooks/useAppController';

const App = () => {
  const { mode, loading, recognizedText, changeMode, handleCamera, handleGallery } = useAppController();

  return (
    <View style={styles.container}>
      {/* KHU VỰC CHỌN CHẾ ĐỘ (4 Chế độ Offline) */}
      <View style={styles.modeContainer}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'ocr_doc' && styles.modeActive]}
          onPress={() => changeMode('ocr_doc')}
        >
          <Text style={[styles.modeText, mode === 'ocr_doc' && styles.modeTextActive]}>📖 Đọc Sách</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, mode === 'ocr_menu' && styles.modeActive]}
          onPress={() => changeMode('ocr_menu')}
        >
          <Text style={[styles.modeText, mode === 'ocr_menu' && styles.modeTextActive]}>🏷️ Menu</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, mode === 'ocr_money' && styles.modeActive]}
          onPress={() => changeMode('ocr_money')}
        >
          <Text style={[styles.modeText, mode === 'ocr_money' && styles.modeTextActive]}>💰 Tiền</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, mode === 'object' && styles.modeActive]}
          onPress={() => changeMode('object')}
        >
          <Text style={[styles.modeText, mode === 'object' && styles.modeTextActive]}>🔍 Vật Thể</Text>
        </TouchableOpacity>
      </View>

      {/* NÚT CHỤP ẢNH TỪ CAMERA */}
      <TouchableOpacity 
        style={[styles.button, styles.cameraButton]} 
        onPress={handleCamera} 
        disabled={loading}
      >
        <Text style={styles.buttonText}>📷 CHỤP ẢNH</Text>
      </TouchableOpacity>

      {/* KHU VỰC HIỂN THỊ KẾT QUẢ ĐỂ TEST */}
      <ScrollView style={styles.statusContainer} contentContainerStyle={styles.statusContent}>
        {loading ? (
          <>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.statusLabel}>AI đang phân tích...</Text>
          </>
        ) : (
          <>
            <Text style={styles.statusLabel}>
              {mode === 'object' ? 'Vật thể phát hiện:' : mode === 'ocr_money' ? 'Mệnh giá tiền:' : 'Nội dung văn bản:'}
            </Text>
            <Text style={styles.statusText}>{recognizedText}</Text>
          </>
        )}
      </ScrollView>

      {/* NÚT CHỌN ẢNH TỪ THƯ VIỆN ĐỂ TEST CÁC CASE KHÓ */}
      <TouchableOpacity 
        style={[styles.button, styles.galleryButton]} 
        onPress={handleGallery} 
        disabled={loading}
      >
        <Text style={styles.buttonText}>🖼️ CHỌN ẢNH</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  modeContainer: { flexDirection: 'row', backgroundColor: '#dfe4ea', padding: 8, gap: 5 },
  modeButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#fff' },
  modeActive: { backgroundColor: '#3742fa' },
  modeText: { fontSize: 13, fontWeight: '700', color: '#3742fa' },
  modeTextActive: { color: '#fff' },
  button: { flex: 2, justifyContent: 'center', alignItems: 'center' },
  cameraButton: { backgroundColor: '#ff4757' },
  galleryButton: { backgroundColor: '#2ed573' },
  buttonText: { color: 'white', fontSize: 28, fontWeight: 'bold' },
  statusContainer: { flex: 2, backgroundColor: '#f1f2f6' },
  statusContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  statusLabel: { fontSize: 14, color: '#888', marginBottom: 12, fontWeight: '600', textTransform: 'uppercase' },
  statusText: { fontSize: 18, color: '#2f3542', textAlign: 'center', lineHeight: 28 },
});

export default App;