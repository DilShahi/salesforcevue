# Backend (API Gateway + Lambda)

This backend provides the production `/api/*` endpoints used by the frontend:

- `POST /api/auth/salesforce/token`
- `POST /api/auth/salesforce/refresh`
- `POST /api/salesforce/request`
- `POST /api/bedrock/events-summary`

## Prerequisites

- AWS CLI configured (`aws configure`)
- AWS SAM CLI installed
- Node.js 20+

## Install

```bash
cd backend
npm install
```

## Build + Deploy (SAM)

```bash
sam build
sam deploy --guided
```

During `--guided`, provide values for all template parameters.

Important ones:

- `FrontendOrigin`: your frontend domain, e.g. `https://d285cc6tcbx9xj.cloudfront.net`
- `SalesforceRedirectUri`: e.g. `https://d285cc6tcbx9xj.cloudfront.net/oauth/callback`
- `BedrockModelId`: e.g. `jp.anthropic.claude-sonnet-4-5-20250929-v1:0`

If Lambda role already has Bedrock access, you can leave `AwsAccessKeyId` / `AwsSecretAccessKey` empty.

## Connect Frontend

Set frontend production env:

```env
VITE_API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com
```

Then build + deploy frontend.

## Notes

- CORS is controlled by `FrontendOrigin` env var.
- This backend mirrors the logic previously implemented in `vite.config.ts` middleware.
