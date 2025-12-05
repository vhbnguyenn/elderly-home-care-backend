# Caregiver Review System API Documentation

## Overview
Hệ thống đánh giá cho phép **Caregiver** đánh giá **Careseeker** sau khi hoàn thành dịch vụ chăm sóc. Review này giúp các caregiver khác có cái nhìn về khách hàng trước khi nhận việc.

## Model Structure: CaregiverReview

### Ratings (Đánh giá 1-5 sao)
```javascript
ratings: {
  cooperation: Number,        // Mức độ hợp tác
  communication: Number,      // Chất lượng giao tiếp
  respect: Number,           // Thái độ tôn trọng
  readiness: Number,         // Tính sẵn sàng
  workingEnvironment: Number // Môi trường làm việc
}
```

### Family Support (Sự hỗ trợ từ gia đình)
```javascript
familySupport: String
// Options: 'very_supportive', 'supportive', 'neutral', 'minimal', 'none'
```

### Issues (Các vấn đề cần lưu ý)
```javascript
issues: [String]
// Options:
// - 'late_payment': Thanh toán chậm
// - 'schedule_changes': Thay đổi lịch trình
// - 'unrealistic_expectations': Kỳ vọng không thực tế
// - 'communication_difficulties': Khó khăn trong giao tiếp
// - 'safety_concerns': Mối quan ngại về an toàn
// - 'hygiene_issues': Vấn đề vệ sinh
// - 'other': Khác
```

### Recommendation (Mức độ giới thiệu)
```javascript
recommendation: String
// Options: 'highly_recommend', 'recommend', 'neutral', 'not_recommend'
```

### Additional Notes
```javascript
additionalNotes: String (max 1000 characters)
```

---

## API Endpoints

### 1. Tạo Review (POST /api/caregiver-reviews)
**Auth Required:** Yes (Caregiver only)

**Request Body:**
```json
{
  "bookingId": "674ab48b9c7f8e1234567890",
  "ratings": {
    "cooperation": 5,
    "communication": 4,
    "respect": 5,
    "readiness": 4,
    "workingEnvironment": 5
  },
  "familySupport": "very_supportive",
  "issues": ["schedule_changes"],
  "recommendation": "highly_recommend",
  "additionalNotes": "Gia đình rất hỗ trợ, môi trường làm việc tốt. Đôi khi có thay đổi lịch trình nhưng thông báo trước."
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Tạo review thành công",
  "data": {
    "_id": "674ab48b9c7f8e1234567891",
    "reviewer": {
      "_id": "674ab48b9c7f8e1234567892",
      "name": "Nguyễn Văn A",
      "avatar": "https://..."
    },
    "careseeker": {
      "_id": "674ab48b9c7f8e1234567893",
      "name": "Trần Thị B"
    },
    "elderlyProfile": {
      "_id": "674ab48b9c7f8e1234567894",
      "fullName": "Nguyễn Văn C",
      "age": 75
    },
    "booking": {
      "_id": "674ab48b9c7f8e1234567890",
      "bookingDate": "2024-12-01",
      "duration": 4
    },
    "ratings": {
      "cooperation": 5,
      "communication": 4,
      "respect": 5,
      "readiness": 4,
      "workingEnvironment": 5
    },
    "familySupport": "very_supportive",
    "issues": ["schedule_changes"],
    "recommendation": "highly_recommend",
    "additionalNotes": "Gia đình rất hỗ trợ...",
    "averageRating": "4.6",
    "createdAt": "2024-12-05T10:00:00.000Z"
  }
}
```

**Validation:**
- Booking phải ở trạng thái `completed`
- Caregiver phải là người làm việc trong booking đó
- Mỗi booking chỉ được review 1 lần
- Tất cả 5 ratings phải được điền

---

### 2. Lấy Review của Tôi (GET /api/caregiver-reviews/my-reviews)
**Auth Required:** Yes (Caregiver)

**Query Params:**
- `page`: số trang (default: 1)
- `limit`: số lượng/trang (default: 10)
- `sortBy`: sắp xếp (default: -createdAt)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "reviews": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "total": 25
    }
  }
}
```

---

### 3. Lấy Review Nhận Được (GET /api/caregiver-reviews/received)
**Auth Required:** Yes (Careseeker only)

Careseeker xem các review về mình từ caregivers.

**Query Params:** Same as above

---

### 4. Lấy Review về Careseeker (GET /api/caregiver-reviews/careseeker/:careseekerUserId)
**Auth Required:** No (Public)

Xem tất cả review công khai về một careseeker cụ thể.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "reviews": [...],
    "stats": {
      "avgCooperation": 4.5,
      "avgCommunication": 4.3,
      "avgRespect": 4.7,
      "avgReadiness": 4.2,
      "avgWorkingEnvironment": 4.6,
      "totalReviews": 15,
      "recommendCount": 12,
      "overallAverage": "4.5",
      "recommendationRate": "80.0"
    },
    "pagination": {...}
  }
}
```

---

### 5. Lấy Chi Tiết Review (GET /api/caregiver-reviews/:id)
**Auth Required:** No (Public, nhưng chỉ hiển thị review visible)

---

### 6. Cập Nhật Review (PUT /api/caregiver-reviews/:id)
**Auth Required:** Yes (Chỉ người tạo)

**Request Body:** Giống như tạo review, có thể update một phần

---

### 7. Xóa Review (DELETE /api/caregiver-reviews/:id)
**Auth Required:** Yes (Người tạo hoặc Admin)

---

### 8. Careseeker Phản Hồi Review (POST /api/caregiver-reviews/:id/response)
**Auth Required:** Yes (Careseeker - chỉ review về mình)

