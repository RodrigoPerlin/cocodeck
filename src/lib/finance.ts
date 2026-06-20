// Utilidades de cálculo financeiro — modelo por lote
export type Pagador = "socio_1" | "socio_2" | "empresa";
// Mantém compatibilidade com o tipo antigo
export type Socio = Pagador;

export interface ConfigFinanceira {
  nome_socio_1: string;
  nome_socio_2: string;
  salario_socio_1: number;
  salario_socio_2: number;
  financiamento_valor: number;
  juros_anual: number;
  prazo_anos: number;
  resultado_minimo_lote: number;
  percentual_excedente_socios: number;
  parcela_valor: number;
  parcela_vencimento: string; // YYYY-MM-DD
}

export interface Lote {
  id: string;
  data: string;
  nome: string;
  valor_bruto: number;
  observacoes: string | null;
}

export interface Despesa {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  valor: number;
  pago_por: Pagador;
  lote_id: string | null;
}

export interface FundoMovimento {
  id: string;
  data: string;
  tipo: "deposito" | "pagamento_parcela" | "ajuste";
  valor: number;
  descricao: string | null;
  lote_id: string | null;
}

export type RetiradaTipo = "pro_labore" | "gasto_inesperado";
export type SocioRetirada = "socio_1" | "socio_2";

export interface Retirada {
  id: string;
  data: string;
  tipo: RetiradaTipo;
  socio: SocioRetirada;
  lote_id: string | null;
  valor: number;
  descricao: string | null;
}

// ============ Formatadores ============
export function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}
export function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

// ============ Fundo da Parcela ============
export interface FundoStatus {
  parcela: number;          // valor da próxima parcela (meta do fundo)
  meta: number;             // = parcela (sem reserva extra)
  saldo: number;            // efetivamente depositado
  falta: number;            // parcela - saldo
  percentual: number;       // saldo / parcela
  proximoVencimento: Date;
  diasAteVencimento: number;
  lotesRestantes: number;   // a cada 60 dias = 1 lote
  reservaPorLote: number;   // falta / lotesRestantes
}

