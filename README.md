# SheetSync Cloud

[![Deploy with Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/shreyvarshney1/sheetsync-cloud)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![Vitest](https://img.shields.io/badge/Tested%20with-Vitest-6E9F18?logo=vitest)](https://vitest.dev/)

**SheetSync Cloud** is a high-performance, secure Cloudflare Worker that acts as a serverless backend proxy for the Google Sheets API (v4). It is purpose-built for portfolio contact forms, landing page subscriber lists, and static websites that need to write submissions directly to Google Sheets without exposing Google Cloud credentials, running dedicated servers, or risking formula injection vulnerabilities.

---

## Features

- **Serverless Google Sheets v4 Integration**: Appends contact and subscriber submissions directly to your designated Google Sheet using official Google OAuth 2.0 service account authentication.
- **OAuth Token In-Memory Caching**: Caches Google OAuth 2.0 access tokens in Worker memory for their 1-hour lifespan, reducing submission latency by ~300ms by eliminating redundant auth token requests.
- **Formula Injection (CSV Injection) Prevention**: Automatically sanitizes and neutralizes spreadsheet formula injection by prefixing inputs starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with a single quote (`'`).
- **Strict Environment-Driven CORS**: Enforces an origin whitelist (`ALLOWED_ORIGINS`) with legitimate subdomain matching (e.g. `*.pages.dev`). Localhost origins are strictly blocked by default in production.
- **Full Preflight (`OPTIONS`) Support**: Responds to HTTP `OPTIONS` requests with `204 No Content`, dynamic allowed origin matching, requested header reflection, and `86400` seconds (`Access-Control-Max-Age`) caching.
- **Sliding-Window IP Rate Limiting**: In-memory rate limiting based on client IP (`CF-Connecting-IP` / `X-Forwarded-For`) to prevent spam and protect your Google Sheets API quota (`429 Too Many Requests` with `Retry-After`).
- **Input Validation & Sanitization**: Enforces strict RFC 5322 email validation, strips dangerous ASCII/Unicode control characters, validates character length boundaries, and restricts request payload size to 32 KB.
- **Dual Timestamp Generation**: Automatically records UTC date and time alongside a customizable local timezone (default: UTC+5:30 / IST).
- **Configurable Root Redirect**: Directs root `GET /` requests to your frontend application using an HTTP `302 Found` redirect via `REDIRECT_URL`.
- **Fully Typed & Tested**: Built in TypeScript with comprehensive unit tests running on [Vitest](https://vitest.dev/).

---

## Spreadsheet Column Layout

When a submission is received at `/post`, the worker appends a single row to the configured sheet and range (`GOOGLE_SHEETS_SUBSCRIBERS_PAGE`, default `Sheet1!A2:G2`):

| Column | Field | Example Value | Description |
|:---:|:---|:---|:---|
| **A** | `name` | `Jane Doe` | Sender's full name (1–100 characters, sanitized) |
| **B** | `email` | `jane.doe@example.com` | Verified RFC 5322 email address (lowercased) |
| **C** | `subject` | `Project Inquiry` | Submission subject (1–200 characters, sanitized) |
| **D** | `message` | `Hello, I'd like to discuss...` | Body of the message (1–5000 characters, sanitized) |
| **E** | `Date` | `20/11/2026` | Date formatted as `DD/MM/YYYY` (UTC) |
| **F** | `UTC Time` | `14:24:35` | Timestamp formatted as `HH:MM:SS` (UTC) |
| **G** | `Local Time` | `19:54:35` | Timestamp formatted as `HH:MM:SS` (Configured local offset, default UTC+5:30) |

> [!NOTE]
> All user inputs in columns A–D are passed through `escapeFormula()` to neutralize formula execution before insertion into Google Sheets.

---

## Prerequisites & Setup

### 1. Google Cloud Service Account

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Enable the **Google Sheets API**:
   - Navigate to **APIs & Services** > **Library**.
   - Search for **Google Sheets API** and click **Enable**.
3. Create a **Service Account**:
   - Go to **IAM & Admin** > **Service Accounts**.
   - Click **Create Service Account** (e.g. `sheetsync-service-account`).
   - Role assignment is optional; click **Done**.
4. Generate and download a JSON key:
   - Click on your newly created service account > **Keys** tab > **Add Key** > **Create new key** > Choose **JSON**.
   - Save the downloaded JSON file locally (e.g. `service-account.json`). Note the `client_email` value.

### 2. Share Your Google Sheet

1. Create a new Google Sheet (or open an existing one).
2. Click the **Share** button in the upper-right corner.
3. Paste the **Service Account email** (`client_email` from your JSON key) and grant it the **Editor** role.
4. Copy the **Spreadsheet ID** from the browser URL:
   ```text
   https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
   ```

### 3. Convert RSA Private Key to JWK Format

The Worker uses the Web Crypto API via `@tsndr/cloudflare-worker-jwt`, requiring the RSA private key in JWK format. You can export it directly using Node.js's built-in `crypto` module without third-party tools:

```bash
node -e '
const fs = require("fs");
const crypto = require("crypto");
const sa = JSON.parse(fs.readFileSync("service-account.json", "utf8"));
const jwk = crypto.createPrivateKey(sa.private_key).export({ format: "jwk" });
console.log(JSON.stringify(jwk));
'
```

Copy the entire output JSON string. This will be the value for `GOOGLE_SHEETS_PRIVATE_KEY`.

---

## Configuration

### Environment Variables Reference

| Variable | Required | Default | Description |
|:---|:---:|:---:|:---|
| `GOOGLE_SHEETS_SERVICE_ACCOUNT` | **Yes** | — | Service Account email address (`...iam.gserviceaccount.com`). |
| `GOOGLE_SHEETS_PRIVATE_KEY` | **Yes** | — | RSA Private Key formatted as a JWK JSON string (`{"kty":"RSA",...}`). |
| `GOOGLE_SHEETS_SUBSCRIBERS_ID` | **Yes** | — | Google Spreadsheet ID extracted from the document URL. |
| `GOOGLE_SHEETS_SUBSCRIBERS_PAGE` | No | `Sheet1` | Sheet name and append range (e.g. `Sheet1` or `Sheet1!A2:G2`). |
| `ALLOWED_ORIGINS` | No | `""` | Comma-separated list of permitted origins (e.g. `https://example.com,https://app.pages.dev`). |
| `ALLOW_LOCALHOST` | No | `false` | Set to `true` to permit `http://localhost:*` and `http://127.0.0.1:*` during local development. |
| `REDIRECT_URL` | No | — | Target URL for HTTP 302 redirects when visitors hit `GET /`. |
| `MAX_REQUESTS_PER_WINDOW` | No | `5` | Maximum number of allowed requests per IP address within the rate-limit window. |
| `RATE_LIMIT_WINDOW_SECONDS` | No | `600` | Sliding window duration in seconds (600s = 10 minutes). |
| `TIMEZONE_OFFSET_HOURS` | No | `5.5` | Offset in hours from UTC for local time calculation (default `5.5` for IST). |

---

## Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/shreyvarshney1/sheetsync-cloud.git
   cd sheetsync-cloud
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Local Development

Create a `.dev.vars` file in the root directory for local Wrangler development:

```env
GOOGLE_SHEETS_SERVICE_ACCOUNT=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY={"kty":"RSA","n":"...","e":"AQAB","d":"..."}
GOOGLE_SHEETS_SUBSCRIBERS_ID=your_spreadsheet_id_here
GOOGLE_SHEETS_SUBSCRIBERS_PAGE=Sheet1!A2:G2
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
ALLOW_LOCALHOST=true
REDIRECT_URL=https://example.com
MAX_REQUESTS_PER_WINDOW=10
RATE_LIMIT_WINDOW_SECONDS=60
TIMEZONE_OFFSET_HOURS=5.5
```

Start the local development server:
```bash
npm run dev
```

### Type Checking & Testing

Run type checks and unit test suites:
```bash
# Typecheck TypeScript definitions
npm run typecheck

# Run Vitest test suite
npm test
```

### Deployment

Deploy directly to your Cloudflare Workers account using Wrangler:

```bash
npm run deploy
```

#### Configuring Production Secrets

For production environments, store sensitive credentials using Wrangler Secrets rather than committing plain text variables:

```bash
# Set Google Service Account Email
npx wrangler secret put GOOGLE_SHEETS_SERVICE_ACCOUNT

# Set RSA Private Key (paste the JWK string when prompted)
npx wrangler secret put GOOGLE_SHEETS_PRIVATE_KEY

# Set Spreadsheet ID
npx wrangler secret put GOOGLE_SHEETS_SUBSCRIBERS_ID
```

Set non-sensitive variables (such as `ALLOWED_ORIGINS`, `REDIRECT_URL`, `TIMEZONE_OFFSET_HOURS`) in `wrangler.toml` or via the Cloudflare dashboard.

---

## API Reference

### 1. Submit Form Entry

Appends a new contact or subscriber row to Google Sheets.

- **URL**: `/post`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Origin: <your-allowed-origin>`

#### Request Body Schema

```json
{
  "name": "Alex Smith",
  "email": "alex.smith@example.com",
  "subject": "Consulting Opportunity",
  "message": "Hi, I would love to talk about collaborating on a project."
}
```

| Field | Type | Validation Rules |
|:---|:---:|:---|
| `name` | `string` | **Required**. 1 to 100 characters. Trimmed and formula-escaped. |
| `email` | `string` | **Required**. Valid RFC 5322 format, 5 to 254 characters. Converted to lowercase. |
| `subject` | `string` | **Required**. 1 to 200 characters. Trimmed and formula-escaped. |
| `message` | `string` | **Required**. 1 to 5000 characters. Trimmed and formula-escaped. |

#### Responses

##### Success (`200 OK`)
```json
{
  "success": true,
  "message": "Success! Your Message has been recorded. I will get back to you soon."
}
```

##### Validation Error (`400 Bad Request`)
```json
{
  "success": false,
  "error": "A valid email address is required."
}
```

##### Forbidden Origin (`403 Forbidden`)
```json
{
  "success": false,
  "error": "CORS origin not allowed"
}
```

##### Payload Too Large (`413 Payload Too Large`)
```json
{
  "success": false,
  "error": "Payload exceeds maximum limit of 32KB"
}
```

##### Rate Limit Exceeded (`429 Too Many Requests`)
*Includes `Retry-After: <seconds>` header.*
```json
{
  "success": false,
  "error": "Too many requests. Please wait a few minutes before submitting again."
}
```

#### Example Usage

**cURL**:
```bash
curl -X POST https://your-worker-subdomain.workers.dev/post \
  -H "Content-Type: application/json" \
  -H "Origin: https://example.com" \
  -d '{
    "name": "Alex Smith",
    "email": "alex.smith@example.com",
    "subject": "Website Inquiry",
    "message": "Hello! I am reaching out regarding your portfolio."
  }'
```

**JavaScript / Fetch**:
```javascript
const response = await fetch('https://your-worker-subdomain.workers.dev/post', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Alex Smith',
    email: 'alex.smith@example.com',
    subject: 'Website Inquiry',
    message: 'Hello! I am reaching out regarding your portfolio.',
  }),
});

