// Global Error Handler Middleware
export const errorHandler = (err, _req, res, _next) => {
  void _next;
  console.error('[Error]', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
