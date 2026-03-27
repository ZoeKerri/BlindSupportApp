# Hướng dẫn sử dụng app BlindSupport

## 1) App này dùng để làm gì?
BlindSupport hỗ trợ người khiếm thị với 2 nhóm chức năng chính:
- Chế độ tĩnh: chụp ảnh để đọc chữ, đọc tiền, đọc menu, mô tả cảnh.
- Chế độ đi đường: kết hợp camera + gậy IoT (BLE hoặc giả lập) để cảnh báo vật cản.

App có 2 kiểu xử lý ảnh:
- OFFLINE: xử lý trực tiếp trên máy (không cần server).
- ONLINE: gửi ảnh lên server để mô tả chi tiết hơn.

## 2) Cách thao tác nhanh (quan trọng)
- Chạm 1 lần:
  - Ở chế độ tĩnh: chụp ảnh và phân tích.
  - Ở chế độ đi đường: mở camera live nếu đang tắt.
- Chạm 3 lần liên tiếp: đổi giữa chế độ tĩnh và chế độ đi đường.
- Giữ lâu (khoảng 0.8 giây): bật nghe lệnh giọng nói (chỉ dùng trong chế độ tĩnh).
- Vuốt trái/phải bằng 2 ngón: đổi OFFLINE <-> ONLINE.

## 3) Dùng chế độ tĩnh
Khi màn hình hiện "CHẾ ĐỘ TĨNH":
- Chạm màn hình để chụp ảnh nhanh.
- Hoặc bấm "CHỌN ẢNH" để lấy ảnh từ thư viện.
- Giữ lâu để nói lệnh giọng nói.

Lệnh giọng nói hỗ trợ:
- "đọc sách" hoặc "đọc" -> OCR tài liệu.
- "tiền" -> nhận diện mệnh giá tiền Việt.
- "menu" -> đọc menu/bảng giá.
- "chụp" hoặc "chụp ảnh" -> tự động nhận diện nội dung.

## 4) Dùng chế độ đi đường
Khi màn hình hiện "CHẾ ĐỘ ĐI ĐƯỜNG":
- Bật IoT bằng nút cây gậy (🦯) ở góc dưới.
- Có 2 kiểu IoT:
  - BLE: kết nối gậy thật qua Bluetooth.
  - SIM: giả lập tín hiệu để test.
- Khi có cảnh báo "danger" hoặc "caution", app sẽ đọc cảnh báo bằng giọng nói và tự chụp để phân tích.

Mức cảnh báo:
- Danger: vật cản rất gần (nhỏ hơn ~30 cm).
- Caution: cần chú ý (khoảng ~30-80 cm).
- Safe: an toàn.

## 5) OFFLINE và ONLINE khác nhau thế nào?
- OFFLINE:
  - Dùng OCR + nhận diện vật thể trên máy.
  - Nhanh, không cần mạng/server.
- ONLINE:
  - Gửi ảnh tới API /caption.
  - Mô tả thường chi tiết hơn, cần mạng và server chạy sẵn.

API mặc định đang để: http://192.168.56.1:8000
Nếu dùng điện thoại thật, đổi thành IP máy tính chạy backend (cùng Wi-Fi).

## 6) Kết quả hiển thị ở đâu?
- Kết quả văn bản hiển thị ở vùng bên dưới màn hình chính.
- App cũng đọc kết quả bằng giọng nói (TTS tiếng Việt).

## 7) Lỗi thường gặp và cách xử lý nhanh
- Không nghe tiếng đọc:
  - Kiểm tra âm lượng máy.
  - Máy không có TTS tiếng Việt thì app sẽ rung thay cho đọc.
- Không chụp được ảnh:
  - Cấp quyền camera cho app.
- ONLINE không chạy:
  - Kiểm tra server backend có đang chạy không.
  - Kiểm tra IP/port API đúng chưa.
  - Điện thoại và máy chủ phải cùng mạng.
- Không kết nối BLE:
  - Kiểm tra tên thiết bị BLE đúng.
  - Kiểm tra quyền Bluetooth (và vị trí nếu máy yêu cầu).
  - Có thể chuyển sang SIM để test tạm.

## 8) Luồng dùng gợi ý cho người mới
1. Mở app, nghe thông báo "ứng dụng sẵn sàng".
2. Ở chế độ tĩnh, chạm 1 lần để thử chụp và nghe kết quả.
3. Giữ lâu rồi nói "đọc sách" hoặc "tiền" để thử lệnh giọng nói.
4. Chạm 3 lần để sang chế độ đi đường.
5. Mở IoT (SIM nếu chưa có phần cứng) và theo dõi cảnh báo vật cản.
6. Vuốt 2 ngón trái/phải để đổi ONLINE/OFFLINE khi cần.

---
Tài liệu này ưu tiên thao tác thực tế, ngắn gọn, dễ dùng cho người vận hành và test app.