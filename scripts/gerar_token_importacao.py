"""Gera um token para a importacao diaria (ver supabase/automacao-token-importacao.sql).

Uso:
    python scripts/gerar_token_importacao.py [nome-do-computador]

Mostra duas coisas:
  1. a linha SUPABASE_INGEST_TOKEN=... para colar no scripts/.env (secreta);
  2. o INSERT para rodar no SQL Editor do Supabase -- ele leva so o hash do
     token, entao o token em si nunca passa pelo banco nem pelo historico do
     SQL Editor.
"""
from __future__ import annotations

import hashlib
import platform
import secrets
import sys


def main() -> None:
    label = sys.argv[1] if len(sys.argv) > 1 else platform.node() or "importacao-local"
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    label_sql = label.replace("'", "''")

    print("1) Cole no scripts/.env (nao compartilhe):\n")
    print(f"SUPABASE_INGEST_TOKEN={token}\n")
    print("2) Rode no Supabase (SQL Editor):\n")
    print(f"insert into public.ingest_tokens (label, token_hash) values ('{label_sql}', '{token_hash}');\n")


if __name__ == "__main__":
    main()
