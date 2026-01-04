import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Wallet, Printer } from "lucide-react";
import { ThermalReceipt } from "./ThermalReceipt";
import { format } from "date-fns";

const WithdrawBonus = () => {
  const [identifier, setIdentifier] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const handleWithdraw = async () => {
    if (!identifier || !amount) {
      toast.error("Preencha CPF/código e valor da retirada");
      return;
    }

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      toast.error("Valor inválido");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      // Buscar nome da empresa
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("business_name")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profile) {
        toast.error("Erro ao buscar dados da empresa");
        setLoading(false);
        return;
      }

      // Buscar cliente
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("business_id", session.user.id)
        .or(`cpf.eq.${identifier},code.eq.${identifier}`)
        .single();

      if (customerError || !customer) {
        toast.error("Cliente não encontrado");
        setLoading(false);
        return;
      }

      // Calcular pontos equivalentes (R$10 = 500 pontos → R$1 = 50 pontos)
      const pointsToDeduct = Math.ceil(withdrawAmount * 50);

      // Verificar saldo
      if (customer.bonus_balance < withdrawAmount || customer.points < pointsToDeduct) {
        toast.custom(() => (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 shadow-md text-red-700 space-y-2 max-w-sm">
            <h3 className="text-base font-semibold flex items-center gap-2">
              ⚠️ Saldo insuficiente
            </h3>
            <p>O cliente não possui bônus suficiente para este resgate.</p>
            <div className="text-sm mt-2 space-y-1">
              <p><strong>Bônus disponível:</strong> R$ {customer.bonus_balance.toFixed(2)}</p>
              <p><strong>Pontos:</strong> {customer.points}</p>
            </div>
          </div>
        ), { duration: 5000 });
        setLoading(false);
        return;
      }

      const newBonusBalance = Number(
        (customer.bonus_balance - withdrawAmount).toFixed(2)
      );
      const newPointsBalance = customer.points - pointsToDeduct;

      // Atualizar saldos do cliente
      const { error: updateError } = await supabase
        .from("customers")
        .update({
          bonus_balance: newBonusBalance,
          points: newPointsBalance,
        })
        .eq("id", customer.id);

      if (updateError) throw updateError;

      // Registrar transação
      const { error: transactionError } = await supabase.from("transactions").insert({
        business_id: session.user.id,
        customer_id: customer.id,
        type: "redemption",
        amount: withdrawAmount,
        points: -pointsToDeduct,
      });

      if (transactionError) throw transactionError;

      const receipt = {
        companyName: profile.business_name?.toUpperCase(),
        clientName: customer.name,
        cpfOrCode: customer.code,
        valorRetirado: withdrawAmount,
        saldoRestante: newBonusBalance,
        dataHora: format(new Date(), "dd/MM/yyyy HH:mm"),
      };

      setReceiptData(receipt);
      toast.success("Retirada registrada com sucesso!");

      // Imprimir automaticamente
      setTimeout(() => {
        window.print();
      }, 500);

      setIdentifier("");
      setAmount("");
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao processar retirada");
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = () => {
    if (!receiptData) {
      toast.error("Nenhum comprovante disponível para reimprimir");
      return;
    }
    window.print();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Retirada de Bônus
          </CardTitle>
          <CardDescription>
            Digite o CPF ou código do cliente e o valor a ser retirado
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
            <Label htmlFor="amount">Valor da Retirada (R$)</Label>
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

          <Button onClick={handleWithdraw} disabled={loading} className="w-full h-16 text-lg">
            {loading ? "Processando..." : "Retirar Bônus"}
          </Button>

          {receiptData && (
            <Button
              onClick={handleReprint}
              variant="outline"
              className="w-full h-14 text-lg flex items-center justify-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Reimprimir Comprovante
            </Button>
          )}
        </CardContent>
      </Card>

      {receiptData && (
        <div className="hidden print:block">
          <ThermalReceipt {...receiptData} />
        </div>
      )}
    </>
  );
};

export default WithdrawBonus;
