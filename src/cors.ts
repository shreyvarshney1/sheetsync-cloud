import type { Env } from './types';

const LOCALHOST_PATTERNS = [
	/^http:\/\/localhost(:[0-9]+)?$/,
	/^http:\/\/127\.0\.0\.1(:[0-9]+)?$/,
];

/**
 * Checks whether an incoming Origin header is permitted.
 * Evaluates env.ALLOWED_ORIGINS (comma-separated list of allowed URLs).
 * Supports exact domain matching and legitimate subdomains (e.g. *.pages.dev).
 * Localhost is strictly blocked in production unless env.ALLOW_LOCALHOST === 'true'.
 */
export function isOriginAllowed(origin: string | null, env: Env): boolean {
	if (!origin) return false;
	const cleanOrigin = origin.trim().toLowerCase();

	if (env.ALLOWED_ORIGINS) {
		const configuredOrigins = env.ALLOWED_ORIGINS.split(',')
			.map(o => o.trim().toLowerCase())
			.filter(Boolean);

		for (const allowed of configuredOrigins) {
			if (cleanOrigin === allowed) return true;

			try {
				const allowedUrl = new URL(allowed);
				const cleanUrl = new URL(cleanOrigin);

				if (
					cleanUrl.protocol === allowedUrl.protocol &&
					(cleanUrl.hostname === allowedUrl.hostname ||
						cleanUrl.hostname.endsWith(`.${allowedUrl.hostname}`))
				) {
					return true;
				}
			} catch {
				// Ignore invalid URL formatting in env
			}
		}
	}

	// Localhost is only permitted when explicitly enabled via env
	if (env.ALLOW_LOCALHOST === 'true') {
		if (LOCALHOST_PATTERNS.some(pattern => pattern.test(cleanOrigin))) return true;
	}

	return false;
}

export function handleCorsPreflight(request: Request, env: Env): Response {
	const origin = request.headers.get('Origin');

	if (!isOriginAllowed(origin, env)) {
		return new Response('CORS origin not allowed', {
			status: 403,
			headers: { 'Content-Type': 'text/plain' },
		});
	}

	const requestHeaders =
		request.headers.get('Access-Control-Request-Headers') ||
		'Content-Type, Authorization, X-Requested-With';

	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': origin!,
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': requestHeaders,
			'Access-Control-Max-Age': '86400',
			'Vary': 'Origin',
		},
	});
}

export function applySecurityAndCorsHeaders(
	response: Response,
	request: Request,
	env: Env
): Response {
	const origin = request.headers.get('Origin');
	const headers = new Headers(response.headers);

	// Standard security headers
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('X-Frame-Options', 'DENY');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	// CORS headers
	if (origin && isOriginAllowed(origin, env)) {
		headers.set('Access-Control-Allow-Origin', origin);
		headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		headers.set('Vary', 'Origin');
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
