
-- 1) Add 'empresa' to socio enum (rename to pagador_tipo conceptually but keep type name)
ALTER TYPE public.socio ADD VALUE IF NOT EXISTS 'empresa';

-- 2) Add lote_id to despesas (FK)
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES public.lotes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_despesas_lote_id ON public.despesas(lote_id);

-- 3) Config: add parcela value and proximo vencimento
ALTER TABLE public.config_financeira
  ADD COLUMN IF NOT EXISTS parcela_valor numeric NOT NULL DEFAULT 264640.02,
  ADD COLUMN IF NOT EXISTS parcela_vencimento date NOT NULL DEFAULT '2026-06-30';
