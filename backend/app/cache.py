"""
cache.py — Patrón de la casa para toda llamada a un proveedor externo.

Un `Resource` envuelve UNA petición a un proveedor y garantiza:

  * caché en memoria con TTL (la segunda llamada no vuelve al proveedor);
  * vuelo único: si diez visitantes piden lo mismo a la vez, sale UNA sola
    petición y los diez esperan el mismo resultado;
  * espera acotada: quien llama espera como mucho `wait` segundos. Si el
    proveedor tarda más, la descarga sigue en segundo plano y llena la caché
    para la siguiente petición, pero el endpoint nunca se queda colgado;
  * `stale`: si el proveedor falla y hay un dato válido anterior, se sirve
    ese dato marcado como no actualizado en vez de un error 5xx;
  * pausa tras un fallo (`retry_after`): no se martillea a un proveedor
    caído ni se gasta su cuota (Launch Library 2: ~15 peticiones/hora).

No hace red por sí mismo: recibe la corrutina `fetch`.
"""

import asyncio
import time
from datetime import datetime, timezone
from typing import Awaitable, Callable, Optional

# Registro de recursos, para /api/health (solo lectura, sin llamar a nadie).
REGISTRY: dict = {}


class ProviderError(RuntimeError):
    """El proveedor falló (o aún no responde) y no hay dato previo que servir."""

    def __init__(self, message: str, pending: bool = False):
        super().__init__(message)
        self.pending = pending  # True: sigue cargando en segundo plano


def iso_utc(ts: Optional[float]) -> Optional[str]:
    """Marca de tiempo Unix -> ISO 8601 UTC con 'Z' (o None)."""
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class Resource:
    def __init__(
        self,
        name: str,
        fetch: Callable[[], Awaitable],
        ttl: float,
        wait: float = 22.0,
        retry_after: float = 60.0,
    ):
        self.name = name
        self._fetch = fetch
        self.ttl = ttl
        self.wait = wait
        self.retry_after = retry_after
        self.data = None
        self.ts: Optional[float] = None          # cuándo se obtuvo `data`
        self.last_error: Optional[str] = None
        self.last_error_ts: Optional[float] = None
        self._task: Optional[asyncio.Task] = None
        REGISTRY[name] = self

    # ── utilidades ────────────────────────────────────────────────────────
    def reset(self) -> None:
        """Olvida todo (para pruebas)."""
        self.data = None
        self.ts = None
        self.last_error = None
        self.last_error_ts = None
        self._task = None

    def age(self) -> Optional[float]:
        return None if self.ts is None else max(0.0, time.time() - self.ts)

    def is_fresh(self) -> bool:
        return self.data is not None and self.age() < self.ttl

    def status(self) -> dict:
        age = self.age()
        return {
            "has_data": self.data is not None,
            "age_s": None if age is None else round(age),
            "updated": iso_utc(self.ts),
            "ttl_s": self.ttl,
            "fresh": self.is_fresh(),
            "last_error": self.last_error,
            "last_error_at": iso_utc(self.last_error_ts),
        }

    # ── núcleo ────────────────────────────────────────────────────────────
    async def _run(self):
        try:
            data = await self._fetch()
        except Exception as e:
            self.last_error = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
            self.last_error_ts = time.time()
            raise
        self.data = data
        self.ts = time.time()
        self.last_error = None
        self.last_error_ts = None
        return data

    def _live_task(self) -> Optional[asyncio.Task]:
        """La descarga en curso, si pertenece al bucle de eventos actual."""
        t = self._task
        if t is None or t.done():
            return None
        try:
            if t.get_loop() is not asyncio.get_running_loop():
                return None
        except RuntimeError:
            return None
        return t

    def _in_backoff(self) -> bool:
        return (
            self.last_error_ts is not None
            and time.time() - self.last_error_ts < self.retry_after
        )

    def _fallback(self, message: str, pending: bool = False):
        if self.data is not None:
            return self.data, True
        raise ProviderError(message, pending=pending)

    async def get(self):
        """Devuelve (dato, stale). Lanza ProviderError si no hay nada que servir."""
        if self.is_fresh():
            return self.data, False

        task = self._live_task()
        if task is None:
            if self._in_backoff():
                # Falló hace poco: no se reintenta todavía.
                return self._fallback(self.last_error or "proveedor no disponible")
            task = asyncio.get_running_loop().create_task(self._run())
            # Evita el aviso "exception was never retrieved" si nadie espera.
            task.add_done_callback(lambda t: t.cancelled() or t.exception())
            self._task = task

        done, _ = await asyncio.wait({task}, timeout=self.wait)
        if not done:
            # Sigue en segundo plano; no se cancela para que llene la caché.
            return self._fallback(
                f"el proveedor tarda más de {self.wait:.0f} s; la descarga "
                "continúa en segundo plano, reintenta en unos segundos",
                pending=True,
            )
        if task.cancelled():
            return self._fallback("la consulta al proveedor fue cancelada")
        exc = task.exception()
        if exc is not None:
            return self._fallback(self.last_error or str(exc) or type(exc).__name__)
        return task.result(), False


def provider_headers() -> dict:
    """Cabeceras comunes para las peticiones a proveedores.

    La política de uso de las API de JPL pide que los procesos automáticos
    se identifiquen con un User-Agent propio (producto, versión y contacto).
    Ese dato lo decide quien despliega: variable de entorno
    TESEO_USER_AGENT, p. ej. "Teseo/0.2 (+https://tu-sitio; correo@dominio)".
    Si no está definida se usa el User-Agent por defecto de httpx.
    """
    import os

    ua = os.environ.get("TESEO_USER_AGENT", "").strip()
    return {"User-Agent": ua} if ua else {}
