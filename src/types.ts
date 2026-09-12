export interface Env {
	GOOGLE_SHEETS_SERVICE_ACCOUNT: string;
	GOOGLE_SHEETS_PRIVATE_KEY: string;
	GOOGLE_SHEETS_SUBSCRIBERS_ID: string;
	GOOGLE_SHEETS_SUBSCRIBERS_PAGE: string;
	ALLOWED_ORIGINS?: string;
	REDIRECT_URL?: string;
	ALLOW_LOCALHOST?: string;
	MAX_REQUESTS_PER_WINDOW?: string;
	RATE_LIMIT_WINDOW_SECONDS?: string;
	TIMEZONE_OFFSET_HOURS?: string;
}

export interface ContactPayload {
	name: string;
	email: string;
	subject: string;
	message: string;
}

export interface ValidationResult {
	valid: boolean;
	data?: ContactPayload;
	error?: string;
}

export interface GoogleSheetsAppendResult {
	success: boolean;
	data?: string;
	error?: string;
	status: number;
}
