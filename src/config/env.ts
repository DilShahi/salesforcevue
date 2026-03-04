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
  direct: {
    clientId: __DIRECT_CLIENT_ID__.trim(),
    clientSecret: __DIRECT_CLIENT_SECRET__.trim(),
    redirectUrl: __DIRECT_REDIRECT_URL__.trim(),
    restApi: __DIRECT_REST_API__.trim(),
    scopes: __DIRECT_SCOPES__.trim(),
  },
}
