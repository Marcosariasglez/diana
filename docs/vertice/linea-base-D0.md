# Línea base D0 — Diana VERTICE

> Capturada: 2026-10-08 12:00 UTC
> Comando: `cd diana-tmp && npm run verify`

## Resultado

```
Test Suites: 1 failed, 61 passed, 62 total
Tests:       2 failed, 362 passed, 364 total
```

## Fallos preexistentes

### 1. `src/__tests__/persistence.test.ts` — perfil por defecto
- **Motivo:** `createDefaultProfile()` incluye `disney-plus` en `favoritePlatforms`, pero la prueba espera solo `['netflix', 'prime-video', 'max']`.
- **No es culpa de VERTICE:** fallo preexistente antes de cualquier cambio.
- **Fichero:** `src/__tests__/persistence.test.ts:54`

### 2. `src/__tests__/persistence.test.ts` — segundo test del mismo suite
- **Motivo:** mismo fallo de plataforma `disney-plus`.

### lobbyCopy.test.tsx — timeout (intermitente)
- En D0.1 falló con timeout de 5000 ms. En la ejecución actual pasó.
- Es intermitente en CI lento.

## Diagnóstico D0

- **Node:** v24.13.0
- **Colors sueltos:** ~28 hits en `app/` + `src/components/`
- **Imports de COLORS:** 52 archivos (B0 del README dice 51)
- **`.gitignore`:** `.env*.local` incluido ✓
- **Capturas:** 10 capturas antes/después en `docs/vertice/capturas/antes/`
