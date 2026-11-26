"""Extrai os campos que a automacao precisa dos PDFs do Power BI (Funil de
Captacao e Ranking Unidades). So leitura/parsing -- a escrita no Supabase
fica em supabase_writer.py.

Os relatorios tem acentuacao inconsistente entre si (alguns saem sem acento,
outros com o acento virando um caractere de substituicao \\ufffd ao extrair
o texto do PDF) -- por isso o parsing evita depender de texto acentuado.

Cada relatorio tem duas funcoes: parse_*(caminho) abre o PDF, e parse_*_text
(texto, nome_arquivo) faz o parsing em cima do texto ja extraido (e o que os
testes em test_parse_bi_pdf.py exercitam, sem precisar de PDF real).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

# Icone de dropdown (caractere de uso privado U+E118 da fonte do Power BI) que
# aparece como separador depois de cada valor de filtro
# (ex.: "All  2027.1  PRESENCIAL  ..."). Estavel nos
# relatorios testados, independente de acentuacao.
FILTER_ICON = ""

# Numero do Power BI em pt-BR ("1.234", "12,5") ou "(Blank)" (etapa sem valor).
NUM = r"(?:[\d.,]+|\(Blank\))"

EXPECTED_CAMPUS = "R9 - TAQUARA"


def _to_number(raw: str) -> float | None:
    raw = raw.strip()
    if not raw:
        return None
    # O Power BI mostra "(Blank)" quando nao ha meta/valor configurado pra
    # aquela etapa -- tratamos como zero, nao como "sem dado".
    if raw.lower() == "(blank)":
        return 0.0
    raw = raw.replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None


def _full_text(pdf_path: str | Path) -> str:
    import pdfplumber  # import tardio: os testes de texto nao precisam do pdfplumber

    with pdfplumber.open(pdf_path) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def _filter_values(text: str) -> list[str]:
    """Primeira linha com o icone de filtro = os valores escolhidos no topo
    do relatorio, na ordem: Marca, Periodo Academico, BU/Modalidade, ...
    """
    for line in text.split("\n"):
        if FILTER_ICON in line:
            return [tok.strip() for tok in line.split(FILTER_ICON)]
    raise ValueError("Nao encontrei a linha de filtros (icone de dropdown ausente)")


def _academic_period(values: list[str], nome: str) -> str:
    if len(values) < 3:
        raise ValueError(f"Linha de filtros com poucos valores em {nome}: {values}")
    periodo = values[1]
    if not re.fullmatch(r"[0-9]{4}\.[0-9]", periodo):
        raise ValueError(f"Periodo academico inesperado '{periodo}' em {nome}")
    return periodo


def _unico(candidatos: set[str], nome: str, o_que: str) -> str:
    if len(candidatos) == 1:
        return next(iter(candidatos))
    if not candidatos:
        raise ValueError(f"Nao consegui identificar {o_que} de {nome} (nem pelo filtro do PDF nem pelo nome do arquivo)")
    raise ValueError(
        f"Nome do arquivo {nome} e ambiguo para {o_que} (bate com {sorted(candidatos)}); "
        "renomeie o arquivo para conter so uma modalidade ou corrija o filtro no Power BI"
    )


# "pres" que NAO faz parte de "semipresencial"/"semi-presencial"/"semi presencial".
_PRES_SOZINHO = r"(?<!semi)(?<!semi-)(?<!semi )pres"


def _graduacao_pelo_nome(nome_arquivo: str) -> set[str]:
    nome = Path(nome_arquivo).name.lower()  # so o nome: a pasta nao pode influenciar
    achados = set()
    if "ao vivo" in nome or "aovivo" in nome:
        achados.add("graduacao_aovivo")
    if "semi" in nome:
        achados.add("graduacao_semipresencial")
    if "digital" in nome:
        achados.add("graduacao_ead")
    if re.search(_PRES_SOZINHO, nome):
        achados.add("graduacao_presencial")
    return achados


def _detect_graduacao_modalidade(raw_value: str, nome_arquivo: str) -> str:
    v = raw_value.lower()
    # O PDF trunca "SEMIPRESENCIAL" de forma consistente (fonte incompleta no
    # export do Power BI): o valor sai como "presencial (bu) + se<lixo>".
    if "semipresencial" in v or v.startswith("presencial (bu) + se"):
        return "graduacao_semipresencial"
    if "ao vivo" in v or "aovivo" in v:
        return "graduacao_aovivo"
    if "digital" in v:
        # O card "Digital" da home soma graduacao_ead + graduacao_dlex (ver
        # METHOD_TILES em OfficialGoalsPanel.tsx); "graduacao_bu_digital" e so
        # uma categoria de exibicao noutras telas, nao entra nesse somatorio.
        # O funil "Digital" do Power BI nao separa EAD de Flex, e os imports
        # manuais historicos sempre gravaram tudo em graduacao_ead (nunca
        # apareceu um graduacao_dlex real), entao e esse o grupo certo aqui.
        return "graduacao_ead"
    if v.strip() == "presencial":
        return "graduacao_presencial"

    # O filtro do PDF as vezes vem quebrado ("Multiple selections", quando a
    # assinatura do Power BI esta com mais de uma modalidade marcada). Nesse
    # caso cai pro nome do arquivo -- mas so se ele apontar UMA modalidade:
    # um nome com o assunto inteiro do e-mail ("Pres/Semi/Ao Vivo/BU Digital")
    # nao pode virar "ao vivo" por acaso.
    return _unico(_graduacao_pelo_nome(nome_arquivo), nome_arquivo, f"a modalidade (filtro '{raw_value}')")


@dataclass
class FunilResult:
    academic_period: str
    goal_group: str
    aa_to_date: float
    target_to_date: float
    actual_to_date: float
    cycle_target: float | None = None


def parse_funil_captacao_text(text: str, nome_arquivo: str) -> FunilResult:
    values = _filter_values(text)
    academic_period = _academic_period(values, nome_arquivo)

    is_tecnico = re.search(r"cursos\s+t.cnicos", text, re.IGNORECASE) is not None
    goal_group = "tecnico_presencial" if is_tecnico else _detect_graduacao_modalidade(values[2], nome_arquivo)

    if is_tecnico:
        # Layout diferente: os numeros vem ANTES do rotulo da etapa, e a
        # etapa financeira se chama "FIN" (nao "M.FIN"). "FIN" sozinho na
        # linha (nao "FIN. DOC", que tambem comeca com FIN).
        fin_match = re.search(r"([^\n]+)\n^FIN[ \t]*$", text, re.MULTILINE)
        if not fin_match:
            raise ValueError(f"Nao encontrei a linha FIN (tecnico) em {nome_arquivo}")
        tokens = [t for t in fin_match.group(1).split() if not t.endswith("%") and t != "-"]
        if len(tokens) < 3:
            raise ValueError(f"Linha FIN com poucos numeros em {nome_arquivo}: {tokens}")
        values = [_to_number(t) for t in tokens]
        aa, meta, atual = values[:3]
        cycle_target = values[-2] if len(values) >= 6 else None
    else:
        mfin_match = re.search(r"^M\.FIN\s+([^\n]+)", text, re.IGNORECASE | re.MULTILINE)
        if not mfin_match:
            raise ValueError(f"Nao encontrei a linha M.FIN em {nome_arquivo}")
        row_tokens = [t for t in mfin_match.group(1).split() if not t.endswith("%") and t != "-"]
        if len(row_tokens) < 3:
            raise ValueError(f"Linha M.FIN com poucos numeros em {nome_arquivo}: {row_tokens}")
        aa, meta, atual = (_to_number(t) for t in row_tokens[:3])
        cycle_target = _to_number(row_tokens[-2]) if len(row_tokens) >= 6 else None

    if aa is None or meta is None or atual is None:
        raise ValueError(f"Nao consegui converter os numeros da linha financeira em {nome_arquivo}")

    return FunilResult(
        academic_period=academic_period,
        goal_group=goal_group,
        aa_to_date=aa,
        target_to_date=meta,
        actual_to_date=atual,
        cycle_target=cycle_target,
    )


def parse_funil_captacao(pdf_path: str | Path) -> FunilResult:
    return parse_funil_captacao_text(_full_text(pdf_path), str(pdf_path))


@dataclass
class RankingResult:
    academic_period: str
    bu: str
    our_rank: int | None
    our_aa: float | None
    our_meta: float | None
    our_real: float | None
    market_aa: float | None
    market_meta: float | None
    market_real: float | None
    avisos: list[str] = field(default_factory=list)


def _bu_do_ranking(raw_value: str, nome_arquivo: str) -> str:
    modalidade = raw_value.lower()
    if "digital" in modalidade:
        return "bu_digital"
    if "presencial" in modalidade:
        return "bu_presencial"
    # Filtro ambiguo ("Multiple selections") -- cai pro nome do arquivo, se ele for claro.
    nome = Path(nome_arquivo).name.lower()
    achados = set()
    if "digital" in nome:
        achados.add("bu_digital")
    if "presencial" in nome or re.search(_PRES_SOZINHO, nome):
        achados.add("bu_presencial")
    return _unico(achados, nome_arquivo, f"a BU (filtro '{raw_value}')")


def parse_ranking_unidades_text(text: str, nome_arquivo: str) -> RankingResult:
    values = _filter_values(text)
    academic_period = _academic_period(values, nome_arquivo)
    bu = _bu_do_ranking(values[2], nome_arquivo)
    avisos: list[str] = []

    # Linha da nossa unidade: UNIDADE RKN AA D-7 REAL VAR-D7 META %ATING-AA ...
    our_match = re.search(
        rf"\n\W*{re.escape(EXPECTED_CAMPUS)}\s+(\d+)\s+({NUM})\s+({NUM})\s+({NUM})\s+{NUM}\s+({NUM})",
        text,
        re.IGNORECASE,
    )
    our_rank = our_aa = our_real = our_meta = None
    if our_match:
        our_rank = int(our_match.group(1))
        our_aa = _to_number(our_match.group(2))
        our_real = _to_number(our_match.group(4))
        our_meta = _to_number(our_match.group(5))
    else:
        avisos.append(f"a linha '{EXPECTED_CAMPUS}' nao apareceu no relatorio; nossa posicao fica em branco")

    # Linha Total: AA D-7 REAL VAR-D7 META %ATING-AA ... (VAR-D7 vem como numero, sem %)
    total_match = re.search(rf"\nTotal\s+({NUM})\s+({NUM})\s+({NUM})\s+{NUM}\s+({NUM})", text, re.IGNORECASE)
    if not total_match:
        raise ValueError(f"Nao encontrei a linha Total em {nome_arquivo}")

    return RankingResult(
        academic_period=academic_period,
        bu=bu,
        our_rank=our_rank,
        our_aa=our_aa,
        our_meta=our_meta,
        our_real=our_real,
        market_aa=_to_number(total_match.group(1)),
        market_meta=_to_number(total_match.group(4)),
        market_real=_to_number(total_match.group(3)),
        avisos=avisos,
    )


def parse_ranking_unidades(pdf_path: str | Path) -> RankingResult:
    return parse_ranking_unidades_text(_full_text(pdf_path), str(pdf_path))
