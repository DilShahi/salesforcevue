# Okicom Salesforce Project

Since salesforce only allow HTTPS and AWS static web hosting doesn't allow HTTPS redirection. So, we need to deploy lambda function and create API Gateway and redirect HTTP to HTTPS.

## Deployment Lambda Function

1. Zip the project with the following command:
   ```
   npm install --omit=dev zip -r function.zip src package.json node_modules
   ```
2. First we will create lambda function with following configuration:
   - Set function name
   - Runtime : nodejs20.x
   - Architecture: arm64
3. Upload the zip file of the project
4. Setup Handler
   - Go to "Code" tab
   - Scroll down to "Runtime Settings"
   - Click "Edit" button
   - Set handler as "src/handler.handler"
   - Click "Save" button
5. Go to "Configuration" tab
   - Select "General Configuration" option
     - Set memory "1024 MB"
     - Set Ephemeral Storage "512 MB"
     - Timeout: 15 min
   - Select "Environment Variables" option
     - AWS_BUCKET
     - AWS_USE_PATH_STYLE_ENDPOINT
     - BEDROCK_CHUNK_SIZE
     - BEDROCK_CONNECT_TIMEOUT
     - BEDROCK_MAX_EVENTS
     - BEDROCK_MAX_PROMPT_CHARS
     - BEDROCK_MAX_TOKENS
     - BEDROCK_RETRIES
     - BEDROCK_TEMPERATURE
     - BEDROCK_TOP_K
     - FRONTEND_ORIGIN
     - SF_ALIAS_NAME
     - SF_CLIENT_ID
     - SF_CLIENT_SECRET
     - SF_LOGIN_URL
     - SF_REDIRECT_URI
     - SF_SCOPES

## Gateway API Creation

1. Create API
   1. Configure API
      - Set API Name
      - IP Address type as IPv4
      - Integrations
        - Select "Lambda" option
        - Set "AWS Region" as "ap-northeast-1"
        - Set "Lambda Function" as "your-lambda-function-you-created"
        - Click "Next"
   2. Configure Routes
      - Set "Method" as "ANY"
      - Set "Resource path" as "/api/{proxy+}"
      - Set "Integration target" as "your-last-created-lambda-function"
   3. Define stages
      - Set "Stage name" as "$default"
      - Set 'Auto-deploy' as "True"
   4. Click "Create" button
2. Configure "CORS"
   - Select the create "API Gateway"
   - Select "CORS" tab
   - Click "Configure" button:
     - Set "Access-Control-Allow-Origin" as "your-frontend-url"
     - Set "Access-Control-Allow-Headers" as "content-type" and "authorization"
     - Set "Access-Control-Allow-Methods" as "GET", "POST" and "OPTIONS"
     - Click "Save" button
