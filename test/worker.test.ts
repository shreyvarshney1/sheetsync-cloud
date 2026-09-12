import { describe, it, expect } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';
import { validateContactPayload, escapeFormula } from '../src/validation';
import { isOriginAllowed } from '../src/cors';

const mockEnv: Env = {
	GOOGLE_SHEETS_SERVICE_ACCOUNT: 'service-account@test-project.iam.gserviceaccount.com',
	GOOGLE_SHEETS_PRIVATE_KEY: '{"kty":"RSA"}',
	GOOGLE_SHEETS_SUBSCRIBERS_ID: 'mock_spreadsheet_id',
	GOOGLE_SHEETS_SUBSCRIBERS_PAGE: 'Sheet1!A2:G2',
	ALLOWED_ORIGINS: 'https://example.com,https://my-app.pages.dev',
	REDIRECT_URL: 'https://example.com',
};

describe('CORS and Origin Whitelisting', () => {
	it('allows verified domains from env.ALLOWED_ORIGINS and their subdomains', () => {
		expect(isOriginAllowed('https://example.com', mockEnv)).toBe(true);
		expect(isOriginAllowed('https://subdomain.example.com', mockEnv)).toBe(true);
		expect(isOriginAllowed('https://my-app.pages.dev', mockEnv)).toBe(true);
		expect(isOriginAllowed('https://preview-123.my-app.pages.dev', mockEnv)).toBe(true);
	});

	it('disallows all origins if ALLOWED_ORIGINS is not configured', () => {
		const emptyEnv: Env = {
			GOOGLE_SHEETS_SERVICE_ACCOUNT: 'service-account@test-project.iam.gserviceaccount.com',
			GOOGLE_SHEETS_PRIVATE_KEY: '{"kty":"RSA"}',
			GOOGLE_SHEETS_SUBSCRIBERS_ID: 'mock_spreadsheet_id',
			GOOGLE_SHEETS_SUBSCRIBERS_PAGE: 'Sheet1!A2:G2',
		};
		expect(isOriginAllowed('https://example.com', emptyEnv)).toBe(false);
	});

	it('strictly blocks localhost by default in production', () => {
		expect(isOriginAllowed('http://localhost:3000', mockEnv)).toBe(false);
		expect(isOriginAllowed('http://127.0.0.1:3000', mockEnv)).toBe(false);
	});

	it('allows localhost only when ALLOW_LOCALHOST is true', () => {
		const devEnv: Env = { ...mockEnv, ALLOW_LOCALHOST: 'true' };
		expect(isOriginAllowed('http://localhost:3000', devEnv)).toBe(true);
		expect(isOriginAllowed('http://127.0.0.1:5173', devEnv)).toBe(true);
	});

	it('allows custom domains configured in env.ALLOWED_ORIGINS', () => {
		const customEnv: Env = {
			...mockEnv,
			ALLOWED_ORIGINS: 'https://custom-site.org,https://another-domain.net',
		};
		expect(isOriginAllowed('https://custom-site.org', customEnv)).toBe(true);
		expect(isOriginAllowed('https://another-domain.net', customEnv)).toBe(true);
		expect(isOriginAllowed('https://unlisted.com', customEnv)).toBe(false);
	});

	it('blocks unauthorized third-party domains and domain suffix spoofing', () => {
		expect(isOriginAllowed('https://malicious.site', mockEnv)).toBe(false);
		expect(isOriginAllowed('https://fake-my-app.pages.dev.attacker.com', mockEnv)).toBe(false);
		expect(isOriginAllowed('https://example.com.attacker.com', mockEnv)).toBe(false);
	});

	it('handles preflight OPTIONS request for allowed origins', async () => {
		const request = new Request('https://worker.dev/post', {
			method: 'OPTIONS',
			headers: {
				Origin: 'https://example.com',
				'Access-Control-Request-Method': 'POST',
				'Access-Control-Request-Headers': 'Content-Type',
			},
		});

		const response = await worker.fetch(request, mockEnv);
		expect(response.status).toBe(204);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
		expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
		expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
	});

	it('rejects preflight OPTIONS for unauthorized origins with 403', async () => {
		const request = new Request('https://worker.dev/post', {
			method: 'OPTIONS',
			headers: {
				Origin: 'https://unauthorized.org',
			},
		});

		const response = await worker.fetch(request, mockEnv);
		expect(response.status).toBe(403);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
	});
});

