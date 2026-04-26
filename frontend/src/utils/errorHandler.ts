/**
 * Standardized error handling utilities for the Ednovate admin panel
 * Provides consistent error formatting, logging, and user feedback
 */

import { toast } from "sonner";

/**
 * Error categories for better error handling and user feedback
 */
export enum ErrorCategory {
  NETWORK = "network",
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  NOT_FOUND = "not_found",
  SERVER = "server",
  CLIENT = "client",
  UNKNOWN = "unknown"
}

/**
 * Standardized error object with additional metadata
 */
export interface AppError {
  message: string;
  category: ErrorCategory;
  originalError?: unknown;
  statusCode?: number;
  timestamp: Date;
  context?: Record<string, unknown>;
}

/**
 * Creates a standardized AppError from various error sources
 */
export function createAppError(
  error: unknown,
  category: ErrorCategory = ErrorCategory.UNKNOWN,
  context?: Record<string, unknown>
): AppError {
  const timestamp = new Date();
  
  if (error instanceof Error) {
    return {
      message: error.message,
      category,
      originalError: error,
      timestamp,
      context
    };
  }
  
  if (typeof error === 'string') {
    return {
      message: error,
      category,
      originalError: error,
      timestamp,
      context
    };
  }
  
  return {
    message: 'An unknown error occurred',
    category,
    originalError: error,
    timestamp,
    context
  };
}

/**
 * Determines error category from HTTP status code
 */
export function getErrorCategoryFromStatusCode(statusCode: number): ErrorCategory {
  if (statusCode >= 400 && statusCode < 500) {
    if (statusCode === 401) return ErrorCategory.AUTHENTICATION;
    if (statusCode === 403) return ErrorCategory.AUTHORIZATION;
    if (statusCode === 404) return ErrorCategory.NOT_FOUND;
    if (statusCode === 422) return ErrorCategory.VALIDATION;
    return ErrorCategory.CLIENT;
  }
  
  if (statusCode >= 500) {
    return ErrorCategory.SERVER;
  }
  
  return ErrorCategory.UNKNOWN;
}

/**
 * Extracts user-friendly error message from various error types
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object') {
    // Try to extract message from common error object patterns
    const obj = error as Record<string, unknown>;
    
    if (typeof obj.message === 'string') {
      return obj.message;
    }
    
    if (typeof obj.error === 'string') {
      return obj.error;
    }
    
    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
      const firstError = obj.errors[0];
      if (typeof firstError === 'string') {
        return firstError;
      }
      if (firstError && typeof firstError === 'object' && typeof (firstError as Record<string, unknown>).message === 'string') {
        return (firstError as Record<string, unknown>).message as string;
      }
    }
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Shows appropriate toast notification based on error category
 */
export function showErrorToast(error: unknown, fallbackMessage?: string): void {
  const message = extractErrorMessage(error);
  const finalMessage = message || fallbackMessage || 'An error occurred';
  
  // Determine toast type based on error characteristics
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    const errMessage = typeof err.message === 'string' ? err.message : '';
    const errName = typeof err.name === 'string' ? err.name : '';
    
    // Network errors (timeout, connection issues)
    if (errName === 'TypeError' && errMessage.includes('fetch')) {
      toast.error('Network error. Please check your connection and try again.');
      return;
    }
    
    // Authentication errors
    if (err.statusCode === 401 || errMessage.includes('auth') || errMessage.includes('login')) {
      toast.error('Authentication failed. Please log in again.');
      return;
    }
    
    // Authorization errors
    if (err.statusCode === 403 || errMessage.includes('permission') || errMessage.includes('access denied')) {
      toast.error('You do not have permission to perform this action.');
      return;
    }
    
    // Validation errors
    if (err.statusCode === 422 || errMessage.includes('validation') || errMessage.includes('invalid')) {
      toast.error(finalMessage);
      return;
    }
    
    // Not found errors
    if (err.statusCode === 404 || errMessage.includes('not found') || errMessage.includes('does not exist')) {
      toast.error('The requested resource was not found.');
      return;
    }
  }
  
  // Default error toast
  toast.error(finalMessage);
}

