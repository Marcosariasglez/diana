# VERTICE · Alineación de Diana (`diana-tmp`) con Norte

> **Para el agente que ejecute esto en el repo `diana-tmp` (Diana).** Lee el documento entero antes de tocar nada. Está en tres partes: **A** (contrato común, idéntico en Norte), **B** (lo que tienes que hacer tú aquí) y **C** (tareas del dueño y preguntas abiertas).
> Redactado el 2026-10-08 a partir de la lectura de los dos repositorios. Los hechos de la tabla A2 son verificables con `grep`: si algo ya no es cierto, créete al código y anótalo.

**Resumen en cinco líneas.** Diana ya tiene el **mejor mecanismo de inicio de sesión** de los dos (Supabase: Google por redirección PKCE + código por correo, que funciona en la PWA de iPhone), así que **eso no se cambia**. Le faltan dos cosas grandes: (1) el **sistema visual de Norte** (paleta crema/verde `#0B7A66`, tema oscuro, Inter + Manrope estáticas, tarjetas de 24, botón principal negro, barra inferior translúcida) y (2) la **gestión de cuenta**: hoy no hay botón de cerrar sesión, ni exportar, ni borrar cuenta, ni pantalla de cuenta. Además la pantalla de acceso se rehace con el diseño común.

---

# PARTE A · CONTRATO VERTICE (idéntico en los dos repositorios)

> Esta parte es **la misma, palabra por palabra**, en `invest` (Norte) y en `diana-tmp` (Diana). Es la fuente de verdad. Si algo de tu código contradice esta parte, **gana esta parte**. Si crees que esta parte está mal, no la cambies tú: anótalo en «Preguntas para el dueño» al final y sigue con lo demás.

## A1 · Qué se quiere conseguir

VERTICE es un grupo de apps (hoy: **Norte**, finanzas, y **Diana**, cine). Deben sentirse **una sola familia**:

1. **Mismo estilo visual**: mismos colores, tipografías, radios, sombras, componentes, navegación y tema claro/oscuro.
2. **Misma forma de entrar**: misma pantalla de acceso, mismos métodos, mismos textos y errores.
3. **Misma gestión de cuenta**: misma pantalla «Cuenta» con las mismas acciones.
4. **Misma identidad**: una persona entra con la misma cuenta en las dos apps.

Lo que **no** se unifica: el contenido de cada app (pantallas de inversión / de cine), su nombre, su glifo de marca y su backend de datos (Norte: Cloudflare Worker + D1; Diana: Supabase).

## A2 · Diagnóstico (hechos verificados leyendo el código el 2026-10-08)

| Tema | Norte (`invest`) | Diana (`diana-tmp`) |
|---|---|---|
| Stack | Web vanilla HTML/CSS/JS (sin bundler) + Cloudflare Worker + D1 | Expo SDK 57 / React Native 0.86 + expo-router + NativeWind + Zustand + Supabase |
| Verde de marca | `#0B7A66` (claro) / `#37D6A4` (oscuro) | `#008060` (solo claro) |
| Fondo | `#F4F3EF` crema cálido | `#F8F9FA` gris frío |
| Tema oscuro | Sí, completo (`themes.css`) | **No.** `COLORS` es una constante estática importada en 51 archivos |
| Tipografía | Manrope (títulos y cifras) + Inter (texto), woff2 estáticos 400–800 | Solo Manrope, un TTF **variable** con `fontWeight` |
| Radio de tarjeta | 24 | 16 |
| Botón principal | Píldora **negra** (`ink`); el verde se reserva para FAB, enlaces y positivos | Píldora **verde**; la negra es la variante `dark` |
| Barra inferior | 2 pestañas · FAB 58 · 2 pestañas, fondo translúcido con blur, pestaña activa en `ink` | 2 pestañas · FAB 56 · 2 pestañas, fondo opaco, pestaña activa en verde |
| Pantalla «Más/Perfil» | Tarjeta de perfil + filas agrupadas con icono en círculo + selector de apariencia | Métricas + importar + historial + ajustes mínimos («Reiniciar prototipo») |
| Entrar con Google | Botón de Google Identity Services (GIS) + Worker que verifica el ID token. **Falla en la PWA de iPhone**, por eso existe un «código de vinculación de dispositivo». En producción sigue por defecto en modo `legacy` (contraseña compartida) hasta activar `AUTH_MODE='google'` | Supabase Auth: Google por **redirección con PKCE** (funciona en la PWA de iPhone con sesión persistente) **y código por correo (OTP)** |
| Registro | **Decidido: abierto a cualquiera** (antes: solo por invitación con `allowed_emails`). Se conserva el tope técnico `MAX_USERS` y el bloqueo de usuarios por el dueño | Abierto a cualquiera |
| Aislamiento de datos | `user_id` en todas las consultas + prueba maestra de aislamiento (45 pruebas) | RLS de Postgres + trigger que crea el perfil al registrarse |
| Cuenta: cerrar sesión | Sí (una, todas, por dispositivo) | `signOut()` existe en el store pero **ninguna pantalla lo usa** |
| Cuenta: exportar datos | Sí (`/api/me/export`) | No (pendiente «B6») |
| Cuenta: borrar cuenta | Sí (frase de confirmación) | Edge Function `delete-account` desplegable, **sin botón en la app** |
| Lista de dispositivos / revocar | Sí | No |
| Administración de invitados | Sí (Ajustes → Administración). **Se elimina** al abrir el registro | No aplica |

**Conclusión:** cada app tiene lo que le falta a la otra. De **Diana** se toma el *mecanismo* de inicio de sesión (Supabase: Google por redirección + código por correo, que además resuelve el iPhone). De **Norte** se toma la *gestión de cuenta* (pantalla Cuenta completa) y todo el *sistema visual*.

## A3 · Sistema visual VERTICE

Base: el diseño «Norte» (referencia: `invest/docs/diseno/norte-mockup.css` y las capturas de `invest/docs/diseno/movil/{claro,oscuro}/`). **Ojo:** el `README.md` de Norte habla de una dirección «Aurora» (índigo, degradado cian→violeta). **Está obsoleto y no vale.** Vale lo que hay en `src/css/themes.css`.

### A3.1 Tokens de color (nombres canónicos; úsalos tal cual en CSS y en TS)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `bg` | `#F4F3EF` | `#0A0C0F` | Fondo de pantalla |
| `card` | `#FFFFFF` | `#14171B` | Tarjetas, hojas, inputs |
| `ink` | `#15171A` | `#F2F3F5` | Texto principal; fondo del botón principal y del chip/segmento activo |
| `onInk` | `#F4F3EF` (= `bg`) | `#0A0C0F` (= `bg`) | Texto sobre `ink` |
| `mut` | `#5A5F68` | `#8C939C` | Texto secundario (AA ≥ 4.5:1 sobre `card`). *(Los prototipos usaban `#7B8088`, que no pasa AA: no lo uses para texto.)* |
| `textSecondary` | `#5B6068` | `#B3B9C1` | Texto de párrafo |
| `line` | `#ECEAE4` | `#22262C` | Separadores y bordes |
| `lineStrong` | `#DAD7CE` | `#2E333A` | Bordes de inputs |
| `chip` | `#EAE8E2` | `#1E2227` | Pista de segmentos, chips neutros, botón secundario |
| `acc` | `#0B7A66` | `#37D6A4` | Marca **y** positivo. FAB, enlaces, estados activos de acento, deltas positivos |
| `accHover` | `#096653` | `#5CE3B8` | Pulsado |
| `accSoft` | `#DDF0EA` | `#0F3129` | Fondo de insignias positivas |
| `onAcc` | `#FFFFFF` | `#03140E` | Texto/icono sobre `acc` |
| `neg` | `#CF4640` | `#FF7168` | Negativo, errores, acciones destructivas |
| `negBg` | `rgba(207,70,64,.09)` | `rgba(255,113,104,.12)` | Fondo de avisos de error |
| `warn` | `#B7791F` | `#F2B85B` | Avisos |
| `warnBg` | `rgba(183,121,31,.09)` | `rgba(242,184,91,.12)` | Fondo de avisos |
| `overlay` | `rgba(10,12,15,.35)` | `rgba(0,0,0,.6)` | Fondo tras hojas/diálogos |
| `shadow` | `0 1px 2px rgba(20,20,20,.04), 0 6px 24px rgba(20,20,20,.05)` | ninguna | Tarjetas, botones redondos |

**Reglas de color (no negociables):**
- Verde = marca y positivo. Rojo = negativo y error. **Nunca** uses rojo/verde como color de categoría.
- Un importe negativo normal va en `ink`, no en rojo (rojo solo para bajadas de rentabilidad y avisos).
- Categorías (series, insignias): `c1…c6` en este orden fijo, no se reordena: claro `#0B7A66 #3F5BD8 #E2A03A #C4548D #9AA1AB #8E5BD9`; oscuro `#37D6A4 #7C93FF #F2B85B #E679B0 #78808B #B48CFF`.
- Cero colores sueltos en el código de pantallas: todo sale de tokens.

### A3.2 Tipografía

