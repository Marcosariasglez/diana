import { Redirect } from 'expo-router';

/**
 * VERTICE-PLAN-2 C.3: la pestaña Match desaparece; sus acciones viven ahora en la
 * pestaña Mood (modo «Con amigos»). Redirigimos /match → /mood para no romper
 * enlaces antiguos (documentación de la elección: /mood es la nueva única
 * entrada a «solas o con amigos», el destino semántico del hub Match).
 */
export default function MatchRedirect() {
  return <Redirect href="/mood" />;
}
