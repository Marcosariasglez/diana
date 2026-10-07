// Tipado minimo de papaparse (no se instala @types/papaparse).
declare module 'papaparse' {
  export interface ParseResult<T> {
    data: T[];
    errors: Array<{ message: string }>;
    meta: { fields?: string[] };
  }
  export interface ParseConfig {
    header?: boolean;
    skipEmptyLines?: boolean | 'greedy';
    transformHeader?: (header: string) => string;
  }
  export function parse<T = unknown>(input: string, config?: ParseConfig): ParseResult<T>;
  const Papa: { parse: typeof parse };
  export default Papa;
}