export function calcularFundoStatus(
  movimentos: FundoMovimento[],
  config: ConfigFinanceira,
): FundoStatus {
  const parcela = Number(config.parcela_valor) || 0;
  const venc = new Date(config.parcela_vencimento + "T00:00:00");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const saldo = movimentos.reduce((s, m) => {
    const v = Number(m.valor);
    return m.tipo === "deposito" ? s + v : s - v;
  }, 0);
  const falta = Math.max(0, parcela - saldo);
  const percentual = parcela > 0 ? Math.min(1, saldo / parcela) : 0;

  const diasAteVencimento = Math.max(
    0,
    Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const lotesRestantes = Math.max(1, Math.ceil(diasAteVencimento / 60));
  const reservaPorLote = falta / lotesRestantes;

  return {
    parcela,
    meta: parcela,
    saldo,
    falta,
    percentual,
    proximoVencimento: venc,
    diasAteVencimento,
    lotesRestantes,
    reservaPorLote,
  };
}

// ============ Resultado por Lote ============
export interface ResultadoLote {
  lote: Lote;
  receita: number;
  despesas: number;
  resultado: number; // receita - despesas vinculadas
}

export function calcularResultadoLote(lote: Lote, despesas: Despesa[]): ResultadoLote {
  const desp = despesas
    .filter((d) => d.lote_id === lote.id)
    .reduce((s, d) => s + Number(d.valor), 0);
  return {
    lote,
    receita: Number(lote.valor_bruto),
    despesas: desp,
    resultado: Number(lote.valor_bruto) - desp,
  };
}

export function calcularResultadosLotes(lotes: Lote[], despesas: Despesa[]): ResultadoLote[] {
  return lotes.map((l) => calcularResultadoLote(l, despesas));
}

// Resultado líquido completo: receita - despesas - pró-labore - gastos inesperados (retiradas vinculadas ao lote)
export interface ResultadoLoteCompleto {
  lote: Lote;
  receita: number;
  despesas: number;
  proLabore: number;
  gastosInesperados: number;
  resultadoLiquido: number; // receita - despesas - proLabore - gastosInesperados
}

export function calcularResultadoLoteCompleto(
  lote: Lote,
  despesas: Despesa[],
  retiradas: Retirada[],
): ResultadoLoteCompleto {
  const base = calcularResultadoLote(lote, despesas);
  const proLabore = retiradas
    .filter((r) => r.lote_id === lote.id && r.tipo === "pro_labore")
    .reduce((s, r) => s + Number(r.valor), 0);
  const gastosInesperados = retiradas
    .filter((r) => r.lote_id === lote.id && r.tipo === "gasto_inesperado")
    .reduce((s, r) => s + Number(r.valor), 0);
  return {
    lote,
    receita: base.receita,
    despesas: base.despesas,
    proLabore,
    gastosInesperados,
    resultadoLiquido: base.receita - base.despesas - proLabore - gastosInesperados,
  };
}

export function calcularResultadosLotesCompleto(
  lotes: Lote[],
  despesas: Despesa[],
  retiradas: Retirada[],
): ResultadoLoteCompleto[] {
  return lotes.map((l) => calcularResultadoLoteCompleto(l, despesas, retiradas));
}

// ============ Pró-labore vencido ============
// Conta o número de meses (inclusive) entre o primeiro lote e hoje.
// Se não houver lote ainda, retorna 0.
export function mesesProLaboreVencidos(lotes: Lote[]): number {
  if (lotes.length === 0) return 0;
  const datas = lotes.map((l) => new Date(l.data + "T00:00:00").getTime());
  const inicio = new Date(Math.min(...datas));
  const hoje = new Date();
  const meses =
    (hoje.getFullYear() - inicio.getFullYear()) * 12 +
    (hoje.getMonth() - inicio.getMonth()) +
    1;
  return Math.max(1, meses);
}

// Pró-labore fixo mensal: pago a apenas um sócio (sócio 1).
export function proLaboreMensal(config: ConfigFinanceira): number {
  return Number(config.salario_socio_1);
}

export function proLaboreVencido(config: ConfigFinanceira, lotes: Lote[]): number {
  return proLaboreMensal(config) * mesesProLaboreVencidos(lotes);
}

// ============ Caixa Atual ============
// Soma dos resultados dos lotes (receita - despesas vinculadas) - pró-labore já vencido
// NÃO desconta meta do fundo nem parcela futura do financiamento.
export function caixaAtual(
  lotes: Lote[],
  despesas: Despesa[],
  config: ConfigFinanceira,
): number {
  const resultados = calcularResultadosLotes(lotes, despesas);
  const somaResultados = resultados.reduce((s, r) => s + r.resultado, 0);
  return somaResultados - proLaboreVencido(config, lotes);
}

// ============ Totais auxiliares ============
export function totalReceitas(lotes: Lote[]): number {
  return lotes.reduce((s, l) => s + Number(l.valor_bruto), 0);
}
export function totalDespesas(despesas: Despesa[]): number {
  return despesas.reduce((s, d) => s + Number(d.valor), 0);
}
export function totalPorPagador(despesas: Despesa[], p: Pagador): number {
  return despesas.filter((d) => d.pago_por === p).reduce((s, d) => s + Number(d.valor), 0);
}
// alias legacy
export const totalPorSocio = totalPorPagador;

// ============ Reservas do fundo por lote ============
// Considera apenas movimentos do tipo 'deposito' vinculados a um lote.
export interface ReservaPorLote {
  lote: Lote;
  reservado: number;
}

export function reservasPorLote(
  lotes: Lote[],
  movimentos: FundoMovimento[],
): ReservaPorLote[] {
  return lotes.map((lote) => ({
    lote,
    reservado: movimentos
      .filter((m) => m.tipo === "deposito" && m.lote_id === lote.id)
      .reduce((s, m) => s + Number(m.valor), 0),
  }));
}

export function totalReservado(movimentos: FundoMovimento[]): number {
  return movimentos
    .filter((m) => m.tipo === "deposito")
    .reduce((s, m) => s + Number(m.valor), 0);
}

// ============ Retiradas ============
export function totalRetiradas(
  retiradas: Retirada[],
  tipo?: RetiradaTipo,
  socio?: SocioRetirada,
): number {
  return retiradas
    .filter((r) => (tipo ? r.tipo === tipo : true) && (socio ? r.socio === socio : true))
    .reduce((s, r) => s + Number(r.valor), 0);
}

// ============ Cálculo da parcela (Tabela Price) ============
// PMT = PV * i / (1 - (1+i)^-n)
export function calcularParcelaPrice(
  valorFinanciado: number,
  jurosPeriodo: number,
  numeroParcelas: number,
): number {
  const pv = Number(valorFinanciado) || 0;
  const i = Number(jurosPeriodo) || 0;
  const n = Number(numeroParcelas) || 0;
  if (n <= 0) return 0;
  if (i === 0) return pv / n;
  return (pv * i) / (1 - Math.pow(1 + i, -n));
}
