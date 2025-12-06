const CaregiverProfile = require('../models/CaregiverProfile');
const CaregiverSkill = require('../models/CaregiverSkill');
const CaregiverAvailability = require('../models/CaregiverAvailability');
const CaregiverReview = require('../models/CaregiverReview');
const Booking = require('../models/Booking');
const User = require('../models/User');
const stringSimilarity = require('string-similarity');
const NodeCache = require('node-cache');

// Cache cho similarity scores (TTL: 1 hour)
const similarityCache = new NodeCache({ stdTTL: 3600 });

/**
 * AI Matching Service - Tìm caregiver phù hợp nhất
 * 
 * Khắc phục hạn chế của source code gốc:
 * ✅ Học từ lịch sử booking và feedback
 * ✅ Dynamic weights dựa trên user preference
 * ✅ Caching để tăng performance
 * ✅ Tích hợp với MongoDB thay vì JSON
 * ✅ Real-time availability check
 */

class AIMatchingService {
  constructor() {
    // Default weights (có thể điều chỉnh động)
    this.weights = {
      credential: 0.25,    // Bằng cấp, chứng chỉ
      skills: 0.25,        // Kỹ năng matching
      availability: 0.15,  // Thời gian rảnh
      rating: 0.12,        // Đánh giá
      experience: 0.08,    // Kinh nghiệm
      distance: 0.08,      // Khoảng cách (nếu có location)
      price: 0.05,         // Giá cả
      trust: 0.02          // Độ tin cậy
    };

    // Vietnamese skills normalization mapping
    this.skillsMapping = {
      'tiêm insulin': ['tiêm', 'insulin', 'tiêm thuốc', 'injection'],
      'chăm sóc vết thương': ['vết thương', 'wound care', 'chăm sóc', 'băng bó'],
      'đo huyết áp': ['huyết áp', 'blood pressure', 'đo', 'vital signs'],
      'cho ăn': ['feeding', 'ăn uống', 'meal', 'nutrition'],
      'tắm rửa': ['bathing', 'tắm', 'vệ sinh', 'hygiene'],
      'vận động': ['exercise', 'physical therapy', 'tập luyện', 'mobility'],
      'đo đường huyết': ['đường huyết', 'blood sugar', 'glucose', 'diabetes'],
      'quản lý thuốc': ['medication', 'thuốc', 'medicine', 'prescription'],
      'vật lý trị liệu': ['physical therapy', 'rehabilitation', 'phục hồi'],
      'alzheimer': ['dementia', 'sa sút trí tuệ', 'nhận thức'],
      'parkinson': ['parkinson disease', 'run', 'tremor'],
      'đột quỵ': ['stroke', 'liệt', 'paralysis', 'hemiplegia']
    };
  }

  /**
   * Main matching function
   */
  async findMatchingCaregivers(request, options = {}) {
    const {
      careseekerId,
      requiredSkills = [],
      preferredSkills = [],
      careLevel = 1,
      timeSlots = [],
      maxDistance = 50, // km
      budgetPerHour = null,
      minRating = 0,
      minExperience = 0,
      genderPreference = null,
      ageRange = null,
      healthConditions = [],
      topN = 10,
      useLearning = true // Sử dụng learning từ lịch sử
    } = request;

    // Get user preferences từ lịch sử nếu enabled
    let adjustedWeights = { ...this.weights };
    if (useLearning && careseekerId) {
      adjustedWeights = await this.getUserPreferenceWeights(careseekerId);
    }

    // BƯỚC 1: Lấy tất cả caregiver profiles (approved)
    const caregivers = await this.getAllApprovedCaregivers();

    // BƯỚC 2: Hard filters - Loại bỏ không đủ điều kiện
    let filteredCaregivers = await this.applyHardFilters(caregivers, {
      careLevel,
      requiredSkills,
      timeSlots,
      minRating,
      minExperience,
      genderPreference,
      ageRange
    });

    // BƯỚC 3: Soft scoring - Tính điểm cho từng caregiver
    const scoredCaregivers = await Promise.all(
      filteredCaregivers.map(async (caregiver) => {
        const scores = await this.calculateScores(caregiver, {
          requiredSkills,
          preferredSkills,
          careLevel,
          timeSlots,
          budgetPerHour,
          healthConditions,
          careseekerId
        });

        // Weighted sum
        const totalScore = Object.keys(adjustedWeights).reduce((sum, key) => {
          return sum + (scores[key] || 0) * adjustedWeights[key];
        }, 0);

        return {
          caregiver,
          totalScore: Math.round(totalScore * 1000) / 1000,
          scores,
          matchPercentage: Math.round(totalScore * 100) + '%'
        };
      })
    );

    // BƯỚC 4: Sắp xếp và trả về top N
    const rankedCaregivers = scoredCaregivers
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, topN);

