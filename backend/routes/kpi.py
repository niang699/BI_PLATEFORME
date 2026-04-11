"""
routes/kpi.py — Endpoints KPIs avec cache Redis

Vues PostgreSQL ciblées :
  mv_recouvrement  → taux recouvrement par DR / bimestre
  mv_ca            → chiffre d'affaires par DR / groupe / période
  mv_reglements    → règlements et impayés

TTL : 30 minutes (suivi journalier — données non temps réel)
Invalidation : POST /kpi/cache/invalidate?prefix=recouvrement
"""
import os
import logging
from typing import Optional

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, HTTPException, Query, Depends

from auth import get_current_user
from models import User
from cache import cached, cache_delete, cache_stats, TTL

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/kpi", tags=["KPIs"])

# ── Connexion PostgreSQL sen_ods ──────────────────────────────────────────────

def get_ods_conn():
    return psycopg2.connect(
        host=os.getenv("DB_ODS_HOST", "10.106.99.138"),
        port=int(os.getenv("DB_ODS_PORT", "5432")),
        dbname=os.getenv("DB_ODS_NAME", "sen_ods"),
        user=os.getenv("DB_ODS_USER", "postgres"),
        password=os.getenv("DB_ODS_PASSWORD", "mysecretpassword"),
        cursor_factory=psycopg2.extras.RealDictCursor,
        connect_timeout=5,
    )


# ── /kpi/recouvrement ─────────────────────────────────────────────────────────

@router.get("/recouvrement")
@cached("seneau:recouvrement", ttl=TTL.JOURNALIER)
async def get_recouvrement(
    annee: Optional[int] = Query(None, description="Année (défaut : dernière disponible)"),
    dr:    Optional[str] = Query(None, description="Filtre Direction Régionale"),
    _user: User = Depends(get_current_user),
):
    """
    Taux de recouvrement par DR et bimestre depuis mv_recouvrement.
    Cache 30 minutes (suivi journalier).
    """
    try:
        conn = get_ods_conn()
        cur  = conn.cursor()

        # Année par défaut : dernière disponible dans la vue
        if not annee:
            cur.execute("SELECT MAX(annee) FROM mv_recouvrement")
            annee = cur.fetchone()["max"] or 2025

        # Filtre DR optionnel (pour les lecteur_dt)
        dr_filter = "AND direction_territoriale = %(dr)s" if dr else ""

        cur.execute(f"""
            SELECT
                direction_territoriale  AS dr,
                bimestre,
                annee,
                nb_factures,
                ca_total,
                encaissement,
                impaye,
                taux_recouvrement,
                taux_impaye,
                a_risque,
                ecart_objectif
            FROM mv_recouvrement
            WHERE annee = %(annee)s
            {dr_filter}
            ORDER BY taux_recouvrement ASC
        """, {"annee": annee, "dr": dr})

        rows = [dict(r) for r in cur.fetchall()]

        # Agrégats globaux
        if rows:
            ca_total      = sum(r["ca_total"]      for r in rows)
            encaissement  = sum(r["encaissement"]  for r in rows)
            impaye        = sum(r["impaye"]         for r in rows)
            nb_factures   = sum(r["nb_factures"]    for r in rows)
            taux_global   = round(encaissement / ca_total * 100, 2) if ca_total else 0
            dts_a_risque  = [r for r in rows if r["a_risque"]]
            meilleure_dt  = max(rows, key=lambda r: r["taux_recouvrement"])
            pire_dt       = min(rows, key=lambda r: r["taux_recouvrement"])
        else:
            ca_total = encaissement = impaye = nb_factures = taux_global = 0
            dts_a_risque = []
            meilleure_dt = pire_dt = None

        conn.close()

        return {
            "annee":           annee,
            "ca_total":        ca_total,
            "encaissement":    encaissement,
            "impaye":          impaye,
            "nb_factures":     nb_factures,
            "taux_recouvrement": taux_global,
            "nb_dr":           len(rows),
            "par_dr":          rows,
            "dts_a_risque":    dts_a_risque,
            "meilleure_dt":    meilleure_dt,
            "pire_dt":         pire_dt,
            "source":          "mv_recouvrement",
        }

    except Exception as e:
        logger.error(f"Erreur /kpi/recouvrement : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur base de données : {e}")


# ── /kpi/ca ───────────────────────────────────────────────────────────────────

