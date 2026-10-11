# Evaluación del recomendador (D2-2.4)

> Generado por `scripts/eval-recomendador.mjs${REAL ? ' --real' : ''}` el 2026-10-11T21:25:09.546Z.

## Dataset (real (embeddings gte-small de producción), «dejar uno fuera»)

- Catálogo: real de producción (catalog_titles, 1196 títulos más populares con feature).
- Valoraciones: 8 usuarios sintéticos con perfil de género; 40 títulos de entrenar por usuario, el resto holdout.
- Embeddings: REALES gte-small 384-d de producción (dump del 2026-10-11T21:25:09.126Z).
- Heurística actual: `predictTenths` con el mismo historial (40 ratings) que el modelo content; sin mazo de onboarding (no existe en el sintético).
- Precisión@10: por usuario, de su top-10 real (por nota verdadera dentro del holdout), cuántos caen en el top-10 ordenado por la predicción de cada modelo.

## Resultados

| Modelo | EAM (décimas) | Precisión@10 | n holdout |
|---|---|---|---|
| heuristic | 5.827 | 0.15 | 400 |
| mean | 7.16 | 0.188 | 400 |
| random | 11.943 | 0.188 | 400 |
| content | 2.935 | 0.5 | 400 |

## Veredicto

CONTENT gana a la heurística en EAM y precisión@10 → EXPO_PUBLIC_RECOMMENDER=content por defecto

### Nota de validez

Evaluación con **embeddings REALES de gte-small** (dump de producción) sobre el catálogo real. La nota «verdadera» sigue siendo sintética (perfil de género + ruido): mide si el embedding real mejora la LÓGICA del modelo frente a la línea base; no es una métrica de usuarios reales, que llegará con las valoraciones de producción.
