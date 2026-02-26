# salesforcevue

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

## Environment Variables

Create your local env from the template and update values:

```sh
cp .env.example .env.local
```

Available variables:

- `VITE_APP_NAME`
- `VITE_API_BASE_URL`
- `SF_LOGIN_URL`
- `SF_CLIENT_ID`
- `SF_CLIENT_SECRET`
- `SF_REDIRECT_URI`
- `SF_SCOPES`
- `SF_ALIAS_NAME`

In Vue code, use:

```ts
import.meta.env.VITE_APP_NAME
import.meta.env.VITE_API_BASE_URL
```

`Sign In` uses Salesforce OAuth authorize endpoint built from:
`SF_LOGIN_URL`, `SF_CLIENT_ID`, `SF_REDIRECT_URI`, `SF_SCOPES`, `SF_ALIAS_NAME`.
`SF_CLIENT_SECRET` is intentionally not exposed in client-side code.

After Salesforce redirects back with `?code=...&state=...`, router middleware exchanges the code at
`/api/auth/salesforce/token` and stores the session in localStorage key:
`salesforce_oauth_session`.

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Run End-to-End Tests with [Cypress](https://www.cypress.io/)

```sh
npm run test:e2e:dev
```

This runs the end-to-end tests against the Vite development server.
It is much faster than the production build.

But it's still recommended to test the production build with `test:e2e` before deploying (e.g. in CI environments):

```sh
npm run build
npm run test:e2e
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
