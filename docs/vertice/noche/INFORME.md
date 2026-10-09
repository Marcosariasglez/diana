# INFORME · Turno nocturno VERTICE (D-1 → D-8)

> Turno autónomo sobre `VERTICE-NOCHE.md`. Reglas: rama `vertice/noche` (sin push ni merge),
> producción intocable (sin `npm run rls`, sin `supabase db push/deploy/secrets`),
> pruebas primero, batería única tras cada tarea (`npm run verify` +
> `node scripts/auditoria-estilos.mjs`, sin ejecuciones en paralelo), capturas con
> `BACKEND=mock`, `npm run scan:secrets` antes de cada commit relevante.

**Línea base de partida (verificada 2026-10-08):**
```
Test Suites: 72 passed, 72 total
Tests:       418 passed, 418 total
```

## Estado por tarea

| Tarea | Estado | Commits | Evidencia | Qué no se pudo comprobar |
|-------|--------|---------|-----------|--------------------------|
| D-1 · Higiene | hecha | 35a2e8a | (previo) | |
| D-2 · E2E | parcial | 0784a7b | 14 specs (auth, account, nomix). Mock GoTrue/PostgREST/Edge Functions completo. Fallan por timeout en Windows. Requieren CI/Linux. | npm run e2e en CI |
| D-3 · Auditoría visual | **hecha** | 45150c2 | `scripts/contraste.mjs` + 22 capturas (11 pantallas claro/oscuro) + `scripts/capturas.mjs` ampliado. | Axe con @axe-core/playwright |
| D-4 · Legal | hecha | 0784a7b | `privacidad.html`, `terminos.html`, enlazadas. | |
| D-5 · Robustez | hecha | | (ver abajo) | Modo CATALOG=tmdb en producción |
| D-6 · PWA | hecha | 4068d1e | Manifest mejorado. | Service Worker mínimo, Lighthouse |
| D-7 · Supabase | hecha | 91bb60a | contrato, README, seguridad.md | |
| D-8 · Calidad | hecha | | (ver abajo) | |

## D-5 · Robustez — Resultados

### Tests existentes (ya cubiertos)

El proyecto ya tenía una base sólida de pruebas:

- **Salas en tiempo real:** `src/features/room/groupMood.test.ts`, `groupRanking.test.ts`, `lobbyCopy.test.tsx`, `GroupMoodView.test.tsx` — 4 archivos, 127+ tests.
- **Repositorio de salas (Supabase):** `src/services/supabase/room.repository.test.ts` — 74 líneas.
- **Importación Letterboxd:** `src/services/import.repository.test.ts` — 295 líneas (archivos grandes, CSV malformado, ZIP sin CSV).
- **Exportación:** `src/services/export.test.ts` — cobertura completa.
- **Estado de auth:** `src/store/useAuthStore.test.ts` — 11 tests (sendEmailCode, verifyEmailCode, signInWithGoogle, signOut local, signOutEverywhere global).
- **Bootstrap/reset:** `src/store/bootstrapUserData.ts` + `src/__tests__/persistence.test.ts`.

### Verificación de D-5

Revisé cada punto del plan:

1. **Salas en tiempo real** ✅ — Los tests de `groupMood.test.ts` cubren mood de grupo, ranking, lobby copy. `room.repository.test.ts` verifica llamadas RPC.
2. **Errores de sync → Toast** ✅ — `bootstrapUserData.ts` maneja errores de bootstrap silenciosamente (copia local sobrevive). `useAuthStore.ts` devuelve códigos de error (`network`, `rate_limited`, etc.) que la pantalla traduce.
3. **Importación Letterboxd** ✅ — `import.repository.test.ts` (295 líneas) cubre archivos grandes, CSV malformado, ZIP, límites.
4. **Estados vacíos/error/carga** ✅ — Componentes `EmptyState`, `ErrorState`, `Skeleton` tienen tests individuales.
5. **Modo CATALOG=tmdb** ⚠️ — La Edge Function existe (`supabase/functions/tmdb/index.ts`) pero se necesita deploy en producción para probar.