- **Display** = Manrope (600/700/800): títulos, cifras grandes, nombres de importes, botones, avatares, logotipo.
- **Texto** = Inter (400/500/600/700): todo lo demás. Cifras con `tabular-nums` (`font-feature-settings:'tnum','cv11'` en web; `fontVariant:['tabular-nums']` en RN).
- Escala (px): título de pantalla **28/800** (tracking −0.03em) · cifra protagonista **46/800** (−0.035em; **56** en escritorio y en la hoja de importe) · título de sección **19/800** (−0.02em) y **17/800** dentro de tarjeta · cuerpo **15/500** · título de fila **15/600** · subtítulo de fila y pistas **12.5/500** en `mut` · etiqueta de grupo **12.5/700 MAYÚSCULAS** con tracking .06em · enlace de sección **13.5/600** en `acc` · etiqueta de barra inferior **10.5/600** · botón **16/700**.
- Fuentes **estáticas** (no variables): en Android un TTF variable ignora `fontWeight`. Cada peso se registra como familia propia (`Manrope-SemiBold`, `Manrope-Bold`, `Manrope-ExtraBold`, `Inter-Regular`, `Inter-Medium`, `Inter-SemiBold`, `Inter-Bold`). Norte ya las tiene en `invest/src/assets/fonts/*.woff2` (licencia OFL). Para RN hacen falta los `.ttf` equivalentes de las mismas familias.

### A3.3 Forma, espacio y movimiento

- Espaciado base 4: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40. Margen lateral de pantalla **20**.
- Radios: tarjeta **24** · hoja inferior **32** arriba · input y buscador **16** · botón, chip, segmento, insignia, delta **píldora (99)** · icono-cuadrado de entidad **13** (42×42) · círculo (avatar, botón redondo) **50%**.
- Tarjeta: fondo `card`, radio 24, padding 6×16 (filas) o 24 (contenido libre, variante «lg»), sombra `shadow`, separación entre tarjetas 14.
- Animación: entrada de hoja/modal con `cubic-bezier(0.22, 1, 0.36, 1)`; 150–250 ms. Respeta «reducir movimiento» del sistema (Diana ya tiene el ajuste; Norte debe respetar `prefers-reduced-motion`).
- Toques: objetivo táctil ≥ 44×44. Foco visible siempre (anillo `acc` 2 px).

### A3.4 Componentes (misma anatomía en las dos apps)

| Componente | Especificación |
|---|---|
| **Botón principal** | Píldora, alto ≥ 52, fondo `ink`, texto `onInk` Manrope 16/700. Estado `disabled`: fondo `chip`, texto `mut`. Cargando: spinner en lugar del texto, mismo tamaño. |
| **Botón secundario** | Píldora, fondo `chip`, texto `ink`, alto ≥ 48. |
| **Botón de Google** | Píldora, fondo `card`, borde `lineStrong` 1 px, logotipo «G» oficial a color + «Continuar con Google» `ink` 16/600, alto 52. (Cumple las guías de marca de Google; no lo pintes de negro.) |
| **Botón destructivo** | Texto `neg` 15/600 sin fondo (en listas) o píldora `negBg` con texto `neg` (en diálogo de confirmación). |
| **FAB (+)** | Círculo 58, fondo `acc`, icono `onAcc`, sobresale 16 por encima de la barra, sombra `0 8px 20px color-mix(acc 40%, transparent)`. Acción: «añadir» (en Norte: hoja de gasto/ingreso/traspaso; en Diana: diario rápido). |
| **Barra inferior** | Alto 88 (incluye zona segura), fondo `card` al 92 % con desenfoque 16, borde superior `line`. 2 pestañas + hueco del FAB + 2 pestañas. Pestaña: icono 24 + etiqueta 10.5/600. Inactiva `mut`; **activa `ink`** (con trazo 2.5). Iconos: **Lucide**. |
| **Segmentos** | Pista `chip` píldora con padding 3; opción 14/600 `mut`; **activa: fondo `ink`, texto `onInk`**. Variante `sm` (13/600, compacta). |
| **Chip** | Píldora 13.5/600; neutro = `card` con sombra; activo = `ink`/`onInk`. Insignia de estado: 12/600 en `accSoft`+`acc` (positiva) o `warnBg`+`warn`. |
| **Fila** | Alto mín. 44; icono/avatar 42 a la izquierda, texto (título 15/600 + subtítulo 12.5 `mut`) con elipsis, valor a la derecha (Manrope 15/700). Separador `line` 1 px entre filas, no tras la última. |
| **Fila de ajustes** | Como «Fila», con icono dentro de **círculo 42** de tono suave (fondo = tono al 14–20 %, icono = tono pleno) y chevron `mut` a la derecha. Tonos permitidos: `c1…c6`. |
| **Tarjeta de perfil** | Avatar círculo **56** (`ink` de fondo, inicial Manrope 800 22 en `onInk`) **con `flex:none` y `aspect-ratio:1`** (en la captura `movil/oscuro/09-mas-ajustes.png` el avatar sale ovalado: es un bug del prototipo, no lo copies) + nombre Manrope 18/800 + línea `mut` 13. |
| **Buscador** | Fondo `card`, radio 16, padding 13×14, icono `mut`, sombra. |
| **Input de texto** | Alto ≥ 52, radio 16, fondo `card`, borde `lineStrong` 1 px, texto Inter 16 (16 evita el zoom de iOS). Foco: borde `acc` 2 px. Error: borde `neg` + mensaje `neg` 13 debajo. |
| **Hoja inferior (sheet)** | Fondo `bg`, radio 32 arriba, asa 40×5 en `line`, overlay `overlay` con blur 3. En escritorio, modal centrado de 540. |
| **Diálogo de confirmación** | Hoja o modal con título 20/800, texto 14.5 `mut`, dos botones; el destructivo a la derecha. Para acciones irreversibles se pide **escribir una frase** (ver A5). |
| **Toast** | Píldora `ink`/`onInk` arriba o sobre la barra; error con icono `neg`. `aria-live="polite"`. |
| **Esqueleto** | Bloques `chip` con pulso suave; nunca spinner a pantalla completa si se puede mostrar estructura. |
| **Logotipo** | Cuadrado 34 radio 11, fondo `acc`, glifo `onAcc` + nombre de la app Manrope 22/800 tracking −0.03em. Cada app pone **su** glifo (Norte: estrella polar ✦; Diana: el suyo). En pantalla de acceso se muestra a 56. |

### A3.5 Navegación y estructura

- **Móvil:** barra inferior `[Inicio] [pestaña 2] (＋) [pestaña 4] [última]`. La **última pestaña** es el hub de cuenta y ajustes. **Decidido:** se llama **«Más»** en Norte y **«Perfil»** en Diana (icono y etiqueta propios de cada una). Lo que es **idéntico** es su estructura interna (A3.5) y la sección «Cuenta» (A5).
- **Escritorio:** Norte tiene barra lateral fija de 248 con botón «Añadir». Diana, por ahora, mantiene su columna móvil centrada de 390 px en pantallas anchas; llevarla a barra lateral es una fase **opcional** posterior.
- **Pantalla Más/Perfil**, de arriba abajo: título 28/800 → tarjeta de perfil → grupo «Datos»/contenido propio de la app → grupo «Aplicación» (**Apariencia** [Claro · Oscuro · Auto], Notificaciones) → grupo **«Cuenta»** (A5) → pie con versión y enlaces legales.

### A3.6 Texto y formato

- Español de España, tuteo, frases cortas, **sin emojis en la interfaz** (Diana ya lo impone con una regla de ESLint; Norte debe cumplirlo en lo que ve el usuario).
- Importes y fechas con `Intl` `es-ES`. Signo menos tipográfico `−` (U+2212). Euro tras la cifra con espacio fino: `1.284,20 €`.
- Nada de `ó` en el código fuente de textos: escribe los caracteres reales (UTF-8). Diana tuvo ese bug en el login.

### A3.7 Accesibilidad (mínimos)

Contraste AA en texto, foco visible, roles y etiquetas (`accessibilityRole`/`aria-*`), mensajes de error con `aria-live`/`accessibilityLiveRegion`, objetivos ≥ 44, respeta tema y movimiento del sistema, campos con `autocomplete` correcto (`email`, `one-time-code`).

## A4 · Pantalla de acceso (idéntica en las dos apps)

**Ruta:** `/login` (Diana) · capa `#loginOverlay` a pantalla completa (Norte). Se muestra mientras no hay sesión. Fondo `bg`. Contenido centrado, ancho máx. 380, margen lateral 20.

**Estructura, de arriba abajo:**

1. Logotipo de la app (56) + nombre (Manrope 800, 32) + una línea de subtítulo `mut` 15:
   - Norte: «La verdad sobre tu cartera.»
   - Diana: «Tu cine, con tu gusto.» *(ajústala si el dueño tiene otro lema)*
2. **Botón de Google** (A3.4).
3. Separador: línea `line` + texto «o con un código por correo» (12.5/700 mayúsculas `mut`) + línea.
4. Input de correo (`type=email`, `autocomplete=email`, `inputmode=email`, sin autocapitalizar, placeholder `tu@correo.com`).
5. Botón secundario **«Enviar código»** (deshabilitado hasta que el correo parezca válido).
6. Tras enviar, **sin cambiar de pantalla**: aparece el input de código (`autocomplete=one-time-code`, `inputmode=numeric`, solo dígitos, **6 dígitos**, fuente tabular, espaciado de letras amplio) y el botón principal **«Entrar»**, más «Reenviar código» (enfriamiento de 30 s con cuenta atrás) y «Cambiar correo».
7. Línea de error (`neg`, 13, `aria-live`), reservando su altura para que nada salte.
8. Pie 12 `mut`: «Al continuar aceptas la [Política de privacidad] y los [Términos].» + «Una app de VERTICE».