const result = await response.json();
if (response.ok) {
  console.log(result.message);
} else {
  console.error(result.error);
}
```

---

### 2. Root Redirect

- **URL**: `/`
- **Method**: `GET`
- **Behavior**: Returns `302 Found` redirecting to `env.REDIRECT_URL`. If `REDIRECT_URL` is unset, returns `404 Not Found`.

---

### 3. Preflight CORS Check

- **URL**: `/post` (or any route)
- **Method**: `OPTIONS`
- **Behavior**: Returns `204 No Content` with appropriate CORS response headers if the `Origin` header matches `ALLOWED_ORIGINS` (or allowed localhost in development), otherwise responds with `403 Forbidden`.

---

## Project Structure

```text
sheetsync-cloud/
├── src/
│   ├── index.ts        # Main worker entry point & route definitions
│   ├── auth.ts         # Google OAuth 2.0 JWT assertion & token caching
│   ├── cors.ts         # Strict CORS validation & security header injection
│   ├── rateLimit.ts    # Sliding-window in-memory IP rate limiter
│   ├── sheets.ts       # Google Sheets API v4 appending & timestamp formatting
│   ├── validation.ts   # Input validation, sanitization & formula escaping
│   └── types.ts        # TypeScript interfaces and environment types
├── test/
│   └── worker.test.ts  # Vitest test suite for CORS, security, and routes
├── .env.example        # Reference environment variables
├── package.json        # Dependencies, scripts, and project metadata
├── tsconfig.json       # TypeScript compiler configuration
├── wrangler.toml       # Cloudflare Workers configuration
├── LICENSE             # MIT License
├── README.md           # Project documentation
└── SECURITY.md         # Vulnerability reporting and security policy
```

---

## Security

Security is a primary focus of this project. For details regarding formula injection prevention, origin validation, rate limiting, and vulnerability disclosure policies, please consult [SECURITY.md](file:///home/shrey/projects/sheetsync-cloud/SECURITY.md).

---

## Contributing

Contributions, bug reports, and improvements are welcome! Please open an issue or submit a pull request on GitHub.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Ensure all tests and type checks pass (`npm run typecheck && npm test`)
4. Commit your changes (`git commit -m "feat: add feature"`)
5. Push to the branch (`git push origin feature/my-feature`)
6. Open a Pull Request

---

## License

This project is licensed under the [MIT License](file:///home/shrey/projects/sheetsync-cloud/LICENSE).
