# Evaluación del recomendador (D2-2.4)

> Generado por `scripts/eval-recomendador.mjs` el 2026-10-09T20:36:06.643Z.

## Dataset (sintético, «dejar uno fuera»)

- Catálogo: mocks del repo (122 títulos).
- Valoraciones: 16 usuarios sintéticos con perfil de género; 40 títulos de entrenar por usuario, el resto holdout.
- Embeddings: sintéticos (vocabulario de contenido) — la calidad del embedding real (gte-small) solo se mide en producción.
- Heurística actual: `predictTenths` con el mismo historial (40 ratings) que el modelo content; sin mazo de onboarding (no existe en el sintético).
- Precisión@10: por usuario, de su top-10 real (por nota verdadera dentro del holdout), cuántos caen en el top-10 ordenado por la predicción de cada modelo.

## Resultados

| Modelo | EAM (décimas) | Precisión@10 | n holdout |
|---|---|---|---|
| heuristic | 5.42 | 0.569 | 800 |
| mean | 8.803 | 0.181 | 800 |
| random | 11.758 | 0.212 | 800 |
| content | 3.705 | 0.444 | 800 |

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
