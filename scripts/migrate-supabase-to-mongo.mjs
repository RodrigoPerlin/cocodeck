// Migra os dados do Supabase para o MongoDB.
//
// Pré-requisitos:
//   - MONGODB_URI e MONGODB_DB no .env
//   - VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env
//   - Credenciais de um usuário existente no Supabase (para passar pelo RLS):
//       SUPABASE_EMAIL e SUPABASE_PASSWORD (via variável de ambiente)
//
// Uso:
//   SUPABASE_EMAIL=voce@email.com SUPABASE_PASSWORD=suasenha node scripts/migrate-supabase-to-mongo.mjs
//
// É idempotente: roda quantas vezes quiser (upsert por id).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { MongoClient } from "mongodb";

function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env opcional se as variáveis já estiverem no ambiente
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "financeiro_socios";
const EMAIL = process.env.SUPABASE_EMAIL;
const PASSWORD = process.env.SUPABASE_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Faltam VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY no .env");
if (!MONGODB_URI) throw new Error("Falta MONGODB_URI no .env");
if (!EMAIL || !PASSWORD) throw new Error("Defina SUPABASE_EMAIL e SUPABASE_PASSWORD (de um usuário existente no Supabase).");

const TABELAS = ["lotes", "despesas", "config_financeira", "fundo_reserva_movimentos", "retiradas"];

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (authErr) throw new Error("Falha ao autenticar no Supabase: " + authErr.message);
  console.log("Autenticado no Supabase.");

  const mongo = new MongoClient(MONGODB_URI);
  await mongo.connect();
  const db = mongo.db(MONGODB_DB);
  console.log("Conectado ao MongoDB:", MONGODB_DB);

  for (const tabela of TABELAS) {
    const { data, error } = await supabase.from(tabela).select("*");
    if (error) {
      console.log(`- ${tabela}: pulada (${error.message})`);
      continue;
    }
    if (!data || data.length === 0) {
      console.log(`- ${tabela}: 0 registros`);
      continue;
    }
    const coll = db.collection(tabela);
    let n = 0;
    for (const row of data) {
      const { id, ...rest } = row;
      const _id = id ?? crypto.randomUUID();
      await coll.updateOne({ _id }, { $set: { _id, ...rest } }, { upsert: true });
      n++;
    }
    console.log(`- ${tabela}: ${n} registro(s) migrado(s)`);
  }

  // Garante singleton na config
  const config = db.collection("config_financeira");
  const cfg = await config.findOne({});
  if (cfg && cfg.singleton !== true) {
    await config.updateOne({ _id: cfg._id }, { $set: { singleton: true } });
  }

  await mongo.close();
  console.log("Migração concluída.");
  process.exit(0);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
