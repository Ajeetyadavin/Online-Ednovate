/**
 * Comprehensive input sanitization utilities for Ednovate backend
 * Protects against XSS, SQL injection, and other injection attacks
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Sanitize a string input by removing dangerous characters and limiting length
 * @param {string} input - The input string to sanitize
 * @param {Object} options - Sanitization options
 * @param {number} options.maxLength - Maximum allowed length (default: 255)
 * @param {boolean} options.allowHtml - Whether to allow HTML (default: false)
 * @param {boolean} options.allowNewlines - Whether to allow newlines (default: false)
 * @param {string} options.allowedChars - Regex pattern of allowed characters
 * @returns {string} Sanitized string
 */
export const sanitizeString = (input, options = {}) => {
  const {
    maxLength = 255,
    allowHtml = false,
    allowNewlines = false,
    allowedChars = null,
  } = options;

  if (input === null || input === undefined) return '';
  
  let str = String(input);
  
  // Trim whitespace
  str = str.trim();
  
  // Apply length limit
  if (str.length > maxLength) {
    str = str.substring(0, maxLength);
  }
  
  // Remove HTML tags if not allowed
  if (!allowHtml) {
    str = str.replace(/<[^>]*>/g, '');
  }
  
  // Remove newlines if not allowed
  if (!allowNewlines) {
    str = str.replace(/[\r\n]+/g, ' ');
  }
  
  // Remove control characters (except tab, newline if allowed)
  const controlCharsPattern = allowNewlines ? /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g : /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
  str = str.replace(controlCharsPattern, '');
  
  // Apply custom character filter if provided
  if (allowedChars) {
    const regex = new RegExp(`[^${allowedChars}]`, 'g');
    str = str.replace(regex, '');
  }
  
  return str;
};

/**
 * Sanitize an email address
 * @param {string} email - Email input
 * @returns {string} Sanitized email or empty string if invalid
 */
export const sanitizeEmail = (email) => {
  if (!email) return '';
  
  const str = String(email).trim().toLowerCase();
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(str)) {
    return '';
  }
  
  // Additional safety: limit length and remove dangerous characters
  const sanitized = str.substring(0, 254)
    .replace(/[^\w.@+-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/@{2,}/g, '@');
  
  return sanitized;
};

/**
 * Sanitize a phone number
 * @param {string} phone - Phone number input
 * @returns {string} Sanitized phone number with only digits
 */
export const sanitizePhone = (phone) => {
  if (!phone) return '';
  
  const str = String(phone);
  // Keep only digits and + (for country code)
  const sanitized = str.replace(/[^\d+]/g, '');
  
  // Limit length
  return sanitized.substring(0, 20);
};

/**
 * Sanitize a numeric input
 * @param {*} input - Input to convert to number
 * @param {Object} options - Options
 * @param {number} options.min - Minimum value
 * @param {number} options.max - Maximum value
 * @param {number} options.default - Default value if invalid
 * @returns {number} Sanitized number
 */
export const sanitizeNumber = (input, options = {}) => {
  const { min = -Infinity, max = Infinity, defaultValue = 0 } = options;
  
  if (input === null || input === undefined || input === '') {
    return defaultValue;
  }
  
  // Convert to number
  const num = Number(input);
  
  // Check if valid number
  if (isNaN(num) || !isFinite(num)) {
    return defaultValue;
  }
  
  // Apply bounds
  let result = num;
  if (result < min) result = min;
  if (result > max) result = max;
  
  return result;
};

/**
 * Sanitize a boolean input
 * @param {*} input - Input to convert to boolean
 * @returns {boolean} Sanitized boolean
 */
export const sanitizeBoolean = (input) => {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'number') return input !== 0;
  if (typeof input === 'string') {
    const lower = input.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on';
  }
  return Boolean(input);
};

/**
 * Sanitize a URL
 * @param {string} url - URL input
 * @param {Object} options - Options
 * @param {boolean} options.requireHttps - Whether to require HTTPS (default: false)
 * @returns {string} Sanitized URL or empty string if invalid
 */
export const sanitizeUrl = (url, options = {}) => {
  const { requireHttps = false } = options;
  
  if (!url) return '';
  
  let str = String(url).trim();
  
  // Add protocol if missing
  if (!str.startsWith('http://') && !str.startsWith('https://') && !str.startsWith('//')) {
    str = 'https://' + str;
  }
  
  try {
    const urlObj = new URL(str);
    
    // Enforce HTTPS if required
    if (requireHttps && urlObj.protocol !== 'https:') {
      return '';
    }
    
    // Allow only http, https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return '';
    }
    
    // Remove dangerous parts
    urlObj.hash = '';
    urlObj.username = '';
    urlObj.password = '';
    
    return urlObj.toString();
  } catch {
    return '';
  }
};