describe('Input Validation & Security', () => {
	it('neutralizes spreadsheet formula injection', () => {
		expect(escapeFormula('=1+1')).toBe("'=1+1");
		expect(escapeFormula('+cmd|')).toBe("'+cmd|");
		expect(escapeFormula('-200')).toBe("'-200");
		expect(escapeFormula('@user')).toBe("'@user");
		expect(escapeFormula('Normal text')).toBe('Normal text');
	});

	it('validates required fields and valid email format', () => {
		const invalidEmail = validateContactPayload({
			name: 'Alice',
			email: 'not-an-email',
			subject: 'Hi',
			message: 'Hello!',
		});
		expect(invalidEmail.valid).toBe(false);

		const missingName = validateContactPayload({
			name: '',
			email: 'alice@example.com',
			subject: 'Hi',
			message: 'Hello!',
		});
		expect(missingName.valid).toBe(false);

		const valid = validateContactPayload({
			name: '  Alice Doe  ',
			email: 'alice@example.com',
			subject: 'Inquiry',
			message: 'I want to collaborate.',
		});
		expect(valid.valid).toBe(true);
		expect(valid.data?.name).toBe('Alice Doe');
		expect(valid.data?.email).toBe('alice@example.com');
	});

	it('enforces payload size limit (>32KB)', async () => {
		const largeString = 'a'.repeat(35000);
		const request = new Request('https://worker.dev/post', {
			method: 'POST',
			headers: {
				'Content-Length': String(largeString.length),
				Origin: 'https://example.com',
			},
			body: JSON.stringify({ message: largeString }),
		});

		const response = await worker.fetch(request, mockEnv);
		expect(response.status).toBe(413);
		const json = (await response.json()) as { success: boolean; error: string };
		expect(json.success).toBe(false);
	});
});

describe('Routing & Lifecycle', () => {
	it('redirects GET / to env.REDIRECT_URL', async () => {
		const request = new Request('https://worker.dev/', { method: 'GET' });
		const response = await worker.fetch(request, mockEnv);
		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toContain('https://example.com');
	});

	it('returns 404 on GET / if env.REDIRECT_URL is not configured', async () => {
		const noRedirectEnv: Env = { ...mockEnv, REDIRECT_URL: undefined };
		const request = new Request('https://worker.dev/', { method: 'GET' });
		const response = await worker.fetch(request, noRedirectEnv);
		expect(response.status).toBe(404);
	});

	it('returns 404 for undefined routes with CORS headers', async () => {
		const request = new Request('https://worker.dev/unknown', {
			method: 'GET',
			headers: { Origin: 'https://example.com' },
		});
		const response = await worker.fetch(request, mockEnv);
		expect(response.status).toBe(404);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
	});

	it('triggers rate limiting after exceeding max requests threshold', async () => {
		const limitedEnv: Env = {
			...mockEnv,
			MAX_REQUESTS_PER_WINDOW: '2',
			RATE_LIMIT_WINDOW_SECONDS: '60',
		};

		const makeReq = () =>
			new Request('https://worker.dev/post', {
				method: 'POST',
				headers: {
					'cf-connecting-ip': '203.0.113.195',
					Origin: 'https://example.com',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: 'bad' }),
			});

		const res1 = await worker.fetch(makeReq(), limitedEnv);
		expect(res1.status).toBe(400); // Fails validation, but passed rate limiter

		const res2 = await worker.fetch(makeReq(), limitedEnv);
		expect(res2.status).toBe(400); // 2nd request

		const res3 = await worker.fetch(makeReq(), limitedEnv);
		expect(res3.status).toBe(429); // 3rd request blocked by rate limiter!
		expect(res3.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
	});
});
