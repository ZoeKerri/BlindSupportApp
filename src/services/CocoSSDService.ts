/**
 * CocoSSDService – tích hợp COCO-SSD MobileNet V1 quant qua react-native-fast-tflite
 *
 * Model: coco_ssd_mobilenet_v1_1.0_quant_2018_06_29 / detect.tflite
 * Input : [1, 300, 300, 3]  Uint8 (RGB)
 * Output:
 *   [0] boxes           Float32  [1, 10, 4]   top/left/bottom/right (0–1)
 *   [1] classes         Float32  [1, 10]       index class (0-based)
 *   [2] scores          Float32  [1, 10]       confidence (0–1)
 *   [3] num_detections  Float32  [1]           số vật phát hiện
 */

import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';

// Model được Metro resolve qua require() → hoạt động cả Android & iOS
const MODEL_SOURCE = require('../assets/detect.tflite');

// ─────────────────────────────────────────────
// COCO label map → Tiếng Việt (80 lớp, index 0-based)
// ─────────────────────────────────────────────
export const COCO_LABELS_VI: Record<number, string> = {
  0: 'người',
  1: 'xe đạp',
  2: 'xe ô tô',
  3: 'xe máy',
  4: 'máy bay',
  5: 'xe buýt',
  6: 'tàu hỏa',
  7: 'xe tải',
  8: 'thuyền',
  9: 'đèn giao thông',
  10: 'vòi cứu hỏa',
  11: 'biển dừng',
  12: 'đồng hồ đỗ xe',
  13: 'ghế dài',
  14: 'chim',
  15: 'mèo',
  16: 'chó',
  17: 'ngựa',
  18: 'cừu',
  19: 'bò',
  20: 'voi',
  21: 'gấu',
  22: 'ngựa vằn',
  23: 'hươu cao cổ',
  24: 'ba lô',
  25: 'ô dù',
  26: 'túi xách',
  27: 'cà vạt',
  28: 'vali',
  29: 'đĩa bay (frisbee)',
  30: 'ván trượt tuyết',
  31: 'ván trượt',
  32: 'bóng thể thao',
  33: 'diều hâu',
  34: 'gậy bóng chày',
  35: 'găng tay bóng chày',
  36: 'ván lướt sóng',
  37: 'vợt tennis',
  38: 'bình nước',
  39: 'ly rượu',
  40: 'cốc nước',
  41: 'nĩa',
  42: 'dao',
  43: 'thìa',
  44: 'tô bát',
  45: 'chuối',
  46: 'táo',
  47: 'bánh mì sandwich',
  48: 'cam',
  49: 'súp lơ xanh',
  50: 'cà rốt',
  51: 'xúc xích',
  52: 'pizza',
  53: 'bánh nướng',
  54: 'bánh ngọt',
  55: 'ghế',
  56: 'ghe-sofa',
  57: 'cây trồng trong chậu',
  58: 'giường ngủ',
  59: 'bàn ăn',
  60: 'nhà vệ sinh',
  61: 'màn hình TV',
  62: 'máy tính xách tay',
  63: 'chuột máy tính',
  64: 'điều khiển từ xa',
  65: 'bàn phím',
  66: 'điện thoại di động',
  67: 'lò vi sóng',
  68: 'lò nướng',
  69: 'lò nướng bánh mì',
  70: 'bồn rửa',
  71: 'tủ lạnh',
  72: 'sách',
  73: 'đồng hồ',
  74: 'bình hoa',
  75: 'kéo',
  76: 'thú bông',
  77: 'máy sấy tóc',
  78: 'bàn chải đánh răng',
};

// ─────────────────────────────────────────────
// Ngưỡng lọc
// ─────────────────────────────────────────────
const CONFIDENCE_THRESHOLD = 0.45;
const MAX_DETECTIONS = 5;

// ─────────────────────────────────────────────
// Mô tả vị trí theo bounding box (normalized)
// ─────────────────────────────────────────────
function describePosition(
  top: number, left: number, bottom: number, right: number
): string {
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const bboxArea = (bottom - top) * (right - left);

  // Vị trí ngang
  const hPos = cx < 0.38 ? 'bên trái' : cx > 0.62 ? 'bên phải' : 'ở giữa';
  // Khoảng cách ước tính theo diện tích bbox
  const distLabel = bboxArea > 0.25 ? 'rất gần' : bboxArea > 0.08 ? 'gần' : 'phía xa';

  return `${hPos}, ${distLabel}`;
}

