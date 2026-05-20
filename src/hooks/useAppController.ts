import { useState, useEffect, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform, Vibration } from 'react-native';
import { launchCamera, launchImageLibrary, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';
import { TtsService } from '../services/TtsService';
import { VisionService } from '../services/VisionService';
import { CaptionService } from '../services/CaptionService';
import { IoTService, ObstacleEvent, IoTMode } from '../services/IOTService';
import { VoiceService, VoiceCommand } from '../services/VoiceService';
import type { LiveCameraHandle } from '../components/LiveCameraView';

export type MainMode = 'walking' | 'static';
export type CaptureMode = 'online' | 'offline';
export type OfflineProcessMode = 'object' | 'ocr';

export const useAppController = () => {
  const [mainMode, setMainMode] = useState<MainMode>('static');
  const [loading, setLoading] = useState(false);
  const [recognizedText, setRecognizedText] = useState(
    'Chạm vào màn hình để bắt đầu.\nChạm 3 lần liên tiếp để chuyển chế độ.'
  );
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [lastCapturedPhotoUri, setLastCapturedPhotoUri] = useState<string | null>(null);
  const [staticAutoCaptureDelayMs, setStaticAutoCaptureDelayMs] = useState(500);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('offline');
  const [offlineProcessMode, setOfflineProcessMode] = useState<OfflineProcessMode>('object');

  const liveCameraRef = useRef<LiveCameraHandle>(null);
  const voiceInitializedRef = useRef(false);

  const [iotMode, setIotMode] = useState<IoTMode>('disconnected');
  const [iotAlert, setIotAlert] = useState<ObstacleEvent | null>(null);
  const iotSimulator = iotMode === 'simulator';

  // ── Triple-tap detection ─────────────────────────────────────────────────
  const tapTimesRef = useRef<number[]>([]);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const TRIPLE_TAP_WINDOW = 1000;

  // Dùng ref để giữ giá trị mới nhất trong closure của setTimeout
  const mainModeRef = useRef<MainMode>('static');
  const loadingRef = useRef(false);
  const showLiveCameraRef = useRef(false);

  useEffect(() => { mainModeRef.current = mainMode; }, [mainMode]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { showLiveCameraRef.current = showLiveCamera; }, [showLiveCamera]);

  const ensureAudioPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (granted) return true;
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  // ── Khởi tạo ────────────────────────────────────────────────────────────
  useEffect(() => {
    TtsService.init();
    if (Platform.OS === 'android') {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA).catch(() => {});
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO).catch(() => {});
    }
    return () => {
      IoTService.stop();
      if (voiceInitializedRef.current) VoiceService.destroy();
    };
  }, []);

  // ── Voice commands ───────────────────────────────────────────────────────
  const handleVoiceCommand = useCallback((cmd: VoiceCommand) => {
    setIsVoiceListening(false);
    VoiceService.stopListening();
    switch (cmd) {
      case 'doc_sach':
        TtsService.speak('Đã nhận lệnh đọc sách. Đang chụp ngay.');
        setStaticAutoCaptureDelayMs(120);
        setShowLiveCamera(true);
        break;
      case 'help':
        TtsService.speak(
          'Hướng dẫn nhanh. Chạm một lần để chụp. Giữ lâu để ra lệnh giọng nói. Chạm 3 lần để đổi chế độ đi đường hoặc tĩnh. Ở chế độ offline, vuốt trái hoặc phải để đổi giữa phân tích vật thể và OCR. Lệnh giọng nói hỗ trợ: đọc sách và help.'
        );
        break;
      default:
        TtsService.speak('Không hiểu lệnh. Hãy nói: đọc sách hoặc help.');
        break;
    }
  }, []);

  // ── Toggle online / offline ──────────────────────────────────────────────
  const toggleCaptureMode = useCallback(() => {
    setCaptureMode(prev => {
      const next: CaptureMode = prev === 'offline' ? 'online' : 'offline';
      if (next === 'online') {
        TtsService.speak('Chế độ online. Ảnh sẽ gửi lên máy chủ để mô tả chi tiết hơn.');
      } else {
        TtsService.speak('Chế độ offline. Nhận diện trực tiếp trên thiết bị.');
      }
      return next;
    });
  }, []);

  const tryEnableOnlineMode = useCallback(async () => {
    if (captureMode === 'online') {
      TtsService.speak('Đang ở chế độ online.');
      return true;
    }
    TtsService.speak('Đang kiểm tra máy chủ online.');
    const healthy = await CaptionService.checkHealth();
    if (healthy) {
      setCaptureMode('online');
      TtsService.speak('Đã chuyển sang chế độ online.');
      return true;
    }
    TtsService.speak('Không kết nối được máy chủ online. Vẫn giữ chế độ offline.');
    return false;
  }, [captureMode]);

  const toggleOfflineProcessMode = useCallback(() => {
    if (captureMode !== 'offline') return;
    setOfflineProcessMode(prev => {
      const next: OfflineProcessMode = prev === 'object' ? 'ocr' : 'object';
      if (next === 'object') {
        TtsService.speak('Đã chuyển sang phân tích vật thể ngoại tuyến.');
      } else {
        TtsService.speak('Đã chuyển sang OCR ngoại tuyến để đọc chữ và nhận diện tiền.');
      }
      return next;
    });
  }, [captureMode]);

  // ── Triple tap → đổi chế độ ─────────────────────────────────────────────
  const handleTripleTap = useCallback(() => {
    const newMode: MainMode = mainModeRef.current === 'walking' ? 'static' : 'walking';
    setMainMode(newMode);
    setRecognizedText('');
    setIsVoiceListening(false);
    VoiceService.stopListening();

    if (newMode === 'walking') {
      TtsService.speak(
        'Đã chuyển sang chế độ đi đường. Bật giả lập IoT để phát hiện vật cản, camera sẽ tự động chụp khi có cảnh báo.'
      );
      setShowLiveCamera(true);
    } else {
      TtsService.speak(
        'Đã chuyển sang chế độ tĩnh. Chạm vào màn hình để chụp ảnh. Giữ lâu để ra lệnh bằng giọng nói.'
      );
      setShowLiveCamera(false);
    }
  }, []);

  // ── Xử lý tap chính ──────────────────────────────────────────────────────
  //
  // BUG CŨ:
  //   1. console.log nằm bên trong while loop → chạy mỗi lần shift, làm chậm
  //   2. singleTapTimerRef.current không được clear trước khi set mới
  //      → lần 2 tap vào khi timer lần 1 vẫn còn → stillSingleTap check fail
  //      → handleSingleTap không bao giờ được gọi ở lần chẵn
  //   3. Dùng state (mainMode, loading, showLiveCamera) trong setTimeout closure
  //      → giá trị bị stale (captured tại thời điểm tạo timer)
  //      → fix: dùng ref để đọc giá trị mới nhất
  //
  const handleScreenTap = useCallback(() => {
    const now = Date.now();
    const taps = tapTimesRef.current;

    taps.push(now);

    // Loại bỏ tap cũ ngoài cửa sổ (log ra ngoài loop)
    while (taps.length > 0 && now - taps[0] > TRIPLE_TAP_WINDOW) {
      taps.shift();
    }
    console.log(`📱 Tap count: ${taps.length}, window: ${TRIPLE_TAP_WINDOW}ms`);

    // Triple-tap
    if (taps.length >= 3) {
      console.log('🎯 Triple-tap detected! Switching mode...');
      // Huỷ single-tap timer nếu đang chờ
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      tapTimesRef.current = [];
      handleTripleTap();
      return;
    }

    // Single-tap: đợi 500ms để chắc không phải đầu của triple-tap
    // Chỉ set timer mới nếu chưa có timer nào đang chạy
    if (taps.length === 1 && !singleTapTimerRef.current) {
      singleTapTimerRef.current = setTimeout(() => {
        // Đọc từ ref để lấy giá trị mới nhất, không bị stale closure
        const currentTapCount = tapTimesRef.current.length;
        tapTimesRef.current = [];
        singleTapTimerRef.current = null;

        if (currentTapCount !== 1) return; // Đã có tap 2 hoặc triple → bỏ qua

        if (loadingRef.current) {
          TtsService.speak('Đang xử lý, vui lòng đợi.');
          return;
        }

        const mode = mainModeRef.current;
        const cameraOpen = showLiveCameraRef.current;

        if (mode === 'walking') {
          if (!cameraOpen) {
            TtsService.speak('Đang mở camera.');
            setShowLiveCamera(true);
          } else {
            liveCameraRef.current?.captureNow();
          }
        } else {
          // Chế độ tĩnh
          if (cameraOpen) {
            liveCameraRef.current?.captureNow();
          } else {
            TtsService.speak('Đang mở camera. Sẽ tự chụp sau nửa giây.');
            setShowLiveCamera(true);
          }
        }
      }, 500);
    }
    // Nếu taps.length === 2: chỉ đợi xem có tap thứ 3 không, không làm gì
  }, [handleTripleTap]);

  // ── Long press: voice ────────────────────────────────────────────────────
  const handleLongPress = useCallback(() => {
    const startVoiceFlow = async () => {
      const hasAudioPermission = await ensureAudioPermission();
      if (!hasAudioPermission) {
        setIsVoiceListening(false);
        Vibration.vibrate([0, 150, 80, 150]);
        TtsService.speak(
          'Chưa có quyền microphone. Vào Cài đặt ứng dụng để cấp quyền Microphone rồi thử lại.'
        );
        return;
      }

      TtsService.speak('Đang bật nhận dạng giọng nói. Hãy nói đọc sách hoặc help.');
      VoiceService.startListening()
        .then(started => {
          if (started) {
            setIsVoiceListening(true);
            TtsService.speak('Đang lắng nghe lệnh. Hãy nói đọc sách hoặc help.');
          } else {
            setIsVoiceListening(false);
            Vibration.vibrate([0, 150, 80, 150]);
            TtsService.speak(
              'Thiết bị chưa có dịch vụ nhận diện giọng nói. Vui lòng dùng chế độ chạm hoặc cài Google Speech Services.'
            );
          }
        })
        .catch(() => {
          setIsVoiceListening(false);
          Vibration.vibrate([0, 150, 80, 150]);
          TtsService.speak('Không bật được nhận dạng giọng nói trên thiết bị này.');
        });
    };

    if (mainModeRef.current !== 'static') {
      TtsService.speak(
        'Chế độ đi đường không dùng giữ lâu. Chạm 3 lần để về chế độ tĩnh rồi giữ lâu để bật giọng nói.'
      );
      return;
    }

    if (isVoiceListening) {
      setIsVoiceListening(false);
      VoiceService.stopListening();
      TtsService.speak('Đã tắt lắng nghe.');
      return;
    }

    if (!voiceInitializedRef.current) {
      try {
        VoiceService.init((cmd: VoiceCommand, raw: string) => {
          console.log('🎙️ Lệnh:', cmd, '| Raw:', raw);
          handleVoiceCommand(cmd);
        });
        voiceInitializedRef.current = true;
      } catch (error) {
        console.error('Voice init error:', error);
        TtsService.speak('Thiết bị chưa hỗ trợ nhận diện giọng nói.');
        return;
      }
    }

    void startVoiceFlow();
  }, [isVoiceListening, handleVoiceCommand, ensureAudioPermission]);

  // ── Chụp ảnh + xử lý ────────────────────────────────────────────────────
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

  const captureModeRef = useRef<CaptureMode>('offline');
  const offlineProcessModeRef = useRef<OfflineProcessMode>('object');
  useEffect(() => { captureModeRef.current = captureMode; }, [captureMode]);
  useEffect(() => { offlineProcessModeRef.current = offlineProcessMode; }, [offlineProcessMode]);

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
          // Đọc từ ref để tránh stale closure
          if (captureModeRef.current === 'online') {
            resultText = await CaptionService.captionImage(imageUri);
            if (!resultText || resultText.trim() === '') {
              resultText = 'Máy chủ không trả về kết quả. Vui lòng thử lại.';
            }
          } else {
            resultText = offlineProcessModeRef.current === 'object'
              ? await VisionService.processObjectDetection(imageUri)
              : await VisionService.processAutoDetect(imageUri);
          }
          break;
      }

      setRecognizedText(resultText);
      TtsService.speak(resultText);
    } catch (error) {
      console.error('processImage error:', error);
      const msg =
        error instanceof Error
          ? error.message
          : 'Có lỗi xảy ra trong quá trình phân tích.';
      setRecognizedText(msg);
      TtsService.speak(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Gallery ──────────────────────────────────────────────────────────────
  const handleGallery = async () => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 1,
      maxWidth: 3000,
      maxHeight: 3000,
    };
    const result = await launchImageLibrary(options);
    const selectedUri = result.assets?.[0]?.uri;
    if (selectedUri) {
      setLastCapturedPhotoUri(selectedUri);
      await processImage(selectedUri, 'auto');
    }
  };

  // ── IoT cảnh báo ─────────────────────────────────────────────────────────
  const handleIoTAlert = useCallback((event: ObstacleEvent) => {
    setIotAlert(event);
    if (event.level === 'danger') {
      TtsService.speakUrgent(`Nguy hiểm! Vật cản cách ${event.distance} xăng ti mét!`);
      liveCameraRef.current?.captureNow();
    } else if (event.level === 'caution') {
      TtsService.speak(`Chú ý! Vật cản cách ${event.distance} xăng ti mét.`);
      liveCameraRef.current?.captureNow();
    }
  }, []);

  // ── Đóng live camera ─────────────────────────────────────────────────────
  const handleCloseLiveCamera = () => {
    setShowLiveCamera(false);
    if (mainModeRef.current === 'walking') {
      TtsService.speak('Đã tạm dừng camera. Chạm để mở lại.');
    }
  };

  // ── Chế độ tĩnh: nhận ảnh từ camera nội bộ ──────────────────────────────
  //
  // BUG CŨ: setShowLiveCamera(false) và setStaticAutoCaptureDelayMs(500)
  // nằm sau await processImage(). Nếu processImage throw (hoặc trả về bình
  // thường nhưng state update bị batch/delay), hai dòng đó không chạy
  // → showLiveCamera kẹt true → lần tap tiếp theo gọi captureNow() vào
  // camera đang ở trạng thái bất định → lần chẵn không capture.
  //
  // FIX: dùng finally để đảm bảo luôn reset state dù thành công hay lỗi.
  //
  const handleStaticPhotoCaptured = useCallback(
    async (photoUri: string) => {
      setLastCapturedPhotoUri(photoUri);

      const processType: ProcessType =
        staticAutoCaptureDelayMs <= 150 ? 'ocr_doc' : 'auto';

      try {
        await processImage(photoUri, processType);
      } finally {
        // Luôn chạy: reset delay và đóng camera
        setStaticAutoCaptureDelayMs(500);
        setShowLiveCamera(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staticAutoCaptureDelayMs]
    // captureMode và offlineProcessMode đã được đọc qua ref bên trong processImage
    // nên không cần đưa vào deps array ở đây
  );

  // ── IoT controls ─────────────────────────────────────────────────────────
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
    lastCapturedPhotoUri,
    staticAutoCaptureDelayMs,
    showLiveCamera,
    isVoiceListening,
    captureMode,
    toggleCaptureMode,
    tryEnableOnlineMode,
    offlineProcessMode,
    toggleOfflineProcessMode,
    liveCameraRef,
    iotMode, iotAlert, iotSimulator,
    handleScreenTap,
    handleLongPress,
    handleCloseLiveCamera,
    handleStaticPhotoCaptured,
    handleGallery,
    toggleIoT,
    testIoTSignal,
  };
};