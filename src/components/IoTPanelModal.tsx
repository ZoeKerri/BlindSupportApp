import React from 'react';
import { View, Text, Modal, Pressable, TouchableOpacity } from 'react-native';
import { IoTModalStyles as s } from '../theme/IoTModalStyles';
import type { IoTMode } from '../services/IOTService';

interface Props {
  visible: boolean;
  onClose: () => void;
  iotMode: IoTMode;
  iotSimulator: boolean;
  iotBadgeColor: string;
  toggleIoT: (preferSimulator: boolean) => void;
  testIoTSignal: (signal: 'danger' | 'caution' | 'safe') => void;
}

const IoTPanelModal: React.FC<Props> = ({
  visible, onClose, iotMode, iotSimulator, iotBadgeColor,
  toggleIoT, testIoTSignal,
}) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent
    onRequestClose={onClose}
  >
    <Pressable style={s.overlay} onPress={onClose}>
      <View style={s.panel}>
        <Text style={s.title}>🦯 Gậy Dò Đường IoT</Text>

        <Text style={s.status}>
          Trạng thái:{' '}
          <Text style={{ color: iotBadgeColor, fontWeight: 'bold' }}>
            {iotMode === 'ble'        ? 'Kết nối BLE thật ✅'      :
             iotMode === 'simulator'  ? 'Giả lập (Simulator) 🤖'   :
             'Chưa kết nối ⚫'}
          </Text>
        </Text>

        {iotMode !== 'disconnected' && (
          <Text style={s.subStatus}>
            {iotMode === 'simulator'
              ? 'Đang giả lập tín hiệu nguy hiểm mỗi 10 giây'
              : 'Nhận tín hiệu từ ESP32 qua BLE'}
          </Text>
        )}

        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: '#3742fa' }]}
            onPress={() => { toggleIoT(false); onClose(); }}
          >
            <Text style={s.btnText}>
              {iotMode !== 'disconnected' && !iotSimulator ? '⏹ Ngắt BLE' : '📡 Kết nối BLE'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btn, { backgroundColor: '#ffa502' }]}
            onPress={() => { toggleIoT(true); onClose(); }}
          >
            <Text style={s.btnText}>
              {iotMode === 'simulator' ? '⏹ Tắt giả lập' : '🤖 Bật giả lập'}
            </Text>
          </TouchableOpacity>
        </View>

        {iotMode === 'simulator' && (
          <>
            <Text style={s.sectionLabel}>🧪 Test tín hiệu thủ công:</Text>
            <View style={s.btnRow}>
              <TouchableOpacity
                style={[s.testBtn, { backgroundColor: '#ff4757' }]}
                onPress={() => { testIoTSignal('danger'); onClose(); }}
              >
                <Text style={s.testBtnText}>⚠️{'\n'}Nguy hiểm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.testBtn, { backgroundColor: '#ffa502' }]}
                onPress={() => { testIoTSignal('caution'); onClose(); }}
              >
                <Text style={s.testBtnText}>⚡{'\n'}Chú ý</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.testBtn, { backgroundColor: '#2ed573' }]}
                onPress={() => { testIoTSignal('safe'); onClose(); }}
              >
                <Text style={s.testBtnText}>✅{'\n'}An toàn</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={s.hint}>
          💡 Cài react-native-ble-manager để kết nối ESP32 thật.{'\n'}
          Xem code ESP32 trong IoTService.ts.
        </Text>
      </View>
    </Pressable>
  </Modal>
);

export default IoTPanelModal;
