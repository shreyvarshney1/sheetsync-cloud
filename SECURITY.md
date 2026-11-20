# Security Policy

The `sheetsync-cloud` project takes the security of its serverless applications, user data, and integration endpoints seriously. This document outlines our supported versions, built-in security architecture, vulnerability disclosure guidelines, and reporting procedures.

---

## Supported Versions

Security updates and patches are actively maintained for the following versions:

| Version | Supported | Notes |
|:---|:---:|:---|
| `1.x` | :white_check_mark: | Current active release branch |
| `< 1.0.0` | :x: | Legacy versions; please upgrade to the latest 1.x release |

---

## Security Architecture & Defenses

`sheetsync-cloud` is designed as a secure gateway between public web clients and Google Sheets. The codebase implements multiple defense-in-depth security layers:

### 1. Spreadsheet Formula Injection (CSV Injection) Prevention
*Implementation: `src/validation.ts` (`escapeFormula`)*
- Google Sheets treats cells starting with characters like `=`, `+`, `-`, or `@` as formulas or commands, which could trigger formula execution or malicious external data exfiltration (`HYPERLINK`, `IMPORTDATA`).
- All user-supplied text fields (`name`, `email`, `subject`, `message`) are evaluated. Any value beginning with `=+\-@\t\r` is automatically prefixed with a single quote (`'`), ensuring the spreadsheet engine renders it strictly as plain text.

### 2. Strict Origin Whitelisting & CORS Isolation
*Implementation: `src/cors.ts` (`isOriginAllowed`, `handleCorsPreflight`, `applySecurityAndCorsHeaders`)*
- Wildcard origins (`*`) are prohibited. Access is restricted to origins explicitly configured in `env.ALLOWED_ORIGINS`.
- Legitimate subdomains (e.g. `preview.my-app.pages.dev` matching `my-app.pages.dev`) are safely evaluated without being susceptible to domain suffix spoofing attacks.
- Localhost origins (`http://localhost:*`, `http://127.0.0.1:*`) are strictly blocked in production and can only be enabled during development by explicitly setting `ALLOW_LOCALHOST=true`.
- Cross-origin preflight requests (`OPTIONS`) are validated before returning `204 No Content`, and unauthorized origins receive an explicit `403 Forbidden`.

### 3. Sliding-Window Rate Limiting
*Implementation: `src/rateLimit.ts` (`checkRateLimit`)*
- An in-memory sliding window rate limiter protects endpoints from automated submission spam, denial-of-wallet, and Google API quota exhaustion.
- Client identification uses Cloudflare's trusted `CF-Connecting-IP` header (falling back to `X-Forwarded-For`).
- Rate limits are configurable via `MAX_REQUESTS_PER_WINDOW` and `RATE_LIMIT_WINDOW_SECONDS` (default: 5 requests per 10-minute window). Requests exceeding thresholds receive `429 Too Many Requests` along with a standard `Retry-After` header.

### 4. Input Sanitization & Payload Size Enforcement
*Implementation: `src/index.ts`, `src/validation.ts` (`validateContactPayload`, `sanitizeString`)*
- **Payload Size Ceilings**: Enforces a strict 32 KB maximum payload limit (`MAX_BODY_BYTES`) before parsing JSON, mitigating memory exhaustion and JSON parsing attacks (`413 Payload Too Large`).
- **Control Character Stripping**: Removes dangerous non-printable ASCII/Unicode control characters (`\u0000-\u0008`, `\u000B`, `\u000C`, `\u000E-\u001F`, `\u007F`).
- **Strict Boundary Checks**: Enforces character length constraints on all fields (`name`: 1–100, `email`: 5–254, `subject`: 1–200, `message`: 1–5000).
- **Email Validation**: Validates syntax against practical RFC 5322 specifications.

### 5. Secure Credential Handling & Ephemeral Token Storage
*Implementation: `src/auth.ts` (`getGoogleSheetsAccessToken`, `generateJwtAssertion`)*
- The Google Sheets Service Account private key is stored securely in Cloudflare Worker environment secrets and is never exposed to the client or returned in API responses.
- Short-lived Google OAuth 2.0 access tokens are generated via RS256 JWT assertions and cached strictly in Worker memory for their 1-hour validity period, eliminating persistent storage exposure.

### 6. Standard HTTP Security Headers
*Implementation: `src/cors.ts` (`applySecurityAndCorsHeaders`)*
- All responses include protective security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`

---

## Reporting a Vulnerability

If you discover a security vulnerability in `sheetsync-cloud`, please report it responsibly so we can remediate the issue promptly.

### How to Report

Please **do not** report security vulnerabilities via public GitHub issues, discussions, or pull requests.

Instead, please send an email to:
**[shreyvarshney1@gmail.com](mailto:shreyvarshney1@gmail.com)**

Please include:
1. **Subject**: `[SECURITY] sheetsync-cloud Vulnerability Report - <Brief Summary>`
2. **Component/Module**: The file, endpoint, or function affected (e.g. `src/cors.ts`, `src/validation.ts`).
3. **Description**: A comprehensive description of the vulnerability and its potential impact.
4. **Steps to Reproduce / Proof of Concept**: Clear, step-by-step instructions or minimal reproduction scripts/payloads.
5. **Mitigation Suggestion**: Any recommended remediations or code patches (if available).

### Response SLAs

When a vulnerability report is submitted, we commit to the following response timeline:

- **Initial Response & Confirmation**: Within **48 hours** of receiving the report.
- **Triage & Assessment**: Within **5 business days**, confirming severity and status.
- **Remediation & Patch**: Timeline agreed upon with the reporter based on complexity and severity (typically within 14–30 days).

---

## Scope

### In Scope
- Vulnerabilities in worker routing, authentication, or OAuth assertion logic (`src/auth.ts`, `src/index.ts`).
- Bypass of origin verification or CORS security protections (`src/cors.ts`).
- Bypass or evasion of formula injection neutralization (`src/validation.ts`).
- Flaws in input sanitization or rate limiting leading to abuse, injection, or denial of service (`src/rateLimit.ts`).
- Credential leakage or improper handling of secrets.

### Out of Scope
- Attacks requiring physical access to the user's unlocked device or compromised local environment.
- Distributed denial-of-service (DDoS) against Cloudflare edge infrastructure (mitigated by Cloudflare's network).
- Service outages, quota exhaustion, or downtime stemming from Google Cloud Platform or Cloudflare upstream services.
- Vulnerabilities in third-party development tools (e.g. local Node.js or test runners) unless directly exploitable in production deployment.
- Social engineering or phishing targeting repository maintainers.

---

## Responsible Disclosure & Safe Harbor

We strongly support responsible and coordinated security disclosure:

- Please provide reasonable time for us to investigate and resolve reported issues before disclosing details publicly.
- Do not access, modify, or destroy user data or spreadsheets that do not belong to you during testing.
- If you conduct security research in good faith in accordance with this policy, we will not pursue legal action against you.

Thank you for helping keep `sheetsync-cloud` and its users secure!
