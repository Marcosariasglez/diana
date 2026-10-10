# D2-4 · Propuesta de notificaciones push (Web Push) — SIN implementar

VERTICE-PLAN-2 §D2-4: «las notificaciones push en iPhone exigen PWA instalada
(iOS 16.4+) y Web Push: investígalo y deja una propuesta sin implementar».

Esta es esa propuesta. Lo implementado ya (D2-4) es la **bandeja in-app**
(`useNotificationTrayStore` + `useAvailabilityNotifications`), que funciona en
todos los dispositivos sin permisos de push. Esta capa es opcional y se
construiría sobre la bandeja, no en su lugar.

## 1. Qué se puede y qué no (resumen honesto)

| Canal | Android (Chrome) | iOS (Safari) | Limitación |
|---|---|---|---|
| **Web Push (service worker)** | Sí, sin instalar nada | **Solo si la PWA está en la pantalla de inicio** (iOS 16.4+). Notificaciones en 2.º plano no garantizadas: iOS las entrega solo si la PWA está instalada y, en la práctica, con la app en primer plano o al abrirla. | En iOS, push «en frío» (app cerrada) es poco fiable. |
| **Apple Push Notification service (APNs)** vía PWA | — | Sí, con certificado y `manifest` correcto | Requiere cuenta de desarrolladora Apple (99 €/año) y backend con credenciales. |
| **Native (Expo/EAS Push)** | Sí | Sí, siempre | La app es Expo: si algún día se empaqueta como nativa (EAS Build), EAS Push resuelve iOS sin PWA. Opción más robusta. |

Conclusión: **Web Push en esta app Expo-web cubre bien a Android y a iOS con
PWA instalada (con matices); para iOS garantizada haría falta nativo (EAS
Push) o APNs vía PWA.** No se implementa ahora (el plan lo dice explícitamente).

## 2. Arquitectura propuesta

```
[Edge Function `catalog-sync` (existe)]
        │  tras cada sincronización
        ▼
[Función `notify-availability` (nueva, service_role)]
        │  1. JOIN watchlist × catalog_titles × profiles
        │  2. Detecta (user, título) cuyo plataformas_flatrate ganaron
        │     una plataforma de favorite_platforms
        │     (misma regla que la detección client-side: comparar con la
        │     última instantánea guardada → tabla `availability_snapshot`)
        │  3. Insere en `notifications` (RLS: solo la suya)
        │  4. Si el usuario tiene `web_push_subscription`: envía vía
        │     VAPID (web-push) — payload { id, title, body, url }
        ▼
[Cliente]
  - Supabase Realtime (ya hay 0004_realtime.sql): suscripción a
    `notifications` por user_id → actualiza la bandeja in-app sin polling.
  - Service worker (solo web, `expo-service-worker` / `workbox`):
    `push` event → `showNotification` → tap → abre la ficha
    (`/(tabs)/detail/[id]`).
```

### Tablas nuevas (borrador, sin crear)

```sql
create table public.availability_snapshot (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie','tv')),
  media_id int not null,
  own_platforms text[] not null default '{}',  -- solo plataformas del usuario
  checked_at timestamptz not null default now(),
  primary key (user_id, media_type, media_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'available',
  payload jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
-- RLS: for all to authenticated using (user_id = (select auth.uid()))
```

> Nota: mientras la detección sea client-side (estado actual), la bandeja es
> local. Si se pasa a server-side, `useNotificationTrayStore` se convertiría
> en espejo local de la tabla `notifications` (mismo patrón que `watchlist`).

## 3. VAPID (web-push)

1. `npm i -D web-push` (solo en la función Edge, no en la app).
2. Generar claves: `npx web-push generate-vapid-keys` → `VAPID_PUBLIC_KEY` /
   `VAPID_PRIVATE_KEY` en secrets de Supabase (NUNCA en el cliente; la pública
   sí puede ser `EXPO_PUBLIC_`).
3. Cliente (web): `navigator.serviceWorker.getRegistration()` →
   `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
   → `supabase.from('push_subscriptions').upsert(...)`.
4. `supabase/functions/notify-availability`: `webpush.sendNotification(key, payload)`.

## 4. Service worker de la app (web)

- La build ya genera PWA (`expo export` + `scripts/postbuild-pwa.mjs`). Añadir
  handler de `push`/`notificationclick` en el service worker generado:

```js
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {};
  e.waitUntil(self.registration.showNotification(data.title ?? 'Diana', {
    body: data.body, icon: '/icon-192.png', data: { url: data.url },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data?.url ?? '/'));
});
```

## 5. iOS: qué se necesita para que funcione de verdad

1. PWA **instalada** en la pantalla de inicio (icono → «Añadir a pantalla de
   inicio»). `expo` ya emite `manifest.webmanifest` con `display: standalone`.
2. `Service-Worker-Allowed` y origin HTTPS (Supabase hosting lo cumple).
3. Para push en frío garantizado: **APNs vía PWA** (certificado
   `Notification` en la cuenta Apple) o, más simple, **empaquetar como app
   nativa y usar EAS Push** (la app ya es Expo; sería cambiar el canal, no la
   app).

## 6. Plan de trabajo si se decide implementar (orden)

1. Migración `0009_notifications.sql` (tablas + RLS + realtime).
2. Función `notify-availability` + dispararla al final de `catalog-sync`.
3. Tabla `push_subscriptions` + endpoint de suscripción.
4. Cliente: suscripción VAPID (solo web), service worker push, bandeja →
   espejo de `notifications` con Realtime.
5. Tests: SQL local (patrón `scripts/sql-*`), función Edge (jest como
   `catalog-sync.test.ts`), cliente (mock de pushManager).
6. Criterio de éxito: aviso < 1 h tras sincronizar en Android (Chrome) y en
   iOS con PWA instalada; bandeja siempre disponible aunque falle el push.

## 7. Riesgos / apuntes

- **Frecuencia**: `catalog-sync` es diaria (GitHub Actions). El aviso llega la
  siguiente sincronización, no en tiempo real. Aceptar.
- **Spam**: la detección server-side debe usar `availability_snapshot` (igual
  que la client-side: primera vez no avisa) para no re-avisar cada día.
- **Coste APNs/Apple**: 99 €/año; solo si se exige push fiable en iOS.
- La bandeja in-app ya entregada **no depende** de nada de esto.
