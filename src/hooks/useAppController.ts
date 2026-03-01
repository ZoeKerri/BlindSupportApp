  import { useState, useEffect } from 'react';
  import { launchCamera, launchImageLibrary, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';
  import { TtsService } from '../services/TtsService';
  import { VisionService } from '../services/VisionService';

  export type AppMode = 'ocr_doc' | 'ocr_menu' | 'ocr_money' | 'object';

  export const useAppController = () => {
    const [loading, setLoading] = useState(false);
    const [recognizedText, setRecognizedText] = useState('Chưa có nội dung');
    const [mode, setMode] = useState<AppMode>('ocr_menu');

    useEffect(() => {
      TtsService.init();
    }, []);

    const changeMode = (newMode: AppMode) => {
      setMode(newMode);
      setRecognizedText('Chưa có nội dung');
      
      // Đọc thông báo cho người khiếm thị biết họ đang ở chế độ nào
      if (newMode === 'ocr_doc') TtsService.speak('Chế độ đọc đoạn văn, tài liệu');
      else if (newMode === 'ocr_menu') TtsService.speak('Chế độ đọc bảng hiệu, thực đơn');
      else if (newMode === 'ocr_money') TtsService.speak('Chế độ nhận diện mệnh giá tiền');
      else TtsService.speak('Chế độ nhận dạng vật thể offline');
    };

    const processImage = async (imageUri: string) => {
      setLoading(true);
      TtsService.speak('Đang xử lý ảnh, vui lòng đợi.');
      
      try {
        let resultText = '';
        
        // Định tuyến AI: Gọi đúng hàm tùy theo chế độ đang chọn
        if (mode === 'ocr_doc') {
          resultText = await VisionService.processDocumentOCR(imageUri);
        } else if (mode === 'ocr_menu') {
          resultText = await VisionService.processMenuOCR(imageUri);
        } else if (mode === 'ocr_money') {
          resultText = await VisionService.processMoneyOCR(imageUri);
        } else {
          resultText = await VisionService.processObjectDetection(imageUri);
        }
        
        setRecognizedText(resultText);
        TtsService.speak(resultText); // Đọc kết quả lên
        
      } catch (error) {
        console.error(error);
        TtsService.speak('Có lỗi xảy ra trong quá trình phân tích.');
      } finally {
        setLoading(false);
      }
    };

    const handleCamera = async () => {
      const options: CameraOptions = {
        mediaType: 'photo',
        saveToPhotos: false,
        quality: 1,        // Chất lượng cao nhất
        maxWidth: 4000,    // Giữ ảnh lớn cho OCR chính xác
        maxHeight: 4000,
      };
      const result = await launchCamera(options);
      if (result.assets?.[0]?.uri) processImage(result.assets[0].uri);
    };

    const handleGallery = async () => {
    const options: ImageLibraryOptions = { 
      mediaType: 'photo',
      quality: 1, // Ép giữ chất lượng cao nhất (100%)
      maxWidth: 3000, // Không cho nó bóp nhỏ ảnh lại
      maxHeight: 3000,
    };
    const result = await launchImageLibrary(options);
    if (result.assets?.[0]?.uri) processImage(result.assets[0].uri);
  };

    return {
      mode, loading, recognizedText,
      changeMode, handleCamera, handleGallery
    };
  };