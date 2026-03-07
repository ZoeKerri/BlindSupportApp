import TextRecognition, { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import ImageLabeling from '@react-native-ml-kit/image-labeling';

// ========================================
// HELPER: Lọc noise cho OCR text
// ========================================
const cleanOCRText = (text: string): string => {
  return text
    .replace(/[|\\{}\[\]<>~`]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// ========================================
// HELPER: Kiểm tra line có phải noise không
// Noise = chữ lẻ, ký tự rác, bleed-through
// ========================================
const isNoiseLine = (text: string): boolean => {
  const cleaned = text.trim();
  // Quá ngắn (1-2 ký tự đơn lẻ)
  if (cleaned.length <= 2) return true;
  // Toàn dấu chấm, dấu phẩy, ký tự đơn cách nhau ("töa. lươ. Ara.")
  const dotFragments = cleaned.split(/[.,:;!?]+/).filter(s => s.trim().length > 0);
  if (dotFragments.length >= 2 && dotFragments.every(f => f.trim().length <= 3)) return true;
  // Tỷ lệ ký tự lạ quá cao (không phải tiếng Việt)
  const vietnamese = cleaned.match(/[a-zA-ZÀ-ỹ0-9\s.,!?;:]+/g);
  const vnLen = vietnamese ? vietnamese.join('').length : 0;
  if (vnLen < cleaned.length * 0.5) return true;
  return false;
};

// ========================================
// HELPER: Chuẩn hóa số tiền VND
// ========================================
const normalizeMoneyText = (raw: string): string => {
  return raw.replace(/[\s.,]/g, '');
};

// ========================================
// HELPER: Tìm mệnh giá VND từ chuỗi OCR
// ========================================
const VALID_DENOMINATIONS = [
  500000, 200000, 100000, 50000, 20000, 10000,
  5000, 2000, 1000, 500
];

const DENOMINATION_LABELS: Record<number, string> = {
  500000: 'năm trăm nghìn đồng',
  200000: 'hai trăm nghìn đồng',
  100000: 'một trăm nghìn đồng',
  50000: 'năm mươi nghìn đồng',
  20000: 'hai mươi nghìn đồng',
  10000: 'mười nghìn đồng',
  5000: 'năm nghìn đồng',
  2000: 'hai nghìn đồng',
  1000: 'một nghìn đồng',
  500: 'năm trăm đồng',
};

// Nhận diện mệnh giá qua chữ viết tiếng Việt trên tiền
const WORD_DENOMINATIONS: [RegExp, number][] = [
  [/năm\s*trăm\s*(nghìn|ngàn)/i, 500000],
  [/hai\s*trăm\s*(nghìn|ngàn)/i, 200000],
  [/một\s*trăm\s*(nghìn|ngàn)/i, 100000],
  [/năm\s*mươi\s*(nghìn|ngàn)/i, 50000],
  [/hai\s*mươi\s*(nghìn|ngàn)/i, 20000],
  [/mười\s*(nghìn|ngàn)/i, 10000],
  [/năm\s*(nghìn|ngàn)/i, 5000],
  [/hai\s*(nghìn|ngàn)/i, 2000],
  [/một\s*(nghìn|ngàn)/i, 1000],
];

const findDenomination = (ocrText: string): number | null => {
  // 1. Tìm số trực tiếp
  const normalized = normalizeMoneyText(ocrText);
  const numberMatches = normalized.match(/\d{3,6}/g);
  if (numberMatches) {
    for (const numStr of numberMatches) {
      const num = parseInt(numStr, 10);
      if (VALID_DENOMINATIONS.includes(num)) return num;
    }
  }

  // 2. Pattern có dấu chấm/phẩy (500.000, 200,000...)
  const dotPatterns = ocrText.match(/\d{1,3}[\s.,]\d{3}/g);
  if (dotPatterns) {
    for (const pat of dotPatterns) {
      const num = parseInt(normalizeMoneyText(pat), 10);
      if (VALID_DENOMINATIONS.includes(num)) return num;
    }
  }

  // 3. Chữ viết tiếng Việt (NĂM TRĂM NGHÌN ĐỒNG...)
  const lower = ocrText.toLowerCase();
  for (const [regex, value] of WORD_DENOMINATIONS) {
    if (regex.test(lower)) return value;
  }

  return null;
};

// ========================================
// HELPER: Tính chiều cao trung bình của line
// ========================================
const calcAverageLineHeight = (lines: any[]): number => {
  const heights = lines
    .filter((l: any) => l.frame && l.frame.height > 0)
    .map((l: any) => l.frame.height);
  if (heights.length === 0) return 20;
  return heights.reduce((a: number, b: number) => a + b, 0) / heights.length;
};

// ========================================
// HELPER: Phát hiện có phải biển báo không
// - Biển báo thường ít chữ, có từ khóa đặc trưng
// ========================================
const SIGN_KEYWORDS = [
  'cấm', 'dừng', 'stop', 'lối ra', 'exit', 'thoát hiểm', 'cứu hỏa',
  'nguy hiểm', 'cảnh báo', 'warning', 'danger', 'no', 'tốc độ',
  'km/h', 'kmh', 'một chiều', 'cấm vào', 'lối vào', 'entrance',
  'toilet', 'wc', 'vệ sinh', 'tầng', 'phòng', 'số', 'thoát',
];

const isLikelySign = (text: string, blockCount: number): boolean => {
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  // Biển báo thường ngắn (ít chữ) hoặc có từ khóa biển báo
  const hasSignKeyword = SIGN_KEYWORDS.some(kw => lower.includes(kw));
  const isShortText = wordCount <= 8 && blockCount <= 2;

  return hasSignKeyword || isShortText;
};

// ========================================
// HELPER: Phát hiện có phải menu/bảng giá không
// - Có giá tiền, nhiều dòng, cấu trúc 2 cột
// ========================================
const isLikelyMenu = (text: string, blockCount: number): boolean => {
  const lower = text.toLowerCase();
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  // Từ khóa menu/bảng hiệu rõ ràng → ưu tiên cao nhất
  const menuKeywords = ['menu', 'thực đơn', 'bảng giá', 'món', 'combo', 'set', 'phần',
    'coffee', 'cafe', 'trà', 'nước', 'ăn', 'uống', 'order'];
  const hasMenuKeyword = menuKeywords.some(kw => lower.includes(kw));
  if (hasMenuKeyword) return true;

  // Phải có RẤT NHIỀU dòng (>=6) + pattern giá rõ ràng (có đ/k/nghìn)
  // → loại trừ tờ tiền chỉ có vài dòng chữ lớn
  const hasExplicitPriceUnit = /\d+[.,]?\d*\s*(đ|vnd|k\b|nghìn|đồng)/i.test(lower);
  const hasManyLines = lines.length >= 6;

  return hasExplicitPriceUnit && hasManyLines;
};

export const VisionService = {

  // ==========================================
  // AUTO-DETECT: Tự động nhận diện loại nội dung
  // Thứ tự ưu tiên: tiền → biển báo → menu → sách → vật thể
  // ==========================================
  processAutoDetect: async (imageUri: string): Promise<string> => {
    try {
      // Chạy OCR trước
      const ocrResult: TextRecognitionResult = await TextRecognition.recognize(imageUri);
      const hasText = ocrResult.text && ocrResult.blocks.length > 0;

      console.log('🤖 [AutoDetect] Có chữ:', hasText, '| Blocks:', ocrResult.blocks.length);
      console.log('🤖 [AutoDetect] Raw text:', ocrResult.text?.substring(0, 200));

      if (hasText) {
        const fullText = ocrResult.text;
        const blockCount = ocrResult.blocks.length;

        // --- Ưu tiên 1: Menu / Bảng giá ---
        // Kiểm tra menu TRƯỚC tiền để tránh nhầm giá menu thành mệnh giá tiền
        if (isLikelyMenu(fullText, blockCount)) {
          console.log('🏷️ [AutoDetect] → Menu');
          return VisionService._extractMenuText(ocrResult);
        }

        // --- Ưu tiên 2: Tiền giấy VND ---
        // Chỉ nhận diện tiền khi KHÔNG phải menu và có mệnh giá rõ ràng
        const blocksByHeight = [...ocrResult.blocks]
          .filter(b => b.frame)
          .sort((a, b) => (b.frame?.height ?? 0) - (a.frame?.height ?? 0));

        let denomination: number | null = null;
        for (const block of blocksByHeight) {
          denomination = findDenomination(block.text);
          if (denomination) break;
        }
        if (!denomination) denomination = findDenomination(fullText);

        if (denomination) {
          const label = DENOMINATION_LABELS[denomination];
          console.log('💰 [AutoDetect] → Tiền:', denomination);
          return `Đây là tờ ${label}.`;
        }

        // --- Ưu tiên 3: Biển báo ---
        if (isLikelySign(fullText, blockCount)) {
          console.log('🚦 [AutoDetect] → Biển báo');
          return VisionService._extractSignText(ocrResult);
        }

        // --- Ưu tiên 4: Tài liệu / Sách (nhiều chữ) ---
        console.log('📖 [AutoDetect] → Tài liệu');
        return VisionService._extractDocumentText(ocrResult);
      }

      // --- Không có chữ → Nhận diện vật thể ---
      console.log('🔍 [AutoDetect] → Vật thể');
      return await VisionService._detectObjects(imageUri);

    } catch (error) {
      console.error('❌ Lỗi AutoDetect:', error);
      return 'Có lỗi xảy ra khi phân tích ảnh.';
    }
  },

  // ==========================================
  // INTERNAL: Trích xuất văn bản biển báo
  // ==========================================
  _extractSignText: (result: TextRecognitionResult): string => {
    const sortedBlocks = [...result.blocks].sort((a, b) =>
      (a.frame?.top ?? 0) - (b.frame?.top ?? 0)
    );

    const lines = sortedBlocks
      .map(block => cleanOCRText(block.text))
      .filter(t => t.length > 0);

    if (lines.length === 0) return 'Không đọc được biển báo.';

    const text = lines.join('. ');
    return `Biển báo: ${text}.`;
  },

  // ==========================================
  // INTERNAL: Trích xuất văn bản tài liệu
  // ==========================================
  _extractDocumentText: (result: TextRecognitionResult): string => {
    // Lọc nhiễu: bỏ chữ quá nhỏ so với trung bình
    const allDocLines = result.blocks.flatMap(b => b.lines || []);
    const avgH = calcAverageLineHeight(allDocLines);
    const minH = avgH * 0.4; // tăng ngưỡng lọc (40% thay vì 25%)

    // Tìm vùng text chính (block có nhiều line nhất = nội dung chính)
    // → lọc bỏ text rìa/bleed-through
    const blocksWithArea = result.blocks
      .filter(b => (b.lines?.length ?? 0) > 0)
      .map(b => ({
        block: b,
        area: (b.frame?.width ?? 0) * (b.frame?.height ?? 0),
        lineCount: b.lines?.length ?? 0,
      }));

    // Tìm block chính (diện tích lớn nhất)
    const maxArea = Math.max(...blocksWithArea.map(b => b.area), 1);
    // Bỏ block quá nhỏ so với block chính (< 10% diện tích) = noise/bleed-through
    const significantBlocks = blocksWithArea
      .filter(b => b.area > maxArea * 0.1)
      .map(b => b.block);

    const sortedBlocks = [...significantBlocks].sort((a, b) =>
      (a.frame?.top ?? 0) - (b.frame?.top ?? 0)
    );

    const paragraphs: string[] = [];

    for (const block of sortedBlocks) {
      const lines = block.lines || [];
      if (lines.length === 0) continue;

      const sortedLines = [...lines]
        .filter(line => (line.frame?.height ?? 999) >= minH)
        .sort((a, b) => (a.frame?.top ?? 0) - (b.frame?.top ?? 0));

      const blockText = sortedLines
        .map(line => cleanOCRText(line.text))
        .filter(t => t.length > 2 && !isNoiseLine(t))
        .join(' ');

      if (blockText.length > 3) paragraphs.push(blockText);
    }

    if (paragraphs.length === 0) return 'Không tìm thấy chữ rõ ràng trong ảnh.';
    return paragraphs.join('. ');
  },

  // ==========================================
  // INTERNAL: Trích xuất menu/bảng giá
  // ==========================================
  _extractMenuText: (result: TextRecognitionResult): string => {
    interface OCRLine {
      text: string; top: number; left: number;
      height: number; width: number; bottom: number; right: number;
    }

    let allLines: OCRLine[] = [];

    for (const block of result.blocks) {
      for (const line of (block.lines || [])) {
        const rect = line.frame;
        if (!rect) continue;
        const cleaned = cleanOCRText(line.text);
        if (cleaned.length < 1) continue;
        allLines.push({
          text: cleaned,
          top: rect.top, left: rect.left,
          height: rect.height || 20, width: rect.width || 50,
          bottom: (rect.top || 0) + (rect.height || 20),
          right: (rect.left || 0) + (rect.width || 50),
        });
      }
    }

    if (allLines.length === 0) return 'Không đọc được nội dung.';

    const avgLineHeight = calcAverageLineHeight(
      result.blocks.flatMap(b => b.lines || [])
    );
    const Y_TOLERANCE = Math.max(avgLineHeight * 0.5, 8);

    allLines.sort((a, b) => a.top - b.top);

    const rows: OCRLine[][] = [];
    let currentRow: OCRLine[] = [allLines[0]];

    for (let i = 1; i < allLines.length; i++) {
      const line = allLines[i];
      const avgRowTop = currentRow.reduce((sum, l) => sum + l.top, 0) / currentRow.length;
      if (Math.abs(line.top - avgRowTop) <= Y_TOLERANCE) {
        currentRow.push(line);
      } else {
        rows.push(currentRow);
        currentRow = [line];
      }
    }
    if (currentRow.length > 0) rows.push(currentRow);

    const menuItems: string[] = [];
    for (const row of rows) {
      row.sort((a, b) => a.left - b.left);
      if (row.length >= 2) {
        const gaps: number[] = [];
        for (let i = 1; i < row.length; i++) {
          gaps.push(row[i].left - row[i - 1].right);
        }
        const maxGap = Math.max(...gaps);
        const avgWidth = row.reduce((s, l) => s + l.width, 0) / row.length;
        if (maxGap > avgWidth * 1.5) {
          const gapIndex = gaps.indexOf(maxGap);
          const leftPart = row.slice(0, gapIndex + 1).map(l => l.text).join(' ');
          const rightPart = row.slice(gapIndex + 1).map(l => l.text).join(' ');
          menuItems.push(`${leftPart}, giá ${rightPart}`);
        } else {
          menuItems.push(row.map(l => l.text).join(' '));
        }
      } else {
        menuItems.push(row[0].text);
      }
    }

    return menuItems.filter(item => item.length > 0).join('. ') || 'Không đọc được nội dung.';
  },

  // ==========================================
  // INTERNAL: Nhận diện vật thể bằng ML Kit Image Labeling
  // ==========================================
  _detectObjects: async (imageUri: string): Promise<string> => {
    try {
      const labels = await ImageLabeling.label(imageUri);
      if (!labels || labels.length === 0) return 'Không phát hiện vật thể nào rõ ràng.';

      const top = labels
        .filter(obj => obj.confidence > 0.5)
        .sort((a, b) => b.confidence - a.confidence)[0];

      if (top) return `Phát hiện: ${top.text}.`;
      return 'Không có vật thể rõ ràng phía trước.';
    } catch (error) {
      console.error('❌ Lỗi object detection:', error);
      return 'Lỗi xử lý nhận diện vật thể.';
    }
  },

  // ==========================================
  // PUBLIC (giữ lại để tương thích nếu cần)
  // ==========================================
  processDocumentOCR: async (imageUri: string): Promise<string> => {
    const result = await TextRecognition.recognize(imageUri);
    if (!result.text || result.blocks.length === 0) return 'Không tìm thấy chữ trong tài liệu này.';
    return VisionService._extractDocumentText(result);
  },

  processMenuOCR: async (imageUri: string): Promise<string> => {
    const result = await TextRecognition.recognize(imageUri);
    if (!result.text || result.blocks.length === 0) return 'Không tìm thấy thông tin trên bảng hiệu.';
    return VisionService._extractMenuText(result);
  },

  processMoneyOCR: async (imageUri: string): Promise<string> => {
    const result = await TextRecognition.recognize(imageUri);
    if (!result.text || result.blocks.length === 0) return 'Không nhận diện được tờ tiền. Hãy chụp rõ hơn.';

    // Thu thập text + chiều cao khung → chữ lớn nhất = mệnh giá
    const allPieces: Array<{ text: string; height: number }> = [];
    for (const block of result.blocks) {
      if (block.frame) allPieces.push({ text: block.text, height: block.frame.height || 0 });
      for (const line of (block.lines || [])) {
        if (line.frame) allPieces.push({ text: line.text, height: line.frame.height || 0 });
      }
    }

    // Sắp xếp theo kích thước giảm dần – chữ lớn nhất = mệnh giá
    allPieces.sort((a, b) => b.height - a.height);
    for (const piece of allPieces) {
      const denom = findDenomination(piece.text);
      if (denom) return `Đây là tờ ${DENOMINATION_LABELS[denom]}.`;
    }

    // Fallback: thử toàn bộ text
    const denom = findDenomination(result.text);
    if (denom) return `Đây là tờ ${DENOMINATION_LABELS[denom]}.`;

    // Đọc chữ lớn nhất cho user biết
    if (allPieces.length > 0) {
      return `Không xác định được mệnh giá. Đọc được: "${allPieces[0].text}". Hãy chụp rõ mặt có số tiền.`;
    }
    return 'Không nhận diện được mệnh giá. Hãy chụp rõ mặt có số tiền.';
  },

  processSignOCR: async (imageUri: string): Promise<string> => {
    const result = await TextRecognition.recognize(imageUri);
    if (!result.text || result.blocks.length === 0) return 'Không tìm thấy nội dung biển báo.';
    return VisionService._extractSignText(result);
  },

  processObjectDetection: async (imageUri: string): Promise<string> => {
    return VisionService._detectObjects(imageUri);
  },
};