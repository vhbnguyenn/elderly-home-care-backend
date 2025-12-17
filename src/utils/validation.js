const Joi = require('joi');
const { REGISTERABLE_ROLES } = require('../constants');

// Vietnamese name rule:
// - Only Latin letters (Vietnamese supported via Unicode) + spaces + hyphen (-)
// - Do NOT force capitalization (UX-friendly)
// Examples: "Nguyễn Văn A", "Tran Thi Anh", "Trần Thị-Anh"
const VIETNAMESE_NAME_ONE_OR_MORE_WORDS_REGEX =
  /^[\p{Script=Latin}]+(?:[ -][\p{Script=Latin}]+)*$/u;
// Caregiver requires >= 2 words
const VIETNAMESE_NAME_TWO_OR_MORE_WORDS_REGEX =
  /^[\p{Script=Latin}]+(?:[ -][\p{Script=Latin}]+)+(?:\s+[\p{Script=Latin}]+(?:[ -][\p{Script=Latin}]+)*)*$/u;

// Validation schema cho đăng ký
const registerSchema = Joi.object({
  name: Joi.string()
    .custom((value, helpers) => {
      if (typeof value !== 'string') return value;
      // Normalize whitespace (SIT-friendly)
      return value.replace(/\s+/g, ' ').trim();
    })
    .max(100)
    .required()
    .when('role', {
      is: 'caregiver',
      then: Joi.string()
        .min(2)
        .max(60)
        .pattern(VIETNAMESE_NAME_TWO_OR_MORE_WORDS_REGEX)
        .messages({
          'string.min': 'Họ tên caregiver phải có ít nhất 2 ký tự',
          'string.max': 'Họ tên caregiver không được vượt quá 60 ký tự',
          'string.pattern.base': 'Họ tên caregiver phải có ít nhất 2 từ và chỉ gồm chữ cái tiếng Việt (có thể có dấu), khoảng trắng hoặc dấu gạch nối (-)'
        }),
      otherwise: Joi.string()
        .min(1)
        .pattern(VIETNAMESE_NAME_ONE_OR_MORE_WORDS_REGEX)
        .messages({
          'string.pattern.base': 'Họ tên chỉ được gồm chữ cái tiếng Việt (có thể có dấu), khoảng trắng hoặc dấu gạch nối (-)'
        })
    })
    .messages({
      'string.empty': 'Họ tên là bắt buộc',
      'string.min': 'Họ tên là bắt buộc',
      'string.max': 'Họ tên không được vượt quá 100 ký tự'
    }),
  
  email: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    .required()
    .messages({
      'string.empty': 'Email là bắt buộc',
      'string.pattern.base': 'Email không hợp lệ'
    }),
  
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.empty': 'Mật khẩu là bắt buộc',
      'string.min': 'Mật khẩu phải có ít nhất 6 ký tự'
    }),
  
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Mật khẩu xác nhận không khớp',
      'string.empty': 'Xác nhận mật khẩu là bắt buộc'
    }),
  
  role: Joi.string()
    .valid(...REGISTERABLE_ROLES)
    .required()
    .messages({
      'any.only': 'Vai trò phải là caregiver hoặc careseeker',
      'string.empty': 'Vai trò là bắt buộc'
    }),
  
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{10,11}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Số điện thoại phải có 10-11 chữ số'
    })
});

// Validation schema cho đăng nhập
const loginSchema = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .required()
    .messages({
      'string.empty': 'Email là bắt buộc',
      'string.email': 'Email không hợp lệ'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Mật khẩu là bắt buộc'
    })
});

// Validation schema cho reset password
const resetPasswordSchema = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .required()
    .messages({
      'string.empty': 'Email là bắt buộc',
      'string.email': 'Email không hợp lệ'
    }),
  
  code: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      'string.empty': 'Mã xác minh là bắt buộc',
      'string.length': 'Mã xác minh phải gồm 6 chữ số',
      'string.pattern.base': 'Mã xác minh chỉ được chứa chữ số'
    }),
  
  verifyOnly: Joi.boolean()
    .optional()
    .default(false),
  
  newPassword: Joi.string()
    .min(6)
    .max(128)
    .when('verifyOnly', {
      is: true,
      then: Joi.optional(),
      otherwise: Joi.required()
    })
    .messages({
      'string.empty': 'Mật khẩu mới là bắt buộc',
      'string.min': 'Mật khẩu phải có ít nhất 6 ký tự'
    }),
  
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .when('verifyOnly', {
      is: true,
      then: Joi.optional(),
      otherwise: Joi.required()
    })
    .messages({
      'any.only': 'Mật khẩu xác nhận không khớp',
      'string.empty': 'Xác nhận mật khẩu là bắt buộc'
    })
});

