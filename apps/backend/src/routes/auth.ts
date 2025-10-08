import { createHono } from '../lib/hono.js';
import { auth } from '../config/auth.js';

const authRouter = createHono();

// Debug route to test if router works
authRouter.get('/debug', (c) => {
  return c.json({ message: 'Auth router is working' });
});

// Better Auth handler for all methods
authRouter.on(['GET', 'POST'], '/*', async (c) => {
  console.log(`Auth handler called: ${c.req.method} ${c.req.url}`);
  console.log(`Path: ${c.req.path}`);
  console.log(`Headers:`, Object.fromEntries(c.req.raw.headers.entries()));

  try {
    console.log('Calling auth.handler with request...');
    const response = await auth.handler(c.req.raw);
    console.log(`Auth response status: ${response.status}`);

    // Log response headers for debugging
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    console.log('Auth response headers:', responseHeaders);

    // If it's a 404, let's see what the body contains
    if (response.status === 404) {
      const bodyText = await response.text();
      console.log('Auth 404 response body:', bodyText);
      // Return a new response since we consumed the body
      return new Response(bodyText, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    }

    return response;
  } catch (error) {
    console.error('Auth handler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Auth handler failed', details: errorMessage }, 500);
  }
});

export { authRouter };