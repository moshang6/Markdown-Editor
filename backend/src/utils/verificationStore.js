// 简单的内存存储验证码
// 在实际生产环境中，应考虑使用Redis等存储方式

const verificationCodes = new Map();

// 验证码类型
export const CODE_TYPES = {
  REGISTRATION: 'registration',
  PASSWORD_RESET: 'password_reset'
};

// 验证码有效期（毫秒）
const CODE_EXPIRATION = 10 * 60 * 1000; // 10分钟

// 保存验证码
export const storeVerificationCode = (email, code, type) => {
  const expiration = Date.now() + CODE_EXPIRATION;
  verificationCodes.set(`${type}_${email}`, { code, expiration });
  
  // 设置过期自动删除
  setTimeout(() => {
    verificationCodes.delete(`${type}_${email}`);
  }, CODE_EXPIRATION);
};

// 验证验证码
export const verifyCode = (email, code, type) => {
  const key = `${type}_${email}`;
  const stored = verificationCodes.get(key);
  
  if (!stored) {
    return false; // 验证码不存在或已过期
  }
  
  if (stored.expiration < Date.now()) {
    verificationCodes.delete(key);
    return false; // 验证码已过期
  }
  
  if (stored.code !== code) {
    return false; // 验证码不正确
  }
  
  // 验证成功后删除验证码
  verificationCodes.delete(key);
  return true;
};

// 检查邮箱是否已有待验证的验证码
export const hasActiveCode = (email, type) => {
  const key = `${type}_${email}`;
  const stored = verificationCodes.get(key);
  
  if (!stored) {
    return false;
  }
  
  if (stored.expiration < Date.now()) {
    verificationCodes.delete(key);
    return false;
  }
  
  return true;
}; 