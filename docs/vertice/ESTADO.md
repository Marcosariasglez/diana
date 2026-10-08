# ESTADO DEL PROYECTO VERTICE · Diana

> Actualizado 2026-10-08T20:52+02:00. Ejecución continua D0→D6 completada (todo aprobado por el dueño).
> **Plan VERTICE terminado.** Quedan solo los pasos de producción del dueño (abajo).

## Último verify (tras D6)

```
Test Suites: 72 passed, 72 total
Tests:       417 passed, 417 total
```

**Auditoría de estilos:** `✓ Auditoría de estilos: todo limpio.` (0 problemas)

## Tabla de fases D0 → D6

| Fase | Estado | Hecho | Evidencia |
|------|--------|-------|-----------|
| **D0 · Red de seguridad** | ✅ Hecho | git limpio, verify línea base, capturas "antes" | 10 PNG + informe.json; línea base: 62 suites/364 tests |
| **D1 · Tokens y tema** | ✅ Hecho | tokens.ts, ThemeProvider, useTheme, appearance v2, fuentes estáticas, typography.ts X3, shadows.ts, colors.ts BORRADO, ESLint anti-hex | grep theme/colors=0; lint 0 warnings |
| **D2 · Componentes al contrato** | ✅ Hecho | Button(ink), Card(r24+sombra), FabButton(58,acc,40%), BottomNav(88,card 92% blur16,ink,FAB+16), SegmentedControl(ink/onInk), Pill/Chip/Toast/BottomSheet, nuevos ListRow/ProfileCard/TextField/ConfirmSheet(frase)/GoogleButton con pruebas, pantallas X5 (títulos 28/800, secciones 19/800+acc, insignias accSoft+acc, posters 20/24, swipe 54, sala pad24) | verify 67/381; auditoría 0 |
| **D3 · Perfil + Cuenta** | ✅ Hecho | account.tsx A5 completa (correo, nombre máx40, exportMyData, cerrar 1/todos, borrar con frase + everywhere), useAuthStore con códigos A4 + signOutEverywhere, storageKey vertice-diana-auth, migración 0005 delete_user_data, profile.tsx con displayName + pie, «Reiniciar prototipo» fuera de producción | verify 72/417; auditoría 0 |
| **D4 · Login A4** | ✅ Hecho | login.tsx A4 (logotipo 56, Google, separador, correo, código 6 one-time-code, reenviar 30s, cambiar correo, errores literales de authMessages, pie legal) + 12 pruebas por estado | verify 72/417; auditoría 0 |
| **D5 · Endurecimiento** | ✅ Hecho | rls-check ampliado (initial_ratings, watched, profiles, delete_user_data), `npm run scan:secrets` (242 ficheros, dist incluido), keepalive → consulta anon a Postgres, seguridad.md actualizado | scan:secrets OK; rls ampliado pasa tras `db push` 0005 |
| **D6 · Documentación** | ✅ Hecho | README.md nuevo; PROGRESS/BACKEND_PROGRESS/IMPLEMENTATION_STATUS marcados históricos; **fuentes estáticas corregidas** (las 7 TTF estaban corruptas = HTML; regeneradas con fontTools: `npm run fonts`); capturas "después" 390×844 claro+oscuro de login/inicio/mood/match/perfil/cuenta; **paridad.md** (A8 + X6 punto a punto, comparado contra `referencia/`); build:web de producción; cifras tabulares X3 completadas | 12 PNG + informe.json; paridad A8 marcado; verify 72/417 |

## Pendiente

**Nada del plan.** El plan VERTICE (D0→D6) está terminado.

## Pendientes del dueño (no tocan producción)

- `npx supabase db push` (migración 0005 `delete_user_data`) — con copia de seguridad previa
- `npx supabase functions deploy delete-account --project-ref hvjmewokgxgrshtzhdjq` (primero en proyecto de pruebas) + `npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` si no está
- Re-ejecutar `npm run rls` en producción (ahora incluye initial_ratings, watched, profiles y delete_user_data)
- Supabase: Redirect URLs reales + plantillas «Magic Link»/«Confirm signup» con `{{ .Token }}` + SMTP propio
- Prueba real en iPhone/PWA (guion D5 de la Parte C): Google + código por correo, cerrar en todos, exportar, borrar (verificar en BD)
