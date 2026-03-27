import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  ActivityIndicator, ScrollView, Modal, PanResponder,
} from 'react-native';
import { useAppController, MainMode } from '../hooks/useAppController';
import LiveCameraView from '../components/LiveCameraView';
import IoTPanelModal from '../components/IoTPanelModal';
import { AppStyles as s } from '../theme/AppStyles';

const HomeScreen = () => {
  const {
    mainMode, loading, recognizedText, lastCapturedPhotoUri, staticAutoCaptureDelayMs,
    showLiveCamera, isVoiceListening,
    captureMode, toggleCaptureMode,
    tryEnableOnlineMode,
    offlineProcessMode, toggleOfflineProcessMode,
    liveCameraRef,
    iotMode, iotAlert, iotSimulator,
    handleScreenTap, handleLongPress,
    handleCloseLiveCamera, handleStaticPhotoCaptured, handleGallery,
    toggleIoT, testIoTSignal,
  } = useAppController();

  const [showIoTPanel, setShowIoTPanel] = useState(false);
  const swipeTimesRef = useRef<number[]>([]);
  const SWIPE_STREAK_WINDOW_MS = 2200;

  // Vuốt:
  // - 1 ngón tay (chế độ tĩnh + offline): object/ocr
  // - Vuốt ngang 3 lần liên tiếp: thử chuyển online (có kiểm tra server)
  // - 2 ngón tay: giữ hành vi cũ online/offline
  const swipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder:         (_evt, gesture) => (
        Math.abs(gesture.dx) > 22 && Math.abs(gesture.dx) > Math.abs(gesture.dy)
      ),
      onMoveShouldSetPanResponderCapture:  () => false,
      onPanResponderRelease: (evt, gesture) => {
        if (Math.abs(gesture.dx) <= 60) return;

        const touches = evt.nativeEvent.touches.length || evt.nativeEvent.changedTouches.length;
        if (touches >= 2) {
          toggleCaptureMode();
          return;
        }

        if (touches === 1 && mainMode === 'static') {
          const now = Date.now();
          const swipes = swipeTimesRef.current;
          swipes.push(now);

          while (swipes.length > 0 && now - swipes[0] > SWIPE_STREAK_WINDOW_MS) {
            swipes.shift();
          }

          if (captureMode === 'offline' && swipes.length >= 3) {
            swipeTimesRef.current = [];
            tryEnableOnlineMode();
            return;
          }

          if (captureMode === 'offline') {
            toggleOfflineProcessMode();
          }
        }
      },
    })
  ).current;

  const iotBadgeColor =
    iotMode === 'ble'       ? '#2ed573' :
    iotMode === 'simulator' ? '#ffa502' :
    '#747d8c';

  const iotBadgeLabel =
    iotMode === 'ble'       ? '📡 BLE' :
    iotMode === 'simulator' ? '🤖 SIM' :
    '⚫ OFF';

  const alertBgColor =
    iotAlert?.level === 'danger'  ? '#ff4757' :
    iotAlert?.level === 'caution' ? '#ffa502' :
    'transparent';

  const modeColor: Record<MainMode, string> = {
    walking: '#e94560',
    static:  '#0f3460',
  };

  const modeLabel: Record<MainMode, string> = {
    walking: '🚶  CHẾ ĐỘ ĐI ĐƯỜNG',
    static:  '📸  CHẾ ĐỘ TĨNH',
  };

  const modeHint: Record<MainMode, string> = {
    walking: 'Camera tự động nhận diện vật thể\nChạm 3 lần để chuyển chế độ',
    static:  'Chạm = chụp ảnh · Giữ lâu = lệnh giọng nói\nVuốt trái/phải (offline) đổi OCR/vật thể · Vuốt 3 lần liên tiếp để bật online · Chạm 3 lần để chuyển chế độ',
  };

  return (
    <View style={s.container} {...swipeResponder.panHandlers}>

      {/* ── LIVE CAMERA (chế độ đi đường) ── */}
      <Modal
        visible={showLiveCamera}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={handleCloseLiveCamera}
      >
        <LiveCameraView
          ref={liveCameraRef}
          onClose={handleCloseLiveCamera}
          captureMode={captureMode}
          autoCaptureDelayMs={mainMode === 'static' ? staticAutoCaptureDelayMs : 0}
          onPhotoCaptured={mainMode === 'static' ? handleStaticPhotoCaptured : undefined}
        />
      </Modal>

      {/* ── VÙNG CHẠM CHÍNH ── */}
      <TouchableOpacity
        style={[s.mainTouchArea, { backgroundColor: modeColor[mainMode] }]}
        onPress={handleScreenTap}
        onLongPress={handleLongPress}
        delayLongPress={600}
        activeOpacity={0.85}
        disabled={loading}
        accessibilityLabel={
          mainMode === 'walking'
            ? 'Chế độ đi đường. Chạm 3 lần liên tiếp để chuyển sang chế độ tĩnh.'
            : 'Chế độ tĩnh. Chạm để chụp ảnh. Giữ lâu để ra lệnh giọng nói. Chạm 3 lần để chuyển chế độ.'
        }
        accessibilityRole="button"
      >
        {mainMode === 'static' && lastCapturedPhotoUri && (
          <Image
            source={{ uri: lastCapturedPhotoUri }}
            style={s.mainTouchAreaBgImage}
            resizeMode="cover"
          />
        )}

        {mainMode === 'static' && lastCapturedPhotoUri && (
          <View style={s.mainTouchAreaBgOverlay} />
        )}

        {loading ? (
          <>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={s.modeText}>Đang phân tích...</Text>
          </>
        ) : (
          <>
            <Text style={s.modeIcon}>{mainMode === 'walking' ? '🚶' : '📸'}</Text>
            <Text style={s.modeText}>{modeLabel[mainMode]}</Text>
            <Text style={s.modeHint}>{modeHint[mainMode]}</Text>
            {/* Badge online/offline */}
            <View style={[
              s.captureBadge,
              captureMode === 'online' ? s.captureBadgeOnline : s.captureBadgeOffline,
            ]}>
              <Text style={s.captureBadgeText}>
                {captureMode === 'online' ? '🌐 ONLINE' : '🔌 OFFLINE'}
              </Text>
            </View>
            {captureMode === 'offline' && (
              <View style={[
                s.captureBadge,
                offlineProcessMode === 'object' ? s.captureBadgeOffline : s.captureBadgeOnline,
              ]}>
                <Text style={s.captureBadgeText}>
                  {offlineProcessMode === 'object' ? '📦 OFFLINE: VẬT THỂ' : '📝 OFFLINE: OCR'}
                </Text>
              </View>
            )}
          </>
        )}

        {isVoiceListening && (
          <View style={s.voiceBadge}>
            <Text style={s.voiceBadgeText}>🎙️ Đang lắng nghe...</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── KẾT QUẢ ── */}
      <ScrollView style={s.resultContainer} contentContainerStyle={s.resultContent}>
        <Text style={s.resultText}>{recognizedText}</Text>
      </ScrollView>

      {/* ── THANH DƯỚI: Gallery + IoT ── */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[s.galleryButton, { flex: 3 }]}
          onPress={handleGallery}
          disabled={loading}
          accessibilityLabel="Chọn ảnh từ thư viện"
        >
          <Text style={s.bottomButtonText}>🖼️  CHỌN ẢNH</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.iotButton, { backgroundColor: iotBadgeColor }]}
          onPress={() => setShowIoTPanel(true)}
          accessibilityLabel={`Gậy dò đường, trạng thái: ${iotBadgeLabel}`}
        >
          <Text style={s.iotIcon}>🦯</Text>
          <Text style={s.iotBadgeText}>{iotBadgeLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* ── CẢNH BÁO IoT ── */}
      {iotAlert && iotAlert.level !== 'safe' && (
        <View style={[s.alertBanner, { backgroundColor: alertBgColor }]}>
          <Text style={s.alertText}>
            {iotAlert.level === 'danger' ? '⚠️ NGUY HIỂM' : '⚡ CHÚ Ý'}
            {'  '}{iotAlert.message}
          </Text>
        </View>
      )}

      {/* ── MODAL IoT ── */}
      <IoTPanelModal
        visible={showIoTPanel}
        onClose={() => setShowIoTPanel(false)}
        iotMode={iotMode}
        iotSimulator={iotSimulator}
        iotBadgeColor={iotBadgeColor}
        toggleIoT={toggleIoT}
        testIoTSignal={testIoTSignal}
      />

    </View>
  );
};

export default HomeScreen;
