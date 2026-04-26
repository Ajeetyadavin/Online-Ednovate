# Form Validation Guide for Ednovate Admin Panel

## Overview

This guide documents the comprehensive form validation utilities implemented for the Ednovate admin panel. The validation system provides consistent validation patterns, error messages, and validation rules across all admin components.

## Key Features

- **Type-safe validation** with TypeScript support
- **Consistent error messages** across all forms
- **Reusable validation schemas** for common entities (students, courses, categories, etc.)
- **Client-side validation** with immediate feedback
- **Integration with React hooks** for form state management
- **Comprehensive test coverage** with 43 passing tests

## Installation & Usage

The validation utilities are located in `src/utils/formValidation.ts`. Import the necessary functions and schemas:

```typescript
import {
  validateField,
  validateForm,
  VALIDATION_SCHEMAS,
  createFieldValidations,
  validationHelpers,
  useFormValidation,
} from '@/utils/formValidation';
```

## Core Concepts

### ValidationRule Interface

The `ValidationRule` interface defines the validation rules for a field:

```typescript
interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  custom?: (value: any) => string | null;
  type?: 'email' | 'phone' | 'url' | 'number' | 'positiveNumber' | 'integer' | 'password';
}
```

### FieldValidation Interface

The `FieldValidation` interface represents a field to be validated:

```typescript
interface FieldValidation {
  value: any;
  rules: ValidationRule[];
  fieldName: string;
}
```

### ValidationResult Interface

The `ValidationResult` interface represents the result of validation:

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  firstError?: string;
}
```

## Available Validation Functions

### `validateField(field: FieldValidation): string | null`

Validates a single field against its rules. Returns `null` if valid, or an error message if invalid.

**Example:**
```typescript
const error = validateField({
  value: 'test@example.com',
  rules: [{ type: 'email' }],
  fieldName: 'Email',
});
// Returns: null (valid)
```

### `validateForm(fields: Record<string, FieldValidation>): ValidationResult`

Validates multiple fields at once and returns a comprehensive validation result.

**Example:**
```typescript
const result = validateForm({
  name: {
    value: 'John Doe',
    rules: [{ required: true, minLength: 2 }],
    fieldName: 'Name',
  },
  email: {
    value: 'john@example.com',
    rules: [{ required: true, type: 'email' }],
    fieldName: 'Email',
  },
});

console.log(result.isValid); // true
console.log(result.errors); // {}
```

### `createFieldValidations(data, schema, fieldNames?)`

Creates field validation objects from data and a schema.

**Example:**
```typescript
const fieldValidations = createFieldValidations(
  { name: 'John', email: 'john@example.com' },
  VALIDATION_SCHEMAS.STUDENT,
  { name: 'Full Name', email: 'Email Address' }
);
```

## Predefined Validation Schemas

The system includes predefined validation schemas for common entities:

### Student Validation (`VALIDATION_SCHEMAS.STUDENT`)
```typescript
{
  name: { required: true, minLength: 2, maxLength: 100 },
  email: { required: true, type: 'email' },
  phone: { type: 'phone' },
  password: { required: true, type: 'password', minLength: 6 },
}
```

### Course Validation (`VALIDATION_SCHEMAS.COURSE`)
```typescript
{
  title: { required: true, minLength: 3, maxLength: 200 },
  category: { required: true },
  price: { required: true, type: 'positiveNumber' },
  originalPrice: { type: 'positiveNumber' },
  lectures: { type: 'positiveNumber' },
  hours: { type: 'positiveNumber' },
}
```

### Category Validation (`VALIDATION_SCHEMAS.CATEGORY`)
```typescript
{
  name: { required: true, minLength: 2, maxLength: 50 },
  slug: { pattern: VALIDATION_PATTERNS.SLUG, patternMessage: 'Slug must be lowercase with hyphens' },
}
```

### SMTP Settings Validation (`VALIDATION_SCHEMAS.SMTP`)
```typescript
{
  host: { required: true },
  port: { required: true, type: 'positiveNumber' },
  username: { required: true },
  password: { required: true },
  fromEmail: { required: true, type: 'email' },
}
```

## Validation Patterns

Predefined regex patterns are available in `VALIDATION_PATTERNS`:

```typescript
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[\+]?[1-9][\d]{0,15}$/, // 1-16 digits, starting with 1-9, optional +
  URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
  NUMERIC: /^\d+$/,
  DECIMAL: /^\d+(\.\d+)?$/,
  ALPHANUMERIC: /^[a-zA-Z0-9\s\-_]+$/,
  NO_SPECIAL_CHARS: /^[a-zA-Z0-9\s]+$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
} as const;
```

## Validation Messages

Consistent error messages are available in `VALIDATION_MESSAGES`:

```typescript
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
```

## Validation Helpers

The `validationHelpers` object provides utility functions for common validation scenarios:

```typescript
// Check if string is not empty after trim
validationHelpers.isNotEmpty('test'); // true

