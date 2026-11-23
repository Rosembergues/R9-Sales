"""Grava os resultados do parsing no Supabase pela API REST (HTTPS, porta
443) -- a rede local bloqueia as portas de banco 5432/6543.

Acesso (ver scripts/.env.example):

* Recomendado: SUPABASE_ANON_KEY + SUPABASE_INGEST_TOKEN. O script chama as
  funcoes ingest_funil_captacao / ingest_unit_ranking
  (supabase/automacao-token-importacao.sql), que so aceitam gravar nas caixas
  de entrada e conferem o token. Se este computador for comprometido, o
  estrago possivel e inserir linhas nas caixas de entrada -- nada mais.
* Legado: SUPABASE_SERVICE_ROLE_KEY. Funciona, mas essa chave ignora todas as
  regras de acesso do banco. Use so ate rodar o SQL do token e depois apague
  a chave do .env.

Nos dois casos a resposta ja diz se o gatilho do banco conseguiu mesclar a
linha (processed / process_error); se nao conseguiu, levanta erro para o PDF
ir para a pasta de erros.
"""
from __future__ import annotations

import os
import sys

import requests

from parse_bi_pdf import FunilResult, RankingResult

TIMEOUT = 20


def _base_url() -> str:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not url:
        raise RuntimeError("SUPABASE_URL nao configurada (ver scripts/.env.example)")
    return url + "/rest/v1"


def _usa_token() -> bool:
    return bool(os.environ.get("SUPABASE_INGEST_TOKEN"))


_avisou_legado = False


def _headers() -> dict:
    global _avisou_legado
    if _usa_token():
        key = os.environ.get("SUPABASE_ANON_KEY", "")
        if not key:
            raise RuntimeError("SUPABASE_INGEST_TOKEN configurado, mas falta SUPABASE_ANON_KEY (ver scripts/.env.example)")
    else:
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not key:
            raise RuntimeError("Configure SUPABASE_ANON_KEY + SUPABASE_INGEST_TOKEN em scripts/.env (ver .env.example)")
        if not _avisou_legado:
            print(
                "AVISO: usando a service_role (acesso total ao banco). Rode supabase/automacao-token-importacao.sql "
                "e troque para SUPABASE_INGEST_TOKEN.",
                file=sys.stderr,
            )
            _avisou_legado = True
    headers = {"apikey": key, "Content-Type": "application/json"}
    # Chaves antigas (JWT, "eyJ...") tambem vao no Authorization. As novas
    # (sb_publishable_... / sb_secret_...) nao sao JWT: vao so no apikey.
    if key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {key}"
    return headers


def _conferir_resultado(tabela: str, linha: dict) -> None:
    if not linha.get("processed"):
        erro = linha.get("process_error") or "motivo nao informado"
        raise RuntimeError(f"O banco recebeu a linha em {tabela}, mas nao conseguiu mesclar: {erro}")


def _gravar(tabela: str, funcao: str, row: dict) -> None:
    if _usa_token():
        resp = requests.post(
            f"{_base_url()}/rpc/{funcao}",
            json={"p_token": os.environ["SUPABASE_INGEST_TOKEN"], "p_row": row},
            headers=_headers(),
            timeout=TIMEOUT,
        )
        if resp.status_code >= 300:
            raise RuntimeError(f"Supabase recusou {funcao} ({resp.status_code}): {resp.text}")
        _conferir_resultado(tabela, resp.json())
        return

    resp = requests.post(
        f"{_base_url()}/{tabela}",
        json=row,
        headers={**_headers(), "Prefer": "return=representation"},
        params={"select": "processed,process_error"},
        timeout=TIMEOUT,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"Supabase recusou o insert em {tabela} ({resp.status_code}): {resp.text}")
    linhas = resp.json()
    _conferir_resultado(tabela, linhas[0] if linhas else {})


def write_funil_result(result: FunilResult, reference_date: str, source: str = "python_local") -> None:
    _gravar(
        "goal_daily_inbox",
        "ingest_funil_captacao",
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
    _gravar(
        "unit_ranking_inbox",
        "ingest_unit_ranking",
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
