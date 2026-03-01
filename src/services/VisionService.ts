import TextRecognition, { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import ImageLabeling from '@react-native-ml-kit/image-labeling';

// ========================================
// HELPER: Lọc noise cho OCR text
// ========================================
const cleanOCRText = (text: string): string => {
  return text
    .replace(/[|\\{}\[\]<>~`]/g, '')  // Bỏ ký tự rác OCR hay nhầm
    .replace(/\s{2,}/g, ' ')           // Gộp khoảng trắng thừa
    .trim();
};

// ========================================
// HELPER: Chuẩn hóa số tiền VND
// ========================================
const normalizeMoneyText = (raw: string): string => {
  // Xóa tất cả dấu chấm, phẩy, khoảng trắng trong chuỗi số
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

const findDenomination = (ocrText: string): number | null => {
  // Chuẩn hóa: bỏ dấu chấm phẩy khoảng trắng
  const normalized = normalizeMoneyText(ocrText);

  // Tìm tất cả chuỗi số liên tiếp
  const numberMatches = normalized.match(/\d{3,6}/g);
  if (!numberMatches) return null;

  for (const numStr of numberMatches) {
    const num = parseInt(numStr, 10);
    if (VALID_DENOMINATIONS.includes(num)) {
      return num;
    }
  }

  // Fallback: tìm trong text gốc có dạng "500.000", "100,000", "50 000"
  const dotPatterns = ocrText.match(/\d{1,3}[\s.,]\d{3}/g);
  if (dotPatterns) {
    for (const pat of dotPatterns) {
      const num = parseInt(normalizeMoneyText(pat), 10);
      if (VALID_DENOMINATIONS.includes(num)) {
        return num;
      }
    }
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
  if (heights.length === 0) return 20; // fallback
  return heights.reduce((a: number, b: number) => a + b, 0) / heights.length;
};

export const VisionService = {

  // ==========================================
  // 1. CHỨC NĂNG ĐỌC SÁCH / TÀI LIỆU (cải tiến)
  // ==========================================
  processDocumentOCR: async (imageUri: string): Promise<string> => {
    try {
      const result: TextRecognitionResult = await TextRecognition.recognize(imageUri);
      if (!result.text || result.blocks.length === 0) {
        return 'Không tìm thấy chữ trong tài liệu này.';
      }

      console.log('📖 [OCR Doc] Số block:', result.blocks.length);

      // Sắp xếp block theo vị trí Y (trên → dưới) để đọc đúng thứ tự
      const sortedBlocks = [...result.blocks].sort((a, b) => {
        const aTop = a.frame?.top ?? 0;
        const bTop = b.frame?.top ?? 0;
        return aTop - bTop;
      });

      let paragraphs: string[] = [];

      for (const block of sortedBlocks) {
        // Mỗi block = 1 đoạn văn, đọc theo từng line trong block
        const lines = block.lines || [];
        if (lines.length === 0) continue;

        // Sắp xếp line theo Y trong block
        const sortedLines = [...lines].sort((a, b) => {
          const aTop = a.frame?.top ?? 0;
          const bTop = b.frame?.top ?? 0;
          return aTop - bTop;
        });

        const blockText = sortedLines
          .map(line => cleanOCRText(line.text))
          .filter(t => t.length > 0)
          .join(' ');

        if (blockText.length > 1) {
          paragraphs.push(blockText);
        }
      }

      if (paragraphs.length === 0) {
        return 'Không tìm thấy chữ rõ ràng trong tài liệu.';
      }

      // Nối các đoạn bằng dấu chấm để TTS đọc có ngắt
      const finalText = paragraphs.join('. ');
      console.log('📖 [OCR Doc] Kết quả:', finalText.substring(0, 200));
      return finalText;
    } catch (error) {
      console.error('Lỗi đọc tài liệu:', error);
      return 'Có lỗi xảy ra khi phân tích tài liệu.';
    }
  },

  // ==========================================
  // 2. CHỨC NĂNG ĐỌC MENU / BẢNG HIỆU (viết lại)
  //    - Dynamic Y tolerance dựa trên chiều cao chữ
  //    - Lọc noise, gom hàng thông minh hơn
  // ==========================================
  processMenuOCR: async (imageUri: string): Promise<string> => {
    try {
      const result: TextRecognitionResult = await TextRecognition.recognize(imageUri);
      if (!result.text || result.blocks.length === 0) {
        return 'Không tìm thấy thông tin trên bảng hiệu.';
      }

      console.log('🏷️ [OCR Menu] Raw text:', result.text);

      // --- Bước 1: Thu thập TẤT CẢ các line từ mọi block ---
      interface OCRLine {
        text: string;
        top: number;
        left: number;
        height: number;
        width: number;
        bottom: number;
        right: number;
      }

      let allLines: OCRLine[] = [];

      for (const block of result.blocks) {
        const lines = block.lines || [];
        for (const line of lines) {
          const rect = line.frame;
          if (!rect) continue;

          const cleaned = cleanOCRText(line.text);
          // Bỏ qua các mảnh text quá ngắn (noise)
          if (cleaned.length < 1) continue;

          allLines.push({
            text: cleaned,
            top: rect.top,
            left: rect.left,
            height: rect.height || 20,
            width: rect.width || 50,
            bottom: (rect.top || 0) + (rect.height || 20),
            right: (rect.left || 0) + (rect.width || 50),
          });
        }
      }

      if (allLines.length === 0) {
        return 'Không tìm thấy nội dung menu rõ ràng.';
      }

      // --- Bước 2: Tính dynamic Y tolerance ---
      // Dùng 50% chiều cao trung bình của dòng chữ làm ngưỡng gom hàng
      const avgLineHeight = calcAverageLineHeight(
        result.blocks.flatMap(b => b.lines || [])
      );
      const Y_TOLERANCE = Math.max(avgLineHeight * 0.5, 8);

      console.log('🏷️ [OCR Menu] Avg line height:', avgLineHeight, ', Y tolerance:', Y_TOLERANCE);

      // --- Bước 3: Sắp xếp theo Y (trên → dưới) ---
      allLines.sort((a, b) => a.top - b.top);

      // --- Bước 4: Gom các line cùng hàng (Y gần nhau) ---
      const rows: OCRLine[][] = [];
      let currentRow: OCRLine[] = [allLines[0]];

      for (let i = 1; i < allLines.length; i++) {
        const line = allLines[i];
        // So sánh với trung bình Y của hàng hiện tại (chính xác hơn so với chỉ line đầu)
        const avgRowTop = currentRow.reduce((sum, l) => sum + l.top, 0) / currentRow.length;

        if (Math.abs(line.top - avgRowTop) <= Y_TOLERANCE) {
          currentRow.push(line);
        } else {
          rows.push(currentRow);
          currentRow = [line];
        }
      }
      if (currentRow.length > 0) rows.push(currentRow);

      // --- Bước 5: Trong mỗi hàng, sắp xếp theo X (trái → phải) ---
      let menuItems: string[] = [];
      for (const row of rows) {
        row.sort((a, b) => a.left - b.left);

        // Tách tên món và giá (nếu có khoảng cách X lớn giữa 2 phần)
        if (row.length >= 2) {
          // Kiểm tra khoảng cách giữa các phần tử
          const gaps: number[] = [];
          for (let i = 1; i < row.length; i++) {
            gaps.push(row[i].left - row[i - 1].right);
          }
          const maxGap = Math.max(...gaps);
          const avgWidth = row.reduce((s, l) => s + l.width, 0) / row.length;

          // Nếu có khoảng cách lớn (> 2x chiều rộng trung bình), tách "tên - giá"
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

      // --- Bước 6: Tạo câu đọc tự nhiên ---
      const finalText = menuItems
        .filter(item => item.length > 0)
        .join('. ');

      console.log('🏷️ [OCR Menu] Kết quả:', finalText.substring(0, 300));
      return finalText || 'Không đọc được nội dung menu.';
    } catch (error) {
      console.error('Lỗi đọc menu:', error);
      return 'Có lỗi xảy ra khi phân tích bảng hiệu.';
    }
  },

  // ==========================================
  // 3. CHỨC NĂNG NHẬN DIỆN MỆNH GIÁ TIỀN (MỚI)
  //    - OCR + pattern matching cho VND
  //    - Nhận diện 500đ → 500.000đ
  // ==========================================
  processMoneyOCR: async (imageUri: string): Promise<string> => {
    try {
      const result: TextRecognitionResult = await TextRecognition.recognize(imageUri);
      if (!result.text || result.blocks.length === 0) {
        return 'Không nhận diện được tờ tiền. Hãy chụp rõ hơn.';
      }

      const fullText = result.text;
      console.log('💰 [OCR Money] Raw text:', fullText);

      // --- Cách 1: Tìm mệnh giá từ toàn bộ text ---
      const denomination = findDenomination(fullText);

      if (denomination) {
        const label = DENOMINATION_LABELS[denomination];
        console.log('💰 [OCR Money] Phát hiện mệnh giá:', denomination);
        return `Đây là tờ ${label}.`;
      }

      // --- Cách 2: Tìm theo từng block (phòng trường hợp text bị tách) ---
      for (const block of result.blocks) {
        const blockDenom = findDenomination(block.text);
        if (blockDenom) {
          const label = DENOMINATION_LABELS[blockDenom];
          console.log('💰 [OCR Money] Phát hiện mệnh giá từ block:', blockDenom);
          return `Đây là tờ ${label}.`;
        }
      }

      // --- Cách 3: Tìm theo từng line ---
      for (const block of result.blocks) {
        for (const line of (block.lines || [])) {
          const lineDenom = findDenomination(line.text);
          if (lineDenom) {
            const label = DENOMINATION_LABELS[lineDenom];
            console.log('💰 [OCR Money] Phát hiện mệnh giá từ line:', lineDenom);
            return `Đây là tờ ${label}.`;
          }
        }
      }

      // --- Cách 4: Ghép tất cả số lại và thử ---
      const allNumbers = fullText.replace(/[^\d\s.,]/g, '');
      const fallbackDenom = findDenomination(allNumbers);
      if (fallbackDenom) {
        const label = DENOMINATION_LABELS[fallbackDenom];
        return `Đây là tờ ${label}.`;
      }

      // --- Nếu tìm thấy text nhưng không khớp mệnh giá ---
      // Đọc ra những gì thấy để user debug
      const visibleText = cleanOCRText(fullText);
      if (visibleText.length > 0) {
        return `Không xác định được mệnh giá. Nội dung đọc được: ${visibleText}. Hãy thử chụp lại mặt có số tiền.`;
      }

      return 'Không nhận diện được mệnh giá. Hãy chụp rõ mặt có số tiền.';
    } catch (error) {
      console.error('Lỗi nhận diện tiền:', error);
      return 'Có lỗi xảy ra khi nhận diện tiền.';
    }
  },

  // ==========================================
  // 4. CHỨC NĂNG NHẬN DIỆN VẬT THỂ
  // ==========================================
  processObjectDetection: async (imageUri: string): Promise<string> => {
    try {
      const labels = await ImageLabeling.label(imageUri);

      console.log('🔍 [Log NCKH] Kết quả ML Kit:', JSON.stringify(labels, null, 2));

      if (!labels || labels.length === 0) {
        return 'Không phát hiện vật thể nào rõ ràng.';
      }

      // Lọc các vật thể có độ tự tin (confidence) trên 60%
      const detectedNames = labels
        .filter(obj => obj.confidence > 0.6)
        .map(obj => obj.text);

      // Lọc bỏ tên trùng lặp
      const uniqueNames = [...new Set(detectedNames)];

      if (uniqueNames.length > 0) {
        return `Phát hiện phía trước có: ${uniqueNames.join(', ')}.`;
      } else {
        return 'An toàn, không có vật cản đáng chú ý.';
      }
    } catch (error) {
      console.error('❌ Lỗi tại processObjectDetection:', error);
      return 'Lỗi xử lý nhận diện vật thể.';
    }
  },
};