**Request Body:**
```json
{
  "responseText": "Cảm ơn anh đã đánh giá. Chúng tôi sẽ cố gắng cải thiện hơn nữa."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Phản hồi review thành công",
  "data": {
    "_id": "...",
    "careseekerResponse": {
      "text": "Cảm ơn anh đã đánh giá...",
      "respondedAt": "2024-12-05T11:00:00.000Z"
    },
    ...
  }
}
```

---

### 9. Admin Ẩn/Hiện Review (PUT /api/caregiver-reviews/:id/toggle-visibility)
**Auth Required:** Yes (Admin only)

Toggle `isVisible` và `status` của review.

---

## Mapping UI to API Fields

### UI Form → API Request
```javascript
// UI State
const reviewData = {
  cooperation: 5,           // ratings.cooperation
  communication: 4,         // ratings.communication
  respect: 5,              // ratings.respect
  readiness: 4,            // ratings.readiness
  workingEnvironment: 5,   // ratings.workingEnvironment
  familySupport: "very_supportive",  // familySupport
  issues: ["late_payment", "schedule_changes"], // issues
  recommendation: "highly_recommend", // recommendation
  additionalNotes: "..."   // additionalNotes
}

// API Request
const apiRequest = {
  bookingId: "674ab48b9c7f8e1234567890",
  ratings: {
    cooperation: reviewData.cooperation,
    communication: reviewData.communication,
    respect: reviewData.respect,
    readiness: reviewData.readiness,
    workingEnvironment: reviewData.workingEnvironment
  },
  familySupport: reviewData.familySupport,
  issues: reviewData.issues,
  recommendation: reviewData.recommendation,
  additionalNotes: reviewData.additionalNotes
}
```

### Family Support Options Mapping
```javascript
const familySupportOptions = [
  { value: 'very_supportive', label: 'Rất hỗ trợ', description: '...' },
  { value: 'supportive', label: 'Hỗ trợ', description: '...' },
  { value: 'neutral', label: 'Trung lập', description: '...' },
  { value: 'minimal', label: 'Ít hỗ trợ', description: '...' },
  { value: 'none', label: 'Không hỗ trợ', description: '...' }
]
```

### Issues Options Mapping
```javascript
const issuesOptions = [
  { id: 'late_payment', label: 'Thanh toán chậm' },
  { id: 'schedule_changes', label: 'Thay đổi lịch trình' },
  { id: 'unrealistic_expectations', label: 'Kỳ vọng không thực tế' },
  { id: 'communication_difficulties', label: 'Khó giao tiếp' },
  { id: 'safety_concerns', label: 'Vấn đề an toàn' },
  { id: 'hygiene_issues', label: 'Vấn đề vệ sinh' },
  { id: 'other', label: 'Khác' }
]
```

### Recommendation Options Mapping
```javascript
const recommendationOptions = [
  { value: 'highly_recommend', label: 'Rất giới thiệu', description: '...' },
  { value: 'recommend', label: 'Giới thiệu', description: '...' },
  { value: 'neutral', label: 'Trung lập', description: '...' },
  { value: 'not_recommend', label: 'Không giới thiệu', description: '...' }
]
```

---

## Mobile Implementation Example

### Create Review Function
```javascript
const handleSubmit = async () => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    
    const response = await fetch('http://your-api/api/caregiver-reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        bookingId: route.params.bookingId, // Từ navigation params
        ratings: {
          cooperation: reviewData.cooperation,
          communication: reviewData.communication,
          respect: reviewData.respect,
          readiness: reviewData.readiness,
          workingEnvironment: reviewData.workingEnvironment
        },
        familySupport: reviewData.familySupport,
        issues: reviewData.issues,
        recommendation: reviewData.recommendation,
        additionalNotes: reviewData.additionalNotes
      })
    });

    const result = await response.json();
    
    if (result.success) {
      Alert.alert('Thành công', 'Đánh giá đã được gửi!');
      navigation.goBack();
    } else {
      Alert.alert('Lỗi', result.message);
    }
  } catch (error) {
    Alert.alert('Lỗi', 'Không thể gửi đánh giá');
  }
};
```

---

## Business Logic

1. **Review Creation:**
   - Chỉ caregiver mới được tạo review
   - Booking phải ở trạng thái `completed`
   - Mỗi booking chỉ được review 1 lần (unique index: reviewer + booking)
   - Tất cả 5 ratings bắt buộc

2. **Visibility:**
   - `isVisible: true` - Hiển thị công khai
   - `isVisible: false` - Bị admin ẩn (vi phạm chính sách)
   - `status: active/hidden/flagged`

3. **Careseeker Response:**
   - Careseeker có thể phản hồi review về mình
   - Response không được vượt quá 500 ký tự

4. **Statistics:**
   - Tính điểm trung bình cho từng tiêu chí
   - Tính overall average (trung bình 5 tiêu chí)
   - Recommendation rate (% người recommend)

---

## Notes for Frontend

1. **Validation trước khi submit:**
   - Kiểm tra tất cả 5 star ratings đã được chọn
   - familySupport đã được chọn
   - recommendation đã được chọn

2. **Loading states:**
   - Show loading khi đang submit
   - Disable nút submit để tránh double submit

3. **Error handling:**
   - 400: Validation error (hiển thị message cụ thể)
   - 403: Không có quyền (ví dụ: không phải caregiver)
   - 404: Booking không tồn tại

4. **Success flow:**
   - Hiển thị success message
   - Navigate về màn hình booking detail hoặc booking list
