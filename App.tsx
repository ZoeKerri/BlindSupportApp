import React, { useState } from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
  ActivityIndicator, ScrollView, Modal, Pressable,
} from 'react-native';
import { useAppController, MainMode } from './src/hooks/useAppController';
import LiveCameraView from './src/components/LiveCameraView';

const App = () => {
  const {
    mainMode, loading, recognizedText,
    showLiveCamera, isVoiceListening,
    liveCameraRef,
    iotMode, iotAlert, iotSimulator,
    handleScreenTap, handleLongPress,
    handleCloseLiveCamera, handleGallery,
    toggleIoT, testIoTSignal,
  } = useAppController();

  const [showIoTPanel, setShowIoTPanel] = useState(false);

  const iotBadgeColor =
    iotMode === 'ble' ? '#2ed573' :
    iotMode === 'simulator' ? '#ffa502' :
    '#747d8c';

  const iotBadgeLabel =
    iotMode === 'ble' ? '📡 BLE' :
    iotMode === 'simulator' ? '🤖 SIM' :
    '⚫ OFF';

  const alertBgColor =
    iotAlert?.level === 'danger' ? '#ff4757' :
    iotAlert?.level === 'caution' ? '#ffa502' :
    'transparent';

  const modeColor: Record<MainMode, string> = {
    walking: '#e94560',
    static: '#0f3460',
  };

  const modeLabel: Record<MainMode, string> = {
    walking: '🚶  CHẾ ĐỘ ĐI ĐƯỜNG',
    static: '📸  CHẾ ĐỘ TĨNH',
  };

  const modeHint: Record<MainMode, string> = {
    walking: 'Camera tự động nhận diện vật thể\nChạm 3 lần để chuyển chế độ',
    static: 'Chạm = chụp ảnh · Giữ lâu = lệnh giọng nói\nChạm 3 lần để chuyển chế độ',
  };

  return (
    <View style={styles.container}>

      {/* ── LIVE CAMERA (walking mode) ── */}
      <Modal
        visible={showLiveCamera}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={handleCloseLiveCamera}
      >
        <LiveCameraView ref={liveCameraRef} onClose={handleCloseLiveCamera} />
      </Modal>

      {/* ── VÙNG CHẠM CHÍNH (toàn màn hình) ── */}
      <TouchableOpacity
        style={[styles.mainTouchArea, { backgroundColor: modeColor[mainMode] }]}
        onPress={handleScreenTap}
        onLongPress={handleLongPress}
        delayLongPress={800}
        activeOpacity={0.85}
        disabled={loading}
        accessibilityLabel={
          mainMode === 'walking'
            ? 'Chế độ đi đường. Chạm 3 lần liên tiếp để chuyển sang chế độ tĩnh.'
            : 'Chế độ tĩnh. Chạm để chụp ảnh. Giữ lâu để ra lệnh giọng nói. Chạm 3 lần để chuyển chế độ.'
        }
        accessibilityRole="button"
      >
        {loading ? (
          <>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.modeText}>Đang phân tích...</Text>
          </>
        ) : (
          <>
            <Text style={styles.modeIcon}>{mainMode === 'walking' ? '🚶' : '📸'}</Text>
            <Text style={styles.modeText}>{modeLabel[mainMode]}</Text>
            <Text style={styles.modeHint}>{modeHint[mainMode]}</Text>
          </>
        )}

        {/* Voice listening indicator */}
        {isVoiceListening && (
          <View style={styles.voiceBadge}>
            <Text style={styles.voiceBadgeText}>🎙️ Đang lắng nghe...</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── KẾT QUẢ ── */}
      <ScrollView style={styles.resultContainer} contentContainerStyle={styles.resultContent}>
        <Text style={styles.resultText}>{recognizedText}</Text>
      </ScrollView>

      {/* ── THANH DƯỚI: Gallery + IoT ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.galleryButton, { flex: 3 }]}
          onPress={handleGallery}
          disabled={loading}
          accessibilityLabel="Chọn ảnh từ thư viện"
        >
          <Text style={styles.bottomButtonText}>🖼️  CHỌN ẢNH</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iotButton, { backgroundColor: iotBadgeColor }]}
          onPress={() => setShowIoTPanel(true)}
          accessibilityLabel={`Gậy dò đường, trạng thái: ${iotBadgeLabel}`}
        >
          <Text style={styles.iotIcon}>🦯</Text>
          <Text style={styles.iotBadgeText}>{iotBadgeLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* ── CẢNH BÁO IoT ── */}
      {iotAlert && iotAlert.level !== 'safe' && (
        <View style={[styles.alertBanner, { backgroundColor: alertBgColor }]}>
          <Text style={styles.alertText}>
            {iotAlert.level === 'danger' ? '⚠️ NGUY HIỂM' : '⚡ CHÚ Ý'}
            {'  '}{iotAlert.message}
          </Text>
        </View>
      )}

      {/* ── MODAL IoT PANEL (giữ nguyên cho demo) ── */}
      <Modal
        visible={showIoTPanel}
        animationType="slide"
        transparent
        onRequestClose={() => setShowIoTPanel(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowIoTPanel(false)}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>🦯 Gậy Dò Đường IoT</Text>

            <Text style={styles.modalStatus}>
              Trạng thái:{' '}
              <Text style={{ color: iotBadgeColor, fontWeight: 'bold' }}>
                {iotMode === 'ble' ? 'Kết nối BLE thật ✅' :
                 iotMode === 'simulator' ? 'Giả lập (Simulator) 🤖' :
                 'Chưa kết nối ⚫'}
              </Text>
            </Text>

            {iotMode !== 'disconnected' && (
              <Text style={styles.modalSubStatus}>
                {iotMode === 'simulator' ? 'Đang giả lập tín hiệu mỗi 3 giây' : 'Nhận tín hiệu từ ESP32 qua BLE'}
              </Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#3742fa' }]}
                onPress={() => { toggleIoT(false); setShowIoTPanel(false); }}
              >
                <Text style={styles.modalBtnText}>
                  {iotMode !== 'disconnected' && !iotSimulator ? '⏹ Ngắt BLE' : '📡 Kết nối BLE'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#ffa502' }]}
                onPress={() => { toggleIoT(true); setShowIoTPanel(false); }}
              >
                <Text style={styles.modalBtnText}>
                  {iotMode === 'simulator' ? '⏹ Tắt giả lập' : '🤖 Bật giả lập'}
                </Text>
              </TouchableOpacity>
            </View>

            {iotMode === 'simulator' && (
              <>
                <Text style={styles.modalSectionLabel}>🧪 Test tín hiệu thủ công:</Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.testBtn, { backgroundColor: '#ff4757' }]}
                    onPress={() => { testIoTSignal('danger'); setShowIoTPanel(false); }}
                  >
                    <Text style={styles.testBtnText}>⚠️{'\n'}Nguy hiểm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.testBtn, { backgroundColor: '#ffa502' }]}
                    onPress={() => { testIoTSignal('caution'); setShowIoTPanel(false); }}
                  >
                    <Text style={styles.testBtnText}>⚡{'\n'}Chú ý</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.testBtn, { backgroundColor: '#2ed573' }]}
                    onPress={() => { testIoTSignal('safe'); setShowIoTPanel(false); }}
                  >
                    <Text style={styles.testBtnText}>✅{'\n'}An toàn</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={styles.modalHint}>
              💡 Cài react-native-ble-manager để kết nối ESP32 thật.{'\n'}
              Xem code ESP32 trong IoTService.ts.
            </Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },

  // Vùng chạm chính – toàn màn hình cho người mù
  mainTouchArea: {
    flex: 5,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
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

  // IoT
  iotButton: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
  iotIcon: { fontSize: 28 },
  iotBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700', marginTop: 2 },

  // Alert
  alertBanner: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, alignItems: 'center' },
  alertText: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },

  // Modal IoT
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalPanel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#2f3542', marginBottom: 16, textAlign: 'center' },
  modalStatus: { fontSize: 16, color: '#2f3542', marginBottom: 4 },
  modalSubStatus: { fontSize: 13, color: '#888', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalSectionLabel: { fontSize: 14, color: '#555', fontWeight: '600', marginBottom: 8 },
  testBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  testBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  modalHint: { fontSize: 12, color: '#aaa', textAlign: 'center', lineHeight: 18 },
});

export default App;