/**
 * Shows success toast with consistent styling
 */
export function showSuccessToast(message: string): void {
  toast.success(message);
}

/**
 * Shows warning toast with consistent styling
 */
export function showWarningToast(message: string): void {
  toast.warning(message);
}

/**
 * Shows info toast with consistent styling
 */
export function showInfoToast(message: string): void {
  toast.info(message);
}

/**
 * Logs error to console with additional context
 * In production, this could be extended to send to error tracking service
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  const appError = createAppError(error, ErrorCategory.UNKNOWN, context);
  
  console.error('[App Error]', {
    message: appError.message,
    category: appError.category,
    timestamp: appError.timestamp.toISOString(),
    context: appError.context,
    originalError: appError.originalError
  });
  
  // In production, you could add error tracking service integration here
  // e.g., Sentry.captureException(error, { extra: context })
}

/**
 * Handles API errors with standardized error handling
 * Returns a standardized error object and shows toast if requested
 */
export function handleApiError(
  error: unknown,
  options: {
    showToast?: boolean;
    logError?: boolean;
    context?: Record<string, unknown>;
    fallbackMessage?: string;
  } = {}
): AppError {
  const { showToast = true, logError: shouldLog = true, context, fallbackMessage } = options;
  
  const appError = createAppError(error, ErrorCategory.UNKNOWN, context);
  
  if (shouldLog) {
    logError(error, context);
  }
  
  if (showToast) {
    showErrorToast(error, fallbackMessage);
  }
  
  return appError;
}

/**
 * Safe execution wrapper that catches errors and handles them consistently
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  options: {
    onError?: (error: AppError) => void;
    showToast?: boolean;
    logError?: boolean;
    context?: Record<string, unknown>;
  } = {}
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const appError = handleApiError(error, {
      showToast: options.showToast,
      logError: options.logError,
      context: options.context
    });
    
    if (options.onError) {
      options.onError(appError);
    }
    
    return null;
  }
}

/**
 * Retry wrapper for operations that may fail due to transient errors
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000, shouldRetry, onRetry } = options;
  
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      const canRetry = shouldRetry ? shouldRetry(error) : true;
      
      if (attempt < maxRetries && canRetry) {
        if (onRetry) {
          onRetry(attempt, error);
        }
        
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      break;
    }
  }
  
  throw lastError;
}

/**
 * Common error messages for consistent user feedback
 */
export const ErrorMessages = {
  NETWORK: 'Network error. Please check your connection and try again.',
  AUTHENTICATION: 'Authentication failed. Please log in again.',
  AUTHORIZATION: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION: 'Please check your input and try again.',
  SERVER: 'Server error. Please try again later.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
  TIMEOUT: 'Request timed out. Please try again.',
  UPLOAD_FAILED: 'Upload failed. Please try again.',
  DELETE_FAILED: 'Failed to delete. Please try again.',
  SAVE_FAILED: 'Failed to save changes. Please try again.',
  LOAD_FAILED: 'Failed to load data. Please try again.',
} as const;

/**
 * Helper to check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('Network') || 
           error.message.includes('fetch') || 
           error.message.includes('timeout') ||
           error.name === 'TypeError';
  }
  return false;
}

/**
 * Helper to check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const errMessage = typeof err.message === 'string' ? err.message : '';
    return err.statusCode === 401 ||
           errMessage.includes('auth') ||
           errMessage.includes('login') ||
           errMessage.includes('token');
  }
  return false;
}

/**
 * Helper to check if error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const errMessage = typeof err.message === 'string' ? err.message : '';
    return err.statusCode === 422 ||
           errMessage.includes('validation') ||
           errMessage.includes('invalid') ||
           errMessage.includes('required');
  }
  return false;
}