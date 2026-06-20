
CREATE TABLE public.fundo_reserva_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL CHECK (tipo IN ('deposito','pagamento_parcela','ajuste')),
  valor numeric NOT NULL,
  descricao text,
  lote_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fundo_reserva_movimentos TO authenticated;
GRANT ALL ON public.fundo_reserva_movimentos TO service_role;

ALTER TABLE public.fundo_reserva_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver movimentos do fundo"
  ON public.fundo_reserva_movimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir movimentos do fundo"
  ON public.fundo_reserva_movimentos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Autenticados podem atualizar movimentos do fundo"
  ON public.fundo_reserva_movimentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem excluir movimentos do fundo"
  ON public.fundo_reserva_movimentos FOR DELETE TO authenticated USING (true);

CREATE TRIGGER touch_fundo_reserva_movimentos
  BEFORE UPDATE ON public.fundo_reserva_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
