/**
 * CaptionService.ts
 * Gọi FastAPI backend: BLIP + Knowledge Graph + T5 LoRA → image caption
 *
 * Đổi DEFAULT_API_URL thành IP máy tính chạy FastAPI (cùng mạng Wi-Fi).
 *   Windows: ipconfig  |  Mac/Linux: ifconfig
 *   Ví dụ: http://192.168.1.5:8000
 */

export interface CaptionResult {
  caption: string;
  blip_caption: string;
  kg_context: string;
  inference_time_s: number;
}

const ensureHttpProtocol = (url: string): string => {
  const trimmed = url.trim().replace(/\/$/, '');
  if (!trimmed) return DEFAULT_API_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
};

// USB debug (khuyên dùng): chạy `adb reverse tcp:8000 tcp:8000` rồi dùng localhost.
// Nếu không dùng adb reverse: đổi sang IP Wi-Fi của máy tính.
const DEFAULT_API_URL = 'http://localhost:8000';
let _apiUrl = DEFAULT_API_URL;

export const CaptionService = {
  get apiUrl(): string {
    return _apiUrl;
  },

  setApiUrl(url: string) {
    _apiUrl = ensureHttpProtocol(url);
  },

  /** Kiểm tra server còn sống không (timeout 3s) */
  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${_apiUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  },

  /** Gửi ảnh lên API, trả về raw result object */
  async captionRaw(imageUri: string): Promise<CaptionResult> {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as any);

    // Timeout 60s — BLIP + T5 inference có thể chậm
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let response: Response;
    try {
      response = await fetch(`${_apiUrl}/caption`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).detail ?? `Lỗi máy chủ ${response.status}`);
    }

    return response.json() as Promise<CaptionResult>;
  },

  /**
   * Gửi ảnh, trả về chuỗi đã format để TTS đọc.
   * Ví dụ: "Phía trước: a person standing near a table."
   */
  async captionImage(imageUri: string): Promise<string> {
    const data = await CaptionService.captionRaw(imageUri);
    const caption = (data.caption || data.blip_caption || '').trim();
    if (!caption) return 'Không mô tả được ảnh.';
    // Bỏ prefix "Phía trước: "
    return caption;
  },
};
