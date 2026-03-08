import { useState, useEffect, useCallback, useRef } from 'react';
import { launchCamera, launchImageLibrary, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';
import { TtsService } from '../services/TtsService';
import { VisionService } from '../services/VisionService';
import { IoTService, ObstacleEvent, IoTMode } from '../services/IoTService';

export const useAppController = () => {
  const [loading, setLoading] = useState(false);
  const [recognizedText, setRecognizedText] = useState('Nhấn chụp ảnh để bắt đầu');

  // IoT states
  const [iotMode, setIotMode] = useState<IoTMode>('disconnected');
  const [iotAlert, setIotAlert] = useState<ObstacleEvent | null>(null);
  const [iotSimulator, setIotSimulator] = useState(false);

  const lastAlertLevelRef = useRef<string>('safe');
  const alertCooldownRef = useRef<boolean>(false);

  useEffect(() => {
    TtsService.init();
  }, []);

  // ----------------------------------------
  // IoT: Xử lý tín hiệu từ gậy
  // ----------------------------------------
  const handleObstacle = useCallback((event: ObstacleEvent) => {
    setIotAlert(event);

    if (!alertCooldownRef.current || event.level !== lastAlertLevelRef.current) {
      if (event.level === 'danger') {
        TtsService.speakUrgent(event.message);
      } else if (event.level === 'caution') {
        TtsService.speak(event.message);
      }
      lastAlertLevelRef.current = event.level;

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

    TtsService.speak(useSimulator
      ? 'Đang khởi động giả lập gậy dò đường.'
      : 'Đang kết nối gậy dò đường qua Bluetooth.'
    );

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

  const testIoTSignal = useCallback((type: 'danger' | 'caution' | 'safe') => {
    IoTService.testSignal(type);
  }, []);

  // ----------------------------------------
  // Xử lý ảnh - tự động nhận diện
  // ----------------------------------------
  const processImage = async (imageUri: string) => {
    setLoading(true);
    TtsService.speak('Đang phân tích ảnh, vui lòng đợi.');

    try {
      const resultText = await VisionService.processAutoDetect(imageUri);
      setRecognizedText(resultText);
      TtsService.speak(resultText);
    } catch (error) {
      console.error(error);
      const errMsg = 'Có lỗi xảy ra trong quá trình phân tích.';
      setRecognizedText(errMsg);
      TtsService.speak(errMsg);
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
    loading, recognizedText,
    iotMode, iotAlert, iotSimulator,
    handleCamera, handleGallery,
    toggleIoT, testIoTSignal,
  };
};