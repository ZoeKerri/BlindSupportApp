/**
 * IoTService.ts
 * Kết nối với gậy IoT qua BLE hoặc WiFi UDP
 *
 * FLOW:
 *   ESP32 (gậy) → phát hiện vật cản (cảm biến siêu âm HC-SR04)
 *              → gửi tín hiệu BLE/UDP → IoTService nhận
 *              → callback onObstacleDetected() → TtsService đọc cảnh báo
 *
 * CẤU HÌNH ESP32 (copy vào Arduino IDE):
 *   - BLE mode: dùng BleManager (react-native-ble-manager)
 *   - WiFi UDP mode: ESP32 gửi UDP broadcast lên cổng 41234
 *
 * SIMULATOR MODE:
 *   - Không cần phần cứng để test
 *   - Giả lập tín hiệu vật cản ngẫu nhiên
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

// ----------------------------------------
// TYPES
// ----------------------------------------
export type ObstacleLevel = 'safe' | 'caution' | 'danger';

export interface ObstacleEvent {
  level: ObstacleLevel;
  distance: number; // cm
  message: string;
}

export type ObstacleCallback = (event: ObstacleEvent) => void;

// ----------------------------------------
// HẰNG SỐ CẤU HÌNH
// ----------------------------------------

// BLE: UUID của service và characteristic trên ESP32
// Thay bằng UUID bạn define trong code ESP32
export const BLE_CONFIG = {
  SERVICE_UUID: '12345678-1234-1234-1234-123456789abc',
  CHARACTERISTIC_UUID: 'abcd1234-ab12-cd34-ef56-abcdef123456',
  DEVICE_NAME: 'GayDoDuong_IoT', // Tên BLE thiết bị ESP32 của bạn
};

// WiFi UDP (nếu dùng UDP thay BLE)
export const UDP_CONFIG = {
  PORT: 41234,
  BROADCAST_IP: '255.255.255.255',
};

// Ngưỡng khoảng cách (cm)
const DISTANCE_THRESHOLDS = {
  DANGER: 30,   // < 30cm: nguy hiểm ngay
  CAUTION: 80,  // < 80cm: cẩn thận
};

// ----------------------------------------
// PARSE TÍN HIỆU TỪ ESP32
// ----------------------------------------
/**
 * ESP32 gửi string dạng: "OBS:45" (vật cản cách 45cm)
 * hoặc: "SAFE" (an toàn)
 */
const parseESP32Signal = (raw: string): ObstacleEvent => {
  const trimmed = raw.trim().toUpperCase();

  if (trimmed === 'SAFE') {
    return { level: 'safe', distance: 999, message: 'Đường trước an toàn.' };
  }

  const match = trimmed.match(/^OBS:(\d+)$/);
  if (match) {
    const distance = parseInt(match[1], 10);
    if (distance < DISTANCE_THRESHOLDS.DANGER) {
      return {
        level: 'danger',
        distance,
        message: `Cảnh báo! Vật cản ngay phía trước, cách ${distance} xăng ti mét. Dừng lại!`,
      };
    } else if (distance < DISTANCE_THRESHOLDS.CAUTION) {
      return {
        level: 'caution',
        distance,
        message: `Chú ý, có vật cản cách ${distance} xăng ti mét.`,
      };
    } else {
      return { level: 'safe', distance, message: 'Đường trước an toàn.' };
    }
  }

  // Không parse được → safe
  return { level: 'safe', distance: 999, message: '' };
};

// ----------------------------------------
// SIMULATOR (test không cần ESP32)
// ----------------------------------------
class IoTSimulator {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callback: ObstacleCallback | null = null;

  start(callback: ObstacleCallback) {
    this.callback = callback;
    console.log('🤖 [IoT Simulator] Bắt đầu giả lập tín hiệu gậy dò đường...');

    // Giả lập: mỗi 3s ngẫu nhiên gửi tín hiệu
    this.intervalId = setInterval(() => {
      const rand = Math.random();
      let signal: string;

      if (rand < 0.15) {
        // 15% xác suất: nguy hiểm
        const dist = Math.floor(Math.random() * 29) + 5; // 5-29cm
        signal = `OBS:${dist}`;
      } else if (rand < 0.35) {
        // 20% xác suất: cẩn thận
        const dist = Math.floor(Math.random() * 49) + 31; // 31-79cm
        signal = `OBS:${dist}`;
      } else {
        // 65%: an toàn
        signal = 'SAFE';
      }

      console.log('🤖 [IoT Simulator] Tín hiệu giả lập:', signal);
      const event = parseESP32Signal(signal);
      if (event.level !== 'safe') {
        this.callback?.(event);
      }
    }, 3000);
  }

