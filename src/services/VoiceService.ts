/**
 * VoiceService – Nhận dạng giọng nói tiếng Việt
 * Dùng @react-native-voice/voice
 *
 * Lệnh hỗ trợ (chế độ tĩnh):
 *   "đọc sách" / "đọc" / "read"       → chụp + OCR tài liệu
 *   "tiền" / "mệnh giá"               → chụp + nhận diện tiền
 *   "menu" / "thực đơn" / "bảng giá"  → chụp + OCR menu
 *   "chụp" / "chụp ảnh"               → chụp + auto-detect
 */

import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';

export type VoiceCommand =
  | 'doc_sach'   // đọc sách / tài liệu
  | 'tien'       // nhận diện tiền
  | 'menu'       // đọc menu / bảng giá
  | 'chup'       // chụp ảnh auto-detect
  | 'unknown';

export type VoiceCommandCallback = (cmd: VoiceCommand, raw: string) => void;

// ─────────────────────────────────────────
// Parse lệnh từ chuỗi nhận dạng
// ─────────────────────────────────────────
function parseCommand(text: string): VoiceCommand {
  const lower = text.toLowerCase().trim();

  if (/đọc\s*sách|đọc\s*văn|đọc\s*tài\s*liệu|read|doc\s*sach/.test(lower)) return 'doc_sach';
  if (/đọc/.test(lower)) return 'doc_sach'; // "đọc" đứng riêng = đọc sách
  if (/tiền|mệnh\s*giá|tien|menh\s*gia/.test(lower)) return 'tien';
  if (/menu|thực\s*đơn|bảng\s*giá|bang\s*gia|thuc\s*don/.test(lower)) return 'menu';
  if (/chụp|chup|ảnh|anh|capture/.test(lower)) return 'chup';

  return 'unknown';
}

// ─────────────────────────────────────────
// Singleton service
// ─────────────────────────────────────────
let _callback: VoiceCommandCallback | null = null;
let _isListening = false;

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
    try {
      _isListening = true;
      await Voice.start('vi-VN');
      console.log('🎙️ [Voice] Bắt đầu lắng nghe...');
    } catch (err) {
      console.error('🎙️ [Voice] Lỗi start:', err);
      _isListening = false;
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
  },
};
