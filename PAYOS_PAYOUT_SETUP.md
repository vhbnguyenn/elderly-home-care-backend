# 🔑 HƯỚNG DẪN LẤY PAYOS PAYOUT API KEYS

## ⚠️ QUAN TRỌNG: PAYOUT CẦN KEYS RIÊNG!

PayOS yêu cầu **2 BỘ API KEYS KHÁC NHAU**:
- **Payment API** (Thu tiền) → PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY
- **Payout API** (Chi tiền) → PAYOS_PAYOUT_CLIENT_ID, PAYOS_PAYOUT_API_KEY, PAYOS_PAYOUT_CHECKSUM_KEY

---

## 🚀 BƯỚC 1: LẤY PAYMENT API KEYS (Đã có)

Nếu bạn đã có keys để thu tiền, skip bước này.

1. Login https://my.payos.vn
2. **Settings** → **API Keys** → **Generate Payment Keys**
3. Copy 3 keys:
   - Client ID
   - API Key
   - Checksum Key

---

## 💸 BƯỚC 2: XÁC THỰC TỔ CHỨC (Bắt buộc cho Payout)

### **Doanh nghiệp:**
1. Login https://my.payos.vn
2. **Cài đặt** → **Xác thực tổ chức**
3. Nhập **Mã số thuế (MST)** hoặc **Giấy phép kinh doanh**
4. Upload tài liệu:
   - Giấy phép đăng ký kinh doanh
   - CMND/CCCD người đại diện
5. Chuyển khoản số tiền nhỏ (VD: 10,000 VND) từ tài khoản ngân hàng doanh nghiệp trùng tên với tổ chức
6. Chờ PayOS xác thực (1-2 ngày làm việc)

### **Cá nhân/Hộ kinh doanh:**
1. Nhập số **CMND/CCCD**
2. Upload ảnh CMND/CCCD 2 mặt
3. Chuyển khoản xác minh từ tài khoản ngân hàng cá nhân
4. Chờ xác thực (1-2 ngày)

---

## 🏦 BƯỚC 3: KẾT NỐI TÀI KHOẢN NGÂN HÀNG

1. **Cài đặt** → **Tài khoản ngân hàng**
2. Chọn ngân hàng của bạn (VD: Vietcombank, Techcombank, MB Bank...)
3. **2 cách kết nối:**

### **Cách 1: Qua ứng dụng ngân hàng (Cas)**
- Quét QR code từ PayOS
- Xác thực trong app ngân hàng
- Cấp quyền cho PayOS

### **Cách 2: Nhập thông tin thủ công**
- Số tài khoản
- Tên chủ tài khoản (trùng với tổ chức đã xác thực)
- Chi nhánh

4. **Xác minh tài khoản:**
   - PayOS gửi giao dịch thử (1,000 VND)
   - Nhập mã xác thực từ nội dung chuyển khoản

---

## 💰 BƯỚC 4: GENERATE PAYOUT API KEYS

Sau khi xác thực tổ chức & kết nối ngân hàng thành công:

1. **Settings** → **API Keys**
2. Tab **Payout API** (khác với Payment API!)
3. Click **Generate Payout Keys**
4. Copy **3 KEYS RIÊNG** cho Payout:
   ```
   Payout Client ID:      abc123-payout...
   Payout API Key:        xyz789-payout...
   Payout Checksum Key:   def456-payout...
   ```

⚠️ **LƯU Ý:** Payout keys **KHÁC** với Payment keys!

---

## ⚙️ BƯỚC 5: CẤU HÌNH `.env`

Thêm vào file `.env`:

```env
# Payment API (Thu tiền)
PAYOS_CLIENT_ID=your-payment-client-id
PAYOS_API_KEY=your-payment-api-key
PAYOS_CHECKSUM_KEY=your-payment-checksum-key

# Payout API (Chi tiền) - KEYS RIÊNG!
PAYOS_PAYOUT_CLIENT_ID=your-payout-client-id
PAYOS_PAYOUT_API_KEY=your-payout-api-key
PAYOS_PAYOUT_CHECKSUM_KEY=your-payout-checksum-key

# URLs
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
```

---

## 🚀 BƯỚC 6: DEPLOY LÊN RENDER

Thêm **6 biến môi trường** trên Render Dashboard:

### **Payment Keys:**
1. `PAYOS_CLIENT_ID` = your-payment-client-id
2. `PAYOS_API_KEY` = your-payment-api-key
3. `PAYOS_CHECKSUM_KEY` = your-payment-checksum-key

### **Payout Keys (THÊM MỚI):**
4. `PAYOS_PAYOUT_CLIENT_ID` = your-payout-client-id
5. `PAYOS_PAYOUT_API_KEY` = your-payout-api-key
6. `PAYOS_PAYOUT_CHECKSUM_KEY` = your-payout-checksum-key

---

## ✅ TEST PAYOUT

### **API Endpoint:**
```bash
POST /api/payments/caregiver/withdraw
Authorization: Bearer <caregiver_token>

{
  "amount": 100000,
  "description": "Test withdrawal"
}
```

### **Kiểm tra:**
1. ✅ API trả về `success: true`
2. ✅ PayOS Dashboard → Transactions → Có giao dịch chi tiền
3. ⏳ Tiền về tài khoản ngân hàng (1-3 ngày làm việc)

---

## 🔒 BẢO MẬT

- ❌ **KHÔNG** commit keys vào Git
- ✅ Lưu trong `.env` (đã có trong `.gitignore`)
- ✅ Set trên Render Environment Variables
- ✅ Production keys chỉ dùng cho production

---

## 🆘 GẶP LỖI?

### **Error: "PayOS Payout API credentials not configured"**
→ Chưa set `PAYOS_PAYOUT_*` keys trong `.env` hoặc Render

### **Error: "Organization not verified"**
→ Chưa hoàn thành xác thực tổ chức ở Bước 2

### **Error: "Bank account not connected"**
→ Chưa kết nối tài khoản ngân hàng ở Bước 3

### **Error: "Invalid payout credentials"**
→ Sai Payout API keys, kiểm tra lại trên PayOS Dashboard

---

## 📞 HỖ TRỢ

- **PayOS Support:** https://payos.vn/support
- **Email:** support@payos.vn
- **Hotline:** 1900-xxxx (check trên website)

---

## 🎯 TÓM TẮT CHECKLIST

- [ ] Xác thực tổ chức (MST hoặc CMND/CCCD)
- [ ] Kết nối tài khoản ngân hàng
- [ ] Generate Payout API Keys từ Dashboard
- [ ] Thêm 3 Payout keys vào `.env`
- [ ] Deploy và set Payout keys trên Render
- [ ] Test withdrawal API
- [ ] Kiểm tra tiền về tài khoản

**Sau khi hoàn thành checklist → Luồng chi tiền hoàn toàn tự động!** 🚀