  sendManual(signal: string) {
    const event = parseESP32Signal(signal);
    this.callback?.(event);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('🤖 [IoT Simulator] Đã dừng giả lập.');
  }
}

// ----------------------------------------
// BLE SERVICE (kết nối thật với ESP32)
// ----------------------------------------
/**
 * Yêu cầu cài: npm install react-native-ble-manager
 * iOS: thêm NSBluetoothAlwaysUsageDescription vào Info.plist
 * Android: thêm BLUETOOTH permissions vào AndroidManifest.xml
 */
class BLEIoTService {
  private BleManager: any = null;
  private bleEmitter: NativeEventEmitter | null = null;
  private connectedDevice: string | null = null;
  private callback: ObstacleCallback | null = null;
  private listeners: any[] = [];

  async init(): Promise<boolean> {
    try {
      // Dynamic import để không crash nếu chưa cài BleManager
      const BleManagerModule = NativeModules.BleManager;
      if (!BleManagerModule) {
        console.warn('⚠️ [BLE] react-native-ble-manager chưa được cài. Dùng Simulator.');
        return false;
      }
      const BleManagerLib = require('react-native-ble-manager');
      this.BleManager = BleManagerLib.default;
      this.bleEmitter = new NativeEventEmitter(BleManagerModule);
      await this.BleManager.start({ showAlert: false });
      console.log('✅ [BLE] Khởi động thành công.');
      return true;
    } catch (e) {
      console.warn('⚠️ [BLE] Không khởi động được:', e);
      return false;
    }
  }

  async scanAndConnect(callback: ObstacleCallback): Promise<boolean> {
    if (!this.BleManager) return false;
    this.callback = callback;

    return new Promise((resolve) => {
      // Lắng nghe khi tìm thấy thiết bị
      const discoverListener = this.bleEmitter!.addListener(
        'BleManagerDiscoverPeripheral',
        async (peripheral: any) => {
          if (peripheral.name === BLE_CONFIG.DEVICE_NAME) {
            console.log('📡 [BLE] Tìm thấy gậy IoT:', peripheral.id);
            await this.BleManager.stopScan();
            discoverListener.remove();
            const ok = await this.connectToDevice(peripheral.id);
            resolve(ok);
          }
        }
      );

      this.BleManager.scan([BLE_CONFIG.SERVICE_UUID], 10, true)
        .then(() => console.log('📡 [BLE] Đang quét...'))
        .catch((e: any) => {
          console.error('[BLE] Lỗi quét:', e);
          discoverListener.remove();
          resolve(false);
        });

      // Timeout sau 10s
      setTimeout(() => {
        discoverListener.remove();
        resolve(false);
      }, 11000);
    });
  }

  private async connectToDevice(deviceId: string): Promise<boolean> {
    try {
      await this.BleManager.connect(deviceId);
      await this.BleManager.retrieveServices(deviceId);
      this.connectedDevice = deviceId;
      console.log('✅ [BLE] Đã kết nối với gậy IoT:', deviceId);

      // Bắt đầu nhận notification từ ESP32
      await this.BleManager.startNotification(
        deviceId,
        BLE_CONFIG.SERVICE_UUID,
        BLE_CONFIG.CHARACTERISTIC_UUID
      );

      // Lắng nghe dữ liệu từ ESP32
      const notifListener = this.bleEmitter!.addListener(
        'BleManagerDidUpdateValueForCharacteristic',
        ({ value }: any) => {
          // Decode bytes → string
          const raw = String.fromCharCode(...value);
          console.log('📨 [BLE] Nhận tín hiệu:', raw);
          const event = parseESP32Signal(raw);
          if (event.level !== 'safe') this.callback?.(event);
        }
      );
      this.listeners.push(notifListener);
      return true;
    } catch (e) {
      console.error('[BLE] Lỗi kết nối:', e);
      return false;
    }
  }

  disconnect() {
    this.listeners.forEach(l => l.remove());
    this.listeners = [];
    if (this.connectedDevice && this.BleManager) {
      this.BleManager.disconnect(this.connectedDevice).catch(() => {});
      this.connectedDevice = null;
    }
  }

  get isConnected() {
    return !!this.connectedDevice;
  }
}

// ----------------------------------------
// IoTService (facade - tự động chọn mode)
// ----------------------------------------
export type IoTMode = 'simulator' | 'ble' | 'disconnected';

