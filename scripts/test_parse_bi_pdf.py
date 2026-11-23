"""Testes do parsing dos PDFs do Power BI, em cima de texto ja extraido.

Rodar: npm run test:py   (ou: python -m unittest discover -s scripts -p "test_*.py")

Os textos abaixo imitam o que o pdfplumber extrai dos relatorios reais. Se o
layout do Power BI mudar, confira com scripts/conferir_pdfs.py e ajuste aqui.
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from parse_bi_pdf import (  # noqa: E402
    FILTER_ICON,
    _to_number,
    parse_funil_captacao_text,
    parse_ranking_unidades_text,
)

I = FILTER_ICON


def funil(modalidade: str, mfin: str = "M.FIN 1.234 1.500 1.100 73% 89%") -> str:
    return f"Funil de Captacao - Sava\nAll{I} 2027.1{I} {modalidade}{I} Todos{I}\nINSC 10 20 30\n{mfin}\n"


class ToNumber(unittest.TestCase):
    def test_formatos(self):
        self.assertEqual(_to_number("1.234"), 1234)
        self.assertEqual(_to_number("12,5"), 12.5)
        self.assertEqual(_to_number("(Blank)"), 0)
        self.assertIsNone(_to_number(""))
        self.assertIsNone(_to_number("abc"))


class Funil(unittest.TestCase):
    def test_modalidade_pelo_filtro(self):
        r = parse_funil_captacao_text(funil("PRESENCIAL"), "x.pdf")
        self.assertEqual((r.academic_period, r.goal_group), ("2027.1", "graduacao_presencial"))
        self.assertEqual((r.aa_to_date, r.target_to_date, r.actual_to_date), (1234, 1500, 1100))
        self.assertEqual(parse_funil_captacao_text(funil("Presencial (BU) + Se\ufffd"), "x.pdf").goal_group,
                         "graduacao_semipresencial")
        self.assertEqual(parse_funil_captacao_text(funil("AO VIVO"), "x.pdf").goal_group, "graduacao_aovivo")
        self.assertEqual(parse_funil_captacao_text(funil("BU DIGITAL"), "x.pdf").goal_group, "graduacao_ead")

    def test_blank_vira_zero(self):
        r = parse_funil_captacao_text(funil("PRESENCIAL", "M.FIN 10 (Blank) 5"), "x.pdf")
        self.assertEqual(r.target_to_date, 0)

    def test_filtro_ambiguo_usa_nome_do_arquivo(self):
        texto = funil("Multiple selections")
        casos = {
            "Funil Sava - Met. Semipresencial.pdf": "graduacao_semipresencial",
            "Funil Sava - Met. Semi-Presencial.pdf": "graduacao_semipresencial",
            "Funil Sava - Met. Pres.pdf": "graduacao_presencial",
            "Funil Sava - Met. Ao Vivo.pdf": "graduacao_aovivo",
            "Funil Sava - BU Digital.pdf": "graduacao_ead",
        }
        for nome, esperado in casos.items():
            with self.subTest(nome=nome):
                self.assertEqual(parse_funil_captacao_text(texto, nome).goal_group, esperado)

    def test_nome_com_varias_modalidades_e_erro(self):
        with self.assertRaisesRegex(ValueError, "ambiguo"):
            parse_funil_captacao_text(funil("Multiple selections"), "Funil Sava - Met. Pres-Semi-Ao Vivo-BU Digital.pdf")

    def test_pasta_nao_influencia(self):
        caminho = str(Path("C:/Relatorios Digital/Funil Sava - Met. Pres.pdf"))
        self.assertEqual(parse_funil_captacao_text(funil("Multiple selections"), caminho).goal_group,
                         "graduacao_presencial")

    def test_tecnico(self):
        texto = f"Funil de Captacao - Cursos Tecnicos\nAll{I} 2027.1{I} PRESENCIAL{I}\n120 150 - 98 80%\nFIN\nFIN. DOC\n"
        r = parse_funil_captacao_text(texto, "x.pdf")
        self.assertEqual(r.goal_group, "tecnico_presencial")
        self.assertEqual((r.aa_to_date, r.target_to_date, r.actual_to_date), (120, 150, 98))

    def test_periodo_invalido(self):
        with self.assertRaisesRegex(ValueError, "Periodo"):
            parse_funil_captacao_text(f"All{I} 2027{I} PRESENCIAL{I}\nM.FIN 1 2 3\n", "x.pdf")


def ranking(modalidade: str, com_nossa_linha: bool = True) -> str:
    nossa = "\nR9 - TAQUARA 7 1.000 900 950 50 1.200 95%" if com_nossa_linha else ""
    return f"Ranking Unidades\nAll{I} 2027.1{I} {modalidade}{I}{nossa}\nOUTRA 1 10 10 10 0 10 100%\nTotal 50.000 45.000 48.000 3.000 60.000 96%\n"


class Ranking(unittest.TestCase):
    def test_linhas(self):
        r = parse_ranking_unidades_text(ranking("BU PRESENCIAL"), "x.pdf")
        self.assertEqual(r.bu, "bu_presencial")
        self.assertEqual((r.our_rank, r.our_aa, r.our_real, r.our_meta), (7, 1000, 950, 1200))
        self.assertEqual((r.market_aa, r.market_real, r.market_meta), (50000, 48000, 60000))
        self.assertEqual(r.avisos, [])

    def test_sem_nossa_unidade_avisa(self):
        r = parse_ranking_unidades_text(ranking("BU DIGITAL", com_nossa_linha=False), "x.pdf")
        self.assertIsNone(r.our_rank)
        self.assertEqual(len(r.avisos), 1)

    def test_filtro_ambiguo(self):
        texto = ranking("Multiple selections")
        self.assertEqual(parse_ranking_unidades_text(texto, "Ranking Unidades BU Digital.pdf").bu, "bu_digital")
        self.assertEqual(parse_ranking_unidades_text(texto, "Ranking Unidades Presencial.pdf").bu, "bu_presencial")
        with self.assertRaises(ValueError):
            parse_ranking_unidades_text(texto, "Ranking Unidades.pdf")


class Arquivar(unittest.TestCase):
    def test_nome_repetido_ganha_sufixo(self):
        from run_daily_import import destino_livre

        with tempfile.TemporaryDirectory() as tmp:
            pasta = Path(tmp)
            self.assertEqual(destino_livre(pasta, "a.pdf").name, "a.pdf")
            (pasta / "a.pdf").touch()
            self.assertEqual(destino_livre(pasta, "a.pdf").name, "a_2.pdf")
            (pasta / "a_2.pdf").touch()
            self.assertEqual(destino_livre(pasta, "a.pdf").name, "a_3.pdf")


if __name__ == "__main__":
    unittest.main()
