import { Router } from 'itty-router';
import jwt from '@tsndr/cloudflare-worker-jwt';

const router = Router();

const validateString = value => {
	return Boolean(Number(value)) || value == 'true' || value == 'false';
};

const validateEmail = value => {
	// const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	// const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
	const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
	return typeof value === 'string' && emailRegex.test(value);
};

async function getJWTAccessToken(env) {
	const iat = Math.floor(Date.now() / 1000);
	const exp = iat + 3600;
	const jwtToken = jwt.sign(
		{
			iss: env.GOOGLE_SHEETS_SERVICE_ACCOUNT,
			scope: 'https://www.googleapis.com/auth/spreadsheets',
			aud: 'https://accounts.google.com/o/oauth2/token',
			exp,
			iat,
		},
		JSON.parse(env.GOOGLE_SHEETS_PRIVATE_KEY),
		{ algorithm: 'RS256' }
	);
	return jwtToken;
}

async function getGoogleSheetsAccessToken(env) {
	const jwtToken = await getJWTAccessToken(env);
	const response = await fetch('https://accounts.google.com/o/oauth2/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwtToken,
		}),
	}).then(response => response.json());
	return response.access_token;
}

async function addRow(payload, accessToken, env) {
	try {
		const response = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEETS_SUBSCRIBERS_ID}/values/${env.GOOGLE_SHEETS_SUBSCRIBERS_PAGE}:append?valueInputOption=USER_ENTERED`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${accessToken}`,
				},
				body: JSON.stringify({
					range: 'Sheet1!A2:F2',
					majorDimension: 'ROWS',
					values: [
						[
							payload.name,
							payload.email,
							payload.subject,
							payload.message,
							new Date().getDate() +
								'/' +
								(new Date().getMonth() + 1) +
								'/' +
								new Date().getFullYear(),
							new Date().getHours() + ':' + new Date().getMinutes() + ':' + new Date().getSeconds(),
						],
					],
				}),
			}
		);
		if (response.ok)
			return {
				data: 'Success! Your Message has been recorded. I will get back to you soon.',
				status: response.status,
			};
		else
			return {
				error: response.statusText,
				status: response.status,
			};
	} catch (error) {
		return {
			error: error,
		};
	}
}

router.get('/', () => {
	return Response.redirect('https://shreyvarshney.pages.dev', 302);
});

router.post('/post', async (request, env) => {
	const data = await request.json();
    if(!validateEmail(data.email) || validateString(data.name) || validateString(data.subject) || validateString(data.message)){
        return new Response('Invalid Input', { status: 400 });
    }
	const accessToken = await getGoogleSheetsAccessToken(env);
	const response = await addRow(data, accessToken, env);
	if (response === null || typeof response === 'undefined') {
		return new Response('Error adding row to Google Sheets', { status: 500 });
	}
	return new Response(response.data, { status: response.status });
});

export default {
	async fetch(request, env) {
		const response = await router.handle(request, env);
		response.headers.set('Access-Control-Allow-Origin', '*');
		response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
		return response;
	},
};
