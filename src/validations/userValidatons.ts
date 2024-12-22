import { Joi } from "express-validation";

const userValidation  = Joi.object({
  userId: Joi.string().required(),
  firstName: Joi.string(),
  middleName: Joi.string(),
  lastName: Joi.string(),
  profileUrl: Joi.string(),
  dob: Joi.date(),
  gender: Joi.string(),
  address1: Joi.string(),
  address2: Joi.string(),
  city: Joi.string(),
  state: Joi.string(),
  country: Joi.string(),
  pincode: Joi.string(),
  phone: Joi.string(),
})

const registerUserValidation = Joi.object({
  email: Joi.string().required(),
  password: Joi.string()
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'))
    .required()
    .label('Password')
    .messages({
      'string.pattern.base': 'Password must have at least one uppercase letter, one lowercase letter, one number, and one special character.',
      'string.empty': 'Password is required',
    }),
  firstName: Joi.string().required(),
  middleName: Joi.string(),
  lastName: Joi.string().required(),
  profileUrl: Joi.string(),
  phone: Joi.string(),
  dob: Joi.date(),
  gender: Joi.string(),
  address1: Joi.string(),
  address2: Joi.string(),
  city: Joi.string(),
  state: Joi.string(),
  country: Joi.string(),
  pincode: Joi.string(),
});

const updateAdminStatusValidation = Joi.object({
  userId: Joi.string().required(),
  makeAdmin: Joi.boolean(),
})

const forgetPasswordValidation = Joi.object({
  email: Joi.string().required(),
})

const resetPasswordValidatins = Joi.object({
  email: Joi.string().required(),
  password: Joi.string()
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'))
    .required()
    .label('Password')
    .messages({
      'string.pattern.base': 'Password must have at least one uppercase letter, one lowercase letter, one number, and one special character.',
      'string.empty': 'Password is required',
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .label('Confirm Password')
    .messages({
      'any.only': 'Confirm Password must match Password',
      'string.empty': 'Confirm Password is required',
    }),
  otp: Joi.string().required(),
  /**
   * Optional if cookies are enabled
   * Required if cookies are disabled
   */
  sessionId: Joi.string(),
})

export default {
  userValidation,
  registerUserValidation,
  updateAdminStatusValidation,
  forgetPasswordValidation,
  resetPasswordValidatins
};
