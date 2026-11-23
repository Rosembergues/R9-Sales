"""Testa a configuracao do scripts/.env SEM gravar nada no banco.

Uso:
    python scripts/testar_acesso.py

Chama a funcao ingest_funil_captacao com o token do .env e uma linha
propositalmente vazia. O banco confere o token primeiro:
  * token errado  -> "token de importacao invalido"   (nada e gravado)
  * token certo   -> a linha vazia e recusada pela regra de campo obrigatorio
                     (nada e gravado), o que prova que o token passou.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

from supabase_writer import _base_url, _headers  # noqa: E402


def main() -> None:
    if not os.environ.get("SUPABASE_INGEST_TOKEN"):
        sys.exit("FALTA: SUPABASE_INGEST_TOKEN no scripts/.env (gere com scripts/gerar_token_importacao.py).")
    if os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        print("AVISO: o .env ainda tem SUPABASE_SERVICE_ROLE_KEY. Ela nao e usada com o token; apague a linha.")

    resp = requests.post(
        f"{_base_url()}/rpc/ingest_funil_captacao",
        json={"p_token": os.environ["SUPABASE_INGEST_TOKEN"], "p_row": {}},
        headers=_headers(),
        timeout=20,
    )
    texto = resp.text.lower()
    if resp.status_code < 300:
        sys.exit("INESPERADO: o banco aceitou uma linha vazia. Confira o SQL da caixa de entrada.")
    if "token" in texto and "inv" in texto:
        sys.exit("FALHOU: o banco recusou o token. Confira se rodou o INSERT do gerar_token_importacao.py.")
    if "not-null" in texto or "null value" in texto or "23502" in texto:
        print("OK: chave e token aceitos. Nada foi gravado. A importacao diaria vai usar o acesso restrito.")
        return
    if resp.status_code in (401, 403) or "api key" in texto:
        sys.exit(f"FALHOU: a chave SUPABASE_ANON_KEY foi recusada ({resp.status_code}): {resp.text}")
    if resp.status_code == 404 or "could not find the function" in texto:
        sys.exit("FALHOU: a funcao nao existe. Rode supabase/automacao-token-importacao.sql no Supabase.")
    sys.exit(f"FALHOU ({resp.status_code}): {resp.text}")


if __name__ == "__main__":
    main()
