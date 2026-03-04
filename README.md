## Okicom Salesforce Project

Since salesforce only allow HTTPS and AWS static web hosting doesn't allow HTTPS redirection. So, we need to deploy lambda function and create API Gateway and redirect HTTP to HTTPS.

## Deployment Lambda Function

1. Zip the project with the following command:
   ```
   npm install --omit=dev
   zip -r function.zip src package.json node_modules
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
   - Select "Permission" option
     - Select the execution role. Example: "okicom-test-salesforce-backend-role-thdk0tx1"
     - In "Permission" tab
       - Select "Add Permission" option
       - Select "Create Inline Policy" dropdown menu.
       - Select "JSON" tab
       - Paste the following permission:
         ```
         {
             "Version": "2012-10-17",
             "Statement": [
                 {
                 "Sid": "AllowBedrockInvoke",
                 "Effect": "Allow",
                 "Action": [
                     "bedrock:InvokeModel",
                     "bedrock:InvokeModelWithResponseStream"
                 ],
                 "Resource": "*"
                 }
             ]
         }
         ```
       - Set policy name as "BedrockInvokePolicy"
       - Click "Create" button

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

## Integrating "Direct" Application

In order to integrate "Direct" OAuth in our application, we need to register our application in "Direct". So, we will register our application in the following link:

```
https://direct4b.com/settings/home#/applications
```

Then generate client_id and client_secret and store in your environment variable as below:

```
DIRECT_CLIENT_ID="direct_client_id"
DIRECT_CLIENT_SECRET="direct_client_secret"
DIRECT_REDIRECT_URL="your_callback_route"
DIRECT_TOKEN_URL="direct_token_url"
DIRECT_LOGOUT_URL="direct_token_revoke"
```

For more guide you can study the following link:

```
https://directdev.feel-on.com/ja/api/id_guide.html#linkage
```

curl -v \
 -H "Authorization: Bearer 18f68f2cabc00000_4c221b9e68d110692b43ba98402111422eaefa5c" \
 -H "Accept: application/json" \
 "https://restapi-directdev.feel-on.com/albero-app-server/users/me/openIdConnect"