**Comportamiento:**
- Tras entrar: si es la primera vez en esa app → onboarding de la app; si no → Inicio.
- La sesión persiste (también en la PWA instalada del iPhone).
- No hay formulario de contraseña. No hay «código de vinculación de dispositivo» (ver A6: deja de hacer falta).
- Un único estado de carga por botón (spinner dentro del botón); nunca bloquees toda la pantalla.

**Textos de error (únicos, literales):**

| Situación | Texto |
|---|---|
| Google falla o se cancela | «No se pudo iniciar sesión con Google. Inténtalo de nuevo.» |
| No se pudo enviar el correo | «No pudimos enviar el código. Revisa el correo e inténtalo de nuevo.» |
| Código malo o caducado | «Código incorrecto o caducado.» |
| Registro cerrado por el tope de usuarios | «La app ha alcanzado su número máximo de usuarios.» |
| Cuenta bloqueada | «Esta cuenta está bloqueada.» |
| Demasiados intentos | «Demasiados intentos. Espera unos minutos.» |
| Límite de usuarios | «La app ha alcanzado su número máximo de usuarios.» |
| Sin red | «Sin conexión. Inténtalo de nuevo.» |

## A5 · Pantalla «Cuenta» (idéntica en las dos apps)

**Dónde vive:** grupo «Cuenta» de la pestaña Más/Perfil; ruta propia `/account` (Diana) / vista de Ajustes (Norte). Se compone de **tarjeta de perfil** + **grupo de filas**:

| Fila | Qué hace | Detalle |
|---|---|---|
| **Correo** | Muestra el correo (solo lectura) | Subtítulo: «Entras con Google» o «Entras con código por correo» |
| **Nombre** | Edita el nombre visible | Inline; guarda al salir del campo; máx. 40 caracteres |
| **Apariencia** | Segmentos Claro · Oscuro · Auto | Persistente; «Auto» sigue al sistema. Cambia **al instante** y sin recargar |
| **Exportar mis datos** | Descarga un JSON con **todo** lo del usuario en esa app | Nombre de fichero `<app>-mis-datos-AAAA-MM-DD.json`. En RN usa la hoja de compartir |
| **Cerrar sesión** | Cierra solo este dispositivo | Sin confirmación; vuelve a `/login` y limpia estado local de usuario |
| **Cerrar sesión en todos los dispositivos** | Invalida todas las sesiones | Con confirmación |
| **Borrar mi cuenta** | Borra los datos de la persona en **esta** app | Texto `neg`. Confirmación escribiendo **`BORRAR MI CUENTA`** (mayúsculas, exacto). Tras borrar: cierra sesión y vuelve a `/login` |
| Pie | «Política de privacidad» · «Términos» · versión · «Una app de VERTICE» | |

**Solo Norte** (porque su backend lo permite; no hay que replicarlo en Diana): «Dispositivos con sesión abierta» (listar y cerrar uno). Es la **única** divergencia permitida y debe quedar como grupo aparte debajo de «Cuenta». Con el registro abierto desaparece «Administración → Invitados».

**Alcance de «Borrar mi cuenta» (decisión por defecto, ver Q2):** borra los datos de **esa app**. La identidad compartida de VERTICE (el usuario de Supabase Auth) **no se borra** desde una sola app, porque la usa la otra. Se ofrece, debajo, un enlace «Borrar también mi acceso a todas las apps de VERTICE» que sí borra la identidad, con aviso explícito de que afecta a las dos apps. (Apple exige poder borrar la cuenta desde la app: guía 5.1.1(v).)

## A6 · Arquitectura de identidad

**Decidido: un único proyecto de Supabase Auth para todo VERTICE, usado solo como proveedor de identidad.** Razón: una sola cuenta para las dos apps, un solo sitio donde configurar Google, correo y plantillas, y un solo código de acceso que mantener. Los datos de cada app siguen **separados** (Diana en Supabase, Norte en D1) y los repositorios también.

```
 Navegador / PWA                      Supabase Auth (proyecto único "vertice")
 ┌──────────────┐  Google (PKCE, redirección)  ┌───────────────────────────┐
 │  Diana / Norte│ ───────────────────────────▶ │ usuarios, Google, OTP mail │
 │              │ ◀─────── access_token ─────── │  (no guarda datos de apps) │
 └──────┬───────┘                               └───────────────────────────┘
        │ Diana: el cliente habla directo con Supabase (RLS)
        │ Norte: POST /api/auth/supabase {access_token}
        ▼
 Worker de Norte ──▶ GET {SUPABASE_URL}/auth/v1/user  (valida el token en Supabase)
        └─▶ crea/enlaza el usuario en D1, aplica tope de usuarios y bloqueo, crea SU sesión opaca
```

- **Diana** ya funciona así: no cambia su mecanismo, solo se le añaden las pantallas que faltan (A5) y se pule A4.
- **Norte** sustituye **solo la puerta de entrada**: deja de verificar un ID token de Google (GIS) y pasa a **intercambiar un access token de Supabase por su propia sesión**. Todo lo de debajo (tabla `sessions`, `requireUser`, aislamiento por `user_id`, lista de dispositivos, exportar, borrar, administración) **se queda intacto**: es lo que ya está probado (pruebas de sesiones y de aislamiento entre usuarios).
- Al intercambiar, el Worker valida el token **preguntándoselo a Supabase** (`GET /auth/v1/user` con `Authorization: Bearer <access_token>` y `apikey: <anon key>`). Es una llamada por inicio de sesión (no por petición), no requiere manejar claves de firma y sobrevive a rotaciones de clave.
- Identidad estable = **`sub` (UUID de Supabase)**, nunca el correo. En D1 la columna `users.google_sub` pasa a ser `users.idp_sub` (migración nueva `0011`, con copia de seguridad antes).
- **Reclamar al dueño**: la lógica actual (el correo de `OWNER_EMAIL` enlaza el usuario `'1'` con datos existentes) se conserva, solo cambia de dónde sale el `sub`.
- **Registro abierto (decidido):** cualquier persona con cuenta válida entra en las dos apps y se crea su usuario la primera vez. Norte **elimina** la lista de invitados (`allowed_emails`, rutas `/api/admin/allowed-emails` y su pantalla). Se conservan: el tope `MAX_USERS` (protege el plan gratuito de D1; súbelo a 100 en `wrangler.toml`, el dueño lo ajusta), el bloqueo de usuarios por el dueño y el límite de intentos en D1. Sin invitación ya no existe el error «sin acceso». **Consecuencia a vigilar:** al abrir el registro en Norte, cualquiera puede guardar datos financieros en tu cuenta de Cloudflare; las obligaciones de privacidad de `docs/PLATAFORMA-APPS.md` §2 pasan a ser **requisito previo** (política de privacidad, exportar y borrar: exportar y borrar ya los cubre A5).
- **iPhone/PWA**: la redirección PKCE de Supabase conserva la sesión en la app instalada; por eso en Norte se **eliminan** GIS, `auth_nonces` y `device_codes` (y la fila «Vincular otro dispositivo»). *Verifica en un iPhone real antes de borrar nada* (fase N4).
- **Correo con código**: la plantilla de email de Supabase por defecto envía un **enlace mágico**, no un código. Hay que editar las plantillas «Magic Link» y «Confirm signup» para que incluyan `{{ .Token }}` (6 dígitos). Además, el SMTP incorporado de Supabase tiene un límite muy bajo de correos por hora (pensado solo para pruebas; **comprueba el límite vigente en su documentación**): para uso real con amigos hay que configurar un SMTP propio (Resend, Brevo… con plan gratuito).
- **Pausa por inactividad**: el plan gratuito de Supabase pausa el proyecto tras ~7 días sin actividad; Diana ya tiene `keepalive.yml`. Si Norte depende del mismo proyecto para entrar, ese keepalive pasa a ser crítico para las dos apps. Comprueba que el ping realmente cuenta como actividad.
- **Hosting (decidido, lo más cómodo ahora):** **repositorios y despliegues separados, cada app en su propia ruta de GitHub Pages** (Diana `/diana`; Norte la que resulte real, `/invest` o `/norte`: hay que verificarlo) sin migrar nada por ahora. Comparten origen (`marcosariasglez.github.io`), así que comparten `localStorage` pero **no** claves: cada app fija su `auth.storageKey` (`vertice-diana-auth`, `vertice-norte-auth`) y su prefijo de almacenamiento, y cada Service Worker queda acotado a su ruta. Mover cada app a su propio dominio (Cloudflare Pages, recomendado por `docs/PLATAFORMA-APPS.md`) se hace **antes de publicar en App Store o de abrir la app a gente ajena**, no antes: es un cambio de URLs, de Redirect URLs de Supabase y de `ALLOWED_ORIGINS` del Worker, sin tocar código de producto. Al moverlo la sesión no se arrastra: cada usuario volverá a entrar una vez.
- **Secretos**: `anon key` y URL de Supabase son públicas (ya lo son en Diana). La `service_role` **solo** en variables secretas del servidor/CI, **jamás** en el repo ni en el front. Diana la tiene en `.env.local` (ignorado por git: correcto; comprueba que sigue así).

## A7 · Cómo trabajar (reglas para el agente)

