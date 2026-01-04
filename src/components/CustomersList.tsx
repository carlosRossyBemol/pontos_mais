import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, Search, Gift } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface Customer {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  code: string;
  points: number;
  bonus_balance: number;
}

const CustomersList = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (!search) {
      setFilteredCustomers(customers);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(searchLower) ||
        customer.cpf.includes(search) ||
        customer.code.includes(search)
    );
    setFilteredCustomers(filtered);
  }, [search, customers]);

  const loadCustomers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("business_id", session.user.id)
        .order("name");

      if (error) throw error;
      setCustomers(data || []);
      setFilteredCustomers(data || []);
    } catch (error: any) {
      console.error("Error loading customers:", error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  
  const handleRedeemBonus = async () => {
    if (!selectedCustomer || !redeemAmount) {
      toast.error("Preencha o valor a resgatar");
      return;
    }

    const amount = parseFloat(redeemAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor inválido");
      return;
    }

    const pointsToDeduct = Math.ceil(amount * 50);

    if (pointsToDeduct > selectedCustomer.points) {
      toast.error("Pontos insuficientes para este resgate");
      return;
    }

    if (amount > selectedCustomer.bonus_balance) {
      toast.error("Saldo insuficiente");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Update customer bonus balance
      const { error: updateError } = await supabase
        .from("customers")
        .update({
          bonus_balance: Number(
            (selectedCustomer.bonus_balance - amount).toFixed(2)
          ),
          points: selectedCustomer.points - pointsToDeduct,
        })
        .eq("id", selectedCustomer.id);

      if (updateError) throw updateError;

      // Register transaction
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          business_id: session.user.id,
          customer_id: selectedCustomer.id,
          type: "redemption",
          amount: amount,
          points: - pointsToDeduct,
        });

      if (transactionError) throw transactionError;

      toast.success("Bônus resgatado com sucesso!");
      setShowRedeemDialog(false);
      setRedeemAmount("");
      setSelectedCustomer(null);
      loadCustomers();
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Erro ao resgatar bônus");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando clientes...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatPhone = (phone: string) => {
  if (!phone) return "-";
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.length === 11) {
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  } else if (cleaned.length === 10) {
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  } else {
    return phone;
  }
};

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clientes Cadastrados
          </CardTitle>
          <CardDescription>
            {customers.length} {customers.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Telefone</TableHead> {/* 👈 nova coluna */}
                    <TableHead className="text-center">Código</TableHead>
                    <TableHead className="text-center">Pontos</TableHead>
                    <TableHead className="text-center">Bônus</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.cpf}</TableCell>
                      <TableCell>{formatPhone(customer.phone)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono text-base px-3">
                          {customer.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {customer.points}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-success">
                        {formatCurrency(customer.bonus_balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resgatar Bônus</DialogTitle>
            <DialogDescription>
              Cliente: {selectedCustomer?.name}
              <br />
              Saldo disponível: {selectedCustomer && formatCurrency(selectedCustomer.bonus_balance)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="redeem-amount">Valor a Resgatar (R$)</Label>
              <Input
                id="redeem-amount"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                className="h-12 text-lg"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRedeemDialog(false);
                  setRedeemAmount("");
                  setSelectedCustomer(null);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button onClick={handleRedeemBonus} className="flex-1">
                Confirmar Resgate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CustomersList;
