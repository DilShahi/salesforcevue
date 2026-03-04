import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue(), vueJsx(), vueDevTools(), tailwindcss()],
    define: {
      __SF_LOGIN_URL__: JSON.stringify(env.SF_LOGIN_URL ?? ''),
      __SF_CLIENT_ID__: JSON.stringify(env.SF_CLIENT_ID ?? ''),
      __SF_REDIRECT_URI__: JSON.stringify(env.SF_REDIRECT_URI ?? ''),
      __SF_SCOPES__: JSON.stringify(env.SF_SCOPES ?? ''),
      __SF_ALIAS_NAME__: JSON.stringify(env.SF_ALIAS_NAME ?? ''),
      __DIRECT_CLIENT_ID__: JSON.stringify(env.DIRECT_CLIENT_ID ?? ''),
      __DIRECT_CLIENT_SECRET__: JSON.stringify(env.DIRECT_CLIENT_SECRET ?? ''),
      __DIRECT_REDIRECT_URL__: JSON.stringify(env.DIRECT_REDIRECT_URL ?? ''),
      __DIRECT_REST_API__: JSON.stringify(env.DIRECT_REST_API ?? ''),
      __DIRECT_SCOPES__: JSON.stringify(env.DIRECT_SCOPES ?? 'openid offline_access profile email'),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
