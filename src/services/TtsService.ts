import Tts from 'react-native-tts';

export const TtsService = {
  init: () => {
    Tts.setDefaultLanguage('vi-VN');
    Tts.speak('Ứng dụng đã sẵn sàng.');
  },
  speak: (text: string) => {
    Tts.stop();
    Tts.speak(text);
  },
  stop: () => Tts.stop(),
};