import type { Collection, Document } from "mongodb";
import { getDb } from "@/lib/mongodb.server";

export const COLLECTIONS = {
  users: "users",
  sessions: "sessions",
  lotes: "lotes",
  despesas: "despesas",
  config: "config_financeira",
  fundo: "fundo_reserva_movimentos",
  retiradas: "retiradas",
} as const;

export async function col<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}

// Remove o _id do Mongo e expõe `id` (string) para o restante do app.
export function mapDoc<T extends { _id?: unknown }>(doc: T | null): (Omit<T, "_id"> & { id: string }) | null {
  if (!doc) return null;
  const { _id, ...rest } = doc as Record<string, unknown>;
  return { ...(rest as Omit<T, "_id">), id: String(_id) };
}

export function mapDocs<T extends { _id?: unknown }>(docs: T[]): (Omit<T, "_id"> & { id: string })[] {
  return docs.map((d) => mapDoc(d)!) as (Omit<T, "_id"> & { id: string })[];
}

// Configuração padrão (espelha os defaults das migrations originais do Supabase).
export const CONFIG_PADRAO = {
  singleton: true,
  nome_socio_1: "Sócio 1",
  nome_socio_2: "Sócio 2",
  salario_socio_1: 5000,
  salario_socio_2: 0,
  financiamento_valor: 1800000,
  juros_anual: 0.06,
  prazo_anos: 9,
  resultado_minimo_lote: 50000,
  percentual_excedente_socios: 50,
  parcela_valor: 264640.02,
  parcela_vencimento: "2027-06-30",
};
