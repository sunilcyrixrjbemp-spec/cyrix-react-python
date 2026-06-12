/**
 * Cloudflare Pages Function – Uploads Proxy
 * Forwards /uploads/* to the Workers backend to serve R2-stored files.
 */

const BACKEND_ORIGIN = 'https://sunil.sunilbishnoi.workers.dev';

interface CFContext {
  request: Request;
  params: { path?: string[] };
  env: Record<string, unknown>;
}

export async function onRequest(context: CFContext): Promise<Response> {
  const { request, params } = context;
  const pathSegments = (params.path || []).join('/');
  const incomingUrl = new URL(request.url);
  const targetUrl = `${BACKEND_ORIGIN}/uploads/${pathSegments}${incomingUrl.search}`;

  try {
    const backendResponse = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      redirect: 'follow',
    });

    const responseHeaders = new Headers(backendResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    // Cache uploaded images for 1 hour
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    return new Response(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response('File not found', { status: 404 });
  }
}
