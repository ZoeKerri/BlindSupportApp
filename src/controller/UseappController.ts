import { useState, useEffect, useCallback, useRef } from 'react';
import { launchCamera, launchImageLibrary, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';
import { TtsService } from '../services/TtsService';
import { VisionService } from '../services/VisionService';
import { IoTService, ObstacleEvent, IoTMode } from '../services/IoTService';

export type AppMode = 'ocr_doc' | 'ocr_menu' | 'ocr_money' | 'ocr_sign' | 'object';

export const useAppController = () => {
  const [loading, setLoading] = useState(false);
  const [recognizedText, setRecognizedText] = useState('Chưa có nội dung');
  const [mode, setMode] = useState<AppMode>('ocr_menu');

  // IoT states
  const [iotMode, setIotMode] = useState<IoTMode>('disconnected');
  const [iotAlert, setIotAlert] = useState<ObstacleEvent | null>(null);
  const [iotSimulator, setIotSimulator] = useState(false); // dùng simulator hay thật

  // Tránh đọc TTS liên tục khi vật cản chưa đổi
  const lastAlertLevelRef = useRef<string>('safe');
  const alertCooldownRef = useRef<boolean>(false);

  useEffect(() => {
    TtsService.init();
  }, []);

  // ----------------------------------------
  // IoT: Xử lý khi nhận tín hiệu từ gậy
  // ----------------------------------------
  const handleObstacle = useCallback((event: ObstacleEvent) => {
    setIotAlert(event);

    // Tránh spam TTS: chỉ đọc nếu level thay đổi hoặc đã qua cooldown
    if (!alertCooldownRef.current || event.level !== lastAlertLevelRef.current) {
      if (event.level === 'danger') {
        TtsService.speakUrgent(event.message); // ưu tiên cao
      } else if (event.level === 'caution') {
        TtsService.speak(event.message);
      }
      lastAlertLevelRef.current = event.level;

      // Cooldown 2s cho danger, 5s cho caution
      alertCooldownRef.current = true;
      const cooldown = event.level === 'danger' ? 2000 : 5000;
      setTimeout(() => { alertCooldownRef.current = false; }, cooldown);
    }
  }, []);

  // ----------------------------------------
  // IoT: Kết nối / ngắt kết nối
  // ----------------------------------------
  const toggleIoT = useCallback(async (useSimulator: boolean) => {
    if (IoTService.isActive) {
      IoTService.stop();
      setIotMode('disconnected');
      setIotAlert(null);
      TtsService.speak('Đã tắt kết nối gậy dò đường.');
      return;
    }

    TtsService.speak(useSimulator ? 'Đang khởi động giả lập gậy dò đường.' : 'Đang kết nối gậy dò đường qua Bluetooth.');
    const resultMode = await IoTService.start(handleObstacle, useSimulator);
    setIotMode(resultMode);
    setIotSimulator(useSimulator);

    if (resultMode === 'ble') {
      TtsService.speak('Đã kết nối gậy dò đường thật qua Bluetooth.');
    } else if (resultMode === 'simulator') {
      TtsService.speak('Đang dùng chế độ giả lập gậy dò đường.');
    } else {
      TtsService.speak('Không kết nối được gậy dò đường.');
    }
  }, [handleObstacle]);

  // IoT: Test thủ công (nút test trong UI)
  const testIoTSignal = useCallback((type: 'danger' | 'caution' | 'safe') => {
    IoTService.testSignal(type);
  }, []);

  // ----------------------------------------
  // Đổi mode OCR/AI
  // ----------------------------------------
  const changeMode = (newMode: AppMode) => {
    setMode(newMode);
    setRecognizedText('Chưa có nội dung');

    const labels: Record<AppMode, string> = {
      ocr_doc:  'Chế độ đọc đoạn văn, tài liệu',
      ocr_menu: 'Chế độ đọc bảng hiệu, thực đơn',
      ocr_money: 'Chế độ nhận diện mệnh giá tiền',
      ocr_sign: 'Chế độ đọc biển báo',
      object:   'Chế độ nhận dạng vật thể offline',
    };
    TtsService.speak(labels[newMode]);
  };

  // ----------------------------------------
  // Xử lý ảnh theo mode
  // ----------------------------------------
  const processImage = async (imageUri: string) => {
    setLoading(true);
    TtsService.speak('Đang xử lý ảnh, vui lòng đợi.');

    try {
      let resultText = '';

      switch (mode) {
        case 'ocr_doc':
          resultText = await VisionService.processDocumentOCR(imageUri);
          break;
        case 'ocr_menu':
          resultText = await VisionService.processMenuOCR(imageUri);
          break;
        case 'ocr_money':
          resultText = await VisionService.processMoneyOCR(imageUri);
          break;
        case 'ocr_sign':
          resultText = await VisionService.processSignOCR(imageUri);
          break;
        case 'object':
          resultText = await VisionService.processObjectDetection(imageUri);
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

  // ----------------------------------------
  // Camera / Gallery
  // ----------------------------------------
  const handleCamera = async () => {
    const options: CameraOptions = {
      mediaType: 'photo',
      saveToPhotos: false,
      quality: 1,
      maxWidth: 4000,
      maxHeight: 4000,
    };
    const result = await launchCamera(options);
    if (result.assets?.[0]?.uri) processImage(result.assets[0].uri);
  };

  const handleGallery = async () => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 1,
      maxWidth: 3000,
      maxHeight: 3000,
    };
    const result = await launchImageLibrary(options);
    if (result.assets?.[0]?.uri) processImage(result.assets[0].uri);
  };

  return {
    mode, loading, recognizedText,
    iotMode, iotAlert, iotSimulator,
    changeMode, handleCamera, handleGallery,
    toggleIoT, testIoTSignal,
  };
};