// Check if array has at least N items
validationHelpers.minArrayLength([1, 2, 3], 2); // true

// Check if number is positive
validationHelpers.isPositiveNumber(5); // true

// Validate email format
validationHelpers.isValidEmail('test@example.com'); // true

// Validate phone format
validationHelpers.isValidPhone('+1234567890'); // true

// Sanitize string (trim and remove extra spaces)
validationHelpers.sanitizeString('  hello  world  '); // 'hello world'

// Sanitize number (parse float, return 0 if invalid)
validationHelpers.sanitizeNumber('123.45'); // 123.45

// Parse CSV input
validationHelpers.parseCsv('a,b,c'); // ['a', 'b', 'c']
```

## React Hook: `useFormValidation`

For React components, use the `useFormValidation` hook:

```typescript
const {
  errors,
  touched,
  validateField,
  validateForm,
  setFieldTouched,
  resetValidation,
} = useFormValidation(initialData, schema);
```

**Example Usage:**
```typescript
function StudentForm() {
  const initialData = { name: '', email: '', password: '' };
  const { errors, validateField, setFieldTouched } = useFormValidation(
    initialData,
    VALIDATION_SCHEMAS.STUDENT
  );

  const handleBlur = (field: keyof typeof initialData) => {
    setFieldTouched(field, true);
  };

  const handleChange = (field: keyof typeof initialData, value: string) => {
    const error = validateField(field, value);
    // Update error state
  };

  return (
    <form>
      <input
        name="name"
        onBlur={() => handleBlur('name')}
        onChange={(e) => handleChange('name', e.target.value)}
      />
      {errors.name && <div className="error">{errors.name}</div>}
      {/* ... other fields */}
    </form>
  );
}
```

## Integration with Admin Components

### Example: AdminUsers Component

The `AdminUsers` component has been updated to use the validation utilities:

```typescript
// Import validation utilities
import { validateField, VALIDATION_SCHEMAS, validationHelpers } from "@/utils/formValidation";
import { handleApiError, showErrorToast, showSuccessToast } from "@/utils/errorHandler";

// Usage in handleChangePassword function
const handleChangePassword = async () => {
  // Validate password field
  const passwordError = validateField({
    value: changePassword,
    rules: [{ required: true, minLength: 6 }],
    fieldName: 'Password',
  });

  if (passwordError) {
    showErrorToast(passwordError);
    return;
  }

  try {
    await adminApi.changeStudentPassword(selectedStudent.id, changePassword);
    showSuccessToast('Password changed successfully');
    setChangePassword('');
    setChangePasswordOpen(false);
  } catch (error) {
    handleApiError(error, { context: 'changePassword' });
  }
};
```

## Testing

The validation utilities have comprehensive test coverage with 43 passing tests. Run the tests with:

```bash
cd frontend
npm test -- formValidation.test.ts
```

### Test Categories:
1. **VALIDATION_PATTERNS** - Tests for regex patterns
2. **validateField** - Tests for single field validation
3. **validateForm** - Tests for multi-field validation
4. **VALIDATION_SCHEMAS** - Tests for predefined schemas
5. **createFieldValidations** - Tests for field validation creation
6. **validationHelpers** - Tests for utility functions
7. **Integration Tests** - Tests for real-world scenarios
8. **useFormValidation** - Tests for React hook (mocked)

## Best Practices

### 1. Always Validate on Submit
```typescript
const handleSubmit = async () => {
  const fieldValidations = createFieldValidations(formData, VALIDATION_SCHEMAS.STUDENT);
  const result = validateForm(fieldValidations);
  
  if (!result.isValid) {
    showErrorToast(result.firstError || 'Please fix validation errors');
    return;
  }
  
  // Proceed with API call
};
```

### 2. Provide Immediate Feedback
```typescript
const handleBlur = (field: keyof FormData) => {
  const error = validateField({
    value: formData[field],
    rules: VALIDATION_SCHEMAS.STUDENT[field],
    fieldName: fieldNames[field],
  });
  
  setErrors(prev => ({ ...prev, [field]: error || '' }));
};
```

### 3. Use Predefined Schemas
Always use `VALIDATION_SCHEMAS` when available to ensure consistency across the application.

### 4. Sanitize Inputs Before Validation
```typescript
const sanitizedValue = validationHelpers.sanitizeString(rawValue);
const error = validateField({
  value: sanitizedValue,
  rules: [...],
  fieldName: 'Field',
});
```

### 5. Combine with Error Handling
Use the validation utilities together with the error handling utilities for a complete solution:

```typescript
import { handleApiError, showErrorToast } from "@/utils/errorHandler";
import { validateForm, VALIDATION_SCHEMAS } from "@/utils/formValidation";

