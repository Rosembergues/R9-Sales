-- R9 SALES — MIGRAÇÃO PARA METAS SEPARADAS POR CICLO ACADÊMICO
-- Execute antes de publicar a versão atualizada do site.
-- Preserva registros antigos; eles ficam com academic_period = NULL.

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS academic_period text;

-- Remove a unicidade legada que impedia repetir o mesmo intervalo em ciclos diferentes.
ALTER TABLE public.goals
  DROP CONSTRAINT IF EXISTS goals_user_id_type_reference_start_key;

-- As novas metas são únicas por consultor, tipo, início e ciclo acadêmico.
-- Registros históricos com academic_period NULL são preservados.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.goals'::regclass
      AND conname = 'goals_user_type_reference_start_academic_period_key'
  ) THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_user_type_reference_start_academic_period_key
      UNIQUE (user_id, type, reference_start, academic_period);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_goals_academic_period
  ON public.goals (academic_period);

-- Validação
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'goals'
  AND column_name IN ('academic_period', 'goal_period_id')
ORDER BY column_name;

SELECT
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.goals'::regclass
  AND contype = 'u'
ORDER BY conname;
