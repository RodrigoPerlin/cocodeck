import { createFileRoute } from "@tanstack/react-router";
import { useLotes, useDespesas, useConfig, useRetiradas, useFundoMovimentos } from "@/lib/queries";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileSpreadsheet, FileText, FileType } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import { formatBRL, totalPorSocio, totalRetiradas, calcularResultadosLotesCompleto } from "@/lib/finance";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/relatorios")({ component: RelatoriosPage });

function RelatoriosPage() {
  const { data: lotes = [] } = useLotes();
  const { data: despesas = [] } = useDespesas();
  const { data: retiradas = [] } = useRetiradas();
  const { data: movimentos = [] } = useFundoMovimentos();
  const { data: configData } = useConfig();

  if (!configData) return <div className="text-muted-foreground">Carregando…</div>;
  const config = configData;

  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const anoAtual = new Date().getFullYear();
  const lotesAno = lotes.filter((l) => new Date(l.data).getFullYear() === anoAtual);
  const despAno = despesas.filter((d) => new Date(d.data).getFullYear() === anoAtual);
  const retiradasAno = retiradas.filter((r) => new Date(r.data).getFullYear() === anoAtual);

  const parcela = Number(config.parcela_valor) || 0;
  const reservaTarget = parcela;

  // Fluxo mensal baseado em dados reais: receitas (lotes), despesas, pró-labore e gastos inesperados registrados
  const fluxoMensal = meses.map((m, i) => {
    const rec = lotesAno.filter((l) => new Date(l.data).getMonth() === i).reduce((s, l) => s + Number(l.valor_bruto), 0);
    const dep = despAno.filter((d) => new Date(d.data).getMonth() === i).reduce((s, d) => s + Number(d.valor), 0);
    const ret = retiradasAno.filter((r) => new Date(r.data).getMonth() === i);
    const prolab = ret.filter((r) => r.tipo === "pro_labore").reduce((s, r) => s + Number(r.valor), 0);
    const gastos = ret.filter((r) => r.tipo === "gasto_inesperado").reduce((s, r) => s + Number(r.valor), 0);
    return { mes: m, Receitas: rec, Despesas: dep, "Pró-labore": prolab, Gastos: gastos, Liquido: rec - dep - prolab - gastos };
  });

  // despesas por categoria
  const categorias = Array.from(new Set(despAno.map((d) => d.categoria)));
  const porCategoria = categorias.map((c) => ({
    categoria: c,
    total: despAno.filter((d) => d.categoria === c).reduce((s, d) => s + Number(d.valor), 0),
  }));

  // despesas por sócio
  const pagoS1 = totalPorSocio(despAno, "socio_1");
  const pagoS2 = totalPorSocio(despAno, "socio_2");
  const porSocio = [
    { name: config.nome_socio_1, value: pagoS1 },
    { name: config.nome_socio_2, value: pagoS2 },
  ];

  // Escala dos resultados dos lotes (ordem cronológica) — para ver se está aumentando ou reduzindo
  const resultadosLotes = calcularResultadosLotesCompleto(lotes, despesas, retiradas)
    .sort((a, b) => new Date(a.lote.data).getTime() - new Date(b.lote.data).getTime())
    .map((r) => ({ nome: r.lote.nome, Resultado: r.resultadoLiquido, Receita: r.receita }));

  // Evolução da reserva financeira — acúmulo real dos movimentos do fundo no ano
  let resAcc = 0;
  const evolucaoReserva = meses.map((m, i) => {
    const movMes = movimentos.filter((mv) => new Date(mv.data).getFullYear() === anoAtual && new Date(mv.data).getMonth() === i);
    const delta = movMes.reduce((s, mv) => s + (mv.tipo === "deposito" ? Number(mv.valor) : -Number(mv.valor)), 0);
    resAcc += delta;
    return { mes: m, Reserva: resAcc, Meta: reservaTarget };
  });

  const COLORS = ["oklch(0.24 0.08 265)", "oklch(0.58 0.13 250)"];

  // Exports
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lotes.map((l) => ({ Data: l.data, Nome: l.nome, "Valor Bruto": Number(l.valor_bruto), Observações: l.observacoes }))), "Lotes");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(despesas.map((d) => ({ Data: d.data, Categoria: d.categoria, Descrição: d.descricao, Valor: Number(d.valor), "Pago por": d.pago_por === "socio_1" ? config.nome_socio_1 : d.pago_por === "socio_2" ? config.nome_socio_2 : "Empresa" }))), "Despesas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fluxoMensal), "Fluxo Mensal");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porCategoria), "Por Categoria");
    XLSX.writeFile(wb, `financeiro-${anoAtual}.xlsx`);
  }

  function exportCSV() {
    const rows = [
      ["=== LOTES ==="],
      ["Data", "Nome", "Valor Bruto", "Observações"],
      ...lotes.map((l) => [l.data, l.nome, l.valor_bruto, l.observacoes ?? ""]),
      [""],
      ["=== DESPESAS ==="],
      ["Data", "Categoria", "Descrição", "Valor", "Pago por"],
      ...despesas.map((d) => [d.data, d.categoria, d.descricao, d.valor, d.pago_por === "socio_1" ? config.nome_socio_1 : d.pago_por === "socio_2" ? config.nome_socio_2 : "Empresa"]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-${anoAtual}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text(`Relatório Financeiro - ${anoAtual}`, 14, 18);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Sócios: ${config.nome_socio_1} & ${config.nome_socio_2}`, 14, 26);

    autoTable(doc, {
      startY: 32, head: [["Indicador", "Valor"]],
      body: [
        ["Receita anual", formatBRL(fluxoMensal.reduce((s, m) => s + m.Receitas, 0))],
        ["Despesas anuais", formatBRL(fluxoMensal.reduce((s, m) => s + m.Despesas, 0))],
        ["Líquido", formatBRL(fluxoMensal.reduce((s, m) => s + m.Liquido, 0))],
        ["Parcela anual financiamento", formatBRL(parcela)],
        ["Reserva alvo", formatBRL(reservaTarget)],
      ],
    });

    autoTable(doc, {
      head: [["Mês", "Receitas", "Despesas", "Líquido"]],
      body: fluxoMensal.map((m) => [m.mes, formatBRL(m.Receitas), formatBRL(m.Despesas), formatBRL(m.Liquido)]),
    });

    autoTable(doc, {
      head: [["Categoria", "Total"]],
      body: porCategoria.map((c) => [c.categoria, formatBRL(c.total)]),
    });

    autoTable(doc, {
      head: [["Sócio", "Total pago"]],
      body: [[config.nome_socio_1, formatBRL(pagoS1)], [config.nome_socio_2, formatBRL(pagoS2)]],
    });

    doc.save(`financeiro-${anoAtual}.pdf`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">Análises e exportação</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}><FileType className="w-4 h-4 mr-2" /> CSV</Button>
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel</Button>
          <Button onClick={exportPDF}><FileText className="w-4 h-4 mr-2" /> PDF</Button>
        </div>
      </div>

      <Tabs defaultValue="fluxo">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger>
          <TabsTrigger value="resultados">Resultados dos lotes</TabsTrigger>
          <TabsTrigger value="categoria">Por categoria</TabsTrigger>
          <TabsTrigger value="socio">Por sócio</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>

        <TabsContent value="fluxo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fluxo mensal ({anoAtual})</CardTitle>
              <p className="text-xs text-muted-foreground">Receitas, despesas e retiradas efetivamente registradas em cada mês</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={fluxoMensal}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} /><Legend />
                  <Bar dataKey="Receitas" fill="oklch(0.62 0.16 155)" radius={[4,4,0,0]} />
                  <Bar dataKey="Despesas" fill="oklch(0.58 0.22 27)" radius={[4,4,0,0]} />
                  <Bar dataKey="Pró-labore" fill="oklch(0.70 0.15 60)" radius={[4,4,0,0]} />
                  <Bar dataKey="Gastos" fill="oklch(0.55 0.18 10)" radius={[4,4,0,0]} />
                  <Bar dataKey="Liquido" fill="oklch(0.58 0.13 250)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resultados">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Escala dos resultados dos lotes</CardTitle>
              <p className="text-xs text-muted-foreground">Resultado líquido por lote em ordem cronológica — veja se está crescendo ou caindo</p>
            </CardHeader>
            <CardContent>
              {resultadosLotes.length === 0 ? <p className="text-muted-foreground text-sm py-6 text-center">Nenhum lote cadastrado.</p> :
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={resultadosLotes}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="nome" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} /><Legend />
                  <ReferenceLine y={0} stroke="oklch(0.58 0.22 27)" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="Resultado" stroke="oklch(0.58 0.13 250)" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categoria">
          <Card>
            <CardHeader><CardTitle className="text-base">Despesas por categoria</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={porCategoria} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="categoria" type="category" fontSize={11} width={100} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="total" fill="oklch(0.58 0.13 250)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="socio">
          <Card>
            <CardHeader><CardTitle className="text-base">Pagamentos por sócio</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={porSocio} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={(e) => `${e.name}: ${formatBRL(e.value)}`}>
                    {porSocio.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolucao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução da reserva financeira</CardTitle>
              <p className="text-xs text-muted-foreground">Acúmulo real das reservas do fundo da parcela ao longo de {anoAtual}</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evolucaoReserva}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} /><Legend />
                  <Line type="monotone" dataKey="Reserva" stroke="oklch(0.62 0.16 155)" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Meta" stroke="oklch(0.58 0.13 250)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
