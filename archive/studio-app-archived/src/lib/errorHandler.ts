/**
 * Global error handler to prevent infinite recursion in Next.js error overlay
 * This catches errors before they reach Next.js's error handler which can cause recursion
 */

let errorHandlerInstalled = false;

export function installGlobalErrorHandler() {
  if (errorHandlerInstalled || typeof window === 'undefined') {
    return;
  }

  errorHandlerInstalled = true;

  // Prevent infinite recursion in error handling
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    try {
      // Check for circular references that could cause recursion
      const stringified = JSON.stringify(args, (key, value) => {
        if (key === 'stack' || key === 'cause') {
          return undefined; // Skip stack traces to prevent recursion
        }
        return value;
      });
      originalConsoleError(...args);
    } catch (e) {
      // If stringification fails (circular reference), just log a simple message
      originalConsoleError('Error (circular reference detected):', args[0]?.message || 'Unknown error');
    }
  };

  // Catch unhandled errors and prevent recursion
  window.addEventListener('error', (event) => {
    // Prevent the error from propagating if it's a recursion error
    if (event.error?.message?.includes('too much recursion') || 
        event.error?.message?.includes('Maximum call stack')) {
      event.preventDefault();
      console.warn('Recursion error caught and prevented:', event.error?.message);
      return false;
    }
  }, true);

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('too much recursion') ||
        event.reason?.message?.includes('Maximum call stack')) {
      event.preventDefault();
      console.warn('Recursion error in promise caught and prevented:', event.reason?.message);
      return false;
    }
  });
}

