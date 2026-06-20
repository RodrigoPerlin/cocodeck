import { useQuery } from "@tanstack/react-query";
import type { ConfigFinanceira, Despesa, FundoMovimento, Lote, Retirada } from "@/lib/finance";
import {
  listLotes, listDespesas, getConfig, listFundoMovimentos, listRetiradas,
} from "@/lib/api/data.functions";

export function useLotes() {
  return useQuery({
    queryKey: ["lotes"],
    queryFn: async (): Promise<Lote[]> => (await listLotes()) as unknown as Lote[],
  });
}

export function useDespesas() {
  return useQuery({
    queryKey: ["despesas"],
    queryFn: async (): Promise<Despesa[]> => (await listDespesas()) as unknown as Despesa[],
  });
}

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: async (): Promise<ConfigFinanceira> => (await getConfig()) as unknown as ConfigFinanceira,
  });
}

export function useFundoMovimentos() {
  return useQuery({
    queryKey: ["fundo_movimentos"],
    queryFn: async (): Promise<FundoMovimento[]> => (await listFundoMovimentos()) as unknown as FundoMovimento[],
  });
}

export function useRetiradas() {
  return useQuery({
    queryKey: ["retiradas"],
    queryFn: async (): Promise<Retirada[]> => (await listRetiradas()) as unknown as Retirada[],
  });
}
