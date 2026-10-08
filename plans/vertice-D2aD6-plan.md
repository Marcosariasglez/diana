# Plan VERTICE Diana · Fases D2 a D6

> Generado 2026-10-08. Estado actual: D0 ✅ D1 ⚠️ (pending: ESLint anti-hex, auditoria, fontWeight audit).
> Objetivo: Ejecutar D2→D6 sin parar.

## Estado verificado

| Item | Valor |
|------|-------|
| Test Suites | 62 passed, 62 total |
| Tests | 364 passed, 364 total |
| tokens.ts | ✅ Con light/dark paletas A3.1 |
| ThemeProvider + useTheme + useThemedStyles | ✅ |
| useSettingsStore v2 | ✅ appearance persistido |
| typography.ts X3 | ✅ Familias estáticas |
| colors.ts | ✅ BORRADO |
| auditoria-estilos.mjs | ✅ Existe (pendiente ejecutar) |
| ESLint anti-hex | ❌ Pendiente |

---

## D2 · Componentes al contrato (A3.4 + Anexo X2)

### D2.1 · Button
- Variantes: `primary` (ink/onInk), `secondary` (chip/ink), `google` (card + borde lineStrong + G), `destructive` (neg, transparent bg)
- minHeight 52, borderRadius 99
- padding 16 primary, 12 secondary
- disabled: bg=chip, fg=mut
- loading: ActivityIndicator en color fg
- Actualizar Button.test.tsx

### D2.2 · Card
- borderRadius 24
- padding: 6 vertical × 16 horizontal (filas), variante lg = 24
- sombra: shadow en claro, ninguna en oscuro
- sin borde en oscuro
- Card.test.tsx

### D2.3 · FabButton
- 58×58, fondo acc, icono onAcc
- sombra: `0 8px 20px color-mix(acc 40%, transparent)`
- Actualizar FabButton.test.tsx

### D2.4 · BottomNav
- Alto 88 + zona segura inferior
- Fondo: card 92% con blur 16 (expo-glass-effect o backdrop-filter web)
- borde superior 1px line
- pestaña activa: ink, inactiva: mut
- etiqueta 10.5/600
- FAB: margin-top -16 (sobresalto)
- BottomNav.test.tsx

### D2.5 · SegmentedControl
- pista: chip, borderRadius 99
- padding 3, gap 2
- opción inactiva: mut 14/600
- activa: bg ink, fg onInk
- variante sm: 13/600
- SegmentedControl.test.tsx

### D2.6 · Chip/Pill/PillGroup
- píldora 99
- neutro: card con sombra
- activo: ink/onInk
- insignia positiva: accSoft + acc

### D2.7 · Toast
- píldora ink/onInk
- error: icono neg

### D2.8 · BottomSheet
- bg, borderRadius 32 arriba
- asa: 40×5 line
- overlay: overlay color con blur 3

### D2.9-D2.13 · Nuevos componentes

**ListRow**
- minHeight 44
- icono/avatar 42 left
- texto título 15/600 + subtítulo 12.5/500 mut
- valor right
- separador 1px line entre filas

**ProfileCard**
- avatar 56 circle, bg ink, inicial onInk 800 22
- nombre 18/800
- línea secundaria 13 mut
- gap 14

**TextField**
- minHeight 52, borderRadius 16
- bg card, borde lineStrong 1px
- foco: borde acc 2px
- error: borde neg + mensaje neg 13
- texto Inter 16

**ConfirmSheet**
- BottomSheet con título 20/800
- texto 14.5 mut
- dos botones (destructive right)
- campo frase escrita para acciones irreversibles
- validación exacta de frase

**GoogleButton**
- píldora, bg card, borde lineStrong 1px
- logo G oficial a color (imagen SVG)
- "Continuar con Google" ink 16/600
- alto 52

### D2.14 · Pantallas de cine
Revisar con tabla X5:
- Inicio: cabecera, chips filtro, tarjeta Top, carril horizontal, Ver todo acc
- Mood: tarjetas con filas, selección ink/onInk, barra progreso
- Match: filas con póster, insignias
- Detalle: póster 24, mini-tarjetas, segmentos
- Onboarding: sin colores sueltos
- Salas: código tarjeta pad24, filas miembros

### D2.15 · Verificación
- npm run verify
- node scripts/auditoria-estilos.mjs → 0 problemas
- commit

---

## D3 · Perfil y Cuenta

### D3.1 · profile.tsx
Estructura:
1. Cabecera "Perfil" 28/800
2. ProfileCard (avatar, nombre, correo)
3. Métricas: "Vistas" / "Tu nota media" (mini-tarjetas rejilla)
4. "Importa tu historial" (tarjeta pad24)
5. "Historial" (tarjeta con filas)
6. Grupo "Aplicación": Apariencia (SegmentedControl), Reducir movimiento
7. Grupo "Cuenta": fila que abre /account
8. Pie: versión, enlaces legales, "Una app de VERTICE"

### D3.2 · app/account.tsx
Filas A5:
- Correo (solo lectura)
- Nombre (editable inline, máx 40)
- Apariencia (segmentos Claro/Oscuro/Auto)
- Exportar mis datos
- Cerrar sesión
- Cerrar sesión en todos los dispositivos
- Borrar mi cuenta
- Legales

### D3.3 · exportMyData()
- Lee profiles, initial_ratings, history_entries, watched (RLS)
- JSON { app: 'diana', exportedAt, user: { id, email }, ... }
- Web: Blob + enlace descarga
- Nativo: expo-file-system + expo-sharing
- Nombre: diana-mis-datos-AAAA-MM-DD.json

### D3.4 · signOut
- useAuthStore.signOut() llama resetLocalStores()
- Navega a /login
- Limpia AsyncStorage

### D3.5 · signOutEverywhere
- supabase.auth.signOut({ scope: 'global' })
- Confirmación

### D3.6 · delete-account Edge Function
NUEVA versión:
- Borra solo datos de Diana: history_entries, initial_ratings, watched, room_members, rooms (host_id), profiles
- Transacción SQL
- SOLO borra user de Auth si { everywhere: true }
- Valida JWT con service_role

### D3.7 · UI borrar cuenta
- ConfirmSheet con frase "BORRAR MI CUENTA"
- Enlace "Borrar también mi acceso a todas las apps de VERTICE"

### D3.8 · Modo mock
- Muestra "Modo demostración"
- Oculta cerrar sesión, borrar, exportar remoto

### D3.9 · Quitar "Reiniciar prototipo"
- `__DEV__` o borrar

### D3.10 · Pruebas
- Mocks para account screen
- exportMyData formato JSON
- delete-account con service_role simulado

---

## D4 · Login A4

### Estructura
1. Logo 56 + nombre 32/800 + subtítulo mut 15
2. GoogleButton
3. Separador
4. Input correo (autocomplete=email)
5. Botón "Enviar código" (secondary)
6. CodeInput 6 dígitos (autocomplete=one-time-code)
7. Botón "Entrar" (primary)
8. "Reenviar código" enfriamiento 30s
9. "Cambiar correo"
10. Línea error neg 13 aria-live
11. Pie legal

### authMessages.ts
Tabla con códigos: google_failed, otp_send_failed, otp_invalid, network, rate_limited, max_users, account_locked

### storageKey
'vertice-diana-auth' en createClient

---

## D5 · Endurecimiento

- rls-check.mjs ampliado (dos usuarios)
- service_role grep en dist
- keepalive.yml verificación
- docs/vertice/seguridad.md

---

## D6 · Documentación

- README.md
- capturas/despues/
- paridad.md (tabla A8)
- Unificar docs
- build:web + rls
- ESTADO.md
