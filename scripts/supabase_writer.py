"""Grava os resultados do parsing nas caixas de entrada do Supabase
(goal_daily_inbox / unit_ranking_inbox) usando a API REST (HTTPS, porta 443)
em vez de conexao direta com o Postgres -- a rede local bloqueia as portas
5432/6543, mas a 443 (a mesma do navegador) passa.

Usa a service_role key (bypassa RLS) porque as politicas de insercao hoje
so liberam o role de banco "power_automate_ingest", nao a API REST.

As credenciais vem de variaveis de ambiente -- nunca ficam hardcoded aqui
nem em nenhum arquivo versionado. Ver scripts/.env.example.
"""
from __future__ import annotations

import os

import requests

from parse_bi_pdf import FunilResult, RankingResult


def _base_url() -> str:
    return os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1"


def _headers(extra: dict | None = None) -> dict:
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def _insert(table: str, row: dict) -> None:
    resp = requests.post(
        f"{_base_url()}/{table}",
        json=row,
        headers=_headers({"Prefer": "return=minimal"}),
        timeout=20,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"Supabase recusou o insert em {table} ({resp.status_code}): {resp.text}")


def write_funil_result(result: FunilResult, reference_date: str, source: str = "python_local") -> None:
    _insert(
        "goal_daily_inbox",
        {
            "academic_period": result.academic_period,
            "product": "Curso Técnico" if result.goal_group == "tecnico_presencial" else "Graduação",
            "goal_group": result.goal_group,
            "reference_date": reference_date,
            "aa_to_date": result.aa_to_date,
            "target_to_date": result.target_to_date,
            "actual_to_date": result.actual_to_date,
            "source": source,
        },
    )


def write_ranking_result(result: RankingResult, reference_date: str, source: str = "python_local") -> None:
    _insert(
        "unit_ranking_inbox",
        {
            "reference_date": reference_date,
            "bu": result.bu,
            "academic_period": result.academic_period,
            "our_rank": result.our_rank,
            "our_aa": result.our_aa,
            "our_meta": result.our_meta,
            "our_real": result.our_real,
            "market_aa": result.market_aa,
            "market_meta": result.market_meta,
            "market_real": result.market_real,
            "source": source,
        },
    )


def fetch_recent_errors(limit: int = 20):
    """Usado pelo orquestrador para avisar se alguma linha falhou no gatilho do banco."""
    out = []
    for table in ("goal_daily_inbox", "unit_ranking_inbox"):
        resp = requests.get(
            f"{_base_url()}/{table}",
            params={
                "select": "id,received_at,process_error",
                "processed": "eq.false",
                "process_error": "not.is.null",
                "order": "received_at.desc",
                "limit": str(limit),
            },
            headers=_headers(),
            timeout=20,
        )
        if resp.status_code >= 300:
            raise RuntimeError(f"Supabase recusou a consulta em {table} ({resp.status_code}): {resp.text}")
        for row in resp.json():
            out.append((table, row["id"], row["received_at"], row["process_error"]))
    return out
