// Fixed values so the suite gives the same result with or without a local .env.
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SEPAY_WEBHOOK_API_KEY = 'test-webhook-key';
process.env.SEPAY_ALLOWED_ACCOUNT_NUMBERS = '0000000000';
process.env.GEMINI_API_KEY = '';