    // BƯỚC 5: Format response
    return rankedCaregivers.map(item => this.formatMatchResult(item));
  }

  /**
   * Get all approved caregivers với đầy đủ thông tin
   */
  async getAllApprovedCaregivers() {
    const profiles = await CaregiverProfile.find({ 
      profileStatus: 'approved' 
    })
    .populate('user', 'name email phone isActive')
    .lean();

    // Lấy thêm skills, availability, reviews cho mỗi caregiver
    const caregivers = await Promise.all(
      profiles.map(async (profile) => {
        const [skills, availability, reviews, bookings] = await Promise.all([
          CaregiverSkill.find({ 
            caregiver: profile.user._id, 
            isActive: true 
          }).lean(),
          CaregiverAvailability.find({ 
            caregiver: profile.user._id, 
            isActive: true 
          }).lean(),
          CaregiverReview.find({ 
            caregiver: profile.user._id 
          }).lean(),
          Booking.find({ 
            caregiver: profile.user._id,
            status: { $in: ['completed', 'ongoing'] }
          }).lean()
        ]);

        return {
          ...profile,
          skills,
          availability,
          reviews,
          bookingHistory: this.calculateBookingStats(bookings)
        };
      })
    );

    return caregivers.filter(c => c.user && c.user.isActive);
  }

  /**
   * Apply hard filters (bắt buộc)
   */
  async applyHardFilters(caregivers, filters) {
    const {
      careLevel,
      requiredSkills,
      timeSlots,
      minRating,
      minExperience,
      genderPreference,
      ageRange
    } = filters;

    return caregivers.filter(caregiver => {
      // Filter 1: Care level - Check education level
      if (careLevel >= 2) {
        const hasUniversityDegree = caregiver.education === 'đại học' || 
                                    caregiver.education === 'sau đại học';
        if (!hasUniversityDegree) return false;
      }

      // Filter 2: Required skills - 100% match
      if (requiredSkills && requiredSkills.length > 0) {
        const hasAllSkills = this.checkRequiredSkills(
          caregiver.skills,
          requiredSkills
        );
        if (!hasAllSkills) return false;
      }

      // Filter 3: Time availability
      if (timeSlots && timeSlots.length > 0) {
        const hasTimeAvailable = this.checkTimeAvailability(
          caregiver.availability,
          timeSlots
        );
        if (!hasTimeAvailable) return false;
      }

      // Filter 4: Minimum rating
      if (minRating > 0) {
        const avgRating = this.calculateAverageRating(caregiver.reviews);
        if (avgRating < minRating) return false;
      }

      // Filter 5: Minimum experience
      if (minExperience > 0) {
        if (caregiver.yearsOfExperience < minExperience) return false;
      }

      // Filter 6: Gender preference
      if (genderPreference && caregiver.gender !== genderPreference) {
        return false;
      }

      // Filter 7: Age range
      if (ageRange) {
        const age = this.calculateAge(caregiver.dateOfBirth);
        const [minAge, maxAge] = ageRange;
        if (age < minAge || age > maxAge) return false;
      }

      return true;
    });
  }

  /**
   * Calculate all scores for a caregiver
   */
  async calculateScores(caregiver, request) {
    const {
      requiredSkills,
      preferredSkills,
      careLevel,
      timeSlots,
      budgetPerHour,
      healthConditions,
      careseekerId
    } = request;

    return {
      credential: this.calculateCredentialScore(caregiver, careLevel),
      skills: this.calculateSkillsScore(
        caregiver.skills,
        requiredSkills,
        preferredSkills
      ),
      availability: this.calculateAvailabilityScore(
        caregiver.availability,
        timeSlots
      ),
      rating: this.calculateRatingScore(caregiver.reviews),
      experience: this.calculateExperienceScore(caregiver.yearsOfExperience),
      distance: 0.8, // Placeholder - cần có location data
      price: budgetPerHour ? this.calculatePriceScore(caregiver, budgetPerHour) : 1.0,
      trust: this.calculateTrustScore(caregiver)
    };
  }

  /**
   * Calculate credential score (bằng cấp + chứng chỉ)
   */
  calculateCredentialScore(caregiver, careLevel) {
    let score = 0;
    const MAX_SCORE = 10;

    // Education level score (0-4 points)
    const educationScores = {
      'trung học cơ sở': 1,
      'trung học phổ thông': 2,
      'đại học': 3,
      'sau đại học': 4
    };
    score += educationScores[caregiver.education] || 0;

    // Certificates score (0-6 points, 0.5 per cert, max 12 certs)
    const relevantCerts = caregiver.certificates.filter(cert => {
      return this.isCertificateRelevant(cert, careLevel);
    });
    score += Math.min(relevantCerts.length * 0.5, 6);

    return Math.min(score / MAX_SCORE, 1.0);
  }

  /**
   * Calculate skills matching score với semantic similarity
   */
  calculateSkillsScore(caregiverSkills, requiredSkills = [], preferredSkills = []) {
    if (preferredSkills.length === 0) return 1.0;

    const caregiverSkillNames = caregiverSkills.map(s => 
      s.name.toLowerCase().trim()
    );

    let matchedCount = 0;
    let skillsWithCertificates = 0;

    preferredSkills.forEach(prefSkill => {
      const normalized = this.normalizeSkillName(prefSkill);
      let bestMatch = 0;
      let matchedSkillObj = null;

      caregiverSkillNames.forEach((cgSkill, index) => {
        const similarity = this.calculateSemanticSimilarity(normalized, cgSkill);
        if (similarity > bestMatch) {
          bestMatch = similarity;
          matchedSkillObj = caregiverSkills[index];
        }
      });

      // Threshold 0.75 (75% similarity)
      if (bestMatch >= 0.75) {
        matchedCount++;
        // Bonus nếu skill có certificate liên quan
        if (matchedSkillObj && this.skillHasCertificate(matchedSkillObj, caregiverSkills)) {
          skillsWithCertificates++;
        }
      }
    });

    const baseScore = matchedCount / preferredSkills.length;
    const certBonus = matchedCount > 0 
      ? (skillsWithCertificates / matchedCount) * 0.2 
      : 0;

    return Math.min(baseScore + certBonus, 1.0);
  }

  /**
   * Semantic similarity using string-similarity
   * Thay thế cho PhoBERT để không cần Python
   */
  calculateSemanticSimilarity(skill1, skill2) {
    // Check cache first
    const cacheKey = `${skill1}|${skill2}`;
    const cached = similarityCache.get(cacheKey);
    if (cached !== undefined) return cached;

    // Normalize
    const s1 = this.normalizeSkillName(skill1);
    const s2 = this.normalizeSkillName(skill2);

    // Exact match
    if (s1 === s2) {
      similarityCache.set(cacheKey, 1.0);
      return 1.0;
    }

    // Check mapping
    const mappedWords1 = this.getSkillMappings(s1);
    const mappedWords2 = this.getSkillMappings(s2);
    
    let maxSimilarity = 0;

    // Compare all combinations
    mappedWords1.forEach(word1 => {
      mappedWords2.forEach(word2 => {
        const similarity = stringSimilarity.compareTwoStrings(word1, word2);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      });
    });

    similarityCache.set(cacheKey, maxSimilarity);
    return maxSimilarity;
  }

  /**
   * Normalize Vietnamese skill name
   */
  normalizeSkillName(skill) {
    return skill
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/đ/g, 'd')
      .trim();
  }

  /**
   * Get skill mappings
   */
  getSkillMappings(skill) {
    const normalized = this.normalizeSkillName(skill);
    
    for (const [key, values] of Object.entries(this.skillsMapping)) {
      const normalizedKey = this.normalizeSkillName(key);
      if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
        return [normalized, ...values.map(v => this.normalizeSkillName(v))];
      }
    }

    return [normalized];
  }

  /**
   * Check required skills - 100% match
   */
  checkRequiredSkills(caregiverSkills, requiredSkills) {
    if (!requiredSkills || requiredSkills.length === 0) return true;

    const caregiverSkillNames = caregiverSkills.map(s => 
      s.name.toLowerCase().trim()
    );

    return requiredSkills.every(reqSkill => {
      const normalized = this.normalizeSkillName(reqSkill);
      return caregiverSkillNames.some(cgSkill => {
        const similarity = this.calculateSemanticSimilarity(normalized, cgSkill);
        return similarity >= 0.8; // 80% threshold cho required skills
      });
    });
  }

  /**
   * Calculate availability score
   */
  calculateAvailabilityScore(availability, requestedTimeSlots) {
    if (!requestedTimeSlots || requestedTimeSlots.length === 0) return 1.0;

    let matchedSlots = 0;

    requestedTimeSlots.forEach(reqSlot => {
      const hasMatch = availability.some(avail => {
        return this.checkTimeSlotOverlap(reqSlot, avail);
      });
      if (hasMatch) matchedSlots++;
    });

    return matchedSlots / requestedTimeSlots.length;
  }

  /**
   * Check if time slots overlap
   */
  checkTimeSlotOverlap(requestedSlot, availability) {
    const { day, startTime, endTime } = requestedSlot;

    // Check if day matches
    if (availability.recurrenceType === 'weekly') {
      if (!availability.daysOfWeek.includes(day.toLowerCase())) {
        return false;
      }
    }

    // Check time overlap
    return availability.timeSlots.some(slot => {
      return this.timeRangesOverlap(
        startTime,
        endTime,
        slot.startTime,
        slot.endTime
      );
    });
  }

  /**
   * Check if time ranges overlap
   */
  timeRangesOverlap(start1, end1, start2, end2) {
    const s1 = this.timeToMinutes(start1);
    const e1 = this.timeToMinutes(end1);
    const s2 = this.timeToMinutes(start2);
    const e2 = this.timeToMinutes(end2);

    return s1 < e2 && s2 < e1;
  }

  /**
   * Convert time string to minutes
   */
  timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Check time availability
   */
  checkTimeAvailability(availability, requestedTimeSlots) {
    if (!requestedTimeSlots || requestedTimeSlots.length === 0) return true;

    return requestedTimeSlots.every(reqSlot => {
      return availability.some(avail => {
        return this.checkTimeSlotOverlap(reqSlot, avail);
      });
    });
  }

  /**
   * Calculate rating score using Bayesian Average
   */
  calculateRatingScore(reviews) {
    if (!reviews || reviews.length === 0) return 0.5;

    const C = 5; // Confidence constant (giảm từ 25 để responsive hơn)
    const m = 4.0; // Platform mean

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const totalReviews = reviews.length;

    const bayesianRating = (totalRating + C * m) / (totalReviews + C);
    
    return Math.min(bayesianRating / 5.0, 1.0);
  }

  /**
   * Calculate average rating
   */
  calculateAverageRating(reviews) {
    if (!reviews || reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / reviews.length;
  }

  /**
   * Calculate experience score
   */
  calculateExperienceScore(yearsOfExperience) {
    // 10 years = 1.0, minimum 0.1 for newcomers
    return Math.min(1.0, Math.max(0.1, yearsOfExperience / 10.0));
  }

  /**
   * Calculate price score
   */
  calculatePriceScore(caregiver, budgetPerHour) {
    // Placeholder - cần có hourly rate trong caregiver profile
    // Giả sử có field: caregiver.hourlyRate
    const hourlyRate = caregiver.hourlyRate || 100000; // Default 100k VND

    if (hourlyRate <= budgetPerHour) {
      // Within budget
      const ratio = hourlyRate / budgetPerHour;
      if (ratio < 0.5) return 1.0;
      return 1.0 - (ratio - 0.5) * 0.2; // Linear decay
    } else {
      // Over budget - penalty
      const excessRatio = (hourlyRate - budgetPerHour) / budgetPerHour;
      const penalty = 1.0 - excessRatio;
      return Math.max(0.0, penalty);
    }
  }

  /**
   * Calculate trust score
   */
  calculateTrustScore(caregiver) {
    const { bookingHistory } = caregiver;

    if (!bookingHistory || bookingHistory.totalBookings === 0) {
      return 0.5; // Neutral for new caregivers
    }

    // Components
    const completionComponent = bookingHistory.completionRate || 0;
    const cancelComponent = Math.max(0, 1.0 - (bookingHistory.cancelRate || 0) * 5);
    
    let bookingsComponent = 0.2;
    if (bookingHistory.totalBookings >= 50) bookingsComponent = 1.0;
    else if (bookingHistory.totalBookings >= 20) bookingsComponent = 0.8;
    else if (bookingHistory.totalBookings >= 10) bookingsComponent = 0.6;
    else if (bookingHistory.totalBookings >= 5) bookingsComponent = 0.4;

    const verificationComponent = caregiver.idCardNumber ? 1.0 : 0.5;

    return (
      0.4 * completionComponent +
      0.3 * cancelComponent +
      0.2 * bookingsComponent +
      0.1 * verificationComponent
    );
  }

  /**
   * Calculate booking statistics
   */
  calculateBookingStats(bookings) {
    if (!bookings || bookings.length === 0) {
      return {
        totalBookings: 0,
        completionRate: 0,
        cancelRate: 0
      };
    }

    const total = bookings.length;
    const completed = bookings.filter(b => b.status === 'completed').length;
    const cancelled = bookings.filter(b => b.status === 'cancelled').length;

    return {
      totalBookings: total,
      completionRate: completed / total,
      cancelRate: cancelled / total
    };
  }

  /**
   * Calculate age from date of birth
   */
  calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Check if certificate is relevant to care level
   */
  isCertificateRelevant(certificate, careLevel) {
    const relevantTypes = [
      'chăm sóc người già',
      'y tá',
      'điều dưỡng',
      'sơ cứu'
    ];
    
    if (careLevel >= 2) {
      relevantTypes.push('vật lí trị liệu', 'dinh dưỡng');
    }

    return relevantTypes.includes(certificate.certificateType);
  }

  /**
   * Check if skill has related certificate
   */
  skillHasCertificate(skill, certificates) {
    // Check if skill name relates to any certificate type
    const skillName = this.normalizeSkillName(skill.name);
    
    return certificates.some(cert => {
      const certType = this.normalizeSkillName(cert.certificateType);
      return skillName.includes(certType) || certType.includes(skillName);
    });
  }

  /**
   * Get user preference weights from booking history
   * Machine Learning component - học từ lịch sử
   */
  async getUserPreferenceWeights(careseekerId) {
    try {
      // Lấy booking history của user
      const bookings = await Booking.find({ 
        careseeker: careseekerId,
        status: { $in: ['completed', 'cancelled'] }
      })
      .populate('caregiver')
      .populate('caregiverProfile')
      .lean();

      if (bookings.length < 3) {
        // Chưa đủ data để học
        return this.weights;
      }

      // Phân tích pattern từ bookings
      const weights = { ...this.weights };
      
      // Tăng weight cho rating nếu user hay book caregiver rating cao
      const avgRatingBooked = bookings.reduce((sum, b) => {
        const reviews = b.caregiverProfile?.reviews || [];
        const avgRating = this.calculateAverageRating(reviews);
        return sum + avgRating;
      }, 0) / bookings.length;

      if (avgRatingBooked > 4.5) {
        weights.rating += 0.05;
        weights.credential -= 0.05;
      }

      // Tăng weight cho experience nếu user hay book caregiver có kinh nghiệm cao
      const avgExperience = bookings.reduce((sum, b) => {
        return sum + (b.caregiverProfile?.yearsOfExperience || 0);
      }, 0) / bookings.length;

      if (avgExperience > 5) {
        weights.experience += 0.03;
        weights.price -= 0.03;
      }

      // Normalize weights to sum to 1.0
      const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
      Object.keys(weights).forEach(key => {
        weights[key] = weights[key] / totalWeight;
      });

      return weights;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return this.weights;
    }
  }

  /**
   * Format match result
   */
  formatMatchResult(matchResult) {
    const { caregiver, totalScore, scores, matchPercentage } = matchResult;

    return {
      caregiverId: caregiver.user._id,
      name: caregiver.user.name,
      email: caregiver.user.email,
      phone: caregiver.user.phone || caregiver.phoneNumber,
      profileImage: caregiver.profileImage,
      bio: caregiver.bio,
      age: this.calculateAge(caregiver.dateOfBirth),
      gender: caregiver.gender,
      education: caregiver.education,
      yearsOfExperience: caregiver.yearsOfExperience,
      rating: this.calculateAverageRating(caregiver.reviews),
      totalReviews: caregiver.reviews?.length || 0,
      skills: caregiver.skills.map(s => ({
        name: s.name,
        description: s.description,
        icon: s.icon
      })),
      certificates: caregiver.certificates.map(c => ({
        name: c.name,
        type: c.certificateType,
        organization: c.issuingOrganization
      })),
      availability: caregiver.availability.length > 0,
      matchScore: totalScore,
      matchPercentage,
      scoreBreakdown: {
        credential: Math.round(scores.credential * 100) + '%',
        skills: Math.round(scores.skills * 100) + '%',
        availability: Math.round(scores.availability * 100) + '%',
        rating: Math.round(scores.rating * 100) + '%',
        experience: Math.round(scores.experience * 100) + '%',
        trust: Math.round(scores.trust * 100) + '%'
      }
    };
  }
}

module.exports = new AIMatchingService();
