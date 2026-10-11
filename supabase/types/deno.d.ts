// Tipos mínimos del runtime Deno SOLO para el editor (VSCode).
//
// Por qué existe: las Edge Functions (Deno) están EXCLUIDAS del tsconfig
// principal del proyecto (no compila con tsc — las despliega la CLI de
// Supabase con esbuild, que no hace typecheck) y no se puede instalar
// @types/deno en este workspace. Sin esta declaración, VSCode marca
// `Deno` en rojo en supabase/functions/**/*.ts. En runtime, el propio Deno
// proporciona `Deno.env`/`Deno.serve`.
declare namespace Deno {
  // deno-lint-ignore no-explicit-any
  const env: { get(key: string): string | undefined };
  type Handler = (req: Request) => Response | Promise<Response>;
  function serve(handler: Handler): unknown;
}
