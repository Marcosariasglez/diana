# ESTADO DEL PROYECTO VERTICE · Diana

> Actualizado 2026-10-08T15:34:00Z. Ejecución D2→D3 completa.

## Línea base de pruebas

```
Test Suites: 62 passed, 62 total
Tests:       364 passed, 364 total
```

**Auditoría de estilos:** 0 problemas.

## Tabla de fases D0 → D6

| Fase | Estado | Hecho | Evidencia |
|------|--------|-------|-----------|
| **D0 · Red de seguridad** | ✅ Hecho | git limpio, verify línea base, capturas "antes" | 10 PNG + informe.json |
| **D1 · Tokens y tema** | ✅ Hecho | tokens.ts, ThemeProvider, useTheme, appearance v2, fuentes estáticas, typography.ts X3, shadows.ts, colors.ts BORRADO | grep theme/colors=0, grep hex=0 |
| **D2 · Componentes al contrato** | ✅ Hecho | Button(ink), Card(r24), FabButton(58), BottomNav(88,ink), SegmentedControl(ink), nuevos: ListRow, ProfileCard, TextField, ConfirmSheet, GoogleButton | verify 62/364, auditoría 0 |
| **D3 · Perfil + Cuenta** | ✅ Hecho | profile.tsx reestructurado (ProfileCard, métricas, historial, Apariencia, Cuenta), account.tsx (correo, apariencia, cerrar sesión, borrar), delete-account reescrita (datos Diana solo), authMessages.ts, routes actualizadas | verify 62/364, auditoría 0 |
| **D4 · Login A4** | ⬜ Pendiente | — | — |
| **D5 · Endurecimiento** | ⬜ Pendiente | — | — |
| **D6 · Documentación** | ⬜ Pendiente | — | — |

## Pendiente

1. D4 · Login A4 (rehacer login.tsx con GoogleButton, código 6 dígitos, enfriamiento 30s)
2. D5 · Endurecimiento (rls, service_role, keepalive)
3. D6 · Documentación (README.md, capturas, paridad A8, build:web)
