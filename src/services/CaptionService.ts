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

// LDPlayer/Emulator: host machine thường là 192.168.56.1 (VirtualBox host-only adapter)
// Nếu dùng thiết bị thật: đổi thành IP WiFi của máy tính (ipconfig)
let _apiUrl = 'http://192.168.56.1:8000';

export const CaptionService = {
  get apiUrl(): string {
    return _apiUrl;
  },

  setApiUrl(url: string) {
    _apiUrl = url.replace(/\/$/, '');
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
    return `Phía trước: ${caption}.`;
  },
};
