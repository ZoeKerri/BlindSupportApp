import Tts from 'react-native-tts';
import { Vibration } from 'react-native';

let ttsAvailable = false;
let initPromise: Promise<boolean> | null = null;

const safeVibrate = (pattern: number | number[]) => {
  try {
    Vibration.vibrate(pattern);
  } catch {
    // Ignore vibration errors on unsupported devices.
  }
};

const setPreferredLanguage = async () => {
  const candidates = ['vi-VN', 'vi'];

  for (const lang of candidates) {
    try {
      await Tts.setDefaultLanguage(lang);
      return;
    } catch {
      // Try next language candidate.
    }
  }
};

const ensureTtsReady = async (): Promise<boolean> => {
  if (ttsAvailable) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await Tts.getInitStatus();
      ttsAvailable = true;

      // Try Vietnamese first; if unavailable, keep engine default language.
      await setPreferredLanguage();
      return true;
    } catch (error: any) {
      ttsAvailable = false;

      if (error?.code === 'no_engine') {
        try {
          await Tts.requestInstallEngine();
        } catch {
          // Ignore install intent failure and fallback to vibration.
        }
      }

      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
};

export const TtsService = {
  init: () => {
    void ensureTtsReady();
  },
  speak: (text: string) => {
    void (async () => {
      if (!text?.trim()) return;

      const ready = await ensureTtsReady();
      if (ready) {
        await Tts.stop();
        Tts.speak(text);
        return;
      }

      safeVibrate(300);
    })();
  },
  speakUrgent: (text: string) => {
    void (async () => {
      if (!text?.trim()) return;

      const ready = await ensureTtsReady();
      if (ready) {
        await Tts.stop();
        await Tts.setDefaultRate(0.55);
        Tts.speak(text);
        await Tts.setDefaultRate(0.5);
        return;
      }

      safeVibrate([0, 400, 100, 400, 100, 400]); // rung liên tục 3 lần
    })();
  },
  stop: () => {
    if (ttsAvailable) Tts.stop();
  },
};