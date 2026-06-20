import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLotes, useConfig, useFundoMovimentos } from "@/lib/queries";
import { createFundoMovimento, deleteFundoMovimento } from "@/lib/api/data.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Landmark, CalendarClock, PiggyBank, Target } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  formatBRL, formatPct, calcularFundoStatus, reservasPorLote, totalReservado,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/financiamento")({ component: FinanciamentoPage });

function FinanciamentoPage() {
  const { data: lotes = [] } = useLotes();
  const { data: movimentos = [] } = useFundoMovimentos();
  const { data: config } = useConfig();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    lote_id: "",
    valor: "",
  });

  if (!config) return <div className="text-muted-foreground">Carregando…</div>;

  const fundo = calcularFundoStatus(movimentos, config);
  const reservado = totalReservado(movimentos);
  const reservas = reservasPorLote(lotes, movimentos);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.lote_id) return toast.error("Selecione o lote de origem");
    if (!form.valor || Number(form.valor) <= 0) return toast.error("Informe um valor válido");
    const lote = lotes.find((l) => l.id === form.lote_id);
    try {
      await createFundoMovimento({ data: {
        data: form.data,
        tipo: "deposito",
        valor: Number(form.valor),
        lote_id: form.lote_id,
        descricao: lote ? `Reserva do lote ${lote.nome}` : "Reserva",
      } });
    } catch (err) {
      return toast.error((err as Error).message);
    }
    toast.success("Reserva registrada");
    qc.invalidateQueries({ queryKey: ["fundo_movimentos"] });
    setOpen(false);
    setForm({ ...form, valor: "" });
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta reserva?")) return;
    try {
      await deleteFundoMovimento({ data: { id } });
    } catch (err) {
      return toast.error((err as Error).message);
    }
    qc.invalidateQueries({ queryKey: ["fundo_movimentos"] });
  }

  const numParcelas = Number(config.prazo_anos) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Financiamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Reserva da próxima parcela por lote</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={lotes.length === 0}><Plus className="w-4 h-4 mr-2" /> Registrar reserva</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar reserva da parcela</DialogTitle></DialogHeader>
            <form onSubmit={add} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Data</Label><Input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
                <div className="space-y-2"><Label>Valor reservado (R$)</Label><Input type="number" step="0.01" required value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Lote de origem *</Label>
                <Select value={form.lote_id} onValueChange={(v) => setForm({ ...form, lote_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um lote" /></SelectTrigger>
                  <SelectContent>
                    {lotes.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.nome} — {new Date(l.data).toLocaleDateString("pt-BR")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-muted rounded-md p-3 text-xs text-muted-foreground">
                Reserva sugerida por lote: <span className="font-mono font-semibold text-foreground">{formatBRL(fundo.reservaPorLote)}</span>
              </div>
              <Button type="submit" className="w-full">Reservar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {lotes.length === 0 && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground text-center">
          Cadastre um lote antes de registrar reservas.
        </CardContent></Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card><CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">Valor financiado</div>
              <div className="text-lg md:text-xl font-display font-semibold">{formatBRL(Number(config.financiamento_valor))}</div>
            </div>
            <Landmark className="w-5 h-5 text-primary opacity-70 shrink-0" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">Juros ao ano</div>
              <div className="text-lg md:text-xl font-display font-semibold">{formatPct(Number(config.juros_anual))}</div>
            </div>
            <Target className="w-5 h-5 text-primary opacity-70 shrink-0" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">Nº de parcelas</div>
              <div className="text-lg md:text-xl font-display font-semibold">{numParcelas || "—"}</div>
            </div>
            <Landmark className="w-5 h-5 text-muted-foreground opacity-70 shrink-0" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">Próximo vencimento</div>
              <div className="text-lg md:text-xl font-display font-semibold">{fundo.proximoVencimento.toLocaleDateString("pt-BR")}</div>
            </div>
            <CalendarClock className="w-5 h-5 text-muted-foreground opacity-70 shrink-0" />
          </div>
        </CardContent></Card>
      </div>

      <Card className="border-accent/40">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-accent" /> Próxima parcela
          </CardTitle>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarClock className="w-3.5 h-3.5" />
            {fundo.proximoVencimento.toLocaleDateString("pt-BR")} ({fundo.diasAteVencimento} dias)
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><div className="text-xs text-muted-foreground">Valor da parcela</div><div className="font-display font-semibold">{formatBRL(fundo.parcela)}</div></div>
            <div><div className="text-xs text-muted-foreground">Total reservado</div><div className="font-display font-semibold text-accent">{formatBRL(reservado)}</div></div>
            <div><div className="text-xs text-muted-foreground">Falta reservar</div><div className="font-display font-semibold text-destructive">{formatBRL(fundo.falta)}</div></div>
            <div><div className="text-xs text-muted-foreground">Reserva sugerida/lote</div><div className="font-display font-semibold">{formatBRL(fundo.reservaPorLote)}</div></div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progresso</span><span className="font-medium">{formatPct(fundo.percentual)}</span></div>
            <Progress value={fundo.percentual * 100} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Reserva por lote</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lote</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor reservado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservas.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhum lote cadastrado.</TableCell></TableRow>
              )}
              {reservas.map((r) => (
                <TableRow key={r.lote.id}>
                  <TableCell className="font-medium">{r.lote.nome}</TableCell>
                  <TableCell>{new Date(r.lote.data).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-mono text-accent">{formatBRL(r.reservado)}</TableCell>
                </TableRow>
              ))}
              {reservas.length > 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">Total reservado</TableCell>
                  <TableCell className="text-right font-mono font-semibold text-accent">{formatBRL(reservado)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de reservas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentos.filter((m) => m.tipo === "deposito").length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma reserva registrada.</TableCell></TableRow>
              )}
              {movimentos.filter((m) => m.tipo === "deposito").map((m) => {
                const lote = lotes.find((l) => l.id === m.lote_id);
                return (
                  <TableRow key={m.id}>
                    <TableCell>{new Date(m.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{lote?.nome ?? <span className="text-muted-foreground italic">—</span>}</TableCell>
                    <TableCell>{m.descricao}</TableCell>
                    <TableCell className="text-right font-mono text-accent">{formatBRL(Number(m.valor))}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => remove(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
