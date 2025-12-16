# 💳 PayOS Payment Integration

## 📌 Tổng quan

Backend đã tích hợp **PayOS** làm payment gateway cho toàn bộ hệ thống thanh toán.

### Chức năng:
- ✅ Careseeker nạp tiền vào ví (Deposit) - Payment Gateway
- ✅ Thanh toán booking qua ví hoặc PayOS - Payment Gateway  
- ✅ Caregiver rút tiền về ngân hàng (Withdrawal) - **Payout API**
- ✅ Admin rút platform fees (15%) - **Payout API**
- ✅ Webhook callbacks tự động cho cả payment và payout
- ✅ Security với signature verification
- ✅ Real-time processing và bulk payouts

---

## 🔧 Cấu hình

### Environment Variables (.env)

```env
# PayOS Configuration
PAYOS_API_URL=https://api-merchant.payos.vn
PAYOS_CLIENT_ID=your-client-id
PAYOS_API_KEY=your-api-key
PAYOS_CHECKSUM_KEY=your-checksum-key

# URLs
BACKEND_URL=https://your-backend-url.com
FRONTEND_URL=https://your-frontend-url.com
```

### Lấy keys tại:
- **Sandbox**: https://dashboard.payos.vn → API Keys → Tab "Test"
- **Production**: https://dashboard.payos.vn → API Keys → Tab "Live"

---

## 📚 API Endpoints

### 1. Nạp tiền (Deposit)

```http
POST /api/payments/deposit
Authorization: Bearer {careseeker_token}

Request:
{
  "amount": 500000
}

Response:
{
  "success": true,
  "data": {
    "orderCode": "DEPOSIT_...",
    "paymentUrl": "https://pay.payos.vn/...",
    "qrCode": "https://...",
    "amount": 500000
  }
}
```

### 2. Thanh toán Booking

```http
POST /api/payments/booking/:bookingId
Authorization: Bearer {careseeker_token}

Response:
{
  "success": true,
  "data": {
    "paymentUrl": "https://pay.payos.vn/...",
    "amount": 300000
  }
}
```

### 3. Setup Bank Account (Caregiver)

```http
PUT /api/payments/caregiver/bank-account
Authorization: Bearer {caregiver_token}

Request:
{
  "bankName": "Vietcombank",
  "bankCode": "VCB",
  "accountNumber": "1234567890",
  "accountName": "NGUYEN VAN A"
}
```

### 4. Rút tiền (Caregiver)

```http
POST /api/payments/caregiver/withdraw
Authorization: Bearer {caregiver_token}

Request:
{
  "amount": 100000
}

Response:
{
  "success": true,
  "message": "Yêu cầu rút tiền đã được gửi"
}
```

### 5. Admin Withdrawal

```http
# Get available balance
GET /api/admin-withdrawal/available-balance
Authorization: Bearer {admin_token}

# Withdraw
POST /api/admin-withdrawal/withdraw
Authorization: Bearer {admin_token}
Request: { "amount": 500000 }
```

---

## 🔔 Webhooks

PayOS sẽ gọi các endpoints này khi giao dịch hoàn thành:

### Deposit Callback
```
POST /api/payments/deposit/callback
```

### Booking Payment Callback
```
POST /api/payments/booking/callback
```

**⚠️ Quan trọng:** 
- Webhooks có signature verification
- PayOS cần public URL (không chấp nhận localhost)
- Cấu hình trên: Dashboard PayOS → Settings → Webhook

---

## 💰 Payment Flow

### Luồng nạp tiền:
```
1. Careseeker call API deposit
2. Backend tạo payment link với PayOS
3. User thanh toán qua QR/Banking
4. PayOS gọi webhook callback
5. Backend cộng tiền vào ví
```

### Luồng thanh toán booking:
```
1. Careseeker tạo booking
2. Call API payment với bookingId
3. Thanh toán qua PayOS hoặc ví
4. Tiền được hold trong booking
5. Khi completed → 85% cho caregiver, 15% platform fee
```

### Luồng rút tiền (PayOS Payout API):
```
1. Caregiver setup bank account
2. Call API withdraw
3. Backend validate và trừ tiền khỏi ví
4. Gọi PayOS Payout API (/v2/payouts)
5. PayOS xử lý chuyển tiền tự động
6. Webhook callback khi hoàn thành
7. Tiền về ngân hàng (1-3 ngày)
```

