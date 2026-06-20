import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { col, COLLECTIONS } from "./collections.server";

const SESSION_COOKIE = "session_token";
const SESSION_DAYS = 30;

export interface UserDoc {
  _id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface SessionDoc {
  _id: string; // token
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomUUID() + randomUUID().replace(/-/g, "");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const sessions = await col<SessionDoc>(COLLECTIONS.sessions);
  await sessions.insertOne({
    _id: token,
    userId,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    const sessions = await col<SessionDoc>(COLLECTIONS.sessions);
    await sessions.deleteOne({ _id: token });
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const sessions = await col<SessionDoc>(COLLECTIONS.sessions);
  const session = await sessions.findOne({ _id: token });
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await sessions.deleteOne({ _id: token });
    deleteCookie(SESSION_COOKIE, { path: "/" });
    return null;
  }
  const users = await col<UserDoc>(COLLECTIONS.users);
  const user = await users.findOne({ _id: session.userId });
  if (!user) return null;
  return { id: user._id, email: user.email };
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Não autenticado");
  return user;
}
