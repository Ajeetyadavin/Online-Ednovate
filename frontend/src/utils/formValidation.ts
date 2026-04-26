/**
 * Comprehensive form validation utilities for the Ednovate admin panel
 * Provides consistent validation patterns, error messages, and validation rules
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  custom?: (value: any) => string | null;
  type?: 'email' | 'phone' | 'url' | 'number' | 'positiveNumber' | 'integer' | 'password';
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  firstError?: string;
}

export interface FieldValidation {
  value: any;
  rules: ValidationRule[];
  fieldName: string;
}

/**
 * Common validation patterns
 */
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[1-9]\d{0,15}$/,
  URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
  NUMERIC: /^\d+$/,
  DECIMAL: /^\d+(\.\d+)?$/,
  ALPHANUMERIC: /^[a-zA-Z0-9\s\-_]+$/,
  NO_SPECIAL_CHARS: /^[a-zA-Z0-9\s]+$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
} as const;

/**
 * Common validation error messages
 */
export const VALIDATION_MESSAGES = {
  REQUIRED: (field: string) => `${field} is required`,
  MIN_LENGTH: (field: string, min: number) => `${field} must be at least ${min} characters`,
  MAX_LENGTH: (field: string, max: number) => `${field} must be at most ${max} characters`,
  EMAIL: 'Please enter a valid email address',
  PHONE: 'Please enter a valid phone number',
  URL: 'Please enter a valid URL',
  NUMBER: 'Please enter a valid number',
  POSITIVE_NUMBER: 'Please enter a positive number',
  INTEGER: 'Please enter a whole number',
  PATTERN: (field: string) => `Invalid format for ${field}`,
  PASSWORD_MIN: 'Password must be at least 6 characters',
} as const;

/**
 * Validate a single field against its rules
 */
export function validateField(field: FieldValidation): string | null {
  const { value, rules, fieldName } = field;
  const stringValue = typeof value === 'string' ? value.trim() : String(value || '');
  const isEmpty = stringValue === '' || value === null || value === undefined;

  for (const rule of rules) {
    // Required check
    if (rule.required && isEmpty) {
      return VALIDATION_MESSAGES.REQUIRED(fieldName);
    }

    // Skip further validation if empty and not required
    if (isEmpty) {
      continue;
    }

    // Type-specific validation
    if (rule.type) {
      const error = validateByType(stringValue, rule.type, fieldName);
      if (error) return error;
    }

    // Length validations
    if (rule.minLength !== undefined && stringValue.length < rule.minLength) {
      return VALIDATION_MESSAGES.MIN_LENGTH(fieldName, rule.minLength);
    }

    if (rule.maxLength !== undefined && stringValue.length > rule.maxLength) {
      return VALIDATION_MESSAGES.MAX_LENGTH(fieldName, rule.maxLength);
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(stringValue)) {
      return rule.patternMessage || VALIDATION_MESSAGES.PATTERN(fieldName);
    }

    // Custom validation
    if (rule.custom) {
      const customError = rule.custom(value);
      if (customError) return customError;
    }
  }

  return null;
}

/**
 * Validate by data type
 */
function validateByType(value: string, type: ValidationRule['type'], fieldName: string): string | null {
  switch (type) {
    case 'email':
      if (!VALIDATION_PATTERNS.EMAIL.test(value)) {
        return VALIDATION_MESSAGES.EMAIL;
      }
      break;
    case 'phone':
      if (!VALIDATION_PATTERNS.PHONE.test(value.replace(/[\s\-()]/g, ''))) {
        return VALIDATION_MESSAGES.PHONE;
      }
      break;
    case 'url':
      if (!VALIDATION_PATTERNS.URL.test(value)) {
        return VALIDATION_MESSAGES.URL;
      }
      break;
    case 'number':
      if (isNaN(Number(value))) {
        return VALIDATION_MESSAGES.NUMBER;
      }
      break;
    case 'positiveNumber': {
      const num = Number(value);
      if (isNaN(num) || num <= 0) {
        return VALIDATION_MESSAGES.POSITIVE_NUMBER;
      }
      break;
    }
    case 'integer':
      if (!VALIDATION_PATTERNS.NUMERIC.test(value)) {
        return VALIDATION_MESSAGES.INTEGER;
      }
      break;
    case 'password':
      if (value.length < 6) {
        return VALIDATION_MESSAGES.PASSWORD_MIN;
      }
      break;
  }
  return null;
}

/**
 * Validate multiple fields at once
 */
