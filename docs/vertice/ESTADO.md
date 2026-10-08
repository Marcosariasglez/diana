# ESTADO DEL PROYECTO VERTICE · Diana

> Actualizado 2026-10-08. Ejecución continua D0→D6 (todo aprobado por el dueño).

## Último verify (tras D2)

```
Test Suites: 67 passed, 67 total
Tests:       381 passed, 381 total
```

**Auditoría de estilos:** `✓ Auditoría de estilos: todo limpio.` (0 problemas)

## Tabla de fases D0 → D6

| Fase | Estado | Hecho | Evidencia |
|------|--------|-------|-----------|
| **D0 · Red de seguridad** | ✅ Hecho | git limpio, verify línea base, capturas "antes" | 10 PNG + informe.json; línea base: 62 suites/364 tests |
| **D1 · Tokens y tema** | ✅ Hecho | tokens.ts, ThemeProvider, useTheme, appearance v2, fuentes estáticas, typography.ts X3, shadows.ts, colors.ts BORRADO, ESLint anti-hex | grep theme/colors=0; lint 0 warnings |
| **D2 · Componentes al contrato** | ✅ Hecho | Button(ink), Card(r24+sombra), FabButton(58,acc,40%), BottomNav(88,card 92% blur16,ink,FAB+16), SegmentedControl(ink/onInk), Pill/Chip/Toast/BottomSheet al contrato, nuevos ListRow/ProfileCard/TextField/ConfirmSheet(frase exacta)/GoogleButton con pruebas, pantallas X5 (títulos 28/800, secciones 19/800+acc, insignias accSoft+acc, posters 20/24, swipe 54, sala pad24) | verify 67/381; auditoría 0 |
| **D3 · Perfil + Cuenta** | ⬜ En curso | — | — |
| **D4 · Login A4** | ⬜ Pendiente | — | — |
| **D5 · Endurecimiento** | ⬜ Pendiente | — | — |
| **D6 · Documentación** | ⬜ Pendiente | — | — |

## Pendiente

1. D3 · Perfil + Cuenta (account.tsx A5, exportMyData, delete-account 0005, signOutEverywhere)
2. D4 · Login A4 (códigos authMessages, pruebas por estado)
3. D5 · Endurecimiento (rls ampliado, service_role, keepalive)
4. D6 · Documentación (README, paridad A8, capturas después, build:web)

## Pendientes del dueño (no tocan producción)

- `npx supabase db push` (migración 0005 `delete_user_data`) — antes de desplegar la función
- `npx supabase functions deploy delete-account --project-ref hvjmewokgxgrshtzhdjq` (primero en proyecto de pruebas)
- Plantillas de email «Magic Link» y «Confirm signup» con `{{ .Token }}` + SMTP propio (Resend/Brevo)
- Prueba real en iPhone/PWA (guion D5 de la Parte C)
