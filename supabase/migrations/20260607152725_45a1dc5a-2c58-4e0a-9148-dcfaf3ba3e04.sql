
-- Enum para identificar qual sócio pagou
CREATE TYPE public.socio AS ENUM ('socio_1', 'socio_2');

-- Tabela de lotes (receitas)
CREATE TABLE public.lotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  nome TEXT NOT NULL,
  valor_bruto NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lotes TO authenticated;
GRANT ALL ON public.lotes TO service_role;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver todos os lotes" ON public.lotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir lotes" ON public.lotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Autenticados podem atualizar lotes" ON public.lotes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem excluir lotes" ON public.lotes FOR DELETE TO authenticated USING (true);

-- Tabela de despesas
CREATE TABLE public.despesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  pago_por public.socio NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas TO authenticated;
GRANT ALL ON public.despesas TO service_role;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver todas despesas" ON public.despesas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir despesas" ON public.despesas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Autenticados podem atualizar despesas" ON public.despesas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem excluir despesas" ON public.despesas FOR DELETE TO authenticated USING (true);

-- Configurações financeiras (linha única compartilhada)
CREATE TABLE public.config_financeira (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  nome_socio_1 TEXT NOT NULL DEFAULT 'Sócio 1',
  nome_socio_2 TEXT NOT NULL DEFAULT 'Sócio 2',
  salario_socio_1 NUMERIC(14,2) NOT NULL DEFAULT 5000,
  salario_socio_2 NUMERIC(14,2) NOT NULL DEFAULT 5000,
  financiamento_valor NUMERIC(14,2) NOT NULL DEFAULT 1800000,
  juros_anual NUMERIC(6,4) NOT NULL DEFAULT 0.06,
  prazo_anos INTEGER NOT NULL DEFAULT 9,
  resultado_minimo_lote NUMERIC(14,2) NOT NULL DEFAULT 50000,
  percentual_excedente_socios NUMERIC(5,2) NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_financeira TO authenticated;
GRANT ALL ON public.config_financeira TO service_role;
ALTER TABLE public.config_financeira ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver config" ON public.config_financeira FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir config" ON public.config_financeira FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar config" ON public.config_financeira FOR UPDATE TO authenticated USING (true);

INSERT INTO public.config_financeira (singleton) VALUES (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_lotes_updated BEFORE UPDATE ON public.lotes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_despesas_updated BEFORE UPDATE ON public.despesas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_config_updated BEFORE UPDATE ON public.config_financeira FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
