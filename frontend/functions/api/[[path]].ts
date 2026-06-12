/**
 * Cloudflare Pages Function – API Reverse Proxy
 * Forwards all /api/* requests to the live Cloudflare Workers backend.
 */

const BACKEND_ORIGIN = 'https://sunil.sunilbishnoi.workers.dev';

interface CFContext {
  request: Request;
  params: { path?: string[] };
  env: Record<string, unknown>;
}

export async function onRequest(context: CFContext): Promise<Response> {
  const { request, params } = context;

  // Handle CORS pre-flight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Build the target URL
  const pathSegments = (params.path || []).join('/');
  const incomingUrl = new URL(request.url);
  const targetUrl = `${BACKEND_ORIGIN}/api/${pathSegments}${incomingUrl.search}`;

  // Forward headers (strip host to avoid issues)
  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete('host');
  forwardHeaders.set('X-Forwarded-For', request.headers.get('cf-connecting-ip') || '');

  // Build the proxied request
  const proxyInit: RequestInit = {
    method: request.method,
    headers: forwardHeaders,
    redirect: 'follow',
  };

  // Attach body for non-GET/HEAD requests
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    proxyInit.body = request.body;
    // @ts-ignore – Cloudflare Workers support duplex
    proxyInit.duplex = 'half';
  }

  try {
    const backendResponse = await fetch(targetUrl, proxyInit);

    // Clone the response and add permissive CORS headers
    const responseHeaders = new Headers(backendResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return new Response(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: 'Backend unreachable: ' + (err?.message || 'unknown error') }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
