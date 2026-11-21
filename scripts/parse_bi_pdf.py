"""Extrai os campos que a automacao precisa dos PDFs do Power BI (Funil de
Captacao e Ranking Unidades). So leitura/parsing -- a escrita no Supabase
fica em outro arquivo.

Os relatorios tem acentuacao inconsistente entre si (alguns saem sem acento,
outros com o acento virando um caractere de substituicao \\ufffd ao extrair
o texto do PDF) -- por isso o parsing evita depender de texto acentuado.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import pdfplumber

# Icone de dropdown que o Power BI usa como separador depois de cada valor de
# filtro (ex.: "All  2027.1  PRESENCIAL  ..."). Estavel nos
# relatorios testados, independente de acentuacao.
FILTER_ICON = ""

def _to_number(raw: str) -> float | None:
    raw = raw.strip()
    if not raw:
        return None
    # O Power BI mostra "(Blank)" quando não há meta/valor configurado pra
    # aquela etapa -- tratamos como zero, não como "sem dado".
    if raw.lower() == "(blank)":
        return 0.0
    raw = raw.replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None


def _full_text(pdf_path: str) -> str:
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


def _detect_graduacao_modalidade(raw_value: str, pdf_path: str) -> str:
    v = raw_value.lower()
    # O PDF trunca "SEMIPRESENCIAL" de forma consistente (fonte incompleta no
    # export do Power BI): o valor sai como "presencial (bu) + se<lixo>".
    if "semipresencial" in v or v.startswith("presencial (bu) + se"):
        return "graduacao_semipresencial"
    if "ao vivo" in v or "aovivo" in v:
        return "graduacao_aovivo"
    if "digital" in v:
        # O card "Digital" da home soma graduacao_ead + graduacao_dlex (ver
        # METHOD_TILES em OfficialGoalsPanel.tsx); "graduacao_bu_digital" é só
        # uma categoria de exibição noutras telas, não entra nesse somatório.
        # O funil "Digital" do Power BI não separa EAD de Flex, e os imports
        # manuais históricos sempre gravaram tudo em graduacao_ead (nunca
        # apareceu um graduacao_dlex real), então é esse o grupo certo aqui.
        return "graduacao_ead"
    if v.strip() == "presencial":
        return "graduacao_presencial"

    # O filtro do PDF às vezes vem quebrado ("Multiple selections", quando a
    # assinatura do Power BI está com mais de uma modalidade marcada). Nesse
    # caso cai pro nome do arquivo (o assunto do email é estável: "Funil Sava
    # - Met. Pres/Semi/Ao Vivo/BU Digital"). Quando o filtro for corrigido lá
    # no Power BI, o texto do PDF volta a mandar (bloco acima).
    nome = pdf_path.lower()
    if "ao vivo" in nome or "aovivo" in nome:
        return "graduacao_aovivo"
    if "semi" in nome:
        return "graduacao_semipresencial"
    if "digital" in nome:
        return "graduacao_ead"
    if "pres" in nome:
        return "graduacao_presencial"

    raise ValueError(
        f"Modalidade desconhecida '{raw_value}' em {pdf_path} (e o nome do arquivo também não ajudou)"
    )


@dataclass
class FunilResult:
    academic_period: str
    goal_group: str
    aa_to_date: float
    target_to_date: float
    actual_to_date: float


def parse_funil_captacao(pdf_path: str) -> FunilResult:
    text = _full_text(pdf_path)
    values = _filter_values(text)
    if len(values) < 3:
        raise ValueError(f"Linha de filtros com poucos valores em {pdf_path}: {values}")

    academic_period = values[1]
    if not re.fullmatch(r"[0-9]{4}\.[0-9]", academic_period):
        raise ValueError(f"Periodo academico inesperado '{academic_period}' em {pdf_path}")

    is_tecnico = re.search(r"cursos\s+t.cnicos", text, re.IGNORECASE) is not None

    if is_tecnico:
        goal_group = "tecnico_presencial"
    else:
        goal_group = _detect_graduacao_modalidade(values[2], pdf_path)

    if is_tecnico:
        # Layout diferente: os numeros vem ANTES do rotulo da etapa, e a
        # etapa financeira se chama "FIN" (nao "M.FIN"). "FIN" sozinho na
        # linha (nao "FIN. DOC", que tambem comeca com FIN).
        fin_match = re.search(r"([^\n]+)\n^FIN$", text, re.MULTILINE)
        if not fin_match:
            raise ValueError(f"Nao encontrei a linha FIN (tecnico) em {pdf_path}")
        tokens = [t for t in fin_match.group(1).split() if not t.endswith("%") and t != "-"]
        if len(tokens) < 3:
            raise ValueError(f"Linha FIN com poucos numeros em {pdf_path}: {tokens}")
        aa, meta, atual = (_to_number(t) for t in tokens[:3])
    else:
        numero_ou_blank = r"(?:[\d.,]+|\(Blank\))"
        mfin_match = re.search(
            rf"\nM\.FIN\s+({numero_ou_blank})\s+({numero_ou_blank})\s+({numero_ou_blank})",
            text,
            re.IGNORECASE,
        )
        if not mfin_match:
            raise ValueError(f"Nao encontrei a linha M.FIN em {pdf_path}")
        aa = _to_number(mfin_match.group(1))
        meta = _to_number(mfin_match.group(2))
        atual = _to_number(mfin_match.group(3))

    if aa is None or meta is None or atual is None:
        raise ValueError(f"Nao consegui converter os numeros da linha financeira em {pdf_path}")

    return FunilResult(
        academic_period=academic_period,
        goal_group=goal_group,
        aa_to_date=aa,
        target_to_date=meta,
        actual_to_date=atual,
    )


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


EXPECTED_CAMPUS = "R9 - TAQUARA"


def parse_ranking_unidades(pdf_path: str) -> RankingResult:
    text = _full_text(pdf_path)
    values = _filter_values(text)
    if len(values) < 3:
        raise ValueError(f"Linha de filtros com poucos valores em {pdf_path}: {values}")

    academic_period = values[1]
    if not re.fullmatch(r"[0-9]{4}\.[0-9]", academic_period):
        raise ValueError(f"Periodo academico inesperado '{academic_period}' em {pdf_path}")

    modalidade = values[2].lower()
    if "digital" in modalidade:
        bu = "bu_digital"
    elif "presencial" in modalidade:
        bu = "bu_presencial"
    else:
        # Filtro ambíguo ("Multiple selections") -- cai pro nome do arquivo.
        nome = pdf_path.lower()
        bu = "bu_digital" if "digital" in nome else "bu_presencial"

    num = r"(?:[\d.,]+|\(Blank\))"
    # Linha da nossa unidade: UNIDADE RKN AA D-7 REAL VAR-D7 META %ATING-AA ...
    our_match = re.search(
        rf"\n\W*{re.escape(EXPECTED_CAMPUS)}\s+(\d+)\s+({num})\s+({num})\s+({num})\s+{num}\s+({num})",
        text,
        re.IGNORECASE,
    )
    our_rank = our_aa = our_real = our_meta = None
    if our_match:
        our_rank = int(our_match.group(1))
        our_aa = _to_number(our_match.group(2))
        our_real = _to_number(our_match.group(4))
        our_meta = _to_number(our_match.group(5))

    # Linha Total: AA D-7 REAL VAR-D7 META %ATING-AA ...
    total_match = re.search(
        rf"\nTotal\s+({num})\s+({num})\s+({num})\s+{num}\s+({num})",
        text,
        re.IGNORECASE,
    )
    if not total_match:
        raise ValueError(f"Nao encontrei a linha Total em {pdf_path}")
    market_aa = _to_number(total_match.group(1))
    market_real = _to_number(total_match.group(3))
    market_meta = _to_number(total_match.group(4))

    return RankingResult(
        academic_period=academic_period,
        bu=bu,
        our_rank=our_rank,
        our_aa=our_aa,
        our_meta=our_meta,
        our_real=our_real,
        market_aa=market_aa,
        market_meta=market_meta,
        market_real=market_real,
    )