/**
 * Sanitize an object by applying sanitization rules to its properties
 * @param {Object} obj - Object to sanitize
 * @param {Object} schema - Schema defining sanitization rules for each property
 * @returns {Object} Sanitized object
 */
export const sanitizeObject = (obj, schema) => {
  if (!obj || typeof obj !== 'object') return {};
  
  const result = {};
  
  for (const [key, rule] of Object.entries(schema)) {
    if (rule === undefined || rule === null) continue;
    
    const value = obj[key];
    
    // Apply sanitization based on rule type
    if (typeof rule === 'function') {
      // Custom sanitizer function
      result[key] = rule(value);
    } else if (rule.type === 'string') {
      result[key] = sanitizeString(value, rule.options || {});
    } else if (rule.type === 'email') {
      result[key] = sanitizeEmail(value);
    } else if (rule.type === 'phone') {
      result[key] = sanitizePhone(value);
    } else if (rule.type === 'number') {
      result[key] = sanitizeNumber(value, rule.options || {});
    } else if (rule.type === 'boolean') {
      result[key] = sanitizeBoolean(value);
    } else if (rule.type === 'url') {
      result[key] = sanitizeUrl(value, rule.options || {});
    } else if (rule.type === 'array') {
      if (Array.isArray(value)) {
        result[key] = value.map(item => {
          if (rule.itemType) {
            // Apply sanitization to each array item
            if (rule.itemType === 'string') {
              return sanitizeString(item, rule.options || {});
            } else if (rule.itemType === 'number') {
              return sanitizeNumber(item, rule.options || {});
            }
          }
          return item;
        }).filter(item => item !== undefined && item !== null);
      } else {
        result[key] = [];
      }
    } else {
      // Default: pass through
      result[key] = value;
    }
  }
  
  return result;
};

/**
 * Middleware to sanitize request body, query, and params
 * @param {Object} schema - Schema for sanitization
 * @returns {Function} Express middleware
 */
export const sanitizeRequest = (schema = {}) => {
  return (req, res, next) => {
    try {
      if (schema.body && req.body) {
        req.body = sanitizeObject(req.body, schema.body);
      }
      
      if (schema.query && req.query) {
        req.query = sanitizeObject(req.query, schema.query);
      }
      
      if (schema.params && req.params) {
        req.params = sanitizeObject(req.params, schema.params);
      }
    } catch (error) {
      console.error('Sanitization error:', error);
      res.status(400).json({ message: "Invalid request data" });
      return;
    }

    next();
  };
};

/**
 * Common sanitization schemas for reuse across endpoints
 */
export const schemas = {
  email: { type: 'email' },
  phone: { type: 'phone' },
  name: { type: 'string', options: { maxLength: 100, allowNewlines: false } },
  password: { type: 'string', options: { maxLength: 100 } },
  text: { type: 'string', options: { maxLength: 1000, allowNewlines: true } },
  longText: { type: 'string', options: { maxLength: 5000, allowNewlines: true } },
  url: { type: 'url', options: { requireHttps: false } },
  positiveNumber: { type: 'number', options: { min: 0, defaultValue: 0 } },
  id: { type: 'string', options: { maxLength: 50, allowedChars: 'a-zA-Z0-9-_' } },
};

/**
 * In-memory rate limiting utility for Express
 * Note: For production, use a distributed store like Redis
 */

const rateLimitStore = new Map();

/**
 * Create a rate limiter middleware
 * @param {Object} options - Rate limiting options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.max - Maximum requests per window (default: 100)
 * @param {string} options.keyGenerator - Function to generate key from request (default: IP + path)
 * @param {boolean} options.skipSuccessfulRequests - Don't count successful requests (default: false)
 * @returns {Function} Express middleware
 */
export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    keyGenerator = (req) => `${req.ip}-${req.path}`,
    skipSuccessfulRequests = false,
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Clean old entries
    if (rateLimitStore.size > 10000) {
      // Simple cleanup: remove entries older than 2 windows
      const cutoff = now - windowMs * 2;
      for (const [k, entry] of rateLimitStore.entries()) {
        if (entry.lastReset < cutoff) {
          rateLimitStore.delete(k);
        }
      }
    }
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.lastReset < now - windowMs) {
      // New window
      entry = {
        count: 0,
        lastReset: now,
      };
      rateLimitStore.set(key, entry);
    }
    
    // Check if limit exceeded
    if (entry.count >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      res.status(429).json({
        message: 'Too many requests, please try again later.',
        retryAfter: Math.ceil((entry.lastReset + windowMs - now) / 1000),
      });
      return;
    }
    
    // Increment counter
    entry.count++;
    
    // Optionally skip counting successful requests
    if (skipSuccessfulRequests) {
      const originalSend = res.send;
      res.send = function(body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          entry.count--;
        }
        return originalSend.call(this, body);
      };
    }
    
    // Add headers for client information
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil((entry.lastReset + windowMs) / 1000));
    
    next();
  };
};

