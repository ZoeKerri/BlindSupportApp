import { useState, useEffect, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';
import { TtsService } from '../services/TtsService';
import { VisionService } from '../services/VisionService';
import { IoTService, ObstacleEvent, IoTMode } from '../services/IOTService';
import { VoiceService, VoiceCommand } from '../services/VoiceService';
import type { LiveCameraHandle } from '../components/LiveCameraView';

// ─────────────────────────────────────────────────
// 2 chế độ chính
// ─────────────────────────────────────────────────
export type MainMode = 'walking' | 'static';

export const useAppController = () => {
  // ── State chính ──────────────────────────────
  const [mainMode, setMainMode] = useState<MainMode>('static');
  const [loading, setLoading] = useState(false);
  const [recognizedText, setRecognizedText] = useState('Chạm vào màn hình để bắt đầu.\nChạm 3 lần liên tiếp để chuyển chế độ.');
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);

  // Ref để gọi captureNow() trên LiveCameraView
  const liveCameraRef = useRef<LiveCameraHandle>(null);

  // IoT state (giữ nguyên cho demo/test)
  const [iotMode, setIotMode] = useState<IoTMode>('disconnected');
  const [iotAlert, setIotAlert] = useState<ObstacleEvent | null>(null);
  const iotSimulator = iotMode === 'simulator';

  // ── Triple-tap detection ─────────────────────
  const tapTimesRef = useRef<number[]>([]);
  const TRIPLE_TAP_WINDOW = 600; // 3 tap trong 600ms

  // ── Khởi tạo ────────────────────────────────
  useEffect(() => {
    TtsService.init();

    // Xin quyền camera 1 lần duy nhất khi mở app
    if (Platform.OS === 'android') {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA).catch(() => {});
    }

    // Voice command handler
    VoiceService.init((cmd: VoiceCommand, raw: string) => {
      console.log('🎙️ Lệnh:', cmd, '| Raw:', raw);
      handleVoiceCommand(cmd);
    });

    return () => {
      IoTService.stop();
      VoiceService.destroy();
    };
  }, []);

  // ── Xử lý lệnh giọng nói (chế độ tĩnh) ────
  const handleVoiceCommand = useCallback((cmd: VoiceCommand) => {
    setIsVoiceListening(false);

    switch (cmd) {
      case 'doc_sach':
        TtsService.speak('Đang chụp ảnh đọc sách.');
        captureAndProcess('ocr_doc');
        break;
      case 'tien':
        TtsService.speak('Đang chụp ảnh nhận diện tiền.');
        captureAndProcess('ocr_money');
        break;
      case 'menu':
        TtsService.speak('Đang chụp ảnh đọc menu.');
        captureAndProcess('ocr_menu');
        break;
      case 'chup':
        TtsService.speak('Đang chụp ảnh phân tích.');
        captureAndProcess('auto');
        break;
      default:
        TtsService.speak('Không hiểu lệnh. Hãy nói: đọc sách, tiền, menu, hoặc chụp ảnh.');
        break;
    }
  }, []);

  // ── Chuyển chế độ bằng triple-tap ───────────
  const handleTripleTap = useCallback(() => {
    const newMode: MainMode = mainMode === 'walking' ? 'static' : 'walking';
    setMainMode(newMode);
    setRecognizedText('');
    setIsVoiceListening(false);
    VoiceService.stopListening();

    if (newMode === 'walking') {
      TtsService.speak('Đã chuyển sang chế độ đi đường. Bật giả lập IoT để phát hiện vật cản, camera sẽ tự động chụp khi có cảnh báo.');
      setShowLiveCamera(true);
    } else {
      TtsService.speak('Đã chuyển sang chế độ tĩnh. Chạm vào màn hình để chụp ảnh. Giữ lâu để ra lệnh bằng giọng nói.');
      setShowLiveCamera(false);
    }
  }, [mainMode]);

  // ── Xử lý tap trên màn hình ─────────────────
  const handleScreenTap = useCallback(() => {
    const now = Date.now();
    const taps = tapTimesRef.current;

    // Thêm tap mới
    taps.push(now);

    // Chỉ giữ các tap trong cửa sổ thời gian
    while (taps.length > 0 && now - taps[0] > TRIPLE_TAP_WINDOW) {
      taps.shift();
    }

    // Triple-tap detected!
    if (taps.length >= 3) {
      taps.length = 0; // Reset
      handleTripleTap();
      return;
    }

    // Đợi xem có tap tiếp không (debounce cho single/double tap)
    setTimeout(() => {
      // Nếu sau 400ms mà vẫn chỉ 1 tap → single tap
      if (tapTimesRef.current.length === 1 && Date.now() - tapTimesRef.current[0] >= 350) {
        tapTimesRef.current = [];
        handleSingleTap();
      }
    }, 400);
  }, [mainMode, loading, handleTripleTap]);

  // ── Single tap: hành động chính tùy chế độ ──
  const handleSingleTap = useCallback(() => {
    if (loading) return;

    if (mainMode === 'walking') {
      // Chế độ đi đường: mở live camera nếu chưa mở
      if (!showLiveCamera) {
        TtsService.speak('Đang mở camera.');
        setShowLiveCamera(true);
      }
    } else {
      // Chế độ tĩnh: chụp ảnh + auto-detect
      TtsService.speak('Đang chụp ảnh.');
      captureAndProcess('auto');
    }
  }, [mainMode, loading, showLiveCamera]);

  // ── Long press: kích hoạt nhận dạng giọng nói ──
  const handleLongPress = useCallback(() => {
    if (mainMode !== 'static') return;

    TtsService.speak('Đang lắng nghe lệnh. Hãy nói: đọc sách, tiền, menu, hoặc chụp ảnh.');
    setIsVoiceListening(true);
    VoiceService.startListening();
  }, [mainMode]);

  // ── Chụp ảnh + xử lý theo loại ──────────────
  type ProcessType = 'auto' | 'ocr_doc' | 'ocr_money' | 'ocr_menu';

  const captureAndProcess = async (type: ProcessType) => {
    const options: CameraOptions = {
      mediaType: 'photo',
      saveToPhotos: false,
      quality: 1,
      maxWidth: 4000,
      maxHeight: 4000,
    };

    try {
      const result = await launchCamera(options);
      const uri = result.assets?.[0]?.uri;
      if (!uri) {
        TtsService.speak('Không chụp được ảnh.');
        return;
      }
      await processImage(uri, type);
    } catch (error) {
      console.error('Camera error:', error);
      TtsService.speak('Lỗi khi mở camera.');
    }
  };

  const processImage = async (imageUri: string, type: ProcessType) => {
    setLoading(true);
    TtsService.speak('Đang phân tích ảnh, vui lòng đợi.');

    try {
      let resultText = '';

      switch (type) {
        case 'ocr_doc':
          resultText = await VisionService.processDocumentOCR(imageUri);
          break;
        case 'ocr_money':
          resultText = await VisionService.processMoneyOCR(imageUri);
          break;
        case 'ocr_menu':
          resultText = await VisionService.processMenuOCR(imageUri);
          break;
        case 'auto':
        default:
          resultText = await VisionService.processAutoDetect(imageUri);
          break;
      }

      setRecognizedText(resultText);
      TtsService.speak(resultText);
    } catch (error) {
      console.error(error);
      TtsService.speak('Có lỗi xảy ra trong quá trình phân tích.');
    } finally {
      setLoading(false);
    }
  };

  // ── Gallery (giữ cho testing) ────────────────
  const handleGallery = async () => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 1,
      maxWidth: 3000,
      maxHeight: 3000,
    };
    const result = await launchImageLibrary(options);
    if (result.assets?.[0]?.uri) {
      await processImage(result.assets[0].uri, 'auto');
    }
  };

  // ── IoT cảnh báo → chụp ảnh khi đi đường ─────
  const handleIoTAlert = useCallback((event: ObstacleEvent) => {
    setIotAlert(event);

    if (event.level === 'danger') {
      TtsService.speakUrgent(`Nguy hiểm! Vật cản cách ${event.distance} xăng ti mét!`);
      if (liveCameraRef.current) {
        liveCameraRef.current.captureNow();
      }
    } else if (event.level === 'caution') {
      TtsService.speak(`Chú ý! Vật cản cách ${event.distance} xăng ti mét.`);
      if (liveCameraRef.current) {
        liveCameraRef.current.captureNow();
      }
    }
    // safe: không nói gì, không chụp
  }, []);

  // ── Đóng live camera ────────────────────────
  const handleCloseLiveCamera = () => {
    setShowLiveCamera(false);
    if (mainMode === 'walking') {
      TtsService.speak('Đã tạm dừng camera. Chạm để mở lại.');
    }
  };

  // ── IoT (giữ nguyên cho demo) ───────────────
  const toggleIoT = async (preferSimulator: boolean) => {
    if (IoTService.isActive) {
      IoTService.stop();
      setIotMode('disconnected');
      setIotAlert(null);
    } else {
      const resultMode = await IoTService.start(handleIoTAlert, preferSimulator);
      setIotMode(resultMode);
    }
  };

  const testIoTSignal = (signal: 'danger' | 'caution' | 'safe') => {
    IoTService.testSignal(signal);
  };

  return {
    mainMode,
    loading,
    recognizedText,
    showLiveCamera,
    isVoiceListening,
    liveCameraRef,
    // IoT (giữ cho demo)
    iotMode, iotAlert, iotSimulator,
    // Actions
    handleScreenTap,
    handleLongPress,
    handleCloseLiveCamera,
    handleGallery,
    toggleIoT,
    testIoTSignal,
  };
};