/**
 * Email Validation Utilities
 * Enforces Gmail-only validation and proper email formatting
 */

/**
 * Gmail-only email regex pattern
 * Validates: username@gmail.com
 * - Username: alphanumeric, dots, underscores, hyphens
 * - Must end with @gmail.com
 */
export const GMAIL_PATTERN = /^[a-zA-Z0-9._-]+@gmail\.com$/i;

/**
 * General email validation pattern (backup)
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates if an email is a valid Gmail address
 * @param email - Email address to validate
 * @returns true if valid Gmail address
 */
export const isValidGmailAddress = (email: string): boolean => {
  const trimmedEmail = email.trim().toLowerCase();
  return GMAIL_PATTERN.test(trimmedEmail);
};

/**
 * Validates email format (general validation)
 * @param email - Email address to validate
 * @returns true if valid email format
 */
export const isValidEmailFormat = (email: string): boolean => {
  const trimmedEmail = email.trim();
  return EMAIL_PATTERN.test(trimmedEmail);
};

/**
 * Sanitizes and normalizes email address
 * @param email - Email address to sanitize
 * @returns Normalized email (trimmed and lowercase)
 */
export const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

/**
 * Gets user-friendly error message for email validation
 * @param email - Email address that failed validation
 * @returns User-friendly error message
 */
export const getEmailValidationError = (email: string): string => {
  const trimmed = email.trim();
  
  if (!trimmed) {
    return 'Email address is required';
  }

  if (!isValidEmailFormat(trimmed)) {
    return 'Please enter a valid email address';
  }

  if (!isValidGmailAddress(trimmed)) {
    return 'Only Gmail addresses (@gmail.com) are supported. Please use a valid Gmail account.';
  }

  return 'Invalid email address';
};

/**
 * Validates password strength
 * @param password - Password to validate
 * @returns { valid: boolean; errors: string[] }
 */
export const validatePasswordStrength = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!password) {
    errors.push('Password is required');
  } else {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letters');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain numbers');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates full name
 * @param name - Name to validate
 * @returns true if valid name
 */
export const isValidName = (name: string): boolean => {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 100 && /^[a-zA-Z\s'-]+$/.test(trimmed);
};

/**
 * Validates phone number (Indian format)
 * @param phone - Phone number to validate
 * @returns true if valid phone number
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  const trimmed = phone.trim();
  return /^[0-9+\-\s()]{10,}$/.test(trimmed);
};
