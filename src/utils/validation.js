const Joi = require('joi');
const { REGISTERABLE_ROLES } = require('../constants');

// Validation schema cho đăng ký
const registerSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 100 characters'
    }),
  
  email: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    .required()
    .messages({
      'string.empty': 'Email is required',
      'string.pattern.base': 'Please provide a valid email'
    }),
  
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 6 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),
  
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'string.empty': 'Confirm password is required'
    }),
  
  role: Joi.string()
    .valid(...REGISTERABLE_ROLES)
    .required()
    .messages({
      'any.only': 'Role must be either caregiver or careseeker',
      'string.empty': 'Role is required'
    }),
  
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{10,11}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Phone number must be 10-11 digits'
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
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required'
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
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email'
    }),
  
  code: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      'string.empty': 'Verification code is required',
      'string.length': 'Code must be 6 digits',
      'string.pattern.base': 'Code must contain only numbers'
    }),
  
  newPassword: Joi.string()
    .min(6)
    .max(128)
    .required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .messages({
      'string.empty': 'New password is required',
      'string.min': 'Password must be at least 6 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),
  
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'string.empty': 'Confirm password is required'
    })
});

// Validation schema cho certificate
const certificateSchema = Joi.object({
  name: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Certificate name is required'
    }),
  
  issueDate: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.base': 'Invalid issue date',
      'date.max': 'Issue date cannot be in the future',
      'any.required': 'Issue date is required'
    }),
  
  issuingOrganization: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Issuing organization is required'
    }),
  
  certificateType: Joi.string()
    .valid('chăm sóc người già', 'y tá', 'điều dưỡng', 'sơ cứu', 'dinh dưỡng', 'vật lí trị liệu', 'khác')
    .required()
    .messages({
      'any.only': 'Invalid certificate type',
      'string.empty': 'Certificate type is required'
    })
});

// Validation schema cho tạo caregiver profile
const createCaregiverProfileSchema = Joi.object({
  phoneNumber: Joi.string()
    .trim()
    .pattern(/^[0-9]{10,11}$/)
    .required()
    .messages({
      'string.empty': 'Phone number is required',
      'string.pattern.base': 'Phone number must be 10-11 digits'
    }),
  
  dateOfBirth: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.base': 'Invalid date of birth',
      'date.max': 'Date of birth cannot be in the future',
      'any.required': 'Date of birth is required'
    }),
  
  gender: Joi.string()
    .valid('Nam', 'Nữ')
    .required()
    .messages({
      'any.only': 'Gender must be Nam or Nữ',
      'string.empty': 'Gender is required'
    }),
  
  permanentAddress: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Permanent address is required'
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
      'string.empty': 'ID card number is required',
      'string.pattern.base': 'ID card number must be 9-12 digits'
    }),
  
  yearsOfExperience: Joi.number()
    .min(0)
    .max(50)
    .required()
    .messages({
      'number.base': 'Years of experience must be a number',
      'number.min': 'Years of experience cannot be negative',
      'number.max': 'Years of experience cannot exceed 50',
      'any.required': 'Years of experience is required'
    }),
  
  workHistory: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Work history is required'
    }),
  
  education: Joi.string()
    .valid('trung học cơ sở', 'trung học phổ thông', 'đại học', 'sau đại học')
    .required()
    .messages({
      'any.only': 'Invalid education level',
      'string.empty': 'Education level is required'
    }),
  
  bio: Joi.string()
    .trim()
    .max(1000)
    .required()
    .messages({
      'string.empty': 'Bio is required',
      'string.max': 'Bio cannot exceed 1000 characters'
    }),
  
  agreeToEthics: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'Must agree to professional ethics',
      'any.required': 'Must agree to professional ethics'
    }),
  
  agreeToTerms: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'Must agree to terms and conditions',
      'any.required': 'Must agree to terms and conditions'
    }),
  
  // Certificates là array of objects
  certificates: Joi.array()
    .items(certificateSchema)
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one certificate is required',
      'any.required': 'Certificates are required'
    })
}).unknown(true); // Cho phép các field khác (như universityDegreeImage từ multer)

module.exports = {
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  createCaregiverProfileSchema
};
