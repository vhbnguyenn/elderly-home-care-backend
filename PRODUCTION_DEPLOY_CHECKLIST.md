# ✅ Production Deployment Checklist - PayOS với TIỀN THẬT

## ⚠️ CẢNH BÁO

**BẠN ĐANG DEPLOY VỚI PAYOS PRODUCTION KEYS - TIỀN THẬT!**
- Mọi giao dịch sẽ dùng tiền thật
- PayOS sẽ tính phí 1.5% - 3% mỗi giao dịch
- Withdrawal sẽ chuyển tiền thật về ngân hàng

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### 1. ✅ Environment Variables

Đảm bảo có ĐẦY ĐỦ trên Render:

```
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=<strong-secret-key>
JWT_EXPIRE=30d

# PayOS Production
PAYOS_API_URL=https://api-merchant.payos.vn
PAYOS_CLIENT_ID=<production-client-id>
PAYOS_API_KEY=<production-api-key>
PAYOS_CHECKSUM_KEY=<production-checksum-key>

# URLs (QUAN TRỌNG!)
BACKEND_URL=https://your-app.onrender.com
FRONTEND_URL=https://your-frontend-url.com

PORT=5000
```

### 2. ✅ PayOS Dashboard Configuration

- [ ] Login: https://dashboard.payos.vn
- [ ] Vào **Cài đặt** → **Webhook**
- [ ] Thêm webhook URLs:
  ```
  https://your-app.onrender.com/api/payments/deposit/callback
  https://your-app.onrender.com/api/payments/booking/callback
  ```
- [ ] **Lưu** và test webhook

### 3. ✅ Git & Security

- [ ] `.env` KHÔNG được commit (check `.gitignore`)
- [ ] Không có credentials hardcoded trong code
- [ ] Đã xóa các file test/debug không cần thiết

### 4. ✅ Database

- [ ] MongoDB Atlas đã setup
- [ ] Database indexes đã tạo
- [ ] Có backup strategy

---

## 🚀 DEPLOYMENT STEPS

### Bước 1: Commit & Push

```bash
git add .
git commit -m "Production ready: PayOS integration with security improvements"
git push origin phuong
```

### Bước 2: Deploy trên Render

1. Login: https://render.com
2. Chọn service hoặc tạo mới
3. Connect GitHub repo
4. Chọn branch: `phuong`
5. **Settings** → **Environment Variables** → Add all variables
6. Click **Deploy**

### Bước 3: Đợi deploy hoàn thành (5-10 phút)

Monitor logs để đảm bảo không có lỗi:
```
✅ MongoDB Connected Successfully
✅ Server is running on port 5000
```

---

## 🧪 POST-DEPLOYMENT TESTING

### Test 1: Health Check

```bash
GET https://your-app.onrender.com/
# Expected: { "message": "Welcome to Elderly Home Care API", "version": "1.0.0" }
```

### Test 2: API Documentation

```
https://your-app.onrender.com/api-docs
# Phải load được Swagger UI
```

### Test 3: Deposit với số tiền NHỎ (50,000 VNĐ)

```bash
POST https://your-app.onrender.com/api/payments/deposit
Authorization: Bearer {careseeker_token}
Content-Type: application/json

{
  "amount": 50000
}

# Response phải có paymentUrl
```

**⚠️ QUAN TRỌNG:** 
- Mở `paymentUrl`
- Thanh toán thử với số tiền nhỏ
- Kiểm tra tiền có vào ví không
- **ĐÂY LÀ TIỀN THẬT!**

### Test 4: Kiểm tra Webhook

Sau khi thanh toán test:
- Check logs trên Render
- Phải thấy: `✅ PayOS deposit payment created`
- Check database: `availableBalance` phải tăng

### Test 5: Withdrawal Test (THẬN TRỌNG!)

```bash
# Setup bank account
PUT https://your-app.onrender.com/api/payments/caregiver/bank-account
Body: { "bankName": "...", "accountNumber": "..." }

# Withdraw (TIỀN THẬT!)
POST https://your-app.onrender.com/api/payments/caregiver/withdraw
Body: { "amount": 50000 }

# ⚠️ Tiền sẽ được chuyển về ngân hàng THẬT trong 1-3 ngày
```

---

## 📊 MONITORING

### 1. PayOS Dashboard

- URL: https://dashboard.payos.vn
- Theo dõi:
  - Tổng giao dịch
  - Doanh thu
  - Số dư
  - Giao dịch thất bại

### 2. Render Logs

- Vào Render Dashboard → Logs
- Theo dõi errors và warnings
- Set up alerts nếu cần

### 3. Database Monitoring

- MongoDB Atlas → Metrics
- Check connection issues
- Monitor query performance

---

## 🚨 ROLLBACK PLAN

Nếu có vấn đề:

### Plan A: Rollback Code
```bash
# Revert commit
git revert HEAD
git push origin phuong

# Render sẽ tự động deploy lại
```

### Plan B: Switch back to Sandbox
- Vào Render → Environment Variables
- Đổi PayOS keys về Sandbox
- Click **Save** → Auto redeploy

---

## 💰 COST ESTIMATION

### PayOS Fees:
- **Deposit**: 1.5% - 2% mỗi giao dịch
- **Withdrawal**: Miễn phí hoặc 5,000 VNĐ/lần

### Render:
- **Free Tier**: 
  - 750 hours/tháng
  - Tự ngủ sau 15 phút không dùng
  - Request đầu tiên chậm (30s)
  
- **Paid**: 
  - $7/tháng
  - Always on
  - Faster

### MongoDB Atlas:
- **Free Tier**: 512MB storage
- **Paid**: Từ $9/tháng

---

## 📞 SUPPORT CONTACTS

### PayOS:
- Hotline: **1900 6923**
- Email: support@payos.vn
- Dashboard: https://dashboard.payos.vn

### Render:
- Docs: https://render.com/docs
- Support: support@render.com

---

## ✅ FINAL CHECKLIST

- [ ] Tất cả environment variables đã set
- [ ] Webhook URLs đã cấu hình trên PayOS
- [ ] Deploy thành công, không có errors
- [ ] Health check pass
- [ ] Test deposit với 50k VNĐ thành công
- [ ] Webhook callback hoạt động (tiền vào ví)
- [ ] Đã hiểu rõ fees và costs
- [ ] Có plan monitoring và rollback
- [ ] Team đã được training về production flow

---

## 🎉 DONE!

**Backend đã LIVE với PayOS Production!**

Lưu ý:
- Luôn test với số tiền nhỏ trước
- Monitor logs thường xuyên tuần đầu
- Chuẩn bị customer support cho user issues
- Có chính sách refund rõ ràng

**Good luck! 🚀**
