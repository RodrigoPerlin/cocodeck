import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { col, COLLECTIONS } from "@/lib/server/collections.server";
import {
  hashPassword, verifyPassword, createSession, destroySession, getCurrentUser,
  type UserDoc, type PublicUser,
} from "@/lib/server/auth.server";

const credSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
});

export const signUp = createServerFn({ method: "POST" })
  .validator(credSchema)
  .handler(async ({ data }): Promise<PublicUser> => {
    const email = data.email.toLowerCase().trim();
    const users = await col<UserDoc>(COLLECTIONS.users);
    const existing = await users.findOne({ email });
    if (existing) throw new Error("Já existe uma conta com este email");
    const _id = randomUUID();
    await users.insertOne({
      _id,
      email,
      passwordHash: await hashPassword(data.password),
      createdAt: new Date().toISOString(),
    });
    await createSession(_id);
    return { id: _id, email };
  });

export const signIn = createServerFn({ method: "POST" })
  .validator(credSchema)
  .handler(async ({ data }): Promise<PublicUser> => {
    const email = data.email.toLowerCase().trim();
    const users = await col<UserDoc>(COLLECTIONS.users);
    const user = await users.findOne({ email });
    if (!user) throw new Error("Email ou senha incorretos");
    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) throw new Error("Email ou senha incorretos");
    await createSession(user._id);
    return { id: user._id, email: user.email };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true };
});

export const getMe = createServerFn({ method: "GET" }).handler(async (): Promise<PublicUser | null> => {
  return getCurrentUser();
});