1. **Una fase cada vez**, en orden. No avances si la comprobación de la fase no sale como dice. Si algo no cuadra, **para y pregunta**; no inventes rutas ni APIs, compruébalas con `grep`.
2. **No toques producción**: nada de `wrangler deploy`, `wrangler d1 execute --remote`, `wrangler secret put`, `supabase db push`, cambios en la consola de Google/Supabase/Cloudflare. Prepara el comando exacto y pídeselo al dueño (sección «Tareas del dueño»).
3. **Primero la prueba, luego el código.** Cada cambio de comportamiento lleva pruebas nuevas que fallan sin él y pasan con él.
4. **No rompas lo que ya funciona**: ejecuta la batería completa del repo antes de cerrar cada fase.
5. **Capturas antes/después** de cada pantalla tocada (móvil 390×844, claro y oscuro) en una carpeta `docs/vertice/capturas/`. La paridad se juzga mirando las dos apps lado a lado.
6. **Secretos**: nunca en ficheros del repo ni en logs. Nada de imprimir tokens ni correos completos.
7. **Respeta el estilo del código de cada repo** (comentarios, nombres, idioma: textos de usuario en español; el código sigue lo que ya haya).
8. Si tu cambio obliga a modificar esta Parte A, **no la modifiques**: anótalo al final del documento.

## A8 · Criterios de paridad (la tarea termina cuando todo esto es verdad)

**Visual**
- [ ] Mismos tokens (A3.1) en claro y oscuro; ningún color suelto en pantallas.
- [ ] Manrope + Inter estáticas en ambas; cifras tabulares.
- [ ] Tarjetas radio 24, botón principal `ink` píldora, FAB 58 verde, barra de 88 con desenfoque y pestaña activa en `ink`.
- [ ] Selector de apariencia Claro/Oscuro/Auto funcionando al instante y persistente.
- [ ] Pantalla de acceso con A4 completa; pantalla Cuenta con A5 completa.
- [ ] Capturas lado a lado de **Login, Inicio, Más/Perfil, Cuenta** (claro y oscuro) sin diferencias de estilo.

**Cuenta**
- [ ] Entrar con Google y con código por correo en las dos apps, también en la PWA de iPhone.
- [ ] Cerrar sesión / en todos / exportar / borrar funcionan **de verdad** (comprobando después en la base de datos, no solo en pantalla).
- [ ] Un usuario nunca ve datos de otro (Norte: prueba maestra; Diana: `npm run rls`).
- [ ] Mismo texto en cada error de A4.

**Calidad**
- [ ] Batería de pruebas del repo en verde (Norte: `npm test` + `npm run qa:rapido`; Diana: `npm run verify`).
- [ ] README del repo actualizado y sin información obsoleta.


---

# PARTE B · Lo que hay que hacer en Diana (`diana-tmp`)

## B0 · Mapa del terreno (verificado)

