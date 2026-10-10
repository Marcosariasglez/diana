# Evaluación del recomendador (D2-2.4)

> Generado por `scripts/eval-recomendador.mjs` el 2026-10-10T08:40:32.960Z.

## Dataset (sintético, «dejar uno fuera»)

- Catálogo: mocks del repo (122 títulos).
- Valoraciones: 8 usuarios sintéticos con perfil de género; 40 títulos de entrenar por usuario, el resto holdout.
- Embeddings: sintéticos (vocabulario de contenido) — la calidad del embedding real (gte-small) solo se mide en producción.
- Heurística actual: `predictTenths` con el mismo historial (40 ratings) que el modelo content; sin mazo de onboarding (no existe en el sintético).
- Precisión@10: por usuario, de su top-10 real (por nota verdadera dentro del holdout), cuántos caen en el top-10 ordenado por la predicción de cada modelo.

## Resultados

| Modelo | EAM (décimas) | Precisión@10 | n holdout |
|---|---|---|---|
| heuristic | 5.315 | 0.512 | 400 |
| mean | 8.06 | 0.188 | 400 |
| random | 12.223 | 0.225 | 400 |
| content | 3.797 | 0.362 | 400 |

## Veredicto

CONTENT no gana a la heurística en las dos métricas (gana en EAM: predicción de nota; la heurística gana en precisión@10: ranking) → se deja EXPO_PUBLIC_RECOMMENDER=heuristic (defecto) y se documenta; el dueño puede pasar a content cuando se mida el embedding real de gte-small en producción

### Nota de validez

La evaluación mide la **lógica** del modelo (vector de gusto centrado, prior con
shrinkage, umbral de 20 valoraciones, regresión simple) con embeddings
sintéticos deterministas del contenido del mock. **No mide la calidad del
embedding real** (gte-small sobre sinopsis), que solo se cuantificará en
producción tras la primera sincronización con features. Por eso el veredicto
no fuerza el interruptor: el dueño puede pasar a `content` cuando quiera,
y el cliente degrada a `heuristic` si el RPC falla (red de seguridad).
