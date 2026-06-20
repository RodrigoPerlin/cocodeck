import * as mongodb from "mongodb";
import process from "node:process";

// Conexão server-only com o MongoDB. O sufixo .server.ts impede que o Vite
// inclua este arquivo no bundle do cliente — a URI (com credenciais) nunca
// chega ao navegador. O MongoDB NÃO pode ser acessado do browser; use este
// cliente apenas dentro de server functions (createServerFn) ou .server.ts.

const DB_NAME = process.env.MONGODB_DB || "financeiro_socios";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<mongodb.MongoClient> | undefined;
}

function getClientPromise(): Promise<mongodb.MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Defina MONGODB_URI no arquivo .env");
  }

  // Em desenvolvimento, reaproveita a conexão entre recarregamentos do HMR.
  if (process.env.NODE_ENV !== "production") {
    if (!global._mongoClientPromise) {
      const client = new mongodb.MongoClient(uri);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  // Em produção, cria uma conexão dedicada.
  const client = new mongodb.MongoClient(uri);
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