| Qué | Dónde |
|---|---|
| Tokens de color | `src/theme/colors.ts` (`COLORS`, constante **estática**, importada en **51 archivos**), `src/theme/{typography,spacing,shadows}.ts`, `tailwind.config.ts` (lee `COLORS`), `global.css` |
| Colores sueltos fuera del tema | ~38 hex en `app/` y `src/` (los peores: `app/(onboarding)/welcome.tsx` ×8, `EpisodePicker.tsx` ×3, `app/(tabs)/profile.tsx` ×3, `Button.tsx`, `TypeBadge.tsx`, `FeaturedMatchCard.tsx`, `Toast.tsx`, `FabButton.tsx`, `Pill.tsx`, `Gallery.tsx`). Filtra con `grep -rnE "#[0-9A-Fa-f]{6}\b" app src --include=*.ts --include=*.tsx` |
| Componentes base | `src/components/ui/*` (con pruebas `*.test.tsx`): `Button`, `Card`, `Chip`, `Pill`, `SegmentedControl`, `BottomNav`, `FabButton`, `Screen`, `Toast`, `BottomSheet`, `Skeleton`… |
| Navegación | `app/_layout.tsx` (`OnboardingGuard`, fuentes, splash), `app/(tabs)/_layout.tsx` (pestañas Inicio · Mood · Match · Perfil + FAB) |
| Acceso | `app/login.tsx` (Google + OTP, muy básico, con `#B42318` suelto) |
| Estado de identidad | `src/store/useAuthStore.ts` (`init`, `signInWithGoogle`, `sendEmailCode`, `verifyEmailCode`, `signOut`), `src/store/bootstrapUserData.ts`, `src/lib/supabase.ts`, `src/lib/env.ts` |
| Perfil | `app/(tabs)/profile.tsx` (métricas, importar Letterboxd, historial, «Ajustes» con *reducir movimiento* y **«Reiniciar prototipo»**), `src/store/useProfileStore.ts`, `src/store/useSettingsStore.ts` |
| Backend | `supabase/migrations/0001..0004` (esquema, RLS, RPC, realtime), `supabase/functions/{tmdb,delete-account}/index.ts` |
| CI | `.github/workflows/deploy.yml` (verify + build web + GitHub Pages en `/diana`), `keepalive.yml` (ping a Supabase cada 3 días) |
| Comandos | `npm run verify` (= `typecheck` + `lint` + `test`), `npm run build:web`, `npm run rls` (comprobación de RLS), `npm run icons` |
| Variables | `EXPO_PUBLIC_BACKEND` (`mock`\|`supabase`), `EXPO_PUBLIC_CATALOG`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_BASE_URL`. `.env.local` está ignorado por git (**comprueba que sigue así**; contiene la `service_role`) |

**Modos:** con `BACKEND=mock` la app no pide inicio de sesión y todo es local; con `BACKEND=supabase` (producción) hay puerta de acceso. **Toda funcionalidad de cuenta nueva debe funcionar en `supabase` y degradarse con elegancia en `mock`** (p. ej. ocultar «Cerrar sesión» y mostrar «Modo demostración»).

## B1 · Cosas que están mal o desfasadas (arreglar)

1. **No hay forma de cerrar sesión ni de borrar la cuenta desde la app.** `useAuthStore.signOut` existe, pero ninguna pantalla lo llama; la Edge Function `delete-account` existe, pero nadie la invoca. Es un bloqueo para publicar en App Store (guía 5.1.1(v), ver `invest/docs/PLATAFORMA-APPS.md` §3).
2. **«Reiniciar prototipo»** (`resetPrototype`) está en el Perfil de producción, borra el estado local **sin cerrar sesión** y manda a la bienvenida: con un usuario real confunde y no borra nada en el servidor. Pasa a una opción solo de desarrollo (`__DEV__`) o desaparece.
3. **`DEFAULT_DISPLAY_NAME = 'Juan'`** y `DEFAULT_USER_ID = 'user-me'` solo valen para el modo `mock`. En `supabase` el nombre sale de `profiles.display_name` (lo rellena el trigger con el nombre de Google). Comprueba que nunca se ve «Juan» con una cuenta real.
4. **`confirmDialog`** usa `window.confirm` en web: no sirve para la confirmación con frase escrita (A5) ni respeta el estilo. Se sustituye por un diálogo propio (A3.4) para las acciones de cuenta.
5. **Documentación contradictoria:** `PROGRESS.md`, `BACKEND_PROGRESS.md` e `IMPLEMENTATION_STATUS.md` se contradicen (B1/B5/B6 marcados de forma distinta). Unifícalas en un único `docs/ESTADO.md` (o deja una y borra las otras) cuando termines.
6. **Sin `README.md`.** El repo no tiene ninguno. Crea uno de portada (qué es Diana, cómo arrancar, variables, comandos, enlace a este documento).
7. **Fuente variable:** `Manrope-VariableFont.ttf` con `fontWeight`: en Android el peso se ignora. Se sustituye por estáticas (A3.2).
8. **Textos:** `app/login.tsx` ya escapa unicode (`ó`) en `useAuthStore`: escribe los caracteres reales.
9. **`app.config.ts`**: `backgroundColor`/`themeColor` y el splash están clavados al gris/verde viejos; deben seguir los tokens nuevos (y el splash tener variante oscura).

## B2 · Fases

Haz **una fase cada vez**. Cada una termina con su comprobación (`npm run verify` en verde como mínimo). **Para cualquier medida, margen, radio, tamaño o peso de letra, la fuente es el Anexo de medidas (X1–X6) al final de la Parte B**: el objetivo del dueño es que Diana sea idéntica a Norte, no «parecida».

### Fase D0 · Red de seguridad (30 min)
1. `git status` limpio; `node -v` ≥ 22; `npm ci`; `npm run verify` en verde (anota el nº de pruebas: línea base, ~61 según los documentos).
2. Capturas «antes» de **Login, Inicio, Mood, Match, Perfil** (móvil 390×844) en `docs/vertice/capturas/antes/`. Diana no trae Playwright: añádelo como `devDependency` y un script `scripts/capturas.mjs` que haga `expo export --platform web`, sirva `dist/` y capture con `BACKEND=mock` (así no hace falta sesión). Hay capturas de diseño previas en `../Diana – Pantallas principales-png/` (fuera del repo) que sirven de referencia de contenido.
3. `grep` de colores sueltos y de usos de `COLORS` (para medir el trabajo de D2).
**Comprobación:** línea base y capturas hechas.

### Fase D1 · Tokens, tema claro/oscuro y tipografía (la fase más grande)
*Medidas y tabla de tipografía exactas: Anexo X1–X4.*
**Objetivo:** que `COLORS` deje de ser una constante y pase a ser **tema**, con los tokens de A3.1.

1. **Nuevo `src/theme/tokens.ts`** con las dos paletas (`light`, `dark`) usando los **nombres canónicos de A3.1** (`bg, card, ink, onInk, mut, textSecondary, line, lineStrong, chip, acc, accHover, accSoft, onAcc, neg, negBg, warn, warnBg, overlay`, y `c1…c6`). Tipado `ThemeColors`.
2. **`ThemeProvider` + `useTheme()`** en `src/theme/ThemeProvider.tsx`: resuelve `appearance` (`'light'|'dark'|'auto'`) con `useColorScheme()`; expone `{ colors, scheme, appearance, setAppearance }`. **`appearance` vive en `useSettingsStore`** (persistido, versión de migración +1; por defecto `'auto'`). El proveedor va en `app/_layout.tsx` por fuera de todo, y `StatusBar` (`style` = contrario al tema) y el color de fondo del contenedor raíz salen de él.
3. **Patrón de estilos:** `const styles = useThemedStyles((c) => StyleSheet.create({...}))` (hook propio con `useMemo` por tema). **Prohibido** crear `StyleSheet.create` a nivel de módulo con colores del tema. Para ayudar a la migración, deja un `COLORS` **deprecado** que lea el tema claro y emita un aviso en `__DEV__`, y migra por grupos:
   1. `src/components/ui/*` (los 20 componentes base y sus pruebas),
   2. `src/components/features/*`,
   3. `app/**` pantallas.
   Cuando `grep -rn "theme/colors" app src` dé 0, **borra** `colors.ts`.
4. **Colores sueltos → tokens.** Todo hex fuera de `src/theme/` desaparece, **salvo** colores de póster (`posterColor.ts`, son datos del catálogo) y logotipos (p. ej. la «G» de Google). Añade una regla de ESLint (`no-restricted-syntax` sobre literales `/^#[0-9a-f]{3,8}$/i` en `app/` y `src/components/`) igual que la regla anti-emoji que ya existe, para que no vuelvan.
5. **Tailwind/NativeWind:** `tailwind.config.ts` deja de leer `COLORS` y pasa a variables CSS (`bg-[var(--bg)]`) **o** se deja de usar para colores (prioriza la opción más simple que compile en nativo y en web; si dudas, quita el color de Tailwind y usa el hook). `darkMode: 'class'` si se mantiene. `global.css` define `:root` y `[data-theme=dark]` con los mismos tokens para el fondo de la página web (evita el «flash» blanco al cargar) y **fija el simulador móvil** de 390 px sobre `bg`, no sobre blanco.
6. **Tipografía (A3.2):** descarga **Manrope 600/700/800** e **Inter 400/500/600/700** en `.ttf` estático (licencia OFL, mismas familias que `invest/src/assets/fonts/`), regístralas en `useFonts` y en el plugin `expo-font` de `app.config.ts`, y reescribe `src/theme/typography.ts`: `fontFamily` por peso (`Manrope-ExtraBold`…) en lugar de `fontWeight`. Escala exacta de A3.2 (28/800, 46/800 cifra, 19/800, 15, 12.5, 10.5…). Cifras con `fontVariant: ['tabular-nums']`. Borra `Manrope-VariableFont.ttf`.
7. **Forma y sombras (A3.3 + Anexo X4):** `shadows.ts` y `spacing.ts` al contrato; en oscuro **no hay sombra ni borde**.
8. **`app.config.ts`:** `userInterfaceStyle: 'automatic'` ya está; pon `backgroundColor`/`themeColor` de `web` y del `adaptiveIcon` en `#F4F3EF` / `#0B7A66`, y splash con variante oscura (`expo-splash-screen` admite `dark: { backgroundColor, image }`). Regenera iconos si cambia el verde (`npm run icons`).
9. **`app.json`** y `public/` (PWA): revisa `theme_color`, `background_color` y `apple-touch-icon` tras el cambio de verde.
**Comprobación:** `npm run verify` en verde (pruebas de componentes actualizadas a los nuevos tokens, **no** borradas); `grep -rn "theme/colors" app src` = 0; `grep` de hex sueltos = 0 fuera de las excepciones; la app cambia de tema **al instante** al mover el selector (tras D3) o el tema del sistema; capturas claro/oscuro de las 5 pantallas.

### Fase D2 · Componentes al contrato (A3.4)
*Medidas exactas de cada bloque: Anexo X2. Composición pantalla a pantalla: Anexo X5. Verificación: Anexo X6.*
Con el tema ya migrado, ajusta la **anatomía**:

| Componente | Cambio |
|---|---|
| `Button` | Variante principal = **`ink`** (píldora negra). Mantén la API pública (`primary`/`secondary`/`dark`) **pero redefine**: `primary` → ink; `secondary` → chip; `dark` desaparece (migra sus usos a `primary`); añade `google` (A3.4) y `destructive`. Alto mín. 52 (hoy 60). Actualiza `Button.test.tsx`. |
| `Card` | Radio **24**, padding 16 (filas) / 24 (`lg`), sombra del contrato (ninguna en oscuro, y sin borde). Hoy radio 16. |
| `FabButton` | 58, `acc`, icono `onAcc`, sombra `acc` al 40 %. Hoy 56 y `#FFFFFF` fijo. |
| `BottomNav` | Alto 88 (con zona segura), fondo `card` al 92 % con desenfoque (usa `expo-glass-effect`, que ya está instalado, o `BlurView`; en web `backdrop-filter`), borde superior `line`, **pestaña activa en `ink`** (hoy `accent`), etiqueta 10.5/600, FAB con sobresalto de 16 (hoy 24). Actualiza `BottomNav.test.tsx`. |
| `SegmentedControl` | Activo = fondo `ink`, texto `onInk`; pista `chip`. Hoy activo es blanco con texto oscuro. |
| `Chip`/`Pill`/`PillGroup` | Píldora 99, neutro con sombra, activo `ink`; insignias positivas `accSoft`+`acc`. |
| `Toast` | Píldora `ink`/`onInk`. |
| `BottomSheet` | Radio 32 arriba, asa, overlay `overlay`. |
| Nuevos | `ListRow` (fila y fila de ajustes con icono en círculo 42 + chevron), `ProfileCard` (avatar 56), `TextField` (A3.4), `ConfirmSheet` (con campo de frase escrita) y `GoogleButton`. Con pruebas. |

Las **pantallas propias de cine** (Inicio, Mood, Match, detalle, salas, onboarding) **conservan su contenido y composición**; solo heredan el nuevo tema y componentes. No rediseñes su lógica. Revisa a mano: contraste de textos sobre pósteres en oscuro, el color de las insignias «Match alto/medio» (usan el verde: deben usar `accSoft`/`acc`), y `welcome.tsx` (8 colores sueltos).
**Comprobación:** `npm run verify`; `scripts/auditoria-estilos.mjs` (X6) sin fallos; capturas de Inicio/Mood/Match/Perfil en claro y oscuro comparadas lado a lado con `docs/vertice/referencia/movil-*/`: mismos radios, mismas sombras, misma barra.

### Fase D3 · Perfil → «Más/Perfil» y pantalla Cuenta (A3.5 + A5)
1. **La pestaña se sigue llamando «Perfil»** (decidido). Reestructura `app/(tabs)/profile.tsx` según A3.5 y la fila «Perfil» del Anexo X5: título → `ProfileCard` (avatar con inicial, nombre, correo) → métricas «Vistas / Tu nota media» (se conservan) → «Importa tu historial» y «Historial» (se conservan, restilados) → grupo **Aplicación** (**Apariencia** con segmentos Claro·Oscuro·Auto → `setAppearance`, **Reducir movimiento** que ya existe) → grupo **Cuenta** (fila que abre `/account`) → pie (versión, enlaces legales, «Una app de VERTICE»).
2. Nueva ruta **`app/account.tsx`** (registrada en `app/_layout.tsx` con `slide_from_right`) con **las filas de A5**, en este orden y con estos textos:
   - **Correo** (solo lectura; subtítulo «Entras con Google» / «Entras con código por correo», según `session.user.app_metadata.provider`).
   - **Nombre** (editable; `profileRepository.saveProfile({ displayName })`; máx. 40; actualiza el store).
   - **Exportar mis datos** → ver 4.
   - **Cerrar sesión** → `useAuthStore.signOut()`; que `signOut` además llame `resetLocalStores()` y navegue a `/login` (hoy depende del listener; verifica que no queda nada del usuario en `AsyncStorage` ni en los stores).
   - **Cerrar sesión en todos los dispositivos** → nueva acción `signOutEverywhere()` = `supabase.auth.signOut({ scope: 'global' })` con confirmación.
   - **Borrar mi cuenta** → ver 5.
   - Enlaces legales (D4).
3. **Modo `mock`:** la pantalla muestra «Modo demostración» y oculta correo/cerrar/borrar/exportar remotos (el export puede seguir funcionando con los datos locales).
4. **Exportar mis datos:** nuevo `exportMyData()` en `src/services/` que lee las tablas del usuario (`profiles`, `initial_ratings`, `history_entries`, `watched`; las salas solo en lo que le pertenece) con la sesión del usuario (RLS) y produce un JSON `{ app:'diana', exportedAt, user:{id,email}, … }`. Web: `Blob` + enlace de descarga. Nativo: `expo-file-system` + hoja de compartir (`expo-sharing` si hace falta añadirlo). Nombre `diana-mis-datos-AAAA-MM-DD.json`. Prueba unitaria del formato y de que **no** incluye datos de otros usuarios.
5. **Borrar cuenta (según la decisión Q2; por defecto A5):**
   - **Cambia la Edge Function `delete-account`**: hoy hace `auth.admin.deleteUser`, que borra la **identidad común** y dejaría sin acceso a Norte a esa persona. Nueva versión: borra **solo los datos de Diana** del usuario (`delete from` en `history_entries, initial_ratings, watched, room_members, rooms where host_id…, profiles`, en este orden y en transacción) y **solo** borra al usuario de Auth si recibe `{ everywhere: true }`. Valida el JWT como ahora (con `service_role` en el servidor, nunca en el cliente).
   - Cliente: `supabase.functions.invoke('delete-account', { body: { everywhere } })`, luego `signOut` local, `resetLocalStores()` y `/login`.
   - UI: `ConfirmSheet` que exige escribir **`BORRAR MI CUENTA`**; enlace secundario «Borrar también mi acceso a todas las apps de VERTICE» (con el aviso de A5).
   - **Pruebas:** de la función (simulando `service_role`) y de que las tablas quedan vacías para ese usuario y **intactas para otro** (amplía `scripts/rls-check.mjs`/`npm run rls`).
6. Quita «Reiniciar prototipo» del Perfil (B1.2); si lo quieres para desarrollo, déjalo tras `__DEV__`.
**Comprobación:** `npm run verify`; **en un proyecto de pruebas de Supabase** (no producción) cierra sesión, exporta y borra con una cuenta desechable y confirma en la base de datos que todo ocurrió; capturas de Perfil y Cuenta (claro/oscuro) iguales en estilo a «Más» y «Cuenta» de Norte.

### Fase D4 · Pantalla de acceso con el diseño común (A4)
1. Rehaz `app/login.tsx` con la estructura exacta de A4 (logotipo 56, subtítulo, `GoogleButton`, separador, correo, «Enviar código», **código de 6 dígitos** con `autoComplete="one-time-code"` y `textContentType="oneTimeCode"`, «Reenviar» con enfriamiento de 30 s, «Cambiar correo», línea de error reservada, pie legal). Hoy el código acepta hasta 8 dígitos y el botón se habilita con 6: ajusta al número que realmente emita Supabase (configurable en el panel; **6 por defecto**) y cuéntalo en el README.
2. **Textos de error:** una tabla única `src/constants/authMessages.ts` con las frases literales de A4; `useAuthStore` devuelve **códigos** (`google_failed`, `otp_send_failed`, `otp_invalid`, `network`, `rate_limited`) y la pantalla los traduce. Hoy el store mezcla mensajes y escapes unicode.
3. **Enfriamiento y límite:** si Supabase devuelve 429, muestra «Demasiados intentos. Espera unos minutos.» y bloquea el botón con cuenta atrás.
4. **Redirección a la app (web):** `redirectTo` correcto con `BASE_URL`; tras volver de Google no debe verse un parpadeo de `/login`. Comprueba `detectSessionInUrl` y que se limpia la URL (`?code=…`).
5. **`storageKey` explícita** en `createClient` (`'vertice-diana-auth'`) para no compartir sesión por accidente con Norte si comparten origen (A6). *Cambiarla desloguea a quien esté dentro: avisa al dueño.*
6. **Accesibilidad:** `accessibilityLabel`s, `accessibilityLiveRegion` en errores, foco inicial en el correo, `returnKeyType` y `onSubmitEditing` encadenados, teclado que no tapa el botón (`KeyboardAvoidingView`).
7. Pruebas de componente (Testing Library) para cada estado: vacío, correo inválido, enviado, código malo, error de red, cargando.
**Comprobación:** `npm run verify`; capturas de acceso en cada estado (claro/oscuro) iguales en estilo a las de Norte; prueba real del dueño (Parte C, D5).

### Fase D5 · Endurecimiento de la identidad compartida
1. **`npm run rls`** ampliado: con dos usuarios de prueba, ninguno lee ni escribe lo del otro en **ninguna** tabla ni RPC (revisa `0003_rpc.sql`: toda función `security definer` debe comprobar `auth.uid()`).
2. **`handle_new_user`**: ahora que la identidad es común, un usuario puede llegar a Supabase desde **Norte** sin pasar por Diana. El trigger crea igualmente su `profiles` en Diana (inofensivo, pero cuenta contra la cuota). Decide con el dueño si se deja (simple) o se crea el perfil la primera vez que entra en Diana (más limpio). Por defecto: se deja.
3. Revisa que la `service_role` **no** aparece en `app/`, `src/`, `public/`, ni en `dist/` tras `build:web` (`grep -r "service_role" dist app src`), ni en ningún workflow.
4. `keepalive.yml`: comprueba que el endpoint que llama cuenta como actividad real (si no, cambia a una consulta mínima autenticada con la `anon key`). Dejarlo roto pausaría el acceso de **las dos apps**.
**Comprobación:** pruebas en verde; informe corto en `docs/vertice/seguridad.md` con lo comprobado y lo no comprobado.

### Fase D6 · Cierre y documentación
1. `README.md` nuevo (B1.6), documentación de estado unificada (B1.5), `docs/vertice/` con capturas «después» y la tabla de paridad (A8) marcada.
2. Elimina de la documentación cualquier dato de credenciales concreto que no haga falta (`SERVICES_DOCS.md` lista IDs de proyecto y rutas: está bien para uso propio, **pero no lo subas a un repo público** y no pongas nunca claves).
3. Verifica el despliegue de pruebas: `build:web` con `EXPO_BASE_URL=/diana` y sin errores de rutas profundas (`404.html` de respaldo).
**Comprobación:** `npm run verify` + `npm run build:web` en verde; paridad A8 revisada punto por punto.

---

# ANEXO · Medidas de interfaz de Norte que Diana debe copiar al píxel

> **Qué es esto.** El objetivo del dueño es que Diana se vea **exactamente** como Norte: mismos espacios, márgenes, colores, tipos y pesos de letra. Este anexo traduce el CSS de Norte a números que se aplican en React Native. **Si una medida de aquí contradice a tu intuición o a lo que ya hace Diana, gana el anexo.**
> **Referencia dentro de este repo** (copiada de Norte para que no dependas de nada externo): `docs/vertice/referencia/`
> - `norte-mockup.css` → el CSS exacto de los prototipos (es la fuente de las medidas de abajo).
> - `norte-themes.css` → los tokens reales de la app (claro/oscuro).
> - `movil-claro/*.png`, `movil-oscuro/*.png` → capturas objetivo de 9 pantallas (390×844 @2x).
> - `*-movil-*.html` → los HTML de esas capturas: ábrelos en un navegador y **mide con las herramientas de desarrollo** cualquier duda.
> Todas las medidas están en **px lógicos = puntos de React Native** (1:1). `em` se convierte multiplicando por el tamaño de letra (`typography.ts` ya hace esa conversión).

## X1 · Esqueleto de pantalla

| Elemento | Medida |
|---|---|
| Fondo de pantalla | `bg` (A3.1). Debajo de la barra de estado, color `bg`; icono de estado según tema |
| Margen horizontal del contenido | **20** a cada lado (no 16, no 24) |
| Hueco superior | zona segura + **0** (la cabecera ya trae su alto) |
| Hueco inferior del scroll | **120** (barra 88 + 32 de aire) **más** la zona segura inferior |
| **Cabecera de pantalla** (`.top`) | fila, alto **56**, `gap` 12, margen inferior 6, alineada al centro. Título a la izquierda `flex:1`: Manrope **28/800**, tracking **−0.03em** (−0.84 px). A la derecha, 0–2 botones redondos |
| **Botón redondo** (`.rb`) | **40×40**, círculo, fondo `card`, sombra `shadow`, icono Lucide 20 `ink`. Variante `sm`: 32×32, fondo `chip`, sin sombra |
| **Avatar** (`.ava`) | **40×40** (56 en perfil), círculo, fondo `ink`, inicial `onInk` Manrope **800**; `flex:none` |
| Título centrado (pantallas secundarias) | texto centrado Manrope **16/700** entre un botón «atrás» redondo 40 y un hueco simétrico |
| Separación vertical entre bloques | tarjetas: **14**; cabecera de sección → contenido: **8** |

## X2 · Bloques y sus medidas exactas

| Bloque (clase en Norte) | Medidas |
|---|---|
| **Tarjeta** `.card` | fondo `card`, radio **24**, `padding` **6 vertical × 16 horizontal** (para filas), margen inferior **14**, sombra `shadow`. Variante `pad24`: padding **24** (contenido libre). Etiqueta dentro de tarjeta: `padding-top` 14. Cifra dentro de tarjeta: `padding-bottom` 4 |
| **Cabecera de sección** `.sh` | fila, `justify:space-between`, alinear a la **línea base**, margen **14 2 8** (arriba, lados, abajo). Título Manrope **19/800**, tracking **−0.02em**. Enlace a la derecha: Inter **13.5/600** color `acc` (**no** gris: el «Ver todo» de Diana hoy es `mut`; debe ser `acc`). Variante dentro de tarjeta `.sh.in`: margen **14 0 4**, título **17** |
| **Fila** `.row` | fila, `gap` **12**, `padding` **11 0**, `alignItems:center`, separador superior **1 px `line`**; sin separador en la primera fila de una tarjeta ni justo bajo una cabecera. Texto `.rt`: título Inter **15/600** en **1 línea con elipsis**; subtítulo Inter **12.5/500** `mut`, `margin-top` 2, 1 línea con elipsis. Valor `.rr` a la derecha: alineado a la derecha, no parte línea; principal Manrope **15/700**; secundario Inter **12.5** `mut`, `margin-top` 2; positivo en `acc` |
| **Avatar de fila** `.av` | **42×42** círculo; fondo `hsl(h s1 l1)`, texto `hsl(h s2 l2)` con `h` = tono propio del elemento; **claro:** `l1 92% · l2 30% · s1 60% · s2 50%`; **oscuro:** `l1 20% · l2 74% · s1 32% · s2 60%` |
| **Icono-cuadrado** `.sq` | **42×42**, radio **13**, texto blanco Manrope **13/800** (logotipos de plataforma, p. ej. Netflix/Max) |
| **Insignia** `.cchip` | Inter **12/600**, `padding` **5 10**, píldora; mismo esquema de color HSL que `.av`. Aviso: fondo `#FBE9C8`/texto `#8A5A00` (claro), `#3A2C0E`/`#F2B85B` (oscuro) |
| **Delta** `.delta` | `margin-top` 8, Inter **14** `mut`; el valor `b`: `acc` sobre `accSoft`, `padding` **4 10**, píldora, peso 600 |
| **Cifra protagonista** `.big` | Manrope **46/800**, tracking **−0.035em**, `line-height` 1.1, `margin-top` 2; sufijo `small`: **0.5×** el tamaño, `mut`, 700 |
| **Etiqueta** `.lbl` | Inter **14/500** `mut` |
| **Segmentos** `.seg` | fila a todo el ancho, fondo `chip`, píldora, `padding` **3**, `gap` 2, margen **6 0 4**. Opción: `flex:1`, centrada, `padding` **8 6**, Inter **14/600** `mut`; **activa** = fondo `ink`, texto `onInk`. Variante `sm`: ancho automático, opción `padding 6 12`, **13/600** |
| **Acciones rápidas** `.quick` | fila `space-between`, margen **20 4 22**; cada una columna centrada `gap` 8; botón círculo **54×54** fondo `card` + sombra; etiqueta Inter **12.5/600** |
| **Buscador** `.search` | fila, `gap` 10, fondo `card`, radio **16**, `padding` **13 14**, Inter **14.5** `mut`, margen **4 0 12**, sombra |
| **Chips de filtro** `.chips` | fila con scroll, `gap` **8**, margen inferior 6; chip: fondo `card`, sombra, píldora, `padding` **8 14**, Inter **13.5/600**; **activo:** `ink`/`onInk` |
| **Carril horizontal** `.hs` | fila con scroll, `gap` **10**, **sangra a los bordes** (margen horizontal −20 y `padding` 0 20 para que el primer elemento alinee con el margen y los demás se corten en el borde de pantalla) |
| **Mini-tarjeta** `.mini` | fondo `card`, radio **20**, `padding` **14**, ancho mín. **138**, `gap` 3, sombra; texto `mut` 12.5; valor Manrope **20**, tracking −0.02em |
| **Tarjeta de lista** `.list` | ancho **132**, radio **20**, `padding` 14; activa = `ink`/`onInk` |
| **Barra de progreso** `.bar` | alto **8**, fondo `chip`, píldora; relleno `acc` |
| **Barra apilada** `.stack` | alto **10**, `gap` 3, píldora, margen **10 0** |
| **Leyenda** `.legend` | fila con salto, `gap` **14**, Inter **12** `mut`; punto de **8** px circular con margen derecho 6 |
| **Cabecera de grupo** `.gh` | Inter **12.5/700 MAYÚSCULAS**, tracking **.06em**, `mut`; `padding` **14 0 2**; valor a la derecha Manrope 14 `ink` sin mayúsculas |
| **Pista** `.hint` | Inter **12.5** `mut`, margen **10 0 12** |
| **Botón** `.btn` | píldora, `padding` **16**, `gap` 8, Manrope **16/700**; principal = `ink`/`onInk`; secundario = `chip`/`ink`, `padding` **12**, margen **8 0 12** |
| **Perfil** `.prof` | fila, `gap` **14**, `padding` **12 0**; nombre Manrope **18/700–800**; línea secundaria Inter **13** `mut` |
| **Fila de ajuste** `.trow` | fila `space-between`, `padding` **12 0**, Inter **15/600** |
| **Cerrar sesión** `.logout` | centrado, `gap` 8, `neg`, 600, margen superior **22** |
| **Barra inferior** `.bnav` | alto **88**, `padding` **8 6 0**, fondo `card` al **92 %** + desenfoque **16**, borde superior **1 px `line`**. Cada pestaña: columna centrada, `gap` 4, `padding-top` 4, etiqueta Inter **10.5/600**; inactiva `mut`, **activa `ink`**. FAB: **58×58**, `acc`, `margin-top` **−16**, `margin` horizontal **8**, sombra `0 8 20` de `acc` al 40 %. Indicador de inicio: barra **134×5** radio 9 `ink` a 8 px del borde |
| **Hoja** `.sheet` | fondo `bg`, radio **32 32 0 0**, `padding` **8 20 26**, sombra `0 −10 40` negro 20 %; asa **40×5** radio 9 `line`, margen **4 auto 10**; cabecera: Manrope **20/800** tracking −0.02em, margen inferior 12; **velo** `rgba(10,12,15,.45)` con desenfoque 3 |
| **Campos agrupados** `.flds` | fondo `card`, radio **22**, `padding` **2 16**, margen inferior 12; cada campo: `padding` **13 0**, `gap` 12, Inter **14.5** `mut`, valor `ink` 600 a la derecha, separador `line` |
| **Teclado numérico** `.keys` | rejilla 3 columnas, `gap` 4, cifras Manrope **24/600** |

## X3 · Letra: de las claves de Diana a la escala de Norte

`src/theme/typography.ts` se reescribe con **estas** entradas (mantén los nombres para no tocar pantallas; cambian los valores y la familia). Tracking en em → `typography.ts` ya lo pasa a px.

| Nombre en Diana | Familia | Tamaño/peso | Tracking | Nota |
|---|---|---|---|---|
| `screenTitle` | Manrope-ExtraBold | **28/800** | −0.03em | = cabecera de pantalla de Norte |
| `heroTitle` | Manrope-ExtraBold | **32/800** | −0.03em | solo acceso y bienvenida |
| `detailTitle` | Manrope-ExtraBold | **26/800** | −0.03em | título en la ficha |
| `sectionTitle` *(nuevo)* | Manrope-ExtraBold | **19/800** | −0.02em | `.sh h3`; 17 dentro de tarjeta |
| `big` *(nuevo)* | Manrope-ExtraBold | **46/800** | −0.035em | cifras protagonistas |
| `value` *(nuevo)* | Manrope-Bold | **15/700** | 0 | `.rr b` |
| `label` | Inter-Bold | **12.5/700 MAYÚSCULAS** | +0.06em | etiquetas de grupo |
| `body` | Inter-Medium | **15/500** | 0 | (hoy 16) |
| `bodyStrong` *(nuevo)* | Inter-SemiBold | **15/600** | 0 | título de fila |
| `bodySmall` | Inter-Medium | **12.5/500** | 0 | subtítulo de fila / pista (hoy 14) |
| `link` *(nuevo)* | Inter-SemiBold | **13.5/600** | 0 | `Ver todo` |
| `button` *(nuevo)* | Manrope-Bold | **16/700** | 0 | |
| `posterTitle` | Manrope-Bold | **13/700** | 0 | |
| `navLabel` | Inter-SemiBold | **10.5/600** | 0 | (hoy 11/500) |
| `wizardQuestion` | Manrope-ExtraBold | **34/800** | −0.03em | se conserva el tamaño |
| `bestMatch` | Manrope-ExtraBold | **38/800** | −0.03em | se conserva |
| `roomCode` | Manrope-ExtraBold | **46/800** | 0.12em | tabular; se conserva |
| `predictionRevealed` | Manrope-ExtraBold | **40/800** | −0.03em | se conserva |

Reglas: **ningún** `fontWeight` suelto en pantallas; el peso viene de la familia. Todas las cifras (importes, notas, códigos, contadores) llevan `fontVariant:['tabular-nums']`.

## X4 · Forma: radios y sombras en una tabla

| Cosa | Radio | Sombra (claro) | Sombra (oscuro) |
|---|---|---|---|
| Tarjeta grande | **24** | `shadow` | ninguna |
| Mini-tarjeta, carril de listas, **póster** | **20** | `shadow` | ninguna |
| Campos agrupados / hoja de campos | **22** | — | — |
| Input, buscador | **16** | `shadow` (buscador) | ninguna |
| Icono-cuadrado | **13** | — | — |
| Hoja inferior | **32** arriba | `0 −10 40 rgba(0,0,0,.2)` | igual |
| Botón, chip, segmento, insignia, delta, barra | **99** | botón redondo/chip de filtro: `shadow` | ninguna |
| Avatar, botón redondo, FAB | **50 %** | `shadow` / FAB propia | FAB propia |

`shadow` = `0 1 2 rgba(20,20,20,.04)` **+** `0 6 24 rgba(20,20,20,.05)`. En RN se aproxima con **una** sombra (`shadowColor #141414, offset {0,6}, radius 24, opacity .05`) más `elevation` baja en Android; en web usa el `box-shadow` doble exacto. **En oscuro no hay sombra ni borde**: la tarjeta (`#14171B`) se distingue del fondo (`#0A0C0F`) solo por color. (Corrige lo que se dijo antes de «sustituir por borde»: no se usa borde.)

## X5 · Traducción pantalla a pantalla (Diana → patrones de Norte)

El **contenido** y la **lógica** de cada pantalla de Diana no cambian; cambia cómo se compone. Antes de empezar cada una, abre en `referencia/` la captura de Norte equivalente.

| Pantalla de Diana | Compónla con | Captura de referencia |
|---|---|---|
| **Inicio «Para ti»** | Cabecera X1 (título «Para ti» + botón redondo de notificaciones). Chips de plataforma = **chips de filtro** (activo `ink`). «Recomendación Top» = **tarjeta** radio 24 con insignia `.cchip` en `accSoft`+`acc`; póster radio **20**; «Match alto» = insignia. Carriles «Joyas ocultas»/«Recomendaciones» = **carril horizontal** con **cabecera de sección** y «Ver todo» en `acc`. Título del póster Manrope 13/700 bajo el póster, gap 8 | `01-inicio.png`, `06-inversion-cartera.png` |
| **Mood** (estado y pasos) | Cabecera; opciones = **tarjetas** `.card` con filas; selección = fondo `ink`/`onInk`; progreso = **barra** 8; botón principal fijo abajo | `03-anadir-gasto.png` |
| **Mood wizard** (pantalla completa) | Como una **hoja** a pantalla completa: asa no, pregunta `wizardQuestion`, opciones como **fichas** radio 24, barra de progreso arriba, `ink` para el seleccionado | `03-anadir-gasto.png` |
| **Resultados de mood / Match** | **Filas** con póster 42×62 (radio 13) + título + insignia de match a la derecha; cabecera de grupo `.gh` por categoría | `02-movimientos.png` |
| **Sala de amigos (lobby)** | Código de sala = **tarjeta pad24** con `roomCode` centrado; miembros = **filas** con avatar 42 (HSL) y estado a la derecha (`cchip`); botón principal abajo | `05-detalle-cuenta.png` |
| **Swipe (sala y onboarding)** | Pantalla completa sobre `bg`; carta radio **24** con póster; botones circulares **54** (`.qb`) con la sombra del contrato; contador `bodySmall` | `01-inicio.png` (acciones rápidas) |
| **Ficha (detalle)** | Póster grande radio **24**; título `detailTitle`; metadatos en insignias; «Nota IA»/«Tu nota» como **mini-tarjetas** `.mini`; selector de temporada/capítulo = **segmentos**; acciones = botones X2 | `05-detalle-cuenta.png` |
| **Slot machine / predicción revelada** | Se conserva la animación; la caja sigue **tarjeta pad24**; la cifra `predictionRevealed` | `06-inversion-cartera.png` |
| **Diario rápido (botón +)** | **Hoja** X2 con buscador arriba, resultados en **filas**, estrellas de valoración, botón principal | `03-anadir-gasto.png` |
| **Perfil** | A3.5 + A5: cabecera, **ProfileCard** (`.prof`), métricas como dos **mini-tarjetas** en rejilla `g2` (`1fr 1fr`, gap 10), importar = tarjeta pad24, historial = tarjeta con **filas**, ajustes y cuenta = **filas de ajuste** | `09-mas-ajustes.png` |
| **Cuenta** | Como «Más» de Norte | `09-mas-ajustes.png` |
| **Notificaciones** | Cabecera con «atrás»; **filas** agrupadas por día con `.dayh` (margen 18 6 8, 13.5/600 `mut`) | `02-movimientos.png` |
| **Ver todo / categoría** | Cabecera con «atrás» + **rejilla** de pósters, gap 10–12, margen 20 | `08-inversion-explorar.png` |
| **Bienvenida (onboarding)** | Logotipo 56, `heroTitle`, texto `body` `mut`, botón principal abajo con margen 20; **sin colores sueltos** (hoy 8) | — (sigue A4) |
| **Estados vacío/error/cargando** | `EmptyState`/`ErrorState`: icono en **círculo 56** `chip`, título 17/800, texto `mut` 14, botón secundario; `Skeleton` = bloques `chip` con la forma real de la fila/tarjeta | `07-inversion-programadas.png` |

## X6 · Cómo comprobar «idéntico» (obligatorio en D1, D2 y D3)

1. **Reglas de medición**: para cada pantalla, saca captura de Diana en 390×844 y la captura de Norte equivalente; superpón o alterna. Tolerancia: **0 px** en márgenes, radios y alturas de componentes; **±1 px** en posiciones de texto por diferencias de renderizado.
2. **Lista de comprobación por pantalla** (cópiala en `docs/vertice/paridad.md` y márcala):
   - [ ] margen lateral 20 · [ ] cabecera 56 / título 28/800 · [ ] radios de la tabla X4 · [ ] separación entre tarjetas 14 · [ ] cabeceras de sección 19/800 con enlace `acc` · [ ] filas 11/12/15/12.5 · [ ] familia y peso de **cada** texto (X3) · [ ] colores solo de tokens · [ ] barra inferior X2 · [ ] oscuro sin sombras ni bordes · [ ] cifras tabulares.
3. Un script `scripts/auditoria-estilos.mjs` que falle si en `app/` o `src/components/` aparece: un `fontWeight`, un `#hex`, un `borderRadius` que no esté en {8,12,13,16,20,22,24,32,99,9999,*/2}, o un `padding/margin` que no sea múltiplo de 2 (excepciones documentadas en el propio script).

