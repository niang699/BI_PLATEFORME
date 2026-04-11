"""
cache.py — Module Redis pour le cache des KPIs SEN'EAU

Connexion : redis-seneau sur 10.106.99.138:6380
Fallback   : si Redis indisponible, les endpoints retournent les données
             directement depuis PostgreSQL sans erreur.

TTL retenus (facturation = suivi journalier) :
  TTL_JOURNALIER  30 min  → mv_recouvrement, mv_ca, mv_reglements
  TTL_MENSUEL      1 h    → synthèses mensuelles, CODIR
  TTL_ANNUEL      24 h    → historiques annuels
  TTL_REFERENTIEL  7 j    → directions, abonnés, contrats
"""
import os
import json
import logging
import functools
from typing import Any, Callable, Optional

import redis as redis_lib

logger = logging.getLogger(__name__)

# ── Connexion Redis ───────────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "redis://10.106.99.138:6380")

_client: Optional[redis_lib.Redis] = None


def get_redis() -> Optional[redis_lib.Redis]:
    """Retourne le client Redis (singleton). None si indisponible."""
    global _client
    if _client is not None:
        return _client
    try:
        _client = redis_lib.from_url(
            REDIS_URL,
            socket_connect_timeout=2,
            socket_timeout=2,
            retry_on_timeout=False,
            decode_responses=True,
        )
        _client.ping()
        logger.info(f"Redis connecté : {REDIS_URL}")
    except Exception as e:
        logger.warning(f"Redis indisponible ({e}) — mode sans cache")
        _client = None
    return _client


# ── TTL (secondes) ────────────────────────────────────────────────────────────

class TTL:
    JOURNALIER  = 30 * 60       # 30 min  — mv_recouvrement, mv_ca, mv_reglements
    MENSUEL     = 60 * 60       #  1 h    — synthèses mensuelles
    ANNUEL      = 24 * 60 * 60  # 24 h    — historiques annuels
    REFERENTIEL = 7 * 24 * 3600 #  7 j    — directions, abonnés, contrats


# ── Helpers get / set / delete ────────────────────────────────────────────────

def cache_get(key: str) -> Optional[Any]:
    """Lit une valeur depuis Redis. Retourne None si absente ou Redis down."""
    r = get_redis()
    if not r:
        return None
    try:
        raw = r.get(key)
        return json.loads(raw) if raw else None
    except Exception as e:
        logger.debug(f"cache_get({key}) erreur : {e}")
        return None


def cache_set(key: str, value: Any, ttl: int = TTL.JOURNALIER) -> bool:
    """Stocke une valeur dans Redis avec un TTL en secondes."""
    r = get_redis()
    if not r:
        return False
    try:
        r.setex(key, ttl, json.dumps(value, ensure_ascii=False, default=str))
        return True
    except Exception as e:
        logger.debug(f"cache_set({key}) erreur : {e}")
        return False


def cache_delete(pattern: str) -> int:
    """Supprime toutes les clés correspondant au pattern (ex: 'seneau:recouvrement:*')."""
    r = get_redis()
    if not r:
        return 0
    try:
        keys = r.keys(pattern)
        if keys:
            return r.delete(*keys)
        return 0
    except Exception as e:
        logger.debug(f"cache_delete({pattern}) erreur : {e}")
        return 0


# ── Décorateur @cached ────────────────────────────────────────────────────────

def cached(key_prefix: str, ttl: int = TTL.JOURNALIER):
    """
    Décorateur pour mettre en cache le résultat d'une fonction async.

    Usage :
        @cached("seneau:recouvrement", ttl=TTL.JOURNALIER)
        async def get_recouvrement(annee: int, dr: str = None):
            ...

    La clé Redis sera construite à partir du préfixe + arguments de la fonction.
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Construire la clé depuis les arguments
            parts = [key_prefix] + [str(a) for a in args] + [f"{k}={v}" for k, v in sorted(kwargs.items())]
            key = ":".join(p for p in parts if p and str(p) != "None")

            # Lire depuis le cache
            cached_value = cache_get(key)
            if cached_value is not None:
                logger.debug(f"Cache HIT : {key}")
                return cached_value

            # Appeler la fonction source (DB)
            logger.debug(f"Cache MISS : {key} → requête DB")
            result = await func(*args, **kwargs)

            # Stocker en cache
            cache_set(key, result, ttl)
            return result

        return wrapper
    return decorator


# ── Stats & monitoring ────────────────────────────────────────────────────────

def cache_stats() -> dict:
    """Retourne les statistiques du cache Redis."""
    r = get_redis()
    if not r:
        return {"redis_ok": False, "message": "Redis indisponible — mode sans cache"}
    try:
        info = r.info("memory")
        nb_keys = r.dbsize()
        seneau_keys = r.keys("seneau:*")
        return {
            "redis_ok":        True,
            "url":             REDIS_URL,
            "nb_keys_total":   nb_keys,
            "nb_keys_seneau":  len(seneau_keys),
            "used_memory":     info.get("used_memory_human", "?"),
            "max_memory":      info.get("maxmemory_human", "?"),
        }
    except Exception as e:
        return {"redis_ok": False, "error": str(e)}
