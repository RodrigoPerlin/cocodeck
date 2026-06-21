import * as mongodb from "mongodb";
import process from "node:process";

// Conexão server-only com o MongoDB. O sufixo .server.ts impede que o Vite
// inclua este arquivo no bundle do cliente — a URI (com credenciais) nunca
// chega ao navegador. O MongoDB NÃO pode ser acessado do browser; use este
// cliente apenas dentro de server functions (createServerFn) ou .server.ts.

// Fallbacks usados apenas se as variáveis de ambiente não estiverem definidas
// (ex.: env não configurada na Vercel). Prefira sempre definir MONGODB_URI /
// MONGODB_DB no ambiente — estas credenciais não deveriam viver no código.
const MONGODB_URI_FALLBACK =
  "mongodb+srv://rodrigoperlin1_db_user:drake951357@cluster1.vfwfcw6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1";
const MONGODB_DB_FALLBACK = "financeiro_socios";

const DB_NAME = process.env.MONGODB_DB || MONGODB_DB_FALLBACK;

// Em ambientes serverless (Vercel/Lambda) o "Happy Eyeballs" do Node (auto
// seleção IPv4/IPv6, padrão a partir do Node 18) pode quebrar o handshake TLS
// com o Atlas, gerando "tlsv1 alert internal error / SSL alert number 80".
// Forçar IPv4 (autoSelectFamily: false + family: 4) evita esse problema.
const CLIENT_OPTIONS: mongodb.MongoClientOptions = {
  autoSelectFamily: false,
  family: 4,
};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<mongodb.MongoClient> | undefined;
}

function getClientPromise(): Promise<mongodb.MongoClient> {
  const uri = process.env.MONGODB_URI || MONGODB_URI_FALLBACK;

  // Em desenvolvimento, reaproveita a conexão entre recarregamentos do HMR.
  if (process.env.NODE_ENV !== "production") {
    if (!global._mongoClientPromise) {
      const client = new mongodb.MongoClient(uri, CLIENT_OPTIONS);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  // Em produção, cria uma conexão dedicada.
  const client = new mongodb.MongoClient(uri, CLIENT_OPTIONS);
  return client.connect();
}

export async function connectToDatabase() {
  const client = await getClientPromise();
  const db = client.db(DB_NAME);
  return { client, db };
}

export async function getDb() {
  const { db } = await connectToDatabase();
  return db;
}
