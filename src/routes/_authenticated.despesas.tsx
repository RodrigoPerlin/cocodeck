import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDespesas, useConfig, useLotes } from "@/lib/queries";
import { createDespesa, deleteDespesa } from "@/lib/api/data.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatBRL, type Pagador } from "@/lib/finance";
import { Badge } from "@/components/ui/badge";

const CATEGORIAS = ["Insumos", "Mão de obra", "Combustível", "Manutenção", "Logística", "Administrativo", "Impostos", "Outros"];

export const Route = createFileRoute("/_authenticated/despesas")({ component: DespesasPage });

function DespesasPage() {
  const { data: despesas = [] } = useDespesas();
  const { data: lotes = [] } = useLotes();
  const { data: config } = useConfig();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filtroLote, setFiltroLote] = useState<string>("todos");
  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    lote_id: "",
    categoria: CATEGORIAS[0],
    descricao: "",
    valor: "",
    pago_por: "empresa" as Pagador,
  });

  const lotePorId = (id: string | null) => lotes.find((l) => l.id === id);

  const despesasFiltradas = filtroLote === "todos"
    ? despesas
    : despesas.filter((d) => d.lote_id === filtroLote);
  const totalFiltrado = despesasFiltradas.reduce((s, d) => s + Number(d.valor), 0);

  const nomePagador = (p: Pagador) =>
    p === "socio_1" ? (config?.nome_socio_1 ?? "Sócio 1")
    : p === "socio_2" ? (config?.nome_socio_2 ?? "Sócio 2")
    : "Empresa";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.lote_id) return toast.error("Selecione o lote vinculado");
    try {
      await createDespesa({ data: {
        data: form.data,
        lote_id: form.lote_id,
        categoria: form.categoria,
        descricao: form.descricao,
        valor: Number(form.valor),
        pago_por: form.pago_por,
      } });
    } catch (err) {
      return toast.error((err as Error).message);
    }
    toast.success("Despesa registrada");
    qc.invalidateQueries({ queryKey: ["despesas"] });
    setOpen(false);
    setForm({ ...form, descricao: "", valor: "" });
  }

  async function remove(id: string) {
    if (!confirm("Excluir despesa?")) return;
    try {
      await deleteDespesa({ data: { id } });
    } catch (err) {
      return toast.error((err as Error).message);
    }
    qc.invalidateQueries({ queryKey: ["despesas"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Despesas</h1>
          <p className="text-sm text-muted-foreground mt-1">Toda despesa é vinculada a um lote</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={lotes.length === 0}><Plus className="w-4 h-4 mr-2" /> Nova despesa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
            <form onSubmit={add} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Data</Label><Input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
                <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" required value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Lote vinculado *</Label>
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
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Descrição</Label><Input required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Pago por</Label>
                <Select value={form.pago_por} onValueChange={(v) => setForm({ ...form, pago_por: v as Pagador })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="socio_1">{nomePagador("socio_1")}</SelectItem>
                    <SelectItem value="socio_2">{nomePagador("socio_2")}</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {lotes.length === 0 && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground text-center">
          Cadastre um lote antes de lançar despesas.
        </CardContent></Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">
            {despesasFiltradas.length} despesa(s)
            <span className="text-muted-foreground font-normal ml-2 text-sm">· total {formatBRL(totalFiltrado)}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Filtrar por lote</Label>
            <Select value={filtroLote} onValueChange={setFiltroLote}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os lotes</SelectItem>
                {lotes.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.nome} — {new Date(l.data).toLocaleDateString("pt-BR")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Pago por</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {despesasFiltradas.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma despesa.</TableCell></TableRow>
              )}
              {despesasFiltradas.map((d) => {
                const lote = lotePorId(d.lote_id);
                return (
                  <TableRow key={d.id}>
                    <TableCell>{new Date(d.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{lote?.nome ?? <span className="text-muted-foreground italic">sem lote</span>}</TableCell>
                    <TableCell><Badge variant="secondary">{d.categoria}</Badge></TableCell>
                    <TableCell>{d.descricao}</TableCell>
                    <TableCell><Badge variant="outline">{nomePagador(d.pago_por)}</Badge></TableCell>
                    <TableCell className="text-right font-mono text-destructive">{formatBRL(Number(d.valor))}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => remove(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
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
