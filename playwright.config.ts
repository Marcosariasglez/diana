import { defineConfig } from '@playwright/test';

// Suite E2E separada (VERTICE-NOCHE D-2): NO forma parte de `npm run verify`
// ni del CI de despliegue. Sirve dist/ (BACKEND=supabase, ver e2e/ensure-dist.mjs)
// y las llamadas HTTP de Supabase se simulan con page.route (e2e/supabaseMock.ts)
// con la misma forma que devuelve GoTrue/PostgREST de verdad.
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4319',
    viewport: { width: 390, height: 844 },
    colorScheme: 'light',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node e2e/server.mjs',
    url: 'http://127.0.0.1:4319/login',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