class _IoTService {
  private simulator = new IoTSimulator();
  private ble = new BLEIoTService();
  private mode: IoTMode = 'disconnected';
  private active = false;

  get currentMode(): IoTMode { return this.mode; }
  get isActive(): boolean { return this.active; }

  /**
   * Khởi động IoT service.
   * - Nếu BLE khởi động được → scan & connect thật
   * - Nếu không → dùng Simulator để test
   */
  async start(callback: ObstacleCallback, preferSimulator = false): Promise<IoTMode> {
    if (this.active) this.stop();

    if (!preferSimulator) {
      const bleOk = await this.ble.init();
      if (bleOk) {
        console.log('📡 [IoT] Đang scan BLE...');
        const connected = await this.ble.scanAndConnect(callback);
        if (connected) {
          this.mode = 'ble';
          this.active = true;
          console.log('✅ [IoT] Đang dùng BLE thật.');
          return 'ble';
        }
      }
    }

    // Fallback: Simulator
    this.simulator.start(callback);
    this.mode = 'simulator';
    this.active = true;
    console.log('🤖 [IoT] Đang dùng Simulator.');
    return 'simulator';
  }

  /** Gửi tín hiệu thủ công để test (chỉ dùng với simulator) */
  testSignal(signal: 'danger' | 'caution' | 'safe') {
    if (this.mode !== 'simulator') return;
    const map = {
      danger: 'OBS:20',
      caution: 'OBS:60',
      safe: 'SAFE',
    };
    this.simulator.sendManual(map[signal]);
  }

  stop() {
    if (this.mode === 'simulator') this.simulator.stop();
    if (this.mode === 'ble') this.ble.disconnect();
    this.mode = 'disconnected';
    this.active = false;
  }
}

export const IoTService = new _IoTService();

/**
 * ============================================================
 * CODE ESP32 MẪU (Arduino IDE)
 * ============================================================
 * 
 * #include <BLEDevice.h>
 * #include <BLEServer.h>
 * #include <BLEUtils.h>
 * #include <BLE2902.h>
 * 
 * #define TRIG_PIN 5
 * #define ECHO_PIN 18
 * #define SERVICE_UUID        "12345678-1234-1234-1234-123456789abc"
 * #define CHARACTERISTIC_UUID "abcd1234-ab12-cd34-ef56-abcdef123456"
 * 
 * BLEServer* pServer = nullptr;
 * BLECharacteristic* pCharacteristic = nullptr;
 * bool deviceConnected = false;
 * 
 * class ServerCallbacks: public BLEServerCallbacks {
 *   void onConnect(BLEServer* pServer) { deviceConnected = true; }
 *   void onDisconnect(BLEServer* pServer) { deviceConnected = false; }
 * };
 * 
 * long measureDistance() {
 *   digitalWrite(TRIG_PIN, LOW);
 *   delayMicroseconds(2);
 *   digitalWrite(TRIG_PIN, HIGH);
 *   delayMicroseconds(10);
 *   digitalWrite(TRIG_PIN, LOW);
 *   long duration = pulseIn(ECHO_PIN, HIGH);
 *   return duration * 0.034 / 2; // cm
 * }
 * 
 * void setup() {
 *   Serial.begin(115200);
 *   pinMode(TRIG_PIN, OUTPUT);
 *   pinMode(ECHO_PIN, INPUT);
 * 
 *   BLEDevice::init("GayDoDuong_IoT");
 *   pServer = BLEDevice::createServer();
 *   pServer->setCallbacks(new ServerCallbacks());
 *   BLEService* pService = pServer->createService(SERVICE_UUID);
 *   pCharacteristic = pService->createCharacteristic(
 *     CHARACTERISTIC_UUID,
 *     BLECharacteristic::PROPERTY_NOTIFY
 *   );
 *   pCharacteristic->addDescriptor(new BLE2902());
 *   pService->start();
 *   BLEDevice::getAdvertising()->start();
 *   Serial.println("ESP32 BLE sẵn sàng!");
 * }
 * 
 * void loop() {
 *   if (deviceConnected) {
 *     long dist = measureDistance();
 *     String signal = (dist < 200) ? "OBS:" + String(dist) : "SAFE";
 *     pCharacteristic->setValue(signal.c_str());
 *     pCharacteristic->notify();
 *     Serial.println("Gửi: " + signal);
 *   }
 *   delay(500); // Đo mỗi 500ms
 * }
 * ============================================================
 */