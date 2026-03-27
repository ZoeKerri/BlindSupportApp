/**
 * VoiceService – Nhận dạng giọng nói tiếng Việt
 * Dùng @react-native-voice/voice
 *
 * Lệnh hỗ trợ (chế độ tĩnh):
 *   "đọc sách" / "đọc" / "read"       → chụp ngay + OCR tài liệu
 *   "help" / "hướng dẫn"              → đọc hướng dẫn sử dụng
 */

import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';

export type VoiceCommand =
  | 'doc_sach'   // đọc sách / tài liệu
  | 'help'       // đọc hướng dẫn nhanh
  | 'unknown';

export type VoiceCommandCallback = (cmd: VoiceCommand, raw: string) => void;

// ─────────────────────────────────────────
// Parse lệnh từ chuỗi nhận dạng
// ─────────────────────────────────────────
function parseCommand(text: string): VoiceCommand {
  const lower = text.toLowerCase().trim();

  if (/đọc\s*sách|đọc\s*văn|đọc\s*tài\s*liệu|read|doc\s*sach/.test(lower)) return 'doc_sach';
  if (/đọc/.test(lower)) return 'doc_sach'; // "đọc" đứng riêng = đọc sách
  if (/help|hướng\s*dẫn|huong\s*dan|trợ\s*giúp|tro\s*giup/.test(lower)) return 'help';

  return 'unknown';
}

// ─────────────────────────────────────────
// Singleton service
// ─────────────────────────────────────────
let _callback: VoiceCommandCallback | null = null;
let _isListening = false;
let _isAvailable: boolean | null = null;

const isSpeechServiceMissingError = (err: unknown): boolean => {
  const message = String((err as any)?.message ?? err ?? '').toLowerCase();
  return message.includes('service not registered') || message.includes('speechrecognizer');
};

export const VoiceService = {
  /**
   * Khởi tạo Voice engine + đăng ký listeners
   */
  init: (onCommand: VoiceCommandCallback) => {
    _callback = onCommand;

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const results = e.value;
      if (!results || results.length === 0) return;

      const bestResult = results[0] ?? '';
      console.log('🎙️ [Voice] Kết quả:', bestResult);

      const cmd = parseCommand(bestResult);
      _callback?.(cmd, bestResult);
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      console.log('🎙️ [Voice] Error:', e.error);
      _isListening = false;
    };

    Voice.onSpeechEnd = () => {
      _isListening = false;
    };
  },

  /**
   * Bắt đầu lắng nghe giọng nói
   */
  startListening: async () => {
    if (_isListening) return;

    if (_isAvailable === null) {
      try {
        _isAvailable = Boolean(await Voice.isAvailable());
      } catch {
        _isAvailable = false;
      }
    }

    if (_isAvailable === false) {
      console.warn('🎙️ [Voice] Speech recognition service is unavailable on this device.');
      return false;
    }

    try {
      _isListening = true;
      await Voice.start('vi-VN');
      console.log('🎙️ [Voice] Bắt đầu lắng nghe...');
      return true;
    } catch (err) {
      if (isSpeechServiceMissingError(err)) {
        console.warn('🎙️ [Voice] Speech service not registered on this device/emulator.');
      } else {
        console.warn('🎙️ [Voice] Lỗi start:', err);
      }
      _isListening = false;
      return false;
    }
  },

  /**
   * Dừng lắng nghe
   */
  stopListening: async () => {
    try {
      await Voice.stop();
    } catch (_) {}
    _isListening = false;
  },

  /** Đang lắng nghe không */
  isListening: () => _isListening,

  /**
   * Hủy toàn bộ listeners khi unmount
   */
  destroy: () => {
    Voice.destroy().then(Voice.removeAllListeners).catch(() => {});
    _callback = null;
    _isListening = false;
    _isAvailable = null;
  },
};
