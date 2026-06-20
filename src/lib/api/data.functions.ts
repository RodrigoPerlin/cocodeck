import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { col, COLLECTIONS, mapDoc, mapDocs, CONFIG_PADRAO } from "@/lib/server/collections.server";
import { requireUser } from "@/lib/server/auth.server";

const idSchema = z.object({ id: z.string().min(1) });

// ============ Lotes ============
export const listLotes = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  const c = await col(COLLECTIONS.lotes);
  const docs = await c.find({}).sort({ data: -1 }).toArray();
  return mapDocs(docs);
});

export const createLote = createServerFn({ method: "POST" })
  .validator(
    z.object({
      data: z.string(),
      nome: z.string().min(1),
      valor_bruto: z.number(),
      observacoes: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const c = await col(COLLECTIONS.lotes);
    const _id = randomUUID();
    await c.insertOne({
      _id,
      data: data.data,
      nome: data.nome,
      valor_bruto: data.valor_bruto,
      observacoes: data.observacoes ?? null,
      user_id: user.id,
      created_at: new Date().toISOString(),
    });
    return mapDoc(await c.findOne({ _id }));
  });

export const deleteLote = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    await requireUser();
    const lotes = await col(COLLECTIONS.lotes);
    const despesas = await col(COLLECTIONS.despesas);
    const retiradas = await col(COLLECTIONS.retiradas);
    const fundo = await col(COLLECTIONS.fundo);
    await despesas.deleteMany({ lote_id: data.id });
    await retiradas.updateMany({ lote_id: data.id }, { $set: { lote_id: null } });
    await fundo.updateMany({ lote_id: data.id }, { $set: { lote_id: null } });
    await lotes.deleteOne({ _id: data.id });
    return { ok: true };
  });

// ============ Despesas ============
export const listDespesas = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  const c = await col(COLLECTIONS.despesas);
  const docs = await c.find({}).sort({ data: -1 }).toArray();
  return mapDocs(docs);
});

export const createDespesa = createServerFn({ method: "POST" })
  .validator(
    z.object({
      data: z.string(),
      lote_id: z.string().nullable(),
      categoria: z.string(),
      descricao: z.string(),
      valor: z.number(),
      pago_por: z.enum(["socio_1", "socio_2", "empresa"]),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const c = await col(COLLECTIONS.despesas);
    const _id = randomUUID();
    await c.insertOne({
      _id,
      data: data.data,
      lote_id: data.lote_id,
      categoria: data.categoria,
      descricao: data.descricao,
      valor: data.valor,
      pago_por: data.pago_por,
      user_id: user.id,
      created_at: new Date().toISOString(),
    });
    return mapDoc(await c.findOne({ _id }));
  });

export const deleteDespesa = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    await requireUser();
    const c = await col(COLLECTIONS.despesas);
    await c.deleteOne({ _id: data.id });
    return { ok: true };
  });

// ============ Config ============
export const getConfig = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  const c = await col(COLLECTIONS.config);
  let doc = await c.findOne({ singleton: true });
  if (!doc) {
    const _id = randomUUID();
    await c.insertOne({ _id, ...CONFIG_PADRAO });
    doc = await c.findOne({ _id });
  }
  return mapDoc(doc);
});

export const updateConfig = createServerFn({ method: "POST" })
  .validator(
    z.object({
      nome_socio_1: z.string(),
      nome_socio_2: z.string(),
      salario_socio_1: z.number(),
      salario_socio_2: z.number(),
      financiamento_valor: z.number(),
      juros_anual: z.number(),
      prazo_anos: z.number(),
      resultado_minimo_lote: z.number(),
      percentual_excedente_socios: z.number(),
      parcela_valor: z.number(),
      parcela_vencimento: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    await requireUser();
    const c = await col(COLLECTIONS.config);
    await c.updateOne(
      { singleton: true },
      { $set: { ...data, singleton: true, updated_at: new Date().toISOString() } },
      { upsert: true },
    );
    return mapDoc(await c.findOne({ singleton: true }));
  });

// ============ Fundo de reserva ============
export const listFundoMovimentos = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  const c = await col(COLLECTIONS.fundo);
  const docs = await c.find({}).sort({ data: -1 }).toArray();
  return mapDocs(docs);
});

export const createFundoMovimento = createServerFn({ method: "POST" })
  .validator(
    z.object({
      data: z.string(),
      tipo: z.enum(["deposito", "pagamento_parcela", "ajuste"]),
      valor: z.number(),
      lote_id: z.string().nullable().optional(),
      descricao: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const c = await col(COLLECTIONS.fundo);
    const _id = randomUUID();
    await c.insertOne({
      _id,
      data: data.data,
      tipo: data.tipo,
      valor: data.valor,
      lote_id: data.lote_id ?? null,
      descricao: data.descricao ?? null,
      user_id: user.id,
      created_at: new Date().toISOString(),
    });
    return mapDoc(await c.findOne({ _id }));
  });

export const deleteFundoMovimento = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    await requireUser();
    const c = await col(COLLECTIONS.fundo);
    await c.deleteOne({ _id: data.id });
    return { ok: true };
  });

// ============ Retiradas ============
export const listRetiradas = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  const c = await col(COLLECTIONS.retiradas);
  const docs = await c.find({}).sort({ data: -1 }).toArray();
  return mapDocs(docs);
});

export const createRetirada = createServerFn({ method: "POST" })
  .validator(
    z.object({
      data: z.string(),
      tipo: z.enum(["pro_labore", "gasto_inesperado"]),
      socio: z.enum(["socio_1", "socio_2"]),
      lote_id: z.string().nullable().optional(),
      valor: z.number(),
      descricao: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const c = await col(COLLECTIONS.retiradas);
    const _id = randomUUID();
    await c.insertOne({
      _id,
      data: data.data,
      tipo: data.tipo,
      socio: data.socio,
      lote_id: data.lote_id ?? null,
      valor: data.valor,
      descricao: data.descricao ?? null,
      user_id: user.id,
      created_at: new Date().toISOString(),
    });
    return mapDoc(await c.findOne({ _id }));
  });

export const deleteRetirada = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    await requireUser();
    const c = await col(COLLECTIONS.retiradas);
    await c.deleteOne({ _id: data.id });
    return { ok: true };
  });
