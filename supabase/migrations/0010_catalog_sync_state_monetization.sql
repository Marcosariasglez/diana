-- Diana 0010: check de monetización en catalog_sync_state (VERTICE-PLAN-2, D2-1.3).
--
-- MIGRACIÓN FORWARD (no editar 0006): la función catalog-sync guarda el pase
-- 2 con la clave monetization='rent|buy' (TMDB descubre alquiler+compra en
-- UNA sola pasada: with_watch_monetization_types=rent|buy), pero el check de
-- 0006 solo admitía ('flatrate','rent','buy'). En las bases donde 0006 ya se
-- aplicó, cada upsert de estado del pase 2 violaba el check → el job quedaba
-- 'error' y reiniciaba por la página 1 en cada run (nunca se reanudaba).
--
-- Idempotente: se elimina el constraint que haya (el nombre autogenerado es
-- impredecible: {col}_{check}) y se crea uno nuevo con el mismo nombre
-- lógico. En bases donde 0006 ya incluyera el valor correcto (despliegue
-- nuevo tras el fix), esto es un no-op funcional.

alter table public.catalog_sync_state
  drop constraint if exists catalog_sync_state_monetization_check;

alter table public.catalog_sync_state
  add constraint catalog_sync_state_monetization_check
  check (monetization in ('flatrate', 'rent|buy'));
