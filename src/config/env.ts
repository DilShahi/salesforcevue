export const ENV = {
  appName: import.meta.env.VITE_APP_NAME || 'Salesforce Vue',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  salesforce: {
    loginUrl: __SF_LOGIN_URL__.trim(),
    clientId: __SF_CLIENT_ID__.trim(),
    redirectUri: __SF_REDIRECT_URI__.trim(),
    scopes: __SF_SCOPES__.trim(),
    aliasName: __SF_ALIAS_NAME__.trim(),
  },
}
