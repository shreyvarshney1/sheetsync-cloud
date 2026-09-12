import type { ContactPayload, Env, GoogleSheetsAppendResult } from './types';

/**
 * Formats timestamps for Google Sheets in both UTC and a configurable local timezone (default UTC+5:30).
 */
export function getFormattedTimestamps(
	now: Date = new Date(),
	timezoneOffsetHours: number = 5.5
): {
	date: string;
	utcTime: string;
	localTime: string;
	istTime: string;
} {
	const pad = (n: number) => String(n).padStart(2, '0');

	// UTC Date and Time
	const date = `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
	const utcTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

	// Local Timezone (default: UTC + 5:30)
	const localDate = new Date(now.getTime() + timezoneOffsetHours * 60 * 60 * 1000);
	const localTime = `${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}:${pad(localDate.getUTCSeconds())}`;

	return { date, utcTime, localTime, istTime: localTime };
}

/**
 * Appends a contact form row to the configured Google Sheet.
 */
export async function appendContactRow(
	payload: ContactPayload,
	accessToken: string,
	env: Env
): Promise<GoogleSheetsAppendResult> {
	if (!env.GOOGLE_SHEETS_SUBSCRIBERS_ID) {
		return {
			success: false,
			status: 500,
			error: 'Missing environment variable: GOOGLE_SHEETS_SUBSCRIBERS_ID',
		};
	}

	const sheetPage = env.GOOGLE_SHEETS_SUBSCRIBERS_PAGE || 'Sheet1';
	const timezoneOffset =
		env.TIMEZONE_OFFSET_HOURS !== undefined ? Number(env.TIMEZONE_OFFSET_HOURS) : 5.5;
	const { date, utcTime, localTime } = getFormattedTimestamps(new Date(), timezoneOffset);

	const rowValues = [
		payload.name,
		payload.email,
		payload.subject,
		payload.message,
		date,
		utcTime,
		localTime,
	];

	try {
		const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
			env.GOOGLE_SHEETS_SUBSCRIBERS_ID
		)}/values/${encodeURIComponent(sheetPage)}:append?valueInputOption=USER_ENTERED`;

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({
				range: sheetPage,
				majorDimension: 'ROWS',
				values: [rowValues],
			}),
		});

		if (response.ok) {
			return {
				success: true,
				status: 200,
				data: 'Success! Your Message has been recorded. I will get back to you soon.',
			};
		}

		const errorDetails = await response.text();
		return {
			success: false,
			status: response.status,
			error: `Google Sheets API error (${response.status}): ${errorDetails}`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			status: 500,
			error: message,
		};
	}
}
