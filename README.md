# Google Sheets API on Cloudflare Workers

[![Deploy with Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/)

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
   git clone https://github.com/shreyvarshney1/googlesheets-api.git
   cd googlesheets-api
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
   ```

   Replace the placeholder values with your actual Google Sheets Service Account information and RSA public key converted to a JWK token.
   ### Note: Your RSA Public Key provided by Google Looks like:
   ```
   -----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----
   ```
   ### Change it to JWK string before adding to `.env`

4. Deploy the Cloudflare Worker:

   ```bash
   wrangler publish
   ```

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