@router.get("/ca")
@cached("seneau:ca", ttl=TTL.JOURNALIER)
async def get_ca(
    annee:  Optional[int] = Query(None, description="Année"),
    dr:     Optional[str] = Query(None, description="Filtre Direction Régionale"),
    _user:  User = Depends(get_current_user),
):
    """
    Chiffre d'affaires par DR, groupe de facturation et période depuis mv_ca.
    Cache 30 minutes (suivi journalier).
    """
    try:
        conn = get_ods_conn()
        cur  = conn.cursor()

        if not annee:
            cur.execute("SELECT MAX(annee) FROM mv_ca")
            annee = cur.fetchone()["max"] or 2025

        dr_filter = "AND direction_territoriale = %(dr)s" if dr else ""

        cur.execute(f"""
            SELECT
                direction_territoriale  AS dr,
                groupe_facturation,
                bimestre,
                annee,
                nb_factures,
                ca_total,
                encaissement,
                impaye,
                taux_recouvrement,
                taux_impaye
            FROM mv_ca
            WHERE annee = %(annee)s
            {dr_filter}
            ORDER BY ca_total DESC
        """, {"annee": annee, "dr": dr})

        rows = [dict(r) for r in cur.fetchall()]

        # Regroupements utiles pour le frontend
        par_groupe: dict = {}
        for r in rows:
            g = r["groupe_facturation"] or "Autre"
            if g not in par_groupe:
                par_groupe[g] = {"groupe_facturation": g, "ca_total": 0, "encaissement": 0, "impaye": 0, "nb_factures": 0}
            par_groupe[g]["ca_total"]     += r["ca_total"]
            par_groupe[g]["encaissement"] += r["encaissement"]
            par_groupe[g]["impaye"]       += r["impaye"]
            par_groupe[g]["nb_factures"]  += r["nb_factures"]

        ca_total = sum(r["ca_total"] for r in rows)
        conn.close()

        return {
            "annee":          annee,
            "ca_total":       ca_total,
            "par_dr":         rows,
            "par_groupe":     list(par_groupe.values()),
            "source":         "mv_ca",
        }

    except Exception as e:
        logger.error(f"Erreur /kpi/ca : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur base de données : {e}")


# ── /kpi/reglements ───────────────────────────────────────────────────────────

@router.get("/reglements")
@cached("seneau:reglements", ttl=TTL.JOURNALIER)
async def get_reglements(
    annee:  Optional[int] = Query(None, description="Année"),
    dr:     Optional[str] = Query(None, description="Filtre Direction Régionale"),
    _user:  User = Depends(get_current_user),
):
    """
    Règlements et impayés depuis mv_reglements.
    Cache 30 minutes (suivi journalier).
    """
    try:
        conn = get_ods_conn()
        cur  = conn.cursor()

        if not annee:
            cur.execute("SELECT MAX(annee) FROM mv_reglements")
            annee = cur.fetchone()["max"] or 2025

        dr_filter = "AND direction_territoriale = %(dr)s" if dr else ""

        cur.execute(f"""
            SELECT
                direction_territoriale  AS dr,
                bimestre,
                annee,
                nb_reglements,
                montant_regle,
                montant_impaye,
                taux_recouvrement,
                nb_clients_en_retard
            FROM mv_reglements
            WHERE annee = %(annee)s
            {dr_filter}
            ORDER BY montant_impaye DESC
        """, {"annee": annee, "dr": dr})

        rows = [dict(r) for r in cur.fetchall()]

        montant_total_regle  = sum(r["montant_regle"]  for r in rows)
        montant_total_impaye = sum(r["montant_impaye"] for r in rows)
        nb_clients_retard    = sum(r.get("nb_clients_en_retard", 0) for r in rows)

        conn.close()

        return {
            "annee":               annee,
            "montant_total_regle": montant_total_regle,
            "montant_total_impaye": montant_total_impaye,
            "nb_clients_en_retard": nb_clients_retard,
            "par_dr":              rows,
            "source":              "mv_reglements",
        }

    except Exception as e:
        logger.error(f"Erreur /kpi/reglements : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur base de données : {e}")


# ── /kpi/cache/invalidate ─────────────────────────────────────────────────────

@router.post("/cache/invalidate")
async def invalidate_cache(
    prefix: Optional[str] = Query(None, description="Préfixe à invalider (ex: recouvrement, ca, reglements). Vide = tout vider."),
    _user:  User = Depends(get_current_user),
):
    """
    Invalide le cache Redis.
    À appeler après un import ETL Talend ou un REFRESH MATERIALIZED VIEW.

    Exemples :
      POST /kpi/cache/invalidate                    → vide tout
      POST /kpi/cache/invalidate?prefix=recouvrement → vide mv_recouvrement
    """
    pattern = f"seneau:{prefix}:*" if prefix else "seneau:*"
    nb = cache_delete(pattern)
    return {
        "ok":      True,
        "pattern": pattern,
        "deleted": nb,
    }


# ── /kpi/cache/stats ─────────────────────────────────────────────────────────

@router.get("/cache/stats")
async def get_cache_stats(_user: User = Depends(get_current_user)):
    """Statistiques du cache Redis (mémoire, nombre de clés, état)."""
    return cache_stats()
