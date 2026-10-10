// VERTICE-PLAN-2, D2-4: claves de persistencia del chequeo de disponibilidad
// («Ya está en tu plataforma»). Compartidas entre useAvailabilityNotifications
// (las escribe/lee) y bootstrapUserData (las BORRA al cambiar de cuenta o al
// cerrar sesión): la base y el cooldown son estado POR USUARIO — si no se
// limpian, el próximo usuario local del dispositivo arranca con la base del
// anterior (avisos falsos, o avisos suprimidos de sus propios títulos).
export const AVAILABILITY_BASELINE_KEY = 'diana.availability.baseline.v1';
export const AVAILABILITY_LAST_CHECK_KEY = 'diana.availability.lastcheck.v1';
