import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useConfig, useLotes, useDespesas } from "@/lib/queries";
import { updateConfig } from "@/lib/api/data.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { calcularResultadosLotes, formatBRL, calcularParcelaPrice } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/configuracoes")({ component: ConfigPage });

function ConfigPage() {
  const { data: config } = useConfig();
  const { data: lotes = [] } = useLotes();
  const { data: despesas = [] } = useDespesas();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);

  if (!config) return <div className="text-muted-foreground">Carregando…</div>;
  const f = form ?? config;

  async function save() {
    try {
      await updateConfig({ data: {
        nome_socio_1: f.nome_socio_1, nome_socio_2: f.nome_socio_2,
        salario_socio_1: Number(f.salario_socio_1), salario_socio_2: Number(f.salario_socio_2),
        financiamento_valor: Number(f.financiamento_valor), juros_anual: Number(f.juros_anual),
        prazo_anos: Number(f.prazo_anos), resultado_minimo_lote: Number(f.resultado_minimo_lote),
        percentual_excedente_socios: Number(f.percentual_excedente_socios),
        parcela_valor: Number(f.parcela_valor),
        parcela_vencimento: f.parcela_vencimento,
      } });
    } catch (err) {
      return toast.error((err as Error).message);
    }
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["config"] });
  }

  const anoAtual = new Date().getFullYear();
  const lotesAno = lotes.filter((l) => new Date(l.data).getFullYear() === anoAtual);
  const despAno = despesas.filter((d) => new Date(d.data).getFullYear() === anoAtual);
  const resultados = calcularResultadosLotes(lotesAno, despAno);
  const totalResultado = resultados.reduce((s, r) => s + r.resultado, 0);
  const base = Number(f.resultado_minimo_lote) * Math.max(1, lotesAno.length);
  const totalExcedente = Math.max(0, totalResultado - base);
  const parteSocios = (totalExcedente * Number(f.percentual_excedente_socios)) / 100;
  const novoSalarioMensal = (Number(f.salario_socio_1) + Number(f.salario_socio_2)) + parteSocios / 12 / 2;

  const parcela = Number(f.parcela_valor) || 0;
  const parcelaSugerida = calcularParcelaPrice(
    Number(f.financiamento_valor),
    Number(f.juros_anual),
    Number(f.prazo_anos),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Regras automáticas e distribuição de resultados</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Sócios e salários</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nome do Sócio 1</Label><Input value={f.nome_socio_1} onChange={(e) => setForm({ ...f, nome_socio_1: e.target.value })} /></div>
              <div className="space-y-2"><Label>Nome do Sócio 2</Label><Input value={f.nome_socio_2} onChange={(e) => setForm({ ...f, nome_socio_2: e.target.value })} /></div>
              <div className="space-y-2"><Label>Salário fixo Sócio 1 (mensal)</Label><Input type="number" step="0.01" value={f.salario_socio_1} onChange={(e) => setForm({ ...f, salario_socio_1: e.target.value })} /></div>
              <div className="space-y-2"><Label>Salário fixo Sócio 2 (mensal)</Label><Input type="number" step="0.01" value={f.salario_socio_2} onChange={(e) => setForm({ ...f, salario_socio_2: e.target.value })} /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Financiamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Valor financiado (R$)</Label><Input type="number" step="0.01" value={f.financiamento_valor ?? ""} onChange={(e) => setForm({ ...f, financiamento_valor: e.target.value })} /></div>
              <div className="space-y-2"><Label>Nº de parcelas</Label><Input type="number" step="1" value={f.prazo_anos ?? ""} onChange={(e) => setForm({ ...f, prazo_anos: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Juros ao ano (ex: 0.06 = 6%)</Label>
                <Input type="number" step="0.0001" value={f.juros_anual ?? ""} onChange={(e) => setForm({ ...f, juros_anual: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Próximo vencimento</Label><Input type="date" value={f.parcela_vencimento ?? ""} onChange={(e) => setForm({ ...f, parcela_vencimento: e.target.value })} /></div>
              <div className="space-y-2 col-span-2"><Label>Valor da próxima parcela (R$)</Label><Input type="number" step="0.01" value={f.parcela_valor ?? ""} onChange={(e) => setForm({ ...f, parcela_valor: e.target.value })} /></div>
            </div>
            <div className="bg-muted rounded-md p-3 text-sm space-y-2">
              <div className="flex justify-between items-center">
                <span>Parcela sugerida (Price):</span>
                <span className="font-mono font-semibold">{formatBRL(parcelaSugerida)}</span>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setForm({ ...f, parcela_valor: parcelaSugerida.toFixed(2) })}>
                Usar parcela sugerida
              </Button>
              <div className="flex justify-between pt-1 border-t border-border"><span>Meta do fundo da parcela:</span><span className="font-mono font-semibold">{formatBRL(parcela)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Distribuição do excedente</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Resultado mínimo esperado por lote (R$)</Label><Input type="number" step="0.01" value={f.resultado_minimo_lote} onChange={(e) => setForm({ ...f, resultado_minimo_lote: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>% do excedente destinado aos sócios: <span className="text-accent font-semibold">{Number(f.percentual_excedente_socios).toFixed(0)}%</span></Label>
                <Slider value={[Number(f.percentual_excedente_socios)]} min={0} max={100} step={5} onValueChange={(v) => setForm({ ...f, percentual_excedente_socios: v[0] })} />
              </div>
            </div>

            <div className="bg-accent/10 border border-accent/30 rounded-md p-4 space-y-2">
              <div className="text-sm font-medium">Simulação ({anoAtual})</div>
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div><div className="text-muted-foreground text-xs">Excedente total</div><div className="font-mono font-semibold text-lg">{formatBRL(totalExcedente)}</div></div>
                <div><div className="text-muted-foreground text-xs">Parte dos sócios</div><div className="font-mono font-semibold text-lg text-accent">{formatBRL(parteSocios)}</div></div>
                <div><div className="text-muted-foreground text-xs">Novo salário sugerido (cada)</div><div className="font-mono font-semibold text-lg text-success">{formatBRL(novoSalarioMensal)}</div></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} size="lg">Salvar configurações</Button>
      </div>
    </div>
  );
}
