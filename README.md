# SheetSync Cloud (Google Sheets API on Cloudflare Workers)

[![Deploy with Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/shreyvarshney1/sheetsync-cloud)

This project leverages Cloudflare Workers and Google Sheets API to handle POST requests from users, authenticate using environment variables, and interact with Google Sheets. The application is designed to create a JWT token with a private key obtained from the specified Google Sheets service account. The token is then used to authenticate requests to the Google Sheets API, allowing appending and editing of the specified Google Sheet based on the provided subscriber ID and subscribers' page.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following:

- [Node.js](https://nodejs.org/) installed
- [Wrangler](https://developers.cloudflare.com/workers/cli-wrangler/install-update) installed
- Access to a Google Sheets Service Account
- Google Sheets API credentials (service account email, private key, etc.)
- RSA public key converted to a JWK token and stored as a string

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

3. Configure environment variables:

   Create a `.env` file at the root of your project with the following variables:

   ```env
   GOOGLE_SHEETS_SERVICE_ACCOUNT=your-service-account-email@your-project.iam.gserviceaccount.com
   GOOGLE_SHEETS_PRIVATE_KEY=your-rsa-public-key-jwk-as-string
   GOOGLE_SHEETS_SUBSCRIBERS_ID=your-spreadsheet-id
   GOOGLE_SHEETS_SUBSCRIBERS_PAGE=your-subscribers-page
   # Optional configurations:
   # ALLOWED_ORIGINS=https://example.com,https://another.com
   # ALLOW_LOCALHOST=true   # Disabled by default in production for security
   # MAX_REQUESTS_PER_WINDOW=5
   # RATE_LIMIT_WINDOW_SECONDS=600
   ```

   Replace the placeholder values with your actual Google Sheets Service Account information and RSA key.

4. Run tests and type checks:

   ```bash
   npm run typecheck
   npm test
   ```

5. Deploy the Cloudflare Worker:

   ```bash
   npm run deploy
   ```

## Security & Features

- **Strict Environment-Driven CORS**: Only origins explicitly configured in `ALLOWED_ORIGINS` are permitted. Localhost is strictly blocked in production unless explicitly enabled via `ALLOW_LOCALHOST=true`.
- **Preflight (OPTIONS) Support**: Returns 204 No Content with proper `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Max-Age` headers.
- **Formula Injection Prevention**: Automatically escapes input starting with `=`, `+`, `-`, or `@` to prevent Google Sheets CSV/formula injection.
- **Sliding Window Rate Limiting**: Protects your API quota and spreadsheet from automated abuse and spam.
- **OAuth Token In-Memory Caching**: Caches Google OAuth 2.0 access tokens for their 1-hour lifespan, reducing submission latency by ~300ms.
- **Size & Format Validation**: Enforces strict RFC email validation, payload size limits (32KB max), and sanitized text fields.

## Usage

### API Endpoint

Once the Cloudflare Worker is deployed, the API endpoint for handling POST requests will be available. You can find this endpoint in your Cloudflare Workers dashboard.

### Making a POST Request

To append or edit the Google Sheet, send a POST request to the API endpoint with the required data. The request payload should contain the necessary information for appending/editing in the Google Sheets API format.

Example using `curl`:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"data": "your-data-here"}' https://your-cloudflare-worker-url.com/endpoint
```

## Security

Ensure that your environment variables and Google Sheets credentials are kept secure. Avoid sharing sensitive information publicly.

## Contributing

Feel free to contribute to the project by creating issues or submitting pull requests. Your contributions are highly appreciated.

## License

This project is licensed under the [MIT License](LICENSE).
