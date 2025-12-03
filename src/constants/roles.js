const ROLES = {
  ADMIN: 'admin',
  CAREGIVER: 'caregiver',
  CARESEEKER: 'careseeker'
};

// Roles được phép đăng ký (admin không được đăng ký)
const REGISTERABLE_ROLES = [ROLES.CAREGIVER, ROLES.CARESEEKER];

module.exports = {
  ROLES,
  REGISTERABLE_ROLES
};
