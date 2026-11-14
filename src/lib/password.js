export const PASSWORD_RULE = '8자 이상, 특수문자 1개 이상 포함'
export const isValidPassword = (password) =>
  password.length >= 8 && /[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]/.test(password)
