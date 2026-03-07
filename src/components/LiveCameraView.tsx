/**
 * LiveCameraView – Camera cho chế độ đi đường
 *
 * • Camera luôn bật, không chụp liên tục
 * • Controller gọi captureNow() khi IoT phát hiện vật cản
 * • Kết quả được gửi về qua onDetectionResult
 */

import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, PermissionsAndroid, Platform,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { TtsService } from '../services/TtsService';
import { VisionService } from '../services/VisionService';

export interface LiveCameraHandle {
  captureNow: () => Promise<void>;
}

interface Props {
  onClose: () => void;
  onDetectionResult?: (text: string) => void;
}

const LiveCameraView = forwardRef<LiveCameraHandle, Props>(({ onClose, onDetectionResult }, ref) => {
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  const [status, setStatus] = useState('Đang mở camera...');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const isProcessingRef = useRef(false);

  // ── Kiểm tra quyền camera (đã request ở useAppController) ──
  useEffect(() => {
    const checkPermission = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        setHasPermission(granted);
        if (granted) {
          setStatus('Camera sẵn sàng. Chờ tín hiệu IoT...');
        }
      } else {
        const status = Camera.getCameraPermissionStatus();
        setHasPermission(status === 'granted');
      }
    };
    checkPermission();
  }, []);

  // ── Expose captureNow() cho controller gọi từ ngoài ──
  useImperativeHandle(ref, () => ({
    captureNow: async () => {
      if (isProcessingRef.current || !cameraRef.current) return;
      isProcessingRef.current = true;
      try {
        setStatus('Đang chụp và phân tích...');
        const photo = await cameraRef.current.takePhoto({
          flash: 'off',
          enableShutterSound: false,
        });
        const result = await VisionService.processAutoDetect(`file://${photo.path}`);
        setStatus(result);
        TtsService.speak(result);
        onDetectionResult?.(result);
      } catch (e) {
        console.warn('📷 Capture error:', e);
        setStatus('Lỗi chụp ảnh.');
      } finally {
        isProcessingRef.current = false;
      }
    },
  }));

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.infoText}>Đang kiểm tra quyền camera...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.infoText}>
          Cần quyền camera.
          {Platform.OS === 'android'
            ? '\nVào Cài đặt → Ứng dụng → BlindSupport → Cấp quyền Camera.'
            : '\nVào Cài đặt để cấp quyền.'}
        </Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Đóng</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.infoText}>Không tìm thấy camera.</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Đóng</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
      />

      <View style={styles.resultOverlay}>
        <Text style={styles.resultText} numberOfLines={4}>{status}</Text>
      </View>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onClose}
        accessibilityLabel="Đóng camera"
        accessibilityRole="button"
      >
        <Text style={styles.closeBtnText}>✕  ĐÓNG</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  infoText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  resultOverlay: {
    position: 'absolute', bottom: 90, left: 0, right: 0,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  resultText: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  closeBtn: {
    position: 'absolute', top: 48, right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 24, borderWidth: 1, borderColor: '#fff',
  },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default LiveCameraView;