try {
  // Validate first
  const validation = validateForm(createFieldValidations(data, schema));
  if (!validation.isValid) {
    showErrorToast(validation.firstError);
    return;
  }
  
  // Then make API call
  await apiCall(data);
} catch (error) {
  handleApiError(error);
}
```

## Common Validation Scenarios

### Email Validation
```typescript
const emailError = validateField({
  value: email,
  rules: [{ required: true, type: 'email' }],
  fieldName: 'Email',
});
```

### Phone Number Validation
```typescript
const phoneError = validateField({
  value: phone,
  rules: [{ type: 'phone' }],
  fieldName: 'Phone Number',
});
```

### Password Validation
```typescript
const passwordError = validateField({
  value: password,
  rules: [{ required: true, type: 'password', minLength: 8 }],
  fieldName: 'Password',
});
```

### URL Validation
```typescript
const urlError = validateField({
  value: website,
  rules: [{ type: 'url' }],
  fieldName: 'Website',
});
```

### Custom Pattern Validation
```typescript
const slugError = validateField({
  value: slug,
  rules: [{ 
    pattern: VALIDATION_PATTERNS.SLUG,
    patternMessage: 'Slug must be lowercase with hyphens (e.g., my-slug)' 
  }],
  fieldName: 'Slug',
});
```

## Troubleshooting

### Common Issues

1. **Phone validation too strict**: The phone pattern `^[\+]?[1-9][\d]{0,15}$` requires numbers to start with 1-9 (not 0). This is intentional to avoid invalid numbers.

2. **Empty fields passing validation**: Non-required fields with type validation will pass if empty. Use `required: true` if the field must not be empty.

3. **TypeScript errors with rule types**: Ensure you use `as const` when defining rules with specific types:
   ```typescript
   const rules = [{ type: 'email' as const }];
   ```

4. **Custom validation not working**: Ensure your custom function returns `string | null` (error message or null for valid).

## Migration Guide

### From Old Validation Patterns

If you're migrating from old validation patterns, replace:

**Old:**
```typescript
if (!email.includes('@')) {
  alert('Invalid email');
}
```

**New:**
```typescript
const error = validateField({
  value: email,
  rules: [{ type: 'email' }],
  fieldName: 'Email',
});
if (error) {
  showErrorToast(error);
}
```

### From alert() to showErrorToast()

Replace all `alert()` calls with proper error handling:

**Old:**
```typescript
alert('Password must be at least 6 characters');
```

**New:**
```typescript
showErrorToast('Password must be at least 6 characters');
```

## Conclusion

The form validation utilities provide a robust, consistent, and type-safe solution for validating forms in the Ednovate admin panel. By using these utilities, you ensure:

1. **Consistency** - Same validation rules and messages across the application
2. **Maintainability** - Centralized validation logic
3. **Testability** - Comprehensive test coverage
4. **User Experience** - Clear, consistent error messages
5. **Security** - Proper input validation before API calls

For any questions or issues, refer to the test files or contact the development team.