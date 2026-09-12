import { Router } from 'itty-router';
import type { Env } from './types';
import { handleCorsPreflight, isOriginAllowed, applySecurityAndCorsHeaders } from './cors';
import { validateContactPayload } from './validation';
import { checkRateLimit } from './rateLimit';
import { getGoogleSheetsAccessToken } from './auth';
import { appendContactRow } from './sheets';

const router = Router();

// Max allowed JSON body size: 32 KB
const MAX_BODY_BYTES = 32 * 1024;

router.get('/', (_request: Request, env: Env) => {
	const destination = env.REDIRECT_URL;
	if (!destination) {
		return new Response(
			JSON.stringify({ success: false, error: 'REDIRECT_URL is not configured' }),
			{ status: 404, headers: { 'Content-Type': 'application/json' } }
		);
	}
	return Response.redirect(destination, 302);
});

router.post('/post', async (request: Request, env: Env) => {
	// 1. Content-Length / Request size enforcement
	const contentLength = request.headers.get('content-length');
	if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
		return new Response(
			JSON.stringify({ success: false, error: 'Payload exceeds maximum limit of 32KB' }),
			{ status: 413, headers: { 'Content-Type': 'application/json' } }
		);
	}

	// 2. Sliding window IP rate limiting
	const rateLimit = checkRateLimit(request, env);
	if (!rateLimit.allowed) {
		return new Response(
			JSON.stringify({
				success: false,
				error: 'Too many requests. Please wait a few minutes before submitting again.',
			}),
			{
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': String(rateLimit.resetSeconds),
				},
			}
		);
	}

	// 3. Parse & Validate Payload
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response(
			JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	const validation = validateContactPayload(body);
	if (!validation.valid || !validation.data) {
		return new Response(
			JSON.stringify({ success: false, error: validation.error }),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	// 4. Authenticate & Append to Google Sheets
	const accessToken = await getGoogleSheetsAccessToken(env);
	const appendResult = await appendContactRow(validation.data, accessToken, env);

	if (!appendResult.success) {
		return new Response(
			JSON.stringify({
				success: false,
				error: appendResult.error || 'Failed to record entry in Google Sheets',
			}),
			{
				status: appendResult.status || 500,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}

	// 5. Success Response
	return new Response(
		JSON.stringify({
			success: true,
			message: appendResult.data,
		}),
		{
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		}
	);
});

router.all('*', () => {
	return new Response(
		JSON.stringify({ success: false, error: 'Route not found' }),
		{ status: 404, headers: { 'Content-Type': 'application/json' } }
	);
});

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const origin = request.headers.get('Origin');

		// Handle preflight OPTIONS requests immediately
		if (request.method === 'OPTIONS') {
			return handleCorsPreflight(request, env);
		}

		// Reject cross-origin requests from disallowed origins
		if (origin && !isOriginAllowed(origin, env)) {
			return applySecurityAndCorsHeaders(
				new Response(JSON.stringify({ success: false, error: 'CORS origin not allowed' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' },
				}),
				request,
				env
			);
		}

		try {
			const response =
				(await router.handle(request, env)) ||
				new Response(JSON.stringify({ success: false, error: 'Route not found' }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' },
				});

			return applySecurityAndCorsHeaders(response, request, env);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Internal Server Error';
			const errorResponse = new Response(
				JSON.stringify({ success: false, error: message }),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}
			);
			return applySecurityAndCorsHeaders(errorResponse, request, env);
		}
	},
};
