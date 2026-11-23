"""Roda todo dia (via Agendador de Tarefas do Windows): le os PDFs que
caem numa pasta, extrai os numeros, grava no Supabase e arquiva o que ja
foi processado (subpastas "processados" e "erros").

Uso:
    python run_daily_import.py

Configuracao em scripts/.env (ver scripts/.env.example):
    RELATORIOS_BI_PASTA                          pasta onde os PDFs baixados do e-mail caem
    SUPABASE_URL                                 endereco do projeto
    SUPABASE_ANON_KEY + SUPABASE_INGEST_TOKEN    acesso restrito (ver supabase_writer.py)
"""
from __future__ import annotations

import datetime
import os
import shutil
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

# Evita o script quebrar se alguma mensagem de erro vier com caractere que o
# console do Windows (cp1252) nao sabe imprimir.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(errors="replace")
    except Exception:  # noqa: BLE001
        pass

from parse_bi_pdf import parse_funil_captacao, parse_ranking_unidades  # noqa: E402
from supabase_writer import write_funil_result, write_ranking_result  # noqa: E402

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

DEFAULT_PASTA = Path.home() / "Downloads" / "RelatoriosBI"
PASTA = Path(os.environ.get("RELATORIOS_BI_PASTA") or DEFAULT_PASTA)
PROCESSADOS = PASTA / "processados"
ERROS = PASTA / "erros"


def _primeira_linha(pdf_path: Path) -> str:
    import pdfplumber

    with pdfplumber.open(pdf_path) as pdf:
        text = pdf.pages[0].extract_text() or ""
    return text.split("\n", 1)[0]


def classificar(pdf_path: Path) -> str:
    titulo = _primeira_linha(pdf_path).lower()
    if "curva funil" in titulo:
        return "curva_funil"  # so grafico, nao da pra extrair
    if "funil de capta" in titulo:
        return "funil_captacao"
    if "ranking unidades" in titulo:
        return "ranking_unidades"
    return "desconhecido"


def destino_livre(pasta: Path, nome: str) -> Path:
    """Caminho em `pasta` que ainda nao existe: nome.pdf, nome_2.pdf, nome_3.pdf..."""
    destino = pasta / nome
    n = 2
    while destino.exists():
        destino = pasta / f"{Path(nome).stem}_{n}{Path(nome).suffix}"
        n += 1
    return destino


def arquivar(pdf_path: Path, pasta: Path, hoje: str) -> None:
    try:
        shutil.move(str(pdf_path), str(destino_livre(pasta, f"{hoje}_{pdf_path.name}")))
    except OSError as exc:
        # Nao derruba o lote: o PDF fica na pasta e entra de novo na proxima execucao.
        print(f"  AVISO       nao consegui mover {pdf_path.name} para {pasta.name}: {exc}")


def processar_um(pdf_path: Path, hoje: str) -> None:
    tipo = classificar(pdf_path)

    if tipo == "funil_captacao":
        resultado = parse_funil_captacao(pdf_path)
        write_funil_result(resultado, hoje)
        print(f"  OK (funil)   {pdf_path.name}: {resultado.goal_group} periodo={resultado.academic_period} "
              f"aa={resultado.aa_to_date} meta={resultado.target_to_date} atual={resultado.actual_to_date}")
    elif tipo == "ranking_unidades":
        resultado = parse_ranking_unidades(pdf_path)
        write_ranking_result(resultado, hoje)
        print(f"  OK (ranking) {pdf_path.name}: {resultado.bu} periodo={resultado.academic_period} "
              f"rank={resultado.our_rank} nosso_real={resultado.our_real} mercado_real={resultado.market_real}")
        for aviso in resultado.avisos:
            print(f"  AVISO       {pdf_path.name}: {aviso}")
    elif tipo == "curva_funil":
        print(f"  IGNORADO    {pdf_path.name}: relatorio 'Curva Funil' e so grafico, nao tem dado pra extrair.")
    else:
        raise ValueError("Nao reconheci o tipo de relatorio (nao e Funil de Captacao nem Ranking Unidades).")


def main() -> None:
    PROCESSADOS.mkdir(parents=True, exist_ok=True)
    ERROS.mkdir(parents=True, exist_ok=True)

    hoje = datetime.date.today().isoformat()  # data local da maquina
    pdfs = sorted(PASTA.glob("*.pdf"))

    print(f"=== Importação diária · {hoje} · {len(pdfs)} PDF(s) em {PASTA} ===")

    falhas = 0
    for pdf_path in pdfs:
        try:
            processar_um(pdf_path, hoje)
        except Exception as exc:  # noqa: BLE001
            falhas += 1
            print(f"  FALHOU      {pdf_path.name}: {exc}")
            traceback.print_exc()
            arquivar(pdf_path, ERROS, hoje)
        else:
            arquivar(pdf_path, PROCESSADOS, hoje)

    print(f"\nConcluído: {len(pdfs) - falhas} ok, {falhas} falha(s).")
    if falhas:
        sys.exit(1)


if __name__ == "__main__":
    main()
