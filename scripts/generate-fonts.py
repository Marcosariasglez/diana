#!/usr/bin/env python3
"""
Genera los 7 TTF estáticos de Diana a partir de fuentes variables oficiales.

Fuentes de origen:
  - Manrope: assets/fonts/Manrope-VariableFont.ttf (variable wght 200-800, glyf)
    -> instancia SemiBold(600), Bold(700), ExtraBold(800)
  - Inter:   Inter[opsz,wght].ttf desde el repositorio oficial google/fonts (GitHub)
    -> instancia Regular(400), Medium(500), SemiBold(600), Bold(700) con opsz=14

Validación: cada TTF generado se verifica con fontTools (carga completa +
verificación estricta) y se comprueba el magic number (00010000 TTF /
'true' / 'OTTO'). Si un archivo ya existe y es válido, se regenera igualmente
para garantizar trazabilidad.

Uso:  python scripts/generate-fonts.py
Dep:   pip install fonttools
"""

import io
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS_DIR = os.path.join(ROOT, "assets", "fonts")
TMP = os.path.join(FONTS_DIR, ".Inter-Variable.ttf.tmp")

INTER_URL = (
    "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf"
)

MANROPE_SRC = os.path.join(FONTS_DIR, "Manrope-VariableFont.ttf")

# (nombre de archivo, fuente de origen, ejes a fijar)
JOBS = [
    ("Manrope-SemiBold.ttf", MANROPE_SRC, {"wght": 600}),
    ("Manrope-Bold.ttf", MANROPE_SRC, {"wght": 700}),
    ("Manrope-ExtraBold.ttf", MANROPE_SRC, {"wght": 800}),
    ("Inter-Regular.ttf", TMP, {"opsz": 14, "wght": 400}),
    ("Inter-Medium.ttf", TMP, {"opsz": 14, "wght": 500}),
    ("Inter-SemiBold.ttf", TMP, {"opsz": 14, "wght": 600}),
    ("Inter-Bold.ttf", TMP, {"opsz": 14, "wght": 700}),
]


def die(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def check_magic(path: str) -> str:
    with open(path, "rb") as f:
        magic = f.read(4).hex()
    if magic not in ("00010000", "74727565", "4F54544F"):
        die(f"{os.path.basename(path)} no es un TTF válido (magic={magic})")
    return magic


def valid_ttf(path: str) -> bool:
    if not os.path.exists(path):
        return False
    try:
        magic = check_magic(path)
    except SystemExit:
        return False
    from fontTools.ttLib import TTFont

    try:
        TTFont(path, fontNumber=0, lazy=False)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"  {os.path.basename(path)} inválido: {exc}", file=sys.stderr)
        return False


def download_inter() -> None:
    if valid_ttf(TMP):
        print(f"Inter variable ya en {TMP}")
        return
    print("Descargando Inter variable (google/fonts)...")
    req = urllib.request.Request(INTER_URL, headers={"User-Agent": "diana-fonts/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    if len(data) < 100_000:
        die(f"descarga de Inter demasiado corta ({len(data)} B) — ¿HTML de error?")
    with open(TMP, "wb") as f:
        f.write(data)
    if not valid_ttf(TMP):
        os.remove(TMP)
        die("el Inter descargado no pasa validación fontTools")
    print(f"  OK: {len(data)} B, magic={check_magic(TMP)}")


def instance(src: str, axes: dict, out_path: str) -> None:
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont

    varfont = TTFont(src, fontNumber=0)
    font = instantiateVariableFont(varfont, axes, inplace=True)
    font.save(out_path)


def main() -> None:
    try:
        import fontTools  # noqa: F401
    except ImportError:
        die("fontTools no instalado (pip install fonttools)")

    if not valid_ttf(MANROPE_SRC):
        die(f"la fuente variable {MANROPE_SRC} no es un TTF válido")
    print(f"Manrope variable OK: {check_magic(MANROPE_SRC)}")

    download_inter()

    for name, src, axes in JOBS:
        out_path = os.path.join(FONTS_DIR, name)
        axes_label = ", ".join(f"{k}={v}" for k, v in axes.items())
        print(f"Instanciando {name} ({axes_label})...")
        instance(src, axes, out_path)
        if not valid_ttf(out_path):
            die(f"salida inválida: {name}")
        print(f"  OK: {os.path.getsize(out_path)} B, magic={check_magic(out_path)}")

    if TMP != MANROPE_SRC and os.path.exists(TMP):
        os.remove(TMP)

    print("Las 7 fuentes estáticas están generadas y validadas.")


if __name__ == "__main__":
    main()
