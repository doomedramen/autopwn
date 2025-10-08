import { toNextJsHandler } from "better-auth/next-js";

// Create a simple auth handler that proxies to the backend
const handler = async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/auth', '');
  
  // Forward the request to the backend auth service
  const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth${path}`;
  
  const response = await fetch(backendUrl, {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers.entries()),
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
    },
    body: request.method !== 'GET' ? await request.text() : undefined,
  });

  // Forward the response back to the client
  const responseBody = await response.text();
  
  return new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

export const GET = handler;
export const POST = handler;