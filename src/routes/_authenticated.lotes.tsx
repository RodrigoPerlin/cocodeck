import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLotes, useDespesas, useConfig, useFundoMovimentos, useRetiradas } from "@/lib/queries";
import { createLote, deleteLote } from "@/lib/api/data.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { calcularFundoStatus, calcularResultadosLotesCompleto, formatBRL } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/lotes")({ component: LotesPage });

function LotesPage() {
  const { data: lotes = [] } = useLotes();
  const { data: despesas = [] } = useDespesas();
  const { data: config } = useConfig();
  const { data: movimentos = [] } = useFundoMovimentos();
  const { data: retiradas = [] } = useRetiradas();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    nome: "",
    valor_bruto: "",
    observacoes: "",
  });

  const fundo = useMemo(() => (config ? calcularFundoStatus(movimentos, config) : null), [movimentos, config]);
  const resultados = useMemo(() => calcularResultadosLotesCompleto(lotes, despesas, retiradas), [lotes, despesas, retiradas]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createLote({ data: {
        data: form.data,
        nome: form.nome,
        valor_bruto: Number(form.valor_bruto),
        observacoes: form.observacoes || null,
      } });
    } catch (err) {
      return toast.error((err as Error).message);
    }
    toast.success("Lote cadastrado");
    qc.invalidateQueries({ queryKey: ["lotes"] });
    setOpen(false);
    setForm({ data: new Date().toISOString().slice(0, 10), nome: "", valor_bruto: "", observacoes: "" });
  }

  async function remove(id: string) {
    if (!confirm("Excluir lote? (despesas vinculadas também serão removidas)")) return;
    try {
      await deleteLote({ data: { id } });
    } catch (err) {
      return toast.error((err as Error).message);
    }
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: ["lotes"] });
    qc.invalidateQueries({ queryKey: ["despesas"] });
    qc.invalidateQueries({ queryKey: ["retiradas"] });
    qc.invalidateQueries({ queryKey: ["fundo_movimentos"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Lotes</h1>
          <p className="text-sm text-muted-foreground mt-1">Receita por lote e suas despesas vinculadas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Novo lote</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Novo lote</DialogTitle></DialogHeader>
            <form onSubmit={add} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Data</Label><Input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
                <div className="space-y-2"><Label>Valor recebido (R$)</Label><Input type="number" step="0.01" required value={form.valor_bruto} onChange={(e) => setForm({ ...form, valor_bruto: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Nome do lote</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
              {fundo && fundo.falta > 0 && Number(form.valor_bruto) > 0 && (
                <div className="rounded-md border border-accent/30 bg-accent/5 p-3 text-xs">
                  Reserva sugerida para este lote: <strong className="text-accent">{formatBRL(fundo.reservaPorLote)}</strong>
                  <div className="text-muted-foreground mt-1">{fundo.lotesRestantes} lote(s) restantes até {fundo.proximoVencimento.toLocaleDateString("pt-BR")}</div>
                </div>
              )}
              <Button type="submit" className="w-full">Cadastrar lote</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{lotes.length} lote(s)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Pró-labore</TableHead>
                <TableHead className="text-right">Gastos inesp.</TableHead>
                <TableHead className="text-right">Resultado líquido</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lotes.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum lote ainda.</TableCell></TableRow>
              )}
              {resultados.map((r) => (
                <TableRow key={r.lote.id}>
                  <TableCell>{new Date(r.lote.data).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="font-medium">{r.lote.nome}</TableCell>
                  <TableCell className="text-right font-mono text-success">{formatBRL(r.receita)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{formatBRL(r.despesas)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{formatBRL(r.proLabore)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{formatBRL(r.gastosInesperados)}</TableCell>
                  <TableCell className={`text-right font-mono font-semibold ${r.resultadoLiquido >= 0 ? "text-success" : "text-destructive"}`}>{formatBRL(r.resultadoLiquido)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => remove(r.lote.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
