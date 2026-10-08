// A6/D4.5: storageKey explícita 'vertice-diana-auth' en createClient.
import { AUTH_STORAGE_KEY } from './supabase';

describe('supabase client (A6)', () => {
  it('exporta la storageKey explícita vertice-diana-auth', () => {
    expect(AUTH_STORAGE_KEY).toBe('vertice-diana-auth');
  });

  it('la storageKey no coincide con la de Norte (vertice-norte-auth)', () => {
    expect(AUTH_STORAGE_KEY).not.toBe('vertice-norte-auth');
  });

  it('createClient usa la storageKey (fuente de verdad)', async () => {
    const src = require('fs').readFileSync(require('path').resolve(__dirname, 'supabase.ts'), 'utf8');
    expect(src).toContain('storageKey: AUTH_STORAGE_KEY');
  });
});
