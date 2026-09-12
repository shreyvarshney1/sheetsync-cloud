import type { Env } from './types';

interface RateLimitRecord {
	timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();

const DEFAULT_WINDOW_SECONDS = 600; // 10 minutes
const DEFAULT_MAX_REQUESTS = 5;

/**
 * Periodically purge stale entries from memory.
 */
function cleanupExpiredEntries(now: number, windowMs: number): void {
	if (rateLimitMap.size > 5000) {
		for (const [ip, record] of rateLimitMap.entries()) {
			const valid = record.timestamps.filter(ts => now - ts < windowMs);
			if (valid.length === 0) {
				rateLimitMap.delete(ip);
			} else {
				record.timestamps = valid;
			}
		}
	}
}

/**
 * Sliding window IP rate limiter.
 */
export function checkRateLimit(
	request: Request,
	env: Env
): { allowed: boolean; remaining: number; resetSeconds: number } {
	const ip =
		request.headers.get('cf-connecting-ip') ||
		request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
		'anonymous';

	const windowSeconds = Number(env.RATE_LIMIT_WINDOW_SECONDS) || DEFAULT_WINDOW_SECONDS;
	const maxRequests = Number(env.MAX_REQUESTS_PER_WINDOW) || DEFAULT_MAX_REQUESTS;
	const windowMs = windowSeconds * 1000;
	const now = Date.now();

	cleanupExpiredEntries(now, windowMs);

	let record = rateLimitMap.get(ip);
	if (!record) {
		record = { timestamps: [] };
		rateLimitMap.set(ip, record);
	}

	// Filter timestamps within the current sliding window
	record.timestamps = record.timestamps.filter(ts => now - ts < windowMs);

	if (record.timestamps.length >= maxRequests) {
		const oldestTimestamp = record.timestamps[0];
		const resetSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));
		return {
			allowed: false,
			remaining: 0,
			resetSeconds,
		};
	}

	record.timestamps.push(now);
	return {
		allowed: true,
		remaining: maxRequests - record.timestamps.length,
		resetSeconds: windowSeconds,
	};
}
