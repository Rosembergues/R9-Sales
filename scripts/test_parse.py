import glob
import sys

sys.path.insert(0, "scripts")
from parse_bi_pdf import parse_funil_captacao, parse_ranking_unidades  # noqa: E402

FUNIL_FILES = sorted(glob.glob(r"C:\Users\daniel.marques\Downloads\Funil de Capta*.pdf"))
RANKING_FILES = sorted(glob.glob(r"C:\Users\daniel.marques\Downloads\Ranking Unidades*.pdf"))

print(f"=== FUNIL DE CAPTACAO ({len(FUNIL_FILES)} arquivos) ===")
for f in FUNIL_FILES:
    name = f.split("\\")[-1]
    try:
        r = parse_funil_captacao(f)
        print(f"OK   {name}: periodo={r.academic_period} grupo={r.goal_group} aa={r.aa_to_date} meta={r.target_to_date} atual={r.actual_to_date}")
    except Exception as e:  # noqa: BLE001
        print(f"FAIL {name}: {e}")

print()
print(f"=== RANKING UNIDADES ({len(RANKING_FILES)} arquivos) ===")
for f in RANKING_FILES:
    name = f.split("\\")[-1]
    try:
        r = parse_ranking_unidades(f)
        print(f"OK   {name}: periodo={r.academic_period} bu={r.bu} rank={r.our_rank} nossa_aa={r.our_aa} nossa_meta={r.our_meta} nosso_real={r.our_real} mercado_aa={r.market_aa} mercado_meta={r.market_meta} mercado_real={r.market_real}")
    except Exception as e:  # noqa: BLE001
        print(f"FAIL {name}: {e}")