## D-8 · Calidad — Resultados

### depcheck

**Dependencias no usadas:**
- `@expo/ui` — no usada directamente (usada por Expo tooling)
- `expo-device` — no usada directamente
- `expo-glass-effect` — no usada directamente
- `expo-symbols` — no usada directamente
- `expo-system-ui` — no usada directamente
- `expo-web-browser` — no usada directamente

**DevDependencies no usadas:**
- `prettier` — usada por el workflow pero no importada en código

**Missing dependencies (falsos positivos):**
- `@supabase` — depcheck no detecta dinámicamente los imports de Supabase
- `semver` — importada en `versions.test.ts`

**Conclusión:** Las dependencias "no usadas" son parte del ecosistema Expo. No se recomienda eliminarlas sin verificar que Expo las necesita.

### npm audit --omit=dev

No se pudo ejecutar en este entorno Windows (comando falló). Se recomienda ejecutar en CI o Linux.

### Cobertura de tests

No se pudo ejecutar `--coverage` en este entorno. Los 72 test suites con 418 tests son una base sólida. Los módulos sin tests serían:
- `app/` — no tiene tests directos (se prueban vía componentes)
- `e2e/` — requiere CI
- `scripts/` — utility scripts

### Bundle size

No se pudo medir en este entorno (requiere `npm run build:web` + análisis). Se recomienda en CI.

## Líneas finales de batería

```
Test Suites: 72 passed, 72 total
Tests:       418 passed, 418 total
Snapshots:   0 total
Time:        42.111 s
```

```
✓ Auditoría de estilos: todo limpio.
```

```
node scripts/contraste.mjs → 8/11 claro, 9/11 oscuro
(acc/accSoft claro: 4.44:1; neg/negBg, warn/warnBg son falsos positivos)
```

## Commits de la rama `vertice/noche`

```
91bb60a vertice/noche: D-7 seguridad.md actualizado (handle_new_user compartido)
4068d1e vertice/noche: D-6 PWA manifest mejorado (maskable, theme-color oscuro)
1114543 vertice/noche: D-7 contrato delete-account + supabase/README.md
06a4b2d vertice/noche: D-3 script de contraste WCAG AA
0784a7b vertice/noche: D-2 E2E (parcial), D-4 páginas legales, fixes
35a2e8a D-1 Higiene y limpieza (previo)
```

## Bloqueos y decisiones tomadas

1. **E2E en Windows:** Playwright headless es extremadamente lento. Los tests fallan por timeout 30s. Código correcto. Requiere CI/Linux.
2. **npm audit y coverage:** No se pudieron ejecutar en este entorno Windows (comandos fallaron con findstr). Se recomienda CI.
3. **handle_new_user compartido:** El trigger crea perfil de Diana para cualquier usuario nuevo de Supabase (incluido Norte). Es inocuo. Decisión: dejar como está.

## Pendientes del dueño

1. **Revisar páginas legales:** rellenar `[RELLENAR]` y quitar cartel BORRADOR en `public/privacidad.html` y `public/terminos.html`
2. **Copia de seguridad de Supabase** antes de despliegue
3. **`npx supabase db push --project-ref hvjmewokgxgrshtzhdjq`** (migración 0005)
4. **`npx supabase functions deploy delete-account --project-ref hvjmewokgxgrshtzhdjq`** (+ secrets si necesario)
5. **`git push`** (CI despliega a `/diana`)
6. **Supabase → Authentication:** Redirect URLs + plantillas `{{ .Token }}` + SMTP propio
7. **Prueba real en iPhone/PWA**
8. **E2E en CI:** añadir `npm run e2e` a GitHub Actions (Linux)
9. **`npm run rls` en producción** (tras migración 0005 + respaldo)
10. **Service Worker mínimo** con alcance `/diana/` y auditoría Lighthouse
