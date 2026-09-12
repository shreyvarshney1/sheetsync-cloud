import type { ContactPayload, ValidationResult } from './types';

// RFC 5322 compliant regex for practical email validation
const EMAIL_REGEX =
	/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Control characters (excluding standard whitespace \t, \n, \r)
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Formula injection trigger characters
const FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/;

/**
 * Escapes strings to prevent Google Sheets Formula Injection.
 * Prefixes strings starting with formula trigger characters with a single quote (').
 */
export function escapeFormula(value: string): string {
	if (FORMULA_PREFIX_REGEX.test(value)) {
		return `'${value}`;
	}
	return value;
}

/**
 * Strips dangerous control characters and trims leading/trailing whitespace.
 */
export function sanitizeString(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.replace(CONTROL_CHARS_REGEX, '').trim();
}

/**
 * Validates and sanitizes incoming contact submission data.
 */
export function validateContactPayload(raw: unknown): ValidationResult {
	if (!raw || typeof raw !== 'object') {
		return { valid: false, error: 'Invalid payload format. Expected JSON object.' };
	}

	const body = raw as Record<string, unknown>;

	const name = sanitizeString(body.name);
	const email = sanitizeString(body.email).toLowerCase();
	const subject = sanitizeString(body.subject);
	const message = sanitizeString(body.message);

	// Validate Name
	if (!name || name.length < 1 || name.length > 100) {
		return {
			valid: false,
			error: 'Name is required and must be between 1 and 100 characters.',
		};
	}

	// Validate Email
	if (!email || email.length < 5 || email.length > 254 || !EMAIL_REGEX.test(email)) {
		return {
			valid: false,
			error: 'A valid email address is required.',
		};
	}

	// Validate Subject
	if (!subject || subject.length < 1 || subject.length > 200) {
		return {
			valid: false,
			error: 'Subject is required and must be between 1 and 200 characters.',
		};
	}

	// Validate Message
	if (!message || message.length < 1 || message.length > 5000) {
		return {
			valid: false,
			error: 'Message is required and must be between 1 and 5000 characters.',
		};
	}

	const sanitizedPayload: ContactPayload = {
		name: escapeFormula(name),
		email: escapeFormula(email),
		subject: escapeFormula(subject),
		message: escapeFormula(message),
	};

	return {
		valid: true,
		data: sanitizedPayload,
	};
}
