"""Confere o parsing de PDFs do Power BI SEM gravar nada no banco.

Uso:
    python scripts/conferir_pdfs.py [pasta]

Sem pasta, usa RELATORIOS_BI_PASTA do scripts/.env (ou Downloads/RelatoriosBI).
Util para testar um relatorio novo ou um layout que mudou antes de deixar a
importacao diaria rodar.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from parse_bi_pdf import parse_funil_captacao, parse_ranking_unidades  # noqa: E402
from run_daily_import import PASTA, classificar  # noqa: E402


def main() -> None:
    pasta = Path(sys.argv[1]) if len(sys.argv) > 1 else PASTA
    pdfs = sorted(pasta.glob("*.pdf"))
    print(f"=== {len(pdfs)} PDF(s) em {pasta} ===")
    for pdf in pdfs:
        try:
            tipo = classificar(pdf)
            if tipo == "funil_captacao":
                print(f"OK   {pdf.name}: {parse_funil_captacao(pdf)}")
            elif tipo == "ranking_unidades":
                print(f"OK   {pdf.name}: {parse_ranking_unidades(pdf)}")
            else:
                print(f"--   {pdf.name}: {tipo}")
        except Exception as exc:  # noqa: BLE001
            print(f"FAIL {pdf.name}: {exc}")


if __name__ == "__main__":
    main()