// ─────────────────────────────────────────────
// Kiểu kết quả nhận diện
// ─────────────────────────────────────────────
export interface CocoDetection {
  label: string;
  labelVi: string;
  confidence: number;
  position: string;
  box: { top: number; left: number; bottom: number; right: number };
}

// ─────────────────────────────────────────────
// Parse output tensors từ model COCO-SSD
// ─────────────────────────────────────────────
export function parseCocoOutput(outputs: ArrayLike<number>[]): CocoDetection[] {
  if (!outputs || outputs.length < 4) return [];

  const boxesRaw    = outputs[0]; // [1, 10, 4] → flatten = 40 values
  const classesRaw  = outputs[1]; // [1, 10]    → 10 values
  const scoresRaw   = outputs[2]; // [1, 10]    → 10 values
  const numDetRaw   = outputs[3]; // [1]

  const numDetections = Math.min(
    Math.round(numDetRaw[0]),
    MAX_DETECTIONS,
    10
  );

  const detections: CocoDetection[] = [];

  for (let i = 0; i < numDetections; i++) {
    const score = scoresRaw[i];
    if (score < CONFIDENCE_THRESHOLD) continue;

    const classIdx = Math.round(classesRaw[i]);
    const labelVi  = COCO_LABELS_VI[classIdx] ?? `vật thể (${classIdx})`;

    // Boxes được lưu theo thứ tự: top, left, bottom, right
    const top    = boxesRaw[i * 4 + 0];
    const left   = boxesRaw[i * 4 + 1];
    const bottom = boxesRaw[i * 4 + 2];
    const right  = boxesRaw[i * 4 + 3];

    detections.push({
      label:      labelVi,
      labelVi,
      confidence: score,
      position:   describePosition(top, left, bottom, right),
      box:        { top, left, bottom, right },
    });
  }

  return detections;
}

// ─────────────────────────────────────────────
// Chuyển kết quả thành câu mô tả tiếng Việt
// ─────────────────────────────────────────────
export function detectionToVietnamese(detections: CocoDetection[]): string {
  if (detections.length === 0) return 'Không phát hiện vật thể nào rõ ràng.';

  // Nhóm theo nhãn (có thể phát hiện nhiều cùng loại)
  const grouped = detections.reduce<Record<string, CocoDetection[]>>((acc, d) => {
    if (!acc[d.labelVi]) acc[d.labelVi] = [];
    acc[d.labelVi].push(d);
    return acc;
  }, {});

  const parts: string[] = [];
  for (const [label, items] of Object.entries(grouped)) {
    if (items.length === 1) {
      parts.push(`${label} ${items[0].position}`);
    } else {
      parts.push(`${items.length} ${label}`);
    }
  }

  return `Phát hiện: ${parts.join('; ')}.`;
}

// ─────────────────────────────────────────────
// Singleton model instance
// ─────────────────────────────────────────────
let _model: TensorflowModel | null = null;
let _loading = false;

export const CocoSSDService = {

  /**
   * Tải model vào bộ nhớ (gọi 1 lần khi khởi động app)
   */
  loadModel: async (): Promise<TensorflowModel> => {
    if (_model) return _model;
    if (_loading) {
      // Đợi cho đến khi load xong
      return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
          if (_model) { clearInterval(interval); resolve(_model!); }
          if (!_loading) { clearInterval(interval); reject(new Error('Model load failed')); }
        }, 100);
      });
    }

    _loading = true;
    console.log('🧠 [CocoSSD] Đang tải model COCO-SSD...');
    try {
      _model = await loadTensorflowModel(MODEL_SOURCE);
      console.log('✅ [CocoSSD] Model sẵn sàng!');
      console.log('   Input :', JSON.stringify(_model.inputs));
      console.log('   Output:', JSON.stringify(_model.outputs));
    } catch (err) {
      console.error('❌ [CocoSSD] Tải model thất bại:', err);
      _loading = false;
      throw err;
    }
    _loading = false;
    return _model;
  },

  /** Lấy model đã tải (null nếu chưa tải) */
  getModel: (): TensorflowModel | null => _model,

  /** Model có sẵn sàng không */
  isReady: (): boolean => _model !== null,
};
