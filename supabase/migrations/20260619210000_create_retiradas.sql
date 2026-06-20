
-- Retiradas: pró-labore pago e gastos inesperados (fora das despesas dos lotes)
CREATE TABLE public.retiradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL CHECK (tipo IN ('pro_labore', 'gasto_inesperado')),
  socio text NOT NULL CHECK (socio IN ('socio_1', 'socio_2')),
  lote_id uuid REFERENCES public.lotes(id) ON DELETE SET NULL,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retiradas TO authenticated;
GRANT ALL ON public.retiradas TO service_role;

ALTER TABLE public.retiradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver retiradas"
  ON public.retiradas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir retiradas"
  ON public.retiradas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Autenticados podem atualizar retiradas"
  ON public.retiradas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem excluir retiradas"
  ON public.retiradas FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_retiradas_data ON public.retiradas(data);
CREATE INDEX idx_retiradas_lote_id ON public.retiradas(lote_id);

CREATE TRIGGER touch_retiradas
  BEFORE UPDATE ON public.retiradas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
