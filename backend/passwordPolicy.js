export const MIN_PASSWORD_LENGTH = 12;

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}

export function bcryptRounds() {
  const configured = Number(process.env.BCRYPT_ROUNDS || 12);
  return Number.isInteger(configured) && configured >= 10 && configured <= 14
    ? configured
    : 12;
}