---

# PARTE C · Para el dueño

## Tareas que solo puedes hacer tú (el agente no debe hacerlas)

| # | Tarea | Cuándo |
|---|---|---|
| **D1** | **Proyecto Supabase único (decidido):** este mismo proyecto (`hvjmewokgxgrshtzhdjq`) lo usará también Norte. Confirma que *Sign ups* está **habilitado** (registro abierto) y no cambies el proveedor Google. | Antes de D3 |
| **D2** | **Copia de seguridad** de la base de Supabase antes de desplegar la nueva `delete-account` (Dashboard → Database → Backups, o `pg_dump`). | Antes de D3 |
| **D3** | En Supabase → *Authentication → URL Configuration*: añade como **Redirect URLs** todas las URLs reales (producción `…/diana/`, `http://localhost:8081`, `http://localhost:8089`, y la de Norte). En *Email Templates* edita **«Magic Link» y «Confirm signup»** para que incluyan **`{{ .Token }}`**: sin eso el «código por correo» manda un enlace y la pantalla pide un código que nunca llega. En *SMTP Settings*, configura un SMTP propio gratuito (Resend/Brevo…): el SMTP incorporado tiene un límite de correos por hora muy bajo (**compruébalo en la documentación vigente de Supabase**), pensado solo para pruebas. | Antes de D4 |
| **D4** | Desplegar la función nueva: `npx supabase functions deploy delete-account --project-ref hvjmewokgxgrshtzhdjq` (con el agente delante, **primero en un proyecto de pruebas**). | Fase D3 |
| **D5** | **Guion de prueba:** (a) PC: Google; salir; código por correo (¿te llega un código de 6 dígitos?). (b) iPhone/Safari: igual. (c) **PWA del iPhone:** Compartir → Añadir a pantalla de inicio → abrir → Google → ¿vuelves dentro? → cierra la app del todo y ábrela: ¿sigues dentro? (d) Cambia Apariencia a Oscuro y reabre: ¿se conserva? (e) Cuenta → Exportar: ¿el JSON tiene tus datos? (f) Con una cuenta **desechable**: Borrar mi cuenta → ¿vuelve al acceso y no puede volver a ver nada tuyo? | D3–D4 |
| **D6** | Si vas a publicar en App Store: URL de **política de privacidad** y **términos** (las redacta el dueño; no es asesoría legal) y `Sign in with Apple` **o** conservar el código por correo como alternativa (guía 4.8: el correo propio cuenta como alternativa, ver `invest/docs/PLATAFORMA-APPS.md` §3). | Antes de publicar |

## Decisiones ya tomadas por el dueño (2026-10-08)

| Tema | Decisión |
|---|---|
| Registro | **Abierto**, en Diana y también en Norte. |
| Última pestaña | **«Perfil»** en Diana (Norte usa «Más»). Estructura interna idéntica. |
| Estilo | Idéntico a Norte al detalle (Anexo). |
| Un proyecto o dos | **Cuenta única** (este Supabase sirve de identidad a las dos apps), **repos, datos y despliegues separados**. Se mantiene GitHub Pages con `storageKey` distinta; mover a dominios propios es una fase futura, antes de publicar o de abrir a terceros. |

## Preguntas que siguen abiertas

- **Q2 · «Borrar mi cuenta»:** *por defecto (así está en D3):* borra los datos **de Diana**; el acceso común se borra con un enlace aparte que avisa de que afecta a las dos. Si prefieres que borre **todo**, dilo antes de la fase D3.
- **Q6 · Escritorio:** hoy columna móvil de 390 px; pasar a barra lateral de 248 como Norte no está en este plan (fase aparte).

*(Anota aquí las discrepancias que encuentres con la Parte A. No la edites.)*
