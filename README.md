# Hồ sơ đảng viên 2026

Biểu mẫu tĩnh cho GitHub Pages, nhận dữ liệu bằng Google Apps Script.

## Tệp chính

- `index.html`, `styles.css`, `app.js`: giao diện không phụ thuộc Bootstrap hoặc phông chữ tải ngoài.
- `apps-script/Code.gs`: backend nhận phiếu, tra cứu thông tin điền sẵn và xuất Google Docs.
- `test/`: các tình huống kiểm thử bằng dữ liệu giả lập, không chứa hồ sơ thật.

## Cấu hình Apps Script

Đặt các khóa trong Script Properties của dự án gắn với bảng dữ liệu:

| Khóa | Nội dung |
| --- | --- |
| `HSDV_SPREADSHEET_ID` | Bảng nhận phiếu |
| `HSDV_TEMPLATE_ID` | Mẫu phiếu năm 2025 để giữ khả năng xuất hồ sơ cũ |
| `HSDV_FOLDER_ID` | Thư mục lưu mẫu và phiếu xuất |
| `HSDV_MEMBERS_2026` | JSON danh sách Chi bộ Một, mỗi phần tử có `hoTen`, `ngaySinh`, `soThe`; trường `chiBo` tùy chọn |
| `HSDV_TEMPLATE_2026_ID` | Được `setup2026` tạo sau khi sao chép mẫu năm 2026 |

Danh sách thành viên và các ID cấu hình không đưa vào kho công khai. Thư mục `.local/` bị Git bỏ qua. Danh sách ban đầu lấy từ ảnh do người quản lý cung cấp; nơi ở ghép từ dữ liệu năm 2025 bằng số thẻ, rồi bằng họ tên. Trường chưa có dữ liệu để trống cho người kê khai bổ sung.

Chạy `setup2026` sau khi cấu hình. Hàm tạo trang tính `2026` khi chưa có và sao chép mẫu, giữ riêng dữ liệu năm 2025. Sau khi đổi mã, cập nhật phiên bản của đúng deployment đang được `SCRIPT_URL` trong `app.js` sử dụng.

Trang công khai có chức năng tra cứu cá nhân qua Apps Script. Cần xác định phạm vi người được tra cứu trước khi triển khai; thông tin không được bảo vệ chỉ bằng việc không đưa dữ liệu vào mã GitHub.

## Dữ liệu và xuất phiếu

- Các cột A:AB giữ thứ tự của hệ thống cũ; AC lưu liên kết phiếu; AD lưu mã gửi để chống ghi lặp.
- Ngày sinh và số thẻ lưu dạng văn bản để giữ đúng định dạng và số 0 đầu.
- Thông tin cá nhân điền sẵn được khóa. Bấm cây bút để sửa, rồi bấm `Lưu` ở từng ô trước khi gửi toàn bộ phiếu.
- Nơi ở luôn được gửi; ghi chú cũ “thay đổi địa chỉ mới do sáp nhập tỉnh” được bỏ khỏi phần điền sẵn. Hai lựa chọn nguyên nhân được ghép trong ngoặc sau địa chỉ khi gửi để cùng được lưu ở cột H và xuất đúng nội dung bằng backend hiện tại.
- Xuất phiếu đọc dòng đã lưu, không đọc lại dữ liệu điền sẵn để thay thế nội dung người dùng đã sửa.
- Menu xuất sử dụng trang đang mở nếu đó là `2026`, `2025` hoặc `Sheet1`.
- Kết quả gửi chỉ thành công khi có xác nhận từ server, hoặc tra cứu được mã gửi đã ghi nhận.

## Kiểm tra cục bộ

```text
npm ci
npm test
npm run preview
```

Preview thông thường tại `http://127.0.0.1:8766`. Kiểm thử giả lập không thay thế việc kiểm tra quyền Google, bản triển khai, bố cục trên trình duyệt và một lần xuất phiếu thực tế.

## Tài liệu

- [Google Apps Script: Web Apps](https://developers.google.com/apps-script/guides/web)
- [Google Apps Script: Content Service](https://developers.google.com/apps-script/guides/content)
- [Google Apps Script: Lock](https://developers.google.com/apps-script/reference/lock/lock)
