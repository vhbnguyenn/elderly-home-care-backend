const mongoose = require('mongoose');

const caregiverAvailabilitySchema = new mongoose.Schema(
  {
    // Caregiver
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Caregiver is required']
    },
    
    // Loại lặp lại
    recurrenceType: {
      type: String,
      enum: ['weekly', 'daily', 'once'],
      default: 'weekly'
    },
    
    // Các ngày trong tuần (cho weekly)
    daysOfWeek: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: function() {
        return this.recurrenceType === 'weekly';
      }
    }],
    
    // Khung giờ rảnh trong ngày
    timeSlots: [{
      startTime: {
        type: String,
        required: true,
        match: /^([01]\d|2[0-3]):([0-5]\d)$/ // Format: HH:mm
      },
      endTime: {
        type: String,
        required: true,
        match: /^([01]\d|2[0-3]):([0-5]\d)$/
      }
    }],
    
    // Cả ngày
    isAllDay: {
      type: Boolean,
      default: false
    },
    
    // Bán cả ngày (nửa ngày)
    isHalfDay: {
      type: Boolean,
      default: false
    },
    
    // Áp dụng từ ngày
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    
    // Đến ngày (optional - null = không giới hạn)
    endDate: {
      type: Date,
      default: null
    },
    
    // Trạng thái
    isActive: {
      type: Boolean,
      default: true
    },
    
    // Ghi chú
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    
    // Các ngày ngoại lệ (ngày nghỉ đột xuất)
    exceptions: [{
      date: {
        type: Date,
        required: true
      },
      reason: {
        type: String,
        trim: true,
        maxlength: 200
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  {
    timestamps: true
  }
);

// Index để query nhanh
caregiverAvailabilitySchema.index({ caregiver: 1, isActive: 1 });
caregiverAvailabilitySchema.index({ caregiver: 1, startDate: 1, endDate: 1 });
caregiverAvailabilitySchema.index({ daysOfWeek: 1 });

// Validation: endDate phải sau startDate
caregiverAvailabilitySchema.pre('save', function(next) {
  if (this.endDate && this.endDate <= this.startDate) {
    return next(new Error('End date must be after start date'));
  }
  
  // Nếu isAllDay = true thì không cần timeSlots
  if (this.isAllDay) {
    this.timeSlots = [{
      startTime: '00:00',
      endTime: '23:59'
    }];
  }
  
  // Nếu isHalfDay = true thì chỉ 1 time slot
  if (this.isHalfDay && this.timeSlots.length > 1) {
    return next(new Error('Half day can only have one time slot'));
  }
  
  next();
});

// Method: Check if caregiver is available on a specific date and time
caregiverAvailabilitySchema.methods.isAvailableAt = function(date, startTime, endTime) {
  // Check if date is within range
  if (date < this.startDate || (this.endDate && date > this.endDate)) {
    return false;
  }
  
  // Check if date is in exceptions
  const isException = this.exceptions.some(exc => {
    const excDate = new Date(exc.date);
    return excDate.toDateString() === date.toDateString();
  });
  
  if (isException) {
    return false;
  }
  
  // Check day of week
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[date.getDay()];
  
  if (this.recurrenceType === 'weekly' && !this.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }
  
  // Check time slots
  // isAllDay = true: rảnh cả ngày
  // isAllDay = false: bận cả ngày (không rảnh)
  if (this.isAllDay === false) {
    return false;
  }
  
  if (this.isAllDay === true) {
    return true;
  }
  
  // Nếu không set isAllDay, check timeSlots
  return this.timeSlots.some(slot => {
    return startTime >= slot.startTime && endTime <= slot.endTime;
  });
};

// Static: Get available caregivers for a specific date and time
caregiverAvailabilitySchema.statics.getAvailableCaregivers = async function(date, startTime, endTime) {
  const CaregiverProfile = require('./CaregiverProfile');
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[date.getDay()];
  
  const availabilities = await this.find({
    isActive: true,
    startDate: { $lte: date },
    $or: [
      { endDate: null },
      { endDate: { $gte: date } }
    ],
    daysOfWeek: dayOfWeek
  }).populate('caregiver', 'name avatar');
  
  // Filter by time slots and exceptions
  const available = availabilities.filter(avail => {
    // Check exceptions
    const hasException = avail.exceptions.some(exc => {
      const excDate = new Date(exc.date);
      return excDate.toDateString() === date.toDateString();
    });
    
    if (hasException) return false;
    
    // Check time slots
    // isAllDay = false: bận cả ngày (không rảnh)
    if (avail.isAllDay === false) return false;
    
    // isAllDay = true: rảnh cả ngày
    if (avail.isAllDay === true) return true;
    
    // Nếu không set isAllDay, check timeSlots
    return avail.timeSlots.some(slot => {
      return startTime >= slot.startTime && endTime <= slot.endTime;
    });
  });
  
  const caregiversWithSchedule = available.map(a => {
    const caregiverId = a.caregiver._id || a.caregiver;
    return caregiverId.toString();
  });
  
  // ✅ Nếu caregiver không set lịch rảnh → tự động coi là rảnh
  // Lấy tất cả caregivers approved và thêm những người không có schedule
  const allApprovedCaregivers = await CaregiverProfile.find({
    profileStatus: 'approved',
    isAvailable: true
  }).populate('user', 'name avatar');
  
  const caregiversWithoutSchedule = allApprovedCaregivers
    .filter(c => {
      const userId = (c.user?._id || c.user)?.toString();
      return userId && !caregiversWithSchedule.includes(userId);
    })
    .map(c => c.user);
  
  // Return cả caregivers có schedule (từ available) và không có schedule
  const caregiversWithScheduleObjects = available.map(a => a.caregiver);
  return [...caregiversWithScheduleObjects, ...caregiversWithoutSchedule];
};

// Static: Get caregiver's schedule for a date range
caregiverAvailabilitySchema.statics.getSchedule = async function(caregiverId, startDate, endDate) {
  return this.find({
    caregiver: caregiverId,
    isActive: true,
    $or: [
      {
        // Availability starts before or during the range
        startDate: { $lte: endDate },
        $or: [
          { endDate: null },
          { endDate: { $gte: startDate } }
        ]
      }
    ]
  }).sort('startDate');
};

module.exports = mongoose.model('CaregiverAvailability', caregiverAvailabilitySchema);
