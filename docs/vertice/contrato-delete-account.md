# Contrato: Edge Function `delete-account`

> **Para el desarrollador de Norte:** esta función es invocada por Diana y,
> en el futuro, por Norte cuando implemente el enlace «Borrar mi acceso VERTICE».
> Reside en `supabase/functions/delete-account/index.ts`.

## Endpoint

```
POST https://<SUPABASE_REF>.supabase.co/functions/v1/delete-account
```

## Cabeceras

| Cabecera | Valor |
|----------|-------|
| `Authorization` | `Bearer <access_token>` (JWT de Supabase del usuario logueado) |
| `Content-Type` | `application/json` |

## Cuerpo de la petición

```json
{
  "everywhere": false
}
```

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `everywhere` | `boolean` | Sí | `false` → borra solo los datos de Diana (perfil, historial, salas, ratings). `true` → borra también la identidad de Supabase Auth (`auth.users`), lo que desloguea al usuario de **todas** las apps VERTICE (Diana y Norte). |

## Respuestas

### 200 OK

```json
{ "ok": true }
```

Los datos se borraron con éxito. El cliente debe llamar después a `supabase.auth.signOut()` y navegar a `/login`.

### 401 Unauthorized

```json
{ "error": "unauthorized" }
```

JWT inválido, caducado o sin `Authorization` header.

### 400 Bad Request

```json
{ "error": "invalid-body" }
```

Cuerpo no es JSON o `everywhere` no es booleano.

### 403 Forbidden

```json
{ "error": "forbidden" }
```

Solo puede ser llamada por un usuario `authenticated` con un JWT válido. La `service_role` no se acepta como Authorization.

### 500 Internal Server Error

```json
{ "error": "delete_failed", "detail": "..." }
```

Error inesperado al borrar datos. Consultar los logs de Supabase Edge Functions.

## CORS

La función responde CORS con:
- `Access-Control-Allow-Origin`: el valor de `Authorization` header de la petición (origen del cliente)
- `Access-Control-Allow-Methods`: `POST, OPTIONS`
- `Access-Control-Allow-Headers`: `Authorization, Content-Type`

El método `OPTIONS` (preflight) devuelve 204 sin cuerpo.

## Flujo completo (cliente)

1. Usuario pulsa «Borrar mi cuenta» o «Borrar mi acceso VERTICE»
2. Se muestra `ConfirmSheet` pidiendo escribir `BORRAR MI CUENTA`
3. Al confirmar:
   ```ts
   await supabase.functions.invoke('delete-account', {
     body: { everywhere: false /* o true */ },
   });
   await supabase.auth.signOut();
   router.replace('/login');
   ```
4. El usuario vuelve a ver `/login`

## Orden de borrado (servidor)

1. Validar JWT (`service_role` en secrets de Supabase)
2. Validar `Authorization` del cliente (extraer `sub` del JWT)
3. Validar cuerpo (`everywhere` booleano obligatorio)
4. Invocar RPC `delete_user_data(sub)` → borra datos de Diana
5. Si `everywhere === true` → `auth.admin.deleteUser(sub)` → borra identidad VERTICE
6. Si paso 5 falla pero paso 4 succeeded → responde 200 con log de error (los datos de Diana ya están borrados, la identidad queda huérfana pero el usuario está deslogueado)

## Restricciones

- **Nunca** se acepta la `service_role` key como `Authorization` del cliente.
- **Nunca** se expone el `sub` de otro usuario.
- El RPC `delete_user_data` tiene `REVOKE ... FROM public, anon, authenticated`: solo se invoca desde esta función (service_role).
