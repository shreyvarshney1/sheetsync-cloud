import jwt from '@tsndr/cloudflare-worker-jwt';
import type { Env } from './types';

interface CachedToken {
	token: string;
	expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function parsePrivateKey(key: string): unknown {
	try {
		return JSON.parse(key);
	} catch {
		return key;
	}
}

/**
 * Generates an RS256-signed JWT assertion for Google OAuth 2.0.
 */
async function generateJwtAssertion(env: Env): Promise<string> {
	const iat = Math.floor(Date.now() / 1000);
	const exp = iat + 3600;

	if (!env.GOOGLE_SHEETS_SERVICE_ACCOUNT) {
		throw new Error('Missing environment variable: GOOGLE_SHEETS_SERVICE_ACCOUNT');
	}
	if (!env.GOOGLE_SHEETS_PRIVATE_KEY) {
		throw new Error('Missing environment variable: GOOGLE_SHEETS_PRIVATE_KEY');
	}

	const privateKey = parsePrivateKey(env.GOOGLE_SHEETS_PRIVATE_KEY);

	const token = await jwt.sign(
		{
			iss: env.GOOGLE_SHEETS_SERVICE_ACCOUNT,
			scope: 'https://www.googleapis.com/auth/spreadsheets',
			aud: 'https://accounts.google.com/o/oauth2/token',
			exp,
			iat,
		},
		privateKey as any,
		{ algorithm: 'RS256' }
	);

	return token;
}

/**
 * Obtains a Google OAuth access token, caching it in memory to avoid repeated network round-trips.
 */
export async function getGoogleSheetsAccessToken(env: Env): Promise<string> {
	const now = Math.floor(Date.now() / 1000);

	// Return cached token if valid for at least 5 more minutes
	if (cachedToken && cachedToken.expiresAt > now + 300) {
		return cachedToken.token;
	}

	const assertion = await generateJwtAssertion(env);

	const response = await fetch('https://accounts.google.com/o/oauth2/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Google OAuth error (${response.status}): ${errorText}`);
	}

	const data = (await response.json()) as { access_token: string; expires_in?: number };

	if (!data.access_token) {
		throw new Error('Failed to retrieve access token from Google OAuth response');
	}

	const expiresIn = data.expires_in || 3600;
	cachedToken = {
		token: data.access_token,
		expiresAt: now + expiresIn,
	};

	return cachedToken.token;
}
