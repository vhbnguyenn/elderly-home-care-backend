const mongoose = require('mongoose');

/**
 * User Preference Schema
 * Lưu preference weights của từng careseeker để cải thiện matching
 * Machine Learning component - học từ hành vi user
 */
const userPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    
    // Custom weights cho AI matching
    weights: {
      credential: {
        type: Number,
        default: 0.25,
        min: 0,
        max: 1
      },
      skills: {
        type: Number,
        default: 0.25,
        min: 0,
        max: 1
      },
      availability: {
        type: Number,
        default: 0.15,
        min: 0,
        max: 1
      },
      rating: {
        type: Number,
        default: 0.12,
        min: 0,
        max: 1
      },
      experience: {
        type: Number,
        default: 0.08,
        min: 0,
        max: 1
      },
      distance: {
        type: Number,
        default: 0.08,
        min: 0,
        max: 1
      },
      price: {
        type: Number,
        default: 0.05,
        min: 0,
        max: 1
      },
      trust: {
        type: Number,
        default: 0.02,
        min: 0,
        max: 1
      }
    },

    // Preferred attributes
    preferredAttributes: {
      gender: {
        type: String,
        enum: ['Nam', 'Nữ', null],
        default: null
      },
      minAge: {
        type: Number,
        default: 20
      },
      maxAge: {
        type: Number,
        default: 60
      },
      minRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      minExperience: {
        type: Number,
        default: 0
      },
      education: {
        type: [String],
        enum: ['trung học cơ sở', 'trung học phổ thông', 'đại học', 'sau đại học'],
        default: []
      }
    },

    // Learning metadata
    totalBookings: {
      type: Number,
      default: 0
    },
    totalSearches: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    learningEnabled: {
      type: Boolean,
      default: true
    },

    // Feedback data for continuous learning
    feedbackHistory: [{
      bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
      },
      caregiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      satisfaction: {
        type: Number,
        min: 1,
        max: 5
      },
      attributesLiked: {
        type: [String],
        enum: ['credential', 'skills', 'availability', 'rating', 'experience', 'personality', 'communication']
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

// Index for faster queries
userPreferenceSchema.index({ user: 1 });

// Validate weights sum to 1.0
userPreferenceSchema.pre('save', function(next) {
  const weightsSum = Object.values(this.weights).reduce((sum, w) => sum + w, 0);
  const tolerance = 0.01; // Allow small floating point errors
  
  if (Math.abs(weightsSum - 1.0) > tolerance) {
    // Auto-normalize weights
    Object.keys(this.weights).forEach(key => {
      this.weights[key] = this.weights[key] / weightsSum;
    });
  }
  
  next();
});

// Static method: Get or create user preference
userPreferenceSchema.statics.getOrCreate = async function(userId) {
  let preference = await this.findOne({ user: userId });
  
  if (!preference) {
    preference = await this.create({ user: userId });
  }
  
  return preference;
};

// Static method: Update weights based on booking feedback
userPreferenceSchema.statics.updateFromFeedback = async function(userId, feedbackData) {
  const preference = await this.getOrCreate(userId);
  
  const { bookingId, caregiverId, satisfaction, attributesLiked } = feedbackData;
  
  // Add to feedback history
  preference.feedbackHistory.push({
    bookingId,
    caregiverId,
    satisfaction,
    attributesLiked,
    createdAt: new Date()
  });

  // Adjust weights based on attributes liked
  if (attributesLiked && attributesLiked.length > 0) {
    const adjustmentFactor = 0.02; // Small incremental learning
    
    attributesLiked.forEach(attr => {
      if (preference.weights[attr] !== undefined) {
        preference.weights[attr] = Math.min(
          preference.weights[attr] + adjustmentFactor,
          0.5 // Max 50% for any single attribute
        );
      }
    });

    // Normalize weights
    const weightsSum = Object.values(preference.weights).reduce((sum, w) => sum + w, 0);
    Object.keys(preference.weights).forEach(key => {
      preference.weights[key] = preference.weights[key] / weightsSum;
    });
  }

  preference.lastUpdated = new Date();
  await preference.save();
  
  return preference;
};

// Instance method: Increment search count
userPreferenceSchema.methods.incrementSearchCount = async function() {
  this.totalSearches += 1;
  this.lastUpdated = new Date();
  await this.save();
};

// Instance method: Increment booking count
userPreferenceSchema.methods.incrementBookingCount = async function() {
  this.totalBookings += 1;
  this.lastUpdated = new Date();
  await this.save();
};

const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

module.exports = UserPreference;
