import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, ScrollView, TextInput, PanResponder,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { VisionService } from '../services/VisionService';
import { CaptionService } from '../services/CaptionService';
import { TtsService } from '../services/TtsService';
import { CaptionStyles as s } from '../theme/CaptionStyles';

type CaptureMode = 'offline' | 'online';

const CaptionScreen = () => {
  const [mode, setMode] = useState<CaptureMode>('offline');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [apiUrl, setApiUrl] = useState(CaptionService.apiUrl);

  const isOnline = mode === 'online';

  // Vuốt trái/phải 1 ngón → chuyển offline / online
  const swipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 15 && Math.abs(gesture.dy) < 60,
      onPanResponderRelease: (_evt, gesture) => {
        if (Math.abs(gesture.dx) > 50) toggleMode();
      },
    }),
  ).current;

  const applyApiUrl = (url: string) => {
    setApiUrl(url);
    CaptionService.setApiUrl(url);
  };

  const processUri = async (uri: string) => {
    setLoading(true);
    setResult('');
    try {
      let text = '';
      if (mode === 'offline') {
        TtsService.speak('Đang phân tích ảnh.');
        text = await VisionService.processAutoDetect(uri);
      } else {
        TtsService.speak('Đang gửi ảnh lên máy chủ.');
        text = await CaptionService.captionImage(uri);
      }
      setResult(text);
      TtsService.speak(text);
    } catch (e: any) {
      const msg = e?.message ?? 'Lỗi không xác định';
      setResult(`Lỗi: ${msg}`);
      TtsService.speak('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCamera = () => {
    launchCamera(
      { mediaType: 'photo', quality: 0.8, saveToPhotos: false },
      res => { const uri = res.assets?.[0]?.uri; if (uri) processUri(uri); },
    );
  };

  const handleGallery = () => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8 },
      res => { const uri = res.assets?.[0]?.uri; if (uri) processUri(uri); },
    );
  };

  const toggleMode = () => {
    const next: CaptureMode = mode === 'offline' ? 'online' : 'offline';
    setMode(next);
    setResult('');
    TtsService.speak(next === 'online' ? 'Chuyển sang chế độ online.' : 'Chuyển sang chế độ offline.');
  };

  return (
    <View style={s.container} {...swipeResponder.panHandlers}>

      {/* ── VÙNG CHẠM CHÍNH ── */}
      <TouchableOpacity
        style={[s.mainTouchArea, { backgroundColor: isOnline ? '#1a5276' : '#0f3460' }]}
        onPress={handleCamera}
        disabled={loading}
        activeOpacity={0.85}
        accessibilityLabel={`Chế độ ${isOnline ? 'online' : 'offline'}. Chạm để chụp ảnh.`}
        accessibilityRole="button"
      >
        {loading ? (
          <>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={s.modeText}>Đang xử lý...</Text>
          </>
        ) : (
          <>
            <Text style={s.modeIcon}>{isOnline ? '🌐' : '🔌'}</Text>
            <Text style={s.modeText}>
              {isOnline ? 'NHẬN DẠNG ONLINE' : 'NHẬN DẠNG OFFLINE'}
            </Text>
            <Text style={s.modeHint}>
              {isOnline
                ? 'BLIP + Knowledge Graph + T5 LoRA\nChạm để chụp ảnh'
                : 'ML Kit · OCR · Nhận diện vật thể\nChạm để chụp ảnh'}
            </Text>
            <View style={[s.modeBadge, { backgroundColor: isOnline ? '#2563eb' : '#1e293b' }]}>
              <Text style={s.modeBadgeText}>{isOnline ? '🌐 ONLINE' : '🔌 OFFLINE'}</Text>
            </View>
          </>
        )}
      </TouchableOpacity>

      {/* ── KẾT QUẢ ── */}
      <ScrollView style={s.resultContainer} contentContainerStyle={s.resultContent}>
        {result ? (
          <Text style={s.resultText}>{result}</Text>
        ) : (
          <Text style={s.placeholderText}>Kết quả sẽ hiển thị ở đây...</Text>
        )}
      </ScrollView>

      {/* ── CÀI ĐẶT API URL (chỉ hiện khi online) ── */}
      {isOnline && (
        <View style={s.configRow}>
          <Text style={s.configLabel}>API:</Text>
          <TextInput
            style={s.configInput}
            value={apiUrl}
            onChangeText={applyApiUrl}
            placeholder="http://192.168.1.x:8000"
            placeholderTextColor="rgba(255,255,255,0.35)"
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
      )}

      {/* ── THANH DƯỚI ── */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[s.galleryBtn, { flex: 3 }]}
          onPress={handleGallery}
          disabled={loading}
          accessibilityLabel="Chọn ảnh từ thư viện"
        >
          <Text style={s.bottomBtnText}>🖼️  CHỌN ẢNH</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.modeToggleBtn, { backgroundColor: isOnline ? '#2563eb' : '#374151' }]}
          onPress={toggleMode}
          accessibilityLabel={`Đang ${isOnline ? 'online' : 'offline'}. Nhấn để chuyển.`}
        >
          <Text style={s.bottomBtnText}>{isOnline ? '🌐' : '🔌'}</Text>
          <Text style={s.modeToggleLabel}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
};

export default CaptionScreen;