**Lưu ý:** 
- Sandbox: Payout chỉ giả lập (không chuyển tiền thật)
- Production: Tiền THẬT được chuyển về bank account

---

## 🔐 Security

### 1. Signature Verification
Tất cả webhooks đều verify signature từ PayOS:
```javascript
const signature = req.headers['x-payos-signature'];
if (!verifyWebhookSignature(req.body, signature)) {
  return res.status(401).json({ message: 'Invalid signature' });
}
```

### 2. Environment Variables
- KHÔNG commit `.env` vào Git
- Dùng environment variables trên server
- Keys được encrypt trên Render/Railway

### 3. Error Handling
- Try-catch ở tất cả payment operations
- Log errors nhưng không expose sensitive data
- Graceful fallback khi PayOS down

---

## 🧪 Testing

### Sandbox Mode (Test)
- Dùng keys từ tab "Test" trên PayOS
- Tiền ảo, test miễn phí
- Webhooks hoạt động bình thường
- **Withdrawal chỉ giả lập** (không chuyển tiền thật)

### Production Mode (Live)
- Dùng keys từ tab "Live" trên PayOS
- Tiền thật, có phí giao dịch
- Cần xác minh KYC (CCCD, ngân hàng)
- Withdrawal chuyển tiền thật về bank

### Test Webhook Local (với ngrok)
```bash
# Install ngrok
npm install -g ngrok

# Run
ngrok http 5000

# Copy URL, update PayOS webhook settings
https://abc123.ngrok.io/api/payments/deposit/callback
```

---

## 💸 Phí

### PayOS Fees:
- Nạp tiền (QR/Banking): **1.5% - 2%**
- Thẻ nội địa (ATM): **2% - 3%**
- Thẻ quốc tế: **3% - 3.5%**
- Rút tiền: Miễn phí hoặc 5,000 VNĐ/lần

### Platform Fees (Your system):
- **15%** của mỗi booking → Admin wallet
- **85%** → Caregiver

---

## 📊 Monitoring

### 1. PayOS Dashboard
- Login: https://dashboard.payos.vn
- Xem giao dịch, doanh thu, số dư
- Export reports

### 2. Backend Logs
```bash
# Success logs
✅ PayOS deposit payment created for order: DEPOSIT_...
✅ Deposit completed: 500000đ for user {userId}

# Error logs
❌ PayOS deposit error: ...
```

### 3. Database
- Collection: `wallets`
- Field: `transactions` array
- Status: `pending`, `completed`, `failed`

---

## 🚨 Troubleshooting

### 1. Webhook không được gọi
- ✅ Check URL webhook trên PayOS Dashboard
- ✅ Đảm bảo server đang chạy và public
- ✅ Check firewall/security group
- ✅ Test với ngrok local

### 2. Signature verification failed
- ✅ Check `PAYOS_CHECKSUM_KEY` đúng chưa
- ✅ Đảm bảo không có space/newline trong key
- ✅ Log request body để debug

### 3. Payment link bị lỗi
- ✅ Check `FRONTEND_URL` và `BACKEND_URL` đúng chưa
- ✅ Verify PayOS keys còn valid
- ✅ Check PayOS service status

### 4. Withdrawal không hoạt động
- ✅ Check đã setup **Payout Channel** trên PayOS Dashboard chưa
- ✅ Verify bank account info đúng format (accountNumber, bankCode, accountName)
- ✅ Check balance trong PayOS merchant account đủ không
- ✅ **Sandbox payout chỉ giả lập** - cần Production để test thật
- ✅ Check logs: `❌ PayOS withdrawal error`

---

## 📞 Support

### PayOS:
- Hotline: **1900 6923**
- Email: support@payos.vn
- Docs: https://payos.vn/docs

### Our Team:
- Check issues: [GitHub Issues]
- Slack: #payment-support

---

## 📝 Changelog

### v1.0.0 (Dec 2024)
- ✅ Tích hợp PayOS deposit
- ✅ Booking payment
- ✅ Caregiver withdrawal
- ✅ Admin withdrawal
- ✅ Webhook callbacks
- ✅ Security improvements

---

## 🎯 Roadmap

- [ ] Refund API
- [ ] Recurring payments
- [ ] Multiple payment methods
- [ ] Better error recovery
- [ ] Analytics dashboard