export function validateForm(fields: Record<string, FieldValidation>): ValidationResult {
  const errors: Record<string, string> = {};
  let firstError: string | undefined;

  for (const [key, field] of Object.entries(fields)) {
    const error = validateField(field);
    if (error) {
      errors[key] = error;
      if (!firstError) {
        firstError = error;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    firstError,
  };
}

/**
 * Common validation schemas for reuse across admin components
 */
export const VALIDATION_SCHEMAS = {
  // Student/User validation
  STUDENT: {
    name: { required: true, minLength: 2, maxLength: 100 },
    email: { required: true, type: 'email' as const },
    phone: { type: 'phone' as const },
    password: { required: true, type: 'password' as const, minLength: 6 },
  },

  // Course validation
  COURSE: {
    title: { required: true, minLength: 3, maxLength: 200 },
    category: { required: true },
    price: { required: true, type: 'positiveNumber' as const },
    originalPrice: { type: 'positiveNumber' as const },
    lectures: { type: 'positiveNumber' as const },
    hours: { type: 'positiveNumber' as const },
  },

  // Category validation
  CATEGORY: {
    name: { required: true, minLength: 2, maxLength: 50 },
    slug: { pattern: VALIDATION_PATTERNS.SLUG, patternMessage: 'Slug must be lowercase with hyphens' },
  },

  // Faculty validation
  FACULTY: {
    name: { required: true, minLength: 2, maxLength: 100 },
    email: { type: 'email' as const },
    password: { type: 'password' as const, minLength: 6 },
  },

  // Coupon validation
  COUPON: {
    code: { required: true, minLength: 3, maxLength: 50 },
    discount: { required: true, type: 'positiveNumber' as const },
    minPurchase: { type: 'positiveNumber' as const },
    maxTotalUses: { type: 'positiveNumber' as const },
  },

  // Marketing campaign validation
  MARKETING_CAMPAIGN: {
    title: { required: true, minLength: 3, maxLength: 200 },
    message: { required: true, minLength: 10 },
    ctaText: { maxLength: 50 },
    ctaUrl: { type: 'url' as const },
  },

  // SMTP settings validation
  SMTP: {
    host: { required: true },
    port: { required: true, type: 'positiveNumber' as const },
    username: { required: true },
    password: { required: true },
    fromEmail: { required: true, type: 'email' as const },
  },
} as const;

/**
 * Helper to convert schema to field validation objects
 */
export function createFieldValidations<T extends Record<string, any>>(
  data: T,
  schema: Record<keyof T, ValidationRule>,
  fieldNames?: Record<keyof T, string>
): Record<string, FieldValidation> {
  const result: Record<string, FieldValidation> = {};

  for (const [key, rules] of Object.entries(schema)) {
    const fieldKey = key as keyof T;
    result[key] = {
      value: data[fieldKey],
      rules: [rules],
      fieldName: fieldNames?.[fieldKey] || String(fieldKey).replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
    };
  }

  return result;
}

/**
 * Quick validation helpers for common scenarios
 */
export const validationHelpers = {
  // Check if string is not empty after trim
  isNotEmpty: (value: string): boolean => {
    return typeof value === 'string' && value.trim().length > 0;
  },

  // Check if array has at least N items
  minArrayLength: <T>(array: T[], min: number): boolean => {
    return Array.isArray(array) && array.length >= min;
  },

  // Check if number is positive
  isPositiveNumber: (value: any): boolean => {
    const num = Number(value);
    return !isNaN(num) && num > 0;
  },

  // Check if value is valid email
  isValidEmail: (email: string): boolean => {
    return VALIDATION_PATTERNS.EMAIL.test(email.trim());
  },

  // Check if value is valid phone
  isValidPhone: (phone: string): boolean => {
    return VALIDATION_PATTERNS.PHONE.test(phone.replace(/[\s\-()]/g, ''));
  },

  // Sanitize string (trim and remove extra spaces)
  sanitizeString: (value: string): string => {
    return value.trim().replace(/\s+/g, ' ');
  },

  // Sanitize number (parse float, return 0 if invalid)
  sanitizeNumber: (value: any, fallback = 0): number => {
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  },

  // Validate and sanitize CSV input
  parseCsv: (value: string): string[] => {
    return value
      .split(/[\n,;]+/)
      .map(item => item.trim())
      .filter(Boolean);
  },
};

/**
 * React hook compatible validation helper
 * Returns validation state and helper functions
 */
export function useFormValidation<T extends Record<string, any>>(
  initialData: T,
  schema: Record<keyof T, ValidationRule>
) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateSingleField = useCallback((field: keyof T, value: any) => {
    const fieldSchema = schema[field];
    if (!fieldSchema) return null;

    const fieldValidation: FieldValidation = {
      value,
      rules: [fieldSchema],
      fieldName: String(field),
    };

    return validateField(fieldValidation);
  }, [schema]);

  const validateEntireForm = useCallback((data: T) => {
    const fieldValidations = createFieldValidations(data, schema);
    return validateForm(fieldValidations);
  }, [schema]);

  const setFieldTouched = useCallback((field: keyof T, isTouched = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
  }, []);

  const resetValidation = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  return {
    errors,
    touched,
    validateField: validateSingleField,
    validateForm: validateEntireForm,
    setFieldTouched,
    resetValidation,
    setErrors,
  };
}

// TypeScript helper for useState compatibility
import { useState, useCallback } from 'react';
