import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { signIn, signUp, getMe } from "@/lib/api/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getMe();
    if (user) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn({ data: { email, password } });
    } catch (err) {
      setLoading(false);
      return toast.error((err as Error).message);
    }
    setLoading(false);
    toast.success("Bem-vindo!");
    router.navigate({ to: "/dashboard" });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp({ data: { email, password } });
    } catch (err) {
      setLoading(false);
      return toast.error((err as Error).message);
    }
    setLoading(false);
    toast.success("Conta criada!");
    router.navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar via-primary to-accent p-4">
      <Card className="w-full max-w-md p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mb-3">
            <Wallet className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-semibold">Financeiro Sócios</h1>
          <p className="text-sm text-muted-foreground mt-1">Acesse a área compartilhada</p>
        </div>

        <Tabs defaultValue="login">
          <TabsList className="grid grid-cols-2 mb-6">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Criando..." : "Criar conta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
