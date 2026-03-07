import Tts from 'react-native-tts';
import { Vibration } from 'react-native';

let ttsAvailable = false;

export const TtsService = {
  init: () => {
    try {
      Tts.setDefaultLanguage('vi-VN')
        .then(() => {
          ttsAvailable = true;
          Tts.speak('Ứng dụng đã sẵn sàng.');
        })
        .catch(() => {
          ttsAvailable = false;
          Vibration.vibrate([0, 200, 100, 200]); // rung thông báo
        });
    } catch {
      ttsAvailable = false;
      Vibration.vibrate([0, 200, 100, 200]);
    }
  },
  speak: (text: string) => {
    if (ttsAvailable) {
      Tts.stop();
      Tts.speak(text);
    } else {
      Vibration.vibrate(300);
    }
  },
  speakUrgent: (text: string) => {
    if (ttsAvailable) {
      Tts.stop();
      Tts.setDefaultRate(0.55);
      Tts.speak(text);
      Tts.setDefaultRate(0.5);
    } else {
      Vibration.vibrate([0, 400, 100, 400, 100, 400]); // rung liên tục 3 lần
    }
  },
  stop: () => {
    if (ttsAvailable) Tts.stop();
  },
};