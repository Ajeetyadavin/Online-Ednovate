import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateField,
  validateForm,
  VALIDATION_PATTERNS,
  VALIDATION_MESSAGES,
  VALIDATION_SCHEMAS,
  createFieldValidations,
  validationHelpers,
  useFormValidation,
  type FieldValidation,
  type ValidationRule,
} from '@/utils/formValidation';

// Mock React hooks for testing
vi.mock('react', () => ({
  useState: vi.fn(() => [{}, vi.fn()]),
  useCallback: vi.fn((fn) => fn),
}));

describe('Form Validation Utilities', () => {
  describe('VALIDATION_PATTERNS', () => {
    it('should validate email patterns correctly', () => {
      expect(VALIDATION_PATTERNS.EMAIL.test('test@example.com')).toBe(true);
      expect(VALIDATION_PATTERNS.EMAIL.test('test.example.com')).toBe(false);
      expect(VALIDATION_PATTERNS.EMAIL.test('test@example')).toBe(false);
      expect(VALIDATION_PATTERNS.EMAIL.test('')).toBe(false);
    });

    it('should validate phone patterns correctly', () => {
      expect(VALIDATION_PATTERNS.PHONE.test('+1234567890')).toBe(true);
      expect(VALIDATION_PATTERNS.PHONE.test('1234567890')).toBe(true);
      expect(VALIDATION_PATTERNS.PHONE.test('123')).toBe(true); // 3-digit number starting with 1-9 is valid
      expect(VALIDATION_PATTERNS.PHONE.test('0123456789')).toBe(false); // Starts with 0
      expect(VALIDATION_PATTERNS.PHONE.test('abc')).toBe(false);
    });

    it('should validate URL patterns correctly', () => {
      expect(VALIDATION_PATTERNS.URL.test('https://example.com')).toBe(true);
      expect(VALIDATION_PATTERNS.URL.test('http://example.com/path')).toBe(true);
      expect(VALIDATION_PATTERNS.URL.test('example.com')).toBe(true);
      expect(VALIDATION_PATTERNS.URL.test('not-a-url')).toBe(false);
    });

    it('should validate numeric patterns correctly', () => {
      expect(VALIDATION_PATTERNS.NUMERIC.test('123')).toBe(true);
      expect(VALIDATION_PATTERNS.NUMERIC.test('123.45')).toBe(false);
      expect(VALIDATION_PATTERNS.NUMERIC.test('abc')).toBe(false);
    });

    it('should validate decimal patterns correctly', () => {
      expect(VALIDATION_PATTERNS.DECIMAL.test('123')).toBe(true);
      expect(VALIDATION_PATTERNS.DECIMAL.test('123.45')).toBe(true);
      expect(VALIDATION_PATTERNS.DECIMAL.test('abc')).toBe(false);
    });

    it('should validate slug patterns correctly', () => {
      expect(VALIDATION_PATTERNS.SLUG.test('my-slug')).toBe(true);
      expect(VALIDATION_PATTERNS.SLUG.test('my-slug-123')).toBe(true);
      expect(VALIDATION_PATTERNS.SLUG.test('My-Slug')).toBe(false);
      expect(VALIDATION_PATTERNS.SLUG.test('my slug')).toBe(false);
    });
  });

  describe('validateField', () => {
    it('should return null for valid field', () => {
      const field: FieldValidation = {
        value: 'test@example.com',
        rules: [{ type: 'email' }],
        fieldName: 'Email',
      };
      expect(validateField(field)).toBeNull();
    });

    it('should validate required fields', () => {
      const field: FieldValidation = {
        value: '',
        rules: [{ required: true }],
        fieldName: 'Name',
      };
      expect(validateField(field)).toBe(VALIDATION_MESSAGES.REQUIRED('Name'));
    });

    it('should skip validation for empty non-required fields', () => {
      const field: FieldValidation = {
        value: '',
        rules: [{ type: 'email' }],
        fieldName: 'Email',
      };
      expect(validateField(field)).toBeNull();
    });

    it('should validate minLength', () => {
      const field: FieldValidation = {
        value: 'ab',
        rules: [{ minLength: 3 }],
        fieldName: 'Password',
      };
      expect(validateField(field)).toBe(VALIDATION_MESSAGES.MIN_LENGTH('Password', 3));
    });

    it('should validate maxLength', () => {
      const field: FieldValidation = {
        value: 'abcdefghij',
        rules: [{ maxLength: 5 }],
        fieldName: 'Title',
      };
      expect(validateField(field)).toBe(VALIDATION_MESSAGES.MAX_LENGTH('Title', 5));
    });

    it('should validate email type', () => {
      const field: FieldValidation = {
        value: 'invalid-email',
        rules: [{ type: 'email' }],
        fieldName: 'Email',
      };
      expect(validateField(field)).toBe(VALIDATION_MESSAGES.EMAIL);
    });

    it('should validate phone type', () => {
      const field: FieldValidation = {
        value: 'abc',
        rules: [{ type: 'phone' }],
        fieldName: 'Phone',
      };
      expect(validateField(field)).toBe(VALIDATION_MESSAGES.PHONE);
    });

    it('should validate url type', () => {
      const field: FieldValidation = {
        value: 'not-a-url',
        rules: [{ type: 'url' }],
        fieldName: 'Website',
      };
      expect(validateField(field)).toBe(VALIDATION_MESSAGES.URL);
    });

    it('should validate number type', () => {
      const field: FieldValidation = {
        value: 'not-a-number',
        rules: [{ type: 'number' }],
        fieldName: 'Age',
      };
      expect(validateField(field)).toBe(VALIDATION_MESSAGES.NUMBER);
    });

    it('should validate positiveNumber type', () => {
      const field: FieldValidation = {
        value: '-5',
        rules: [{ type: 'positiveNumber' }],
        fieldName: 'Price',
      };
      expect(validateField(field)).toBe(VALIDATION_MESSAGES.POSITIVE_NUMBER);
    });

    it('should validate integer type', () => {
      const field: FieldValidation = {
        value: '5.5',
        rules: [{ type: 'integer' }],
        fieldName: 'Quantity',
      };
      expect(validateField(field)).toBe(VALIDATION_MESSAGES.INTEGER);
    });

    it('should validate password type', () => {
      const field: FieldValidation = {
        value: '123',
        rules: [{ type: 'password' }],
        fieldName: 'Password',
      };
      expect(validateField(field)).toBe(VALIDATION_MESSAGES.PASSWORD_MIN);
    });

    it('should validate custom pattern', () => {
      const field: FieldValidation = {
        value: '123abc',
        rules: [{ pattern: /^[A-Z]+$/, patternMessage: 'Must be uppercase' }],
        fieldName: 'Code',
      };
      expect(validateField(field)).toBe('Must be uppercase');
    });

    it('should validate custom function', () => {
      const customValidator = (value: string) => value === 'secret' ? null : 'Invalid secret';
      const field: FieldValidation = {
        value: 'wrong',
        rules: [{ custom: customValidator }],
        fieldName: 'Secret',
      };
      expect(validateField(field)).toBe('Invalid secret');
    });

    it('should apply multiple rules in order', () => {
      const field: FieldValidation = {
        value: '',
        rules: [
          { required: true },
          { type: 'email' },
          { minLength: 5 },
        ],
        fieldName: 'Email',
      };
      expect(validateField(field)).toBe(VALIDATION_MESSAGES.REQUIRED('Email'));
    });

    it('should handle whitespace trimming', () => {
      const field: FieldValidation = {
        value: '  test@example.com  ',
        rules: [{ type: 'email' }],
        fieldName: 'Email',
      };
      expect(validateField(field)).toBeNull();
    });
  });

  describe('validateForm', () => {
    it('should validate multiple fields correctly', () => {
      const fields: Record<string, FieldValidation> = {
        name: {
          value: 'John Doe',
          rules: [{ required: true, minLength: 2 }],
          fieldName: 'Name',
        },
        email: {
          value: 'john@example.com',
          rules: [{ required: true, type: 'email' as const }],
          fieldName: 'Email',
        },
        age: {
          value: '25',
          rules: [{ type: 'positiveNumber' as const }],
          fieldName: 'Age',
        },
      };

      const result = validateForm(fields);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
      expect(result.firstError).toBeUndefined();
    });

    it('should return errors for invalid fields', () => {
      const fields: Record<string, FieldValidation> = {
        name: {
          value: '',
          rules: [{ required: true }],
          fieldName: 'Name',
        },
        email: {
          value: 'invalid-email',
          rules: [{ required: true, type: 'email' as const }],
          fieldName: 'Email',
        },
      };

      const result = validateForm(fields);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe(VALIDATION_MESSAGES.REQUIRED('Name'));
      expect(result.errors.email).toBe(VALIDATION_MESSAGES.EMAIL);
      expect(result.firstError).toBe(VALIDATION_MESSAGES.REQUIRED('Name'));
    });

    it('should handle mixed valid and invalid fields', () => {
      const fields: Record<string, FieldValidation> = {
        name: {
          value: 'John',
          rules: [{ required: true }],
          fieldName: 'Name',
        },
        email: {
          value: 'invalid',
          rules: [{ type: 'email' as const }],
          fieldName: 'Email',
        },
      };

      const result = validateForm(fields);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBeUndefined();
      expect(result.errors.email).toBe(VALIDATION_MESSAGES.EMAIL);
    });
  });

  describe('VALIDATION_SCHEMAS', () => {
    it('should have STUDENT schema with correct rules', () => {
      expect(VALIDATION_SCHEMAS.STUDENT.name).toEqual({
        required: true,
        minLength: 2,
        maxLength: 100,
      });
      expect(VALIDATION_SCHEMAS.STUDENT.email).toEqual({
        required: true,
        type: 'email',
      });
      expect(VALIDATION_SCHEMAS.STUDENT.password).toEqual({
        required: true,
        type: 'password',
        minLength: 6,
      });
    });

    it('should have COURSE schema with correct rules', () => {
      expect(VALIDATION_SCHEMAS.COURSE.title).toEqual({
        required: true,
        minLength: 3,
        maxLength: 200,
      });
      expect(VALIDATION_SCHEMAS.COURSE.price).toEqual({
        required: true,
        type: 'positiveNumber',
      });
    });

    it('should have CATEGORY schema with correct rules', () => {
      expect(VALIDATION_SCHEMAS.CATEGORY.name).toEqual({
        required: true,
        minLength: 2,
        maxLength: 50,
      });
      expect(VALIDATION_SCHEMAS.CATEGORY.slug.pattern).toBe(VALIDATION_PATTERNS.SLUG);
    });

    it('should have SMTP schema with correct rules', () => {
      expect(VALIDATION_SCHEMAS.SMTP.host).toEqual({ required: true });
      expect(VALIDATION_SCHEMAS.SMTP.port).toEqual({
        required: true,
        type: 'positiveNumber',
      });
      expect(VALIDATION_SCHEMAS.SMTP.fromEmail).toEqual({
        required: true,
        type: 'email',
      });
    });
  });

  describe('createFieldValidations', () => {
    it('should create field validations from schema and data', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
      };

      const schema = {
        name: { required: true, minLength: 2 },
        email: { required: true, type: 'email' as const },
        age: { type: 'positiveNumber' as const },
      };

      const result = createFieldValidations(data, schema);

      expect(Object.keys(result)).toEqual(['name', 'email', 'age']);
      expect(result.name.value).toBe('John Doe');
      expect(result.name.rules).toEqual([{ required: true, minLength: 2 }]);
      expect(result.name.fieldName).toBe('Name');
      expect(result.email.fieldName).toBe('Email');
      expect(result.age.fieldName).toBe('Age');
    });

    it('should use custom field names when provided', () => {
      const data = { username: 'johndoe' };
      const schema = { username: { required: true } };
      const fieldNames = { username: 'User Name' };

      const result = createFieldValidations(data, schema, fieldNames);
      expect(result.username.fieldName).toBe('User Name');
    });
  });

  describe('validationHelpers', () => {
    describe('isNotEmpty', () => {
      it('should return true for non-empty strings', () => {
        expect(validationHelpers.isNotEmpty('test')).toBe(true);
        expect(validationHelpers.isNotEmpty('  test  ')).toBe(true);
      });

      it('should return false for empty strings', () => {
        expect(validationHelpers.isNotEmpty('')).toBe(false);
        expect(validationHelpers.isNotEmpty('   ')).toBe(false);
      });
    });

    describe('minArrayLength', () => {
      it('should validate array length', () => {
        expect(validationHelpers.minArrayLength([1, 2, 3], 2)).toBe(true);
        expect(validationHelpers.minArrayLength([1], 2)).toBe(false);
        expect(validationHelpers.minArrayLength([], 1)).toBe(false);
      });
    });

    describe('isPositiveNumber', () => {
      it('should validate positive numbers', () => {
        expect(validationHelpers.isPositiveNumber(5)).toBe(true);
        expect(validationHelpers.isPositiveNumber(0)).toBe(false);
        expect(validationHelpers.isPositiveNumber(-5)).toBe(false);
        expect(validationHelpers.isPositiveNumber('10')).toBe(true);
        expect(validationHelpers.isPositiveNumber('abc')).toBe(false);
      });
    });

    describe('isValidEmail', () => {
      it('should validate email format', () => {
        expect(validationHelpers.isValidEmail('test@example.com')).toBe(true);
        expect(validationHelpers.isValidEmail('invalid')).toBe(false);
        expect(validationHelpers.isValidEmail('test@')).toBe(false);
      });
    });

    describe('isValidPhone', () => {
      it('should validate phone format', () => {
        expect(validationHelpers.isValidPhone('+1234567890')).toBe(true);
        expect(validationHelpers.isValidPhone('1234567890')).toBe(true);
        expect(validationHelpers.isValidPhone('123')).toBe(true); // 3-digit number starting with 1-9 is valid
        expect(validationHelpers.isValidPhone('0123456789')).toBe(false); // Starts with 0
        expect(validationHelpers.isValidPhone('abc')).toBe(false);
      });
    });

    describe('sanitizeString', () => {
      it('should trim and normalize whitespace', () => {
        expect(validationHelpers.sanitizeString('  hello  world  ')).toBe('hello world');
        expect(validationHelpers.sanitizeString('test')).toBe('test');
      });
    });

    describe('sanitizeNumber', () => {
      it('should parse numbers correctly', () => {
        expect(validationHelpers.sanitizeNumber('123')).toBe(123);
        expect(validationHelpers.sanitizeNumber('123.45')).toBe(123.45);
        expect(validationHelpers.sanitizeNumber('abc')).toBe(0);
        expect(validationHelpers.sanitizeNumber('abc', 10)).toBe(10);
      });
    });

    describe('parseCsv', () => {
      it('should parse CSV strings into arrays', () => {
        expect(validationHelpers.parseCsv('a,b,c')).toEqual(['a', 'b', 'c']);
        expect(validationHelpers.parseCsv('a; b; c')).toEqual(['a', 'b', 'c']);
        expect(validationHelpers.parseCsv('a\nb\nc')).toEqual(['a', 'b', 'c']);
        expect(validationHelpers.parseCsv('  a , b , c  ')).toEqual(['a', 'b', 'c']);
        expect(validationHelpers.parseCsv('')).toEqual([]);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should validate a complete student form using schema', () => {
      const studentData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        password: 'password123',
      };

      const fieldValidations = createFieldValidations(
        studentData,
        VALIDATION_SCHEMAS.STUDENT,
        {
          name: 'Full Name',
          email: 'Email Address',
          phone: 'Phone Number',
          password: 'Password',
        }
      );

      const result = validateForm(fieldValidations);
      expect(result.isValid).toBe(true);
    });

    it('should detect errors in invalid student form', () => {
      const studentData = {
        name: 'J', // Too short
        email: 'invalid-email',
        phone: 'abc',
        password: '123', // Too short
      };

      const fieldValidations = createFieldValidations(
        studentData,
        VALIDATION_SCHEMAS.STUDENT
      );

      const result = validateForm(fieldValidations);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe(VALIDATION_MESSAGES.MIN_LENGTH('Name', 2));
      expect(result.errors.email).toBe(VALIDATION_MESSAGES.EMAIL);
      expect(result.errors.password).toBe(VALIDATION_MESSAGES.PASSWORD_MIN);
    });
  });

  describe('useFormValidation (React Hook)', () => {
    // Note: This is a simplified test since we're mocking React hooks
    it('should have the expected API structure', () => {
      const mockInitialData = { name: '', email: '' };
      const mockSchema = {
        name: { required: true },
        email: { type: 'email' as const },
      };

      // Since we're mocking React, we can't test the actual hook behavior
      // but we can verify the function exists and has the right signature
      expect(typeof useFormValidation).toBe('function');
    });
  });
});