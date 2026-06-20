import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLotes, useDespesas, useConfig, useFundoMovimentos, useRetiradas } from "@/lib/queries";
import {
  formatBRL, formatPct, calcularResultadoLote, calcularResultadosLotesCompleto,
  calcularFundoStatus,
  totalReceitas, totalDespesas, totalRetiradas,
  type RetiradaTipo, type SocioRetirada, type Lote,
  type Despesa, type FundoMovimento, type Retirada,
} from "@/lib/finance";
import { createRetirada, deleteRetirada } from "@/lib/api/data.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, CalendarClock, Target,
  Plus, Trash2, HandCoins, AlertTriangle, Package, Calendar, Filter,
} from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: lotes = [] } = useLotes();
  const { data: despesas = [] } = useDespesas();
  const { data: movimentos = [] } = useFundoMovimentos();
  const { data: retiradas = [] } = useRetiradas();
  const { data: config } = useConfig();
  const qc = useQueryClient();

  const [tipoDialog, setTipoDialog] = useState<RetiradaTipo | null>(null);
  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    socio: "socio_1" as SocioRetirada,
    lote_id: "",
    valor: "",
    descricao: "",
  });

  const [view, setView] = useState<"anual" | "lote">("anual");
  const [loteSel, setLoteSel] = useState<string>("");

  if (!config) return <div className="text-muted-foreground">Carregando…</div>;

  const fundo = calcularFundoStatus(movimentos, config);
  const resultados = calcularResultadosLotesCompleto(lotes, despesas, retiradas);
  const resultadosOrd = [...resultados].sort(
    (a, b) => new Date(b.lote.data).getTime() - new Date(a.lote.data).getTime()
  );

  const anoAtual = new Date().getFullYear();
  const lotesAno = lotes.filter((l) => new Date(l.data).getFullYear() === anoAtual);
  const despAno = despesas.filter((d) => new Date(d.data).getFullYear() === anoAtual);
  const retiradasAno = retiradas.filter((r) => new Date(r.data).getFullYear() === anoAtual);
  const recebidoAno = totalReceitas(lotesAno);
  const despesasAno = totalDespesas(despAno);
  const proLaboreAno = totalRetiradas(retiradasAno, "pro_labore");
  const gastosAno = totalRetiradas(retiradasAno, "gasto_inesperado");

  const nomeSocio = (s: SocioRetirada) =>
    s === "socio_1" ? config.nome_socio_1 : config.nome_socio_2;

  const proLaboreList = retiradas.filter((r) => r.tipo === "pro_labore");
  const gastosList = retiradas.filter((r) => r.tipo === "gasto_inesperado");

  async function addRetirada(e: React.FormEvent) {
    e.preventDefault();
    if (!tipoDialog) return;
    if (!form.valor || Number(form.valor) <= 0) return toast.error("Informe um valor válido");
    if (tipoDialog === "pro_labore" && !form.lote_id) return toast.error("Selecione o lote de origem");
    try {
      await createRetirada({ data: {
        data: form.data,
        tipo: tipoDialog,
        socio: form.socio,
        lote_id: form.lote_id || null,
        valor: Number(form.valor),
        descricao: form.descricao || null,
      } });
    } catch (err) {
      return toast.error((err as Error).message);
    }
    toast.success(tipoDialog === "pro_labore" ? "Pró-labore registrado" : "Gasto registrado");
    qc.invalidateQueries({ queryKey: ["retiradas"] });
    setTipoDialog(null);
    setForm({ ...form, valor: "", descricao: "", lote_id: "" });
  }

  async function removeRetirada(id: string) {
    if (!confirm("Excluir registro?")) return;
    try {
      await deleteRetirada({ data: { id } });
    } catch (err) {
      return toast.error((err as Error).message);
    }
    qc.invalidateQueries({ queryKey: ["retiradas"] });
  }

  const visaoGeral = [
    { label: `Total recebido (${anoAtual})`, value: formatBRL(recebidoAno), icon: TrendingUp, tone: "text-success" },
    { label: `Total despesas (${anoAtual})`, value: formatBRL(despesasAno), icon: TrendingDown, tone: "text-destructive" },
    { label: "Total retirada pró-labore", value: formatBRL(proLaboreAno), icon: HandCoins, tone: "text-primary" },
    { label: "Total gastos inesperados", value: formatBRL(gastosAno), icon: AlertTriangle, tone: "text-destructive" },
    { label: "Reservado p/ próxima parcela", value: formatBRL(fundo.saldo), icon: PiggyBank, tone: "text-accent" },
    { label: "Falta p/ próxima parcela", value: formatBRL(fundo.falta), icon: Target, tone: "text-destructive" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão financeira do aviário</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-1.5 shadow-sm">
          <Filter className="w-4 h-4 text-muted-foreground ml-1.5" />
          <Select value={view} onValueChange={(v) => setView(v as "anual" | "lote")}>
            <SelectTrigger className="w-[140px] h-9 border-0 shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="anual">Visão anual</SelectItem>
              <SelectItem value="lote">Por lote</SelectItem>
            </SelectContent>
          </Select>
          {view === "lote" && (
            <Select value={loteSel} onValueChange={setLoteSel}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Selecione um lote" /></SelectTrigger>
              <SelectContent>
                {lotes.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.nome} — {new Date(l.data).toLocaleDateString("pt-BR")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {view === "lote" ? (
        <ResumoLote
          lote={lotes.find((l) => l.id === loteSel)}
          despesas={despesas}
          movimentos={movimentos}
          retiradas={retiradas}
          nomeSocio={nomeSocio}
        />
      ) : (
        <>
          {/* Visão geral do ano */}
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Visão geral de {anoAtual}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {visaoGeral.map((k, i) => (
                <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="overflow-hidden relative border-primary/20 shadow-sm">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/60 to-accent/60" />
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5 min-w-0">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">{k.label}</div>
                          <div className={`text-xl md:text-2xl font-display font-semibold ${k.tone}`}>{k.value}</div>
                        </div>
                        <div className="rounded-lg bg-muted p-2 shrink-0"><k.icon className={`w-5 h-5 ${k.tone}`} /></div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>

          <Card className="border-accent/40 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-accent" /> Fundo da Parcela
              </CardTitle>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarClock className="w-3.5 h-3.5" />
                {fundo.proximoVencimento.toLocaleDateString("pt-BR")}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div><div className="text-xs text-muted-foreground">Valor da parcela</div><div className="font-display font-semibold">{formatBRL(fundo.parcela)}</div></div>
                <div><div className="text-xs text-muted-foreground">Já reservado</div><div className="font-display font-semibold text-accent">{formatBRL(fundo.saldo)}</div></div>
                <div><div className="text-xs text-muted-foreground">Valor faltante</div><div className="font-display font-semibold text-destructive">{formatBRL(fundo.falta)}</div></div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progresso</span><span className="font-medium">{formatPct(fundo.percentual)}</span></div>
                <Progress value={fundo.percentual * 100} />
              </div>
              <p className="text-xs text-muted-foreground">
                Vence em {fundo.diasAteVencimento} dias. Meta financeira — não desconta do caixa.
              </p>
            </CardContent>
          </Card>

          {/* Retiradas */}
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Retiradas</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RetiradaCard
                title="Pró-labore pago"
                icon={HandCoins}
                registros={proLaboreList}
                lotes={lotes}
                nomeSocio={nomeSocio}
                config={config}
                totalSocio1={totalRetiradas(retiradas, "pro_labore", "socio_1")}
                totalSocio2={totalRetiradas(retiradas, "pro_labore", "socio_2")}
                showLote
                onAdd={() => { setForm({ ...form, valor: "", descricao: "", lote_id: "" }); setTipoDialog("pro_labore"); }}
                onRemove={removeRetirada}
              />
              <RetiradaCard
                title="Gastos inesperados"
                icon={AlertTriangle}
                registros={gastosList}
                lotes={lotes}
                nomeSocio={nomeSocio}
                config={config}
                totalSocio1={totalRetiradas(retiradas, "gasto_inesperado", "socio_1")}
                totalSocio2={totalRetiradas(retiradas, "gasto_inesperado", "socio_2")}
                onAdd={() => { setForm({ ...form, valor: "", descricao: "", lote_id: "" }); setTipoDialog("gasto_inesperado"); }}
                onRemove={removeRetirada}
              />
            </div>
          </section>

          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Resultado por lote</CardTitle></CardHeader>
            <CardContent>
              {resultados.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum lote cadastrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lote</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Despesas</TableHead>
                      <TableHead className="text-right">Pró-labore</TableHead>
                      <TableHead className="text-right">Gastos inesp.</TableHead>
                      <TableHead className="text-right">Resultado líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultadosOrd.map((r) => (
                      <TableRow key={r.lote.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{r.lote.nome}</div>
                          <div className="text-xs text-muted-foreground">{new Date(r.lote.data).toLocaleDateString("pt-BR")}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-success">{formatBRL(r.receita)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive">{formatBRL(r.despesas)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive">{formatBRL(r.proLabore)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive">{formatBRL(r.gastosInesperados)}</TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${r.resultadoLiquido >= 0 ? "text-success" : "text-destructive"}`}>{formatBRL(r.resultadoLiquido)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={tipoDialog !== null} onOpenChange={(o) => !o && setTipoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tipoDialog === "pro_labore" ? "Registrar pró-labore" : "Registrar gasto inesperado"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={addRetirada} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data</Label><Input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
              <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" required value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
            </div>
            <div className="space-y-2">
              <Label>Sócio</Label>
              <Select value={form.socio} onValueChange={(v) => setForm({ ...form, socio: v as SocioRetirada })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="socio_1">{config.nome_socio_1}</SelectItem>
                  <SelectItem value="socio_2">{config.nome_socio_2}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Lote de origem {tipoDialog === "pro_labore" ? "*" : "(opcional)"}</Label>
              <Select value={form.lote_id} onValueChange={(v) => setForm({ ...form, lote_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o lote" /></SelectTrigger>
                <SelectContent>
                  {lotes.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome} — {new Date(l.data).toLocaleDateString("pt-BR")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <Button type="submit" className="w-full">Cadastrar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ResumoLoteProps {
  lote: Lote | undefined;
  despesas: Despesa[];
  movimentos: FundoMovimento[];
  retiradas: Retirada[];
  nomeSocio: (s: SocioRetirada) => string;
}

function ResumoLote({ lote, despesas, movimentos, retiradas, nomeSocio }: ResumoLoteProps) {
  if (!lote) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-16 text-center text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          Selecione um lote para ver o resumo.
        </CardContent>
      </Card>
    );
  }

  const r = calcularResultadoLote(lote, despesas);
  const reservado = movimentos
    .filter((m) => m.tipo === "deposito" && m.lote_id === lote.id)
    .reduce((s, m) => s + Number(m.valor), 0);
  const retiradasLote = retiradas.filter((rt) => rt.lote_id === lote.id);
  const proLaboreLote = retiradasLote.filter((rt) => rt.tipo === "pro_labore").reduce((s, rt) => s + Number(rt.valor), 0);
  const gastosLote = retiradasLote.filter((rt) => rt.tipo === "gasto_inesperado").reduce((s, rt) => s + Number(rt.valor), 0);
  const despesasLote = despesas.filter((d) => d.lote_id === lote.id);

  const cards = [
    { label: "Receita bruta", value: formatBRL(r.receita), tone: "text-success", icon: TrendingUp },
    { label: "Despesas", value: formatBRL(r.despesas), tone: "text-destructive", icon: TrendingDown },
    { label: "Resultado líquido", value: formatBRL(r.resultado), tone: r.resultado >= 0 ? "text-success" : "text-destructive", icon: Wallet },
    { label: "Reservado p/ parcela", value: formatBRL(reservado), tone: "text-accent", icon: PiggyBank },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card className="overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-primary/15 via-accent/10 to-transparent px-6 py-5 border-b border-border">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/15 p-3"><Package className="w-6 h-6 text-primary" /></div>
              <div>
                <div className="text-xl font-display font-semibold">{lote.nome}</div>
                <div className="text-xs text-muted-foreground">{new Date(lote.data).toLocaleDateString("pt-BR")}</div>
              </div>
            </div>
            <Badge variant={r.resultado >= 0 ? "default" : "destructive"} className="text-sm px-3 py-1">
              {r.resultado >= 0 ? "Lucro" : "Prejuízo"}: {formatBRL(r.resultado)}
            </Badge>
          </div>
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => (
              <div key={c.label} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
                  <c.icon className={`w-4 h-4 ${c.tone}`} />
                </div>
                <div className={`text-xl font-display font-semibold mt-2 ${c.tone}`}>{c.value}</div>
              </div>
            ))}
          </div>
          {lote.observacoes && (
            <p className="text-sm text-muted-foreground mt-4 border-t border-border pt-4">{lote.observacoes}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="w-4 h-4 text-destructive" /> Despesas do lote</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {despesasLote.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">Nenhuma despesa.</TableCell></TableRow>}
                {despesasLote.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell><Badge variant="secondary">{d.categoria}</Badge></TableCell>
                    <TableCell className="text-sm">{d.descricao}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{formatBRL(Number(d.valor))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><HandCoins className="w-4 h-4 text-primary" /> Retiradas do lote</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground">Pró-labore</div><div className="font-mono font-semibold">{formatBRL(proLaboreLote)}</div></div>
              <div className="rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground">Gastos inesperados</div><div className="font-mono font-semibold">{formatBRL(gastosLote)}</div></div>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Sócio</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {retiradasLote.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">Nenhuma retirada.</TableCell></TableRow>}
                {retiradasLote.map((rt) => (
                  <TableRow key={rt.id}>
                    <TableCell><Badge variant="outline">{rt.tipo === "pro_labore" ? "Pró-labore" : "Gasto"}</Badge></TableCell>
                    <TableCell className="text-sm">{nomeSocio(rt.socio)}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{formatBRL(Number(rt.valor))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

interface RetiradaCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  registros: Retirada[];
  lotes: Lote[];
  nomeSocio: (s: SocioRetirada) => string;
  config: { nome_socio_1: string; nome_socio_2: string };
  totalSocio1: number;
  totalSocio2: number;
  showLote?: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

function RetiradaCard({ title, icon: Icon, registros, lotes, nomeSocio, config, totalSocio1, totalSocio2, showLote, onAdd, onRemove }: RetiradaCardProps) {
  const nomeLote = (id: string | null) => lotes.find((l) => l.id === id)?.nome ?? "—";
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Icon className="w-4 h-4 text-primary" /> {title}</CardTitle>
        <Button size="sm" variant="outline" onClick={onAdd}><Plus className="w-4 h-4 mr-1" /> Registrar</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-muted p-2"><div className="text-xs text-muted-foreground truncate">{config.nome_socio_1}</div><div className="font-mono font-semibold text-sm">{formatBRL(totalSocio1)}</div></div>
          <div className="rounded-md bg-muted p-2"><div className="text-xs text-muted-foreground truncate">{config.nome_socio_2}</div><div className="font-mono font-semibold text-sm">{formatBRL(totalSocio2)}</div></div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Sócio</TableHead>
              {showLote && <TableHead>Lote</TableHead>}
              <TableHead className="text-right">Valor</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.length === 0 && (
              <TableRow><TableCell colSpan={showLote ? 5 : 4} className="text-center py-6 text-muted-foreground text-sm">Nenhum registro.</TableCell></TableRow>
            )}
            {registros.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{new Date(r.data).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell><Badge variant="outline">{nomeSocio(r.socio)}</Badge></TableCell>
                {showLote && <TableCell className="text-sm">{nomeLote(r.lote_id)}</TableCell>}
                <TableCell className="text-right font-mono text-destructive">{formatBRL(Number(r.valor))}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => onRemove(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
