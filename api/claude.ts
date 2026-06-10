// Vercel Edge Function: proxies requests to the Anthropic API so the API key
// never reaches the browser. Configure ANTHROPIC_API_KEY (no VITE_ prefix) in
// the deployment's environment variables.
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const body = await req.text()

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body,
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  })
}
