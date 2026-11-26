"""Versión de Teseo en el backend (la misma que "version" en package.json de la raíz; tests/test_api.py lo
comprueba). Módulo aparte, sin dependencias, para que main.py y peaks.py la importen sin import circular."""

VERSION = "1.102.1"