/**
 * Admin-specific rate limiter (stricter limits)
 */
export const adminRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // 5000 requests per 15 minutes for admin endpoints
  keyGenerator: (req) => `${req.ip}-admin`,
});

/**
 * Login-specific rate limiter (very strict to prevent brute force)
 */
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per 15 minutes per IP+email
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `${req.ip}-login-${email || "unknown"}`;
  },
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * API-specific rate limiter (more generous)
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes for regular API
  keyGenerator: (req) => `${req.ip}-api`,
});

export const studentLoginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyGenerator: (req) => {
    const identifier = String(req.body?.identifier || req.body?.emailOrMobile || "").trim().toLowerCase();
    return `${req.ip}-student-login-${identifier || "unknown"}`;
  },
  skipSuccessfulRequests: true,
});

export const otpRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}-otp-${String(req.body?.mobile || req.body?.mobileNo || "").trim()}`,
});

export const signupRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip}-signup`,
});

/**
 * Password security utilities for encrypting and masking sensitive data
 */

/**
 * Simple encryption for passwords using environment variable as key
 * In production, use a proper key management system
 */
export const encryptPassword = (password) => {
  if (!password || password === '••••••' || password === '******') {
    return password;
  }

  const keySource = process.env.SETTINGS_ENCRYPTION_KEY || "";
  if (!keySource || keySource.length < 32) {
    console.error("[WARN] SETTINGS_ENCRYPTION_KEY not set or too short (<32 chars). Storing value with basic encoding.");
    const encoded = Buffer.from(password).toString('base64');
    return `enc:${encoded}`;
  }

  try {
    const key = Buffer.from(keySource.slice(0, 32), "utf8");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(password, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");
    return `aes:${iv.toString("hex")}:${tag}:${encrypted}`;
  } catch (error) {
    console.error('Password encryption error:', error);
    return password;
  }
};

/**
 * Decrypt password if it's encrypted
 */
export const decryptPassword = (encryptedPassword) => {
  if (!encryptedPassword || typeof encryptedPassword !== 'string') {
    return encryptedPassword;
  }

  if (encryptedPassword.startsWith('aes:')) {
    try {
      const keySource = process.env.SETTINGS_ENCRYPTION_KEY || "";
      if (!keySource || keySource.length < 32) {
        console.error('Cannot decrypt AES password: SETTINGS_ENCRYPTION_KEY not set');
        return encryptedPassword;
      }
      const key = Buffer.from(keySource.slice(0, 32), "utf8");
      const parts = encryptedPassword.split(':');
      if (parts.length !== 4) return encryptedPassword;
      const iv = Buffer.from(parts[1], "hex");
      const tag = Buffer.from(parts[2], "hex");
      const data = parts[3];
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(data, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (error) {
      console.error('AES password decryption error:', error);
      return encryptedPassword;
    }
  }

  if (encryptedPassword.startsWith('enc:')) {
    try {
      const encoded = encryptedPassword.substring(4);
      return Buffer.from(encoded, 'base64').toString('utf8');
    } catch (error) {
      console.error('Password decryption error:', error);
      return encryptedPassword;
    }
  }

  return encryptedPassword;
};

/**
 * Mask sensitive fields in settings responses
 * Replaces passwords with placeholder values
 */
export const maskSensitiveSettings = (settings) => {
  if (!settings || typeof settings !== 'object') {
    return settings;
  }
  
  const masked = { ...settings };
  
  // Mask SMTP password
  if (masked.smtp && typeof masked.smtp === 'object') {
    if (masked.smtp.password && masked.smtp.password.trim()) {
      masked.smtp.password = '••••••';
    }
  }
  
  // Mask SMS OTP passwords
  if (masked.siteSettings && typeof masked.siteSettings === 'object') {
    if (masked.siteSettings.smsOtp && typeof masked.siteSettings.smsOtp === 'object') {
      if (masked.siteSettings.smsOtp.apiPassword && masked.siteSettings.smsOtp.apiPassword.trim()) {
        masked.siteSettings.smsOtp.apiPassword = '••••••';
      }
    }
  }
  
  // Mask payment gateway keys
  if (masked.siteSettings && typeof masked.siteSettings === 'object') {
    if (masked.siteSettings.paymentGateways && typeof masked.siteSettings.paymentGateways === 'object') {
      const gateways = masked.siteSettings.paymentGateways;
      
      // Mask Easebuzz keys
      if (gateways.easebuzz && typeof gateways.easebuzz === 'object') {
        if (gateways.easebuzz.key && gateways.easebuzz.key.trim()) {
          gateways.easebuzz.key = '••••••';
        }
        if (gateways.easebuzz.salt && gateways.easebuzz.salt.trim()) {
          gateways.easebuzz.salt = '••••••';
        }
      }
      
      // Mask PayU keys
      if (gateways.payu && typeof gateways.payu === 'object') {
        if (gateways.payu.merchantKey && gateways.payu.merchantKey.trim()) {
          gateways.payu.merchantKey = '••••••';
        }
        if (gateways.payu.merchantSalt && gateways.payu.merchantSalt.trim()) {
          gateways.payu.merchantSalt = '••••••';
        }
      }
      
      // Mask HDFC keys
      if (gateways.hdfc && typeof gateways.hdfc === 'object') {
        if (gateways.hdfc.accessCode && gateways.hdfc.accessCode.trim()) {
          gateways.hdfc.accessCode = '••••••';
        }
        if (gateways.hdfc.workingKey && gateways.hdfc.workingKey.trim()) {
          gateways.hdfc.workingKey = '••••••';
        }
      }
    }
  }
  
  return masked;
};

/**
 * Process incoming settings to handle password updates properly
 * Only updates password fields if a new value is provided (not placeholder)
 */
export const processIncomingSettings = (incoming, existing) => {
  if (!incoming || typeof incoming !== 'object') {
    return incoming;
  }
  
  const processed = { ...incoming };
  
  // Handle SMTP password
  if (processed.smtp && typeof processed.smtp === 'object') {
    const incomingPassword = processed.smtp.password;
    const existingPassword = existing?.smtp?.password;
    
    // If password is placeholder or empty, keep existing password
    if (!incomingPassword || incomingPassword === '••••••' || incomingPassword === '******') {
      if (existingPassword) {
        processed.smtp.password = existingPassword;
      } else {
        processed.smtp.password = '';
      }
    } else {
      // New password provided, encrypt it
      processed.smtp.password = encryptPassword(incomingPassword);
    }
  }
  
  // Handle SMS OTP password
  if (processed.siteSettings && typeof processed.siteSettings === 'object') {
    if (processed.siteSettings.smsOtp && typeof processed.siteSettings.smsOtp === 'object') {
      const incomingPassword = processed.siteSettings.smsOtp.apiPassword;
      const existingPassword = existing?.siteSettings?.smsOtp?.apiPassword;
      
      if (!incomingPassword || incomingPassword === '••••••' || incomingPassword === '******') {
        if (existingPassword) {
          processed.siteSettings.smsOtp.apiPassword = existingPassword;
        } else {
          processed.siteSettings.smsOtp.apiPassword = '';
        }
      } else {
        processed.siteSettings.smsOtp.apiPassword = encryptPassword(incomingPassword);
      }
    }

    if (processed.siteSettings.paymentGateways && typeof processed.siteSettings.paymentGateways === 'object') {
      const gateways = processed.siteSettings.paymentGateways;
      const existingGateways = existing?.siteSettings?.paymentGateways || {};
      const keepExistingSecret = (gateway, key) => {
        const incomingValue = gateways?.[gateway]?.[key];
        if (!gateways[gateway] || !(!incomingValue || incomingValue === '••••••' || incomingValue === '******')) return;
        if (existingGateways?.[gateway]?.[key]) {
          gateways[gateway][key] = existingGateways[gateway][key];
        } else {
          gateways[gateway][key] = '';
        }
      };
      keepExistingSecret('easebuzz', 'key');
      keepExistingSecret('easebuzz', 'salt');
      keepExistingSecret('payu', 'merchantKey');
      keepExistingSecret('payu', 'merchantSalt');
      keepExistingSecret('hdfc', 'accessCode');
      keepExistingSecret('hdfc', 'workingKey');
    }
  }
  
  return processed;
};

export default {
  sanitizeString,
  sanitizeEmail,
  sanitizePhone,
  sanitizeNumber,
  sanitizeBoolean,
  sanitizeUrl,
  sanitizeObject,
  sanitizeRequest,
  schemas,
  createRateLimiter,
  adminRateLimiter,
  loginRateLimiter,
  apiRateLimiter,
  encryptPassword,
  decryptPassword,
  maskSensitiveSettings,
  processIncomingSettings,
};