// Validation schema cho certificate
const certificateSchema = Joi.object({
  name: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Tên chứng chỉ là bắt buộc'
    }),
  
  issueDate: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.base': 'Ngày cấp không hợp lệ',
      'date.max': 'Ngày cấp không được ở tương lai',
      'any.required': 'Ngày cấp là bắt buộc'
    }),
  
  issuingOrganization: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Đơn vị cấp là bắt buộc'
    }),
  
  certificateType: Joi.string()
    .valid('chăm sóc người già', 'y tá', 'điều dưỡng', 'sơ cứu', 'dinh dưỡng', 'vật lí trị liệu', 'khác')
    .required()
    .messages({
      'any.only': 'Loại chứng chỉ không hợp lệ',
      'string.empty': 'Loại chứng chỉ là bắt buộc'
    })
});

// Validation schema cho tạo caregiver profile
const createCaregiverProfileSchema = Joi.object({
  phoneNumber: Joi.string()
    .trim()
    .pattern(/^[0-9]{10,11}$/)
    .required()
    .messages({
      'string.empty': 'Số điện thoại là bắt buộc',
      'string.pattern.base': 'Số điện thoại phải có 10-11 chữ số'
    }),
  
  dateOfBirth: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.base': 'Ngày sinh không hợp lệ',
      'date.max': 'Ngày sinh không được ở tương lai',
      'any.required': 'Ngày sinh là bắt buộc'
    }),
  
  gender: Joi.string()
    .valid('Nam', 'Nữ')
    .required()
    .messages({
      'any.only': 'Giới tính phải là Nam hoặc Nữ',
      'string.empty': 'Giới tính là bắt buộc'
    }),
  
  permanentAddress: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Địa chỉ thường trú là bắt buộc'
    }),
  
  temporaryAddress: Joi.string()
    .trim()
    .allow('')
    .optional(),
  
  idCardNumber: Joi.string()
    .trim()
    .pattern(/^[0-9]{9,12}$/)
    .required()
    .messages({
      'string.empty': 'Số CCCD/CMND là bắt buộc',
      'string.pattern.base': 'Số CCCD/CMND phải có 9-12 chữ số'
    }),
  
  yearsOfExperience: Joi.number()
    .min(0)
    .max(50)
    .required()
    .messages({
      'number.base': 'Số năm kinh nghiệm phải là số',
      'number.min': 'Số năm kinh nghiệm không được âm',
      'number.max': 'Số năm kinh nghiệm không được vượt quá 50',
      'any.required': 'Số năm kinh nghiệm là bắt buộc'
    }),
  
  workHistory: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Kinh nghiệm làm việc là bắt buộc'
    }),
  
  education: Joi.string()
    .valid('trung học cơ sở', 'trung học phổ thông', 'đại học', 'sau đại học')
    .required()
    .messages({
      'any.only': 'Trình độ học vấn không hợp lệ',
      'string.empty': 'Trình độ học vấn là bắt buộc'
    }),
  
  bio: Joi.string()
    .trim()
    .max(1000)
    .required()
    .messages({
      'string.empty': 'Giới thiệu bản thân là bắt buộc',
      'string.max': 'Giới thiệu bản thân không được vượt quá 1000 ký tự'
    }),
  
  agreeToEthics: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'Bạn phải đồng ý với đạo đức nghề nghiệp',
      'any.required': 'Bạn phải đồng ý với đạo đức nghề nghiệp'
    }),
  
  agreeToTerms: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'Bạn phải đồng ý với điều khoản và điều kiện',
      'any.required': 'Bạn phải đồng ý với điều khoản và điều kiện'
    }),
  
  // Certificates là array of objects
  certificates: Joi.array()
    .items(certificateSchema)
    .min(1)
    .required()
    .messages({
      'array.min': 'Cần ít nhất một chứng chỉ',
      'any.required': 'Chứng chỉ là bắt buộc'
    })
}).unknown(true); // Cho phép các field khác (như universityDegreeImage từ multer)

// Validation schema cho đổi mật khẩu
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'string.empty': 'Mật khẩu hiện tại là bắt buộc'
    }),
  
  newPassword: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.empty': 'Mật khẩu mới là bắt buộc',
      'string.min': 'Mật khẩu mới phải có ít nhất 6 ký tự'
    }),
  
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Mật khẩu xác nhận không khớp',
      'string.empty': 'Xác nhận mật khẩu là bắt buộc'
    })
});

// Validation schema cho admin tạo user
const createUserByAdminSchema = Joi.object({
  name: Joi.string()
    .custom((value, helpers) => {
      if (typeof value !== 'string') return value;
      return value.replace(/\s+/g, ' ').trim();
    })
    .max(100)
    .optional(),
  
  email: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    .required()
    .messages({
      'string.empty': 'Email là bắt buộc',
      'string.pattern.base': 'Email không hợp lệ'
    }),
  
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.empty': 'Mật khẩu là bắt buộc',
      'string.min': 'Mật khẩu phải có ít nhất 6 ký tự'
    }),
  
  role: Joi.string()
    .valid('admin', 'caregiver', 'careseeker')
    .required()
    .messages({
      'any.only': 'Vai trò phải là một trong: admin, caregiver, careseeker',
      'string.empty': 'Vai trò là bắt buộc'
    }),
  
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{10,11}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Số điện thoại phải có 10-11 chữ số'
    })
});

module.exports = {
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  createCaregiverProfileSchema,
  changePasswordSchema,
  createUserByAdminSchema
};
