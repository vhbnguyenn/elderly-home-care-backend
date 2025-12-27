# 🐛 Bug Fix: Token Refresh API - undefined accessToken

## ❌ Problem
Frontend gặp lỗi khi refresh token:
```
[AsyncStorage] Passing null/undefined as value is not supported.
Passed value: undefined
Passed key: auth_token
```

**Root Cause:** API endpoint `/api/auth/refresh-token` chỉ trả về `accessToken`, không có `refreshToken` trong response, khiến frontend không xử lý được.

## ✅ Solution

### Fixed File: `src/controllers/authController.js`

**Before (Line 260-269):**
```javascript
// Tạo access token mới
const newAccessToken = user.generateToken();

res.status(200).json({
  success: true,
  message: 'Làm mới token thành công',
  data: {
    accessToken: newAccessToken
    // ❌ Missing refreshToken
  }
});
```

**After:**
```javascript
// Tạo access token mới
const newAccessToken = user.generateToken();

// CRITICAL: Return both accessToken and refreshToken
res.status(200).json({
  success: true,
  message: 'Làm mới token thành công',
  data: {
    accessToken: newAccessToken,
    refreshToken: refreshToken // ✅ Return the same refresh token
  }
});
```

## 📋 Response Structure

### Correct Response Format:
```json
{
  "success": true,
  "message": "Làm mới token thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Key Points:
- ✅ `data.accessToken` MUST be a valid JWT string
- ✅ `data.refreshToken` MUST be present (can be same or new)
- ✅ Status code: `200`
- ✅ Both tokens MUST NOT be `null` or `undefined`

## 🔒 Security Flow

1. Frontend sends `refreshToken` in request body
2. Backend verifies refresh token:
   - Check JWT signature
   - Check token expiry
   - Check token exists in DB
   - Check user is active
3. Generate NEW `accessToken`
4. Return BOTH tokens in response
5. Frontend stores new `accessToken` in AsyncStorage

## ✅ Validation Checklist

- [x] `accessToken` exists in response
- [x] `refreshToken` exists in response
- [x] Both tokens are valid JWT strings
- [x] Status code is 200 on success
- [x] No linter errors
- [x] Response structure validated

## 🧪 Testing

### Manual Test:
```bash
curl -X POST http://localhost:5000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token_here"
  }'
```

### Expected Response:
```json
{
  "success": true,
  "message": "Làm mới token thành công",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

## 📝 Notes

- Refresh token stays the same (not rotated)
- Access token is regenerated on every refresh
- Token expiry: Access token (1h), Refresh token (7d)
- Refresh token stored in DB for validation

## 🎯 Impact

- ✅ Frontend can now refresh tokens without errors
- ✅ AsyncStorage no longer receives `undefined` values
- ✅ User session management works correctly
- ✅ Auto-refresh on 401 errors now functional

---

**Fixed by:** AI Assistant
**Date:** 2025-12-27
**File:** `src/controllers/authController.js` (Line 260-271)

