import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShoppingCart, Loader2 } from "lucide-react";

export const RegisterPurchase = () => {
  const [identifier, setIdentifier] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [tempCpf, setTempCpf] = useState("");
  const queryClient = useQueryClient();

  const handleRegisterPurchase = async () => {
    if (!identifier || !amount) {
      toast.error("Preencha CPF/código e valor da compra");
      return;
    }

    const purchaseAmount = parseFloat(amount);
    if (isNaN(purchaseAmount) || purchaseAmount <= 0) {
      toast.error("Valor inválido");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      // Busca cliente por CPF ou código dentro da empresa logada
      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("business_id", session.user.id)
        .or(`cpf.eq.${identifier},code.eq.${identifier}`)
        .single();

      if (!customer) {
        setTempCpf(identifier);
        setShowNewCustomerDialog(true);
        setLoading(false);
        return;
      }

      // Processar compra com lógica de bônus
      await processPurchase(customer, purchaseAmount, session.user.id);

      // Atualiza queries locais
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao registrar compra");
    } finally {
      setLoading(false);
    }
  };

  function formatCurrency(value: number): string {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  const processPurchase = async (customer: any, purchaseAmount: number, businessId: string) => {
    // 1 real = 1 ponto
    const pointsEarned = Math.floor(purchaseAmount);
    const previousPoints = customer.points ?? 0;
    const previousBonus = customer.bonus_balance ?? 0;

    const newTotalPoints = previousPoints + pointsEarned;

    // Quantos múltiplos de 500 o cliente já tinha e quantos tem agora
    const prevMultiples = Math.floor(previousPoints / 500);
    const newMultiples = Math.floor(newTotalPoints / 500);

    // Bônus a adicionar = diferença de múltiplos * R$10
    const bonusToAdd = (newMultiples - prevMultiples) * 10;
    const newBonusBalance = previousBonus + bonusToAdd;

    // Atualiza cliente
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        points: newTotalPoints,
        bonus_balance: newBonusBalance,
      })
      .eq("id", customer.id);

    if (updateError) throw updateError;

    // Registra transação (compatível com seu schema)
    const { error: transactionError } = await supabase
      .from("transactions")
      .insert({
        business_id: businessId,
        customer_id: customer.id,
        type: "purchase",
        amount: purchaseAmount,
        points: pointsEarned,
      });

    if (transactionError) throw transactionError;

    // Função utilitária de formatação (local)
    const formatCurrency = (value: number): string =>
      value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // Mensagem de sucesso
    const bonusMsg =
      bonusToAdd > 0
        ? `\n🎉 Cliente ganhou ${formatCurrency(bonusToAdd)} de bônus!`
        : "";

    const upperName = customer.name.toUpperCase();
    toast.custom(() => (
      <div className="p-4 rounded-xl shadow-lg bg-white border border-gray-200 text-gray-800 space-y-2 max-w-sm">
        <h3 className="text-lg font-semibold text-green-600 flex items-center gap-2">
          🛍️ Compra registrada com sucesso!
        </h3>
        <div className="text-sm space-y-1">
          <p><strong>Cliente:</strong> {upperName}</p>
          <p><strong>Código:</strong> {customer.code}</p>
          <p><strong>Compra:</strong> {formatCurrency(purchaseAmount)}</p>
          <p><strong>Pontos ganhos:</strong> +{pointsEarned}</p>
          <p><strong>Total de pontos:</strong> {newTotalPoints}</p>
          <p><strong>Saldo de bônus:</strong> {formatCurrency(newBonusBalance)}</p>
          {bonusToAdd > 0 && (
            <p className="text-green-700 font-semibold mt-2">
              🎉 Novo bônus conquistado: {formatCurrency(bonusToAdd)}!
            </p>
          )}
        </div>
      </div>
    ), { duration: 6000 });

    setIdentifier("");
    setAmount("");
  };


  const handleCreateCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast.error("Preencha nome e telefone");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      // Gera código único
      const { data: codeData, error: codeError } = await supabase
        .rpc("generate_customer_code");

      if (codeError) throw codeError;

      // Cria novo cliente
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          business_id: session.user.id,
          name: newCustomer.name,
          cpf: tempCpf,
          phone: newCustomer.phone,
          code: codeData,
          points: 0,
          bonus_balance: 0,
        })
        .select()
        .single();

      if (customerError) throw customerError;

      setShowNewCustomerDialog(false);
      setNewCustomer({ name: "", phone: "" });

      // Processar compra inicial com lógica de bônus
      await processPurchase(customer, parseFloat(amount), session.user.id);
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao cadastrar cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Registrar Compra
          </CardTitle>
          <CardDescription>
            Digite o CPF ou código do cliente e o valor da compra
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="identifier">CPF ou Código</Label>
            <Input
              id="identifier"
              placeholder="000.000.000-00 ou 0000"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
              className="h-14 text-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Valor da Compra (R$)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loading}
              className="h-14 text-lg"
            />
          </div>
          <Button
            onClick={handleRegisterPurchase}
            disabled={loading}
            className="w-full h-16 text-lg"
          >
            {loading ? "Processando..." : "Registrar Compra"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription>
              Cliente não encontrado. Cadastre os dados abaixo:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Nome Completo</Label>
              <Input
                id="new-name"
                placeholder="João da Silva"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-phone">Telefone</Label>
              <Input
                id="new-phone"
                placeholder="(00) 00000-0000"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowNewCustomerDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCustomer}
                disabled={loading}
                className="flex-1"
              >
                Cadastrar e Continuar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RegisterPurchase;
