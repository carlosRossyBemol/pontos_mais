import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import RegisterPurchase from "@/components/RegisterPurchase";
import WithdrawBonus from "@/components/WithdrawBonus";
import CustomersList from "@/components/CustomersList";
import TransactionHistory from "@/components/TransactionHistory";

const Index = () => {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name")
      .eq("id", session.user.id)
      .single();

    if (profile) {
      setBusinessName(profile.business_name);
    }
    
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Pontos+</h1>
              <p className="text-sm text-muted-foreground">{businessName}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="purchase" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-12">
            <TabsTrigger value="purchase" className="text-base">Registrar Compra</TabsTrigger>
            <TabsTrigger value="withdraw" className="text-base">Retirada de Bônus</TabsTrigger>
            <TabsTrigger value="customers" className="text-base">Clientes</TabsTrigger>
            <TabsTrigger value="history" className="text-base">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="purchase" className="mt-6">
            <RegisterPurchase />
          </TabsContent>

          <TabsContent value="withdraw" className="mt-6">
            <WithdrawBonus />
          </TabsContent>

          <TabsContent value="customers" className="mt-6">
            <CustomersList />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <TransactionHistory />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
