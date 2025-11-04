import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { History, Search, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  points: number;
  created_at: string;
  customer: {
    name: string;
    cpf: string;
    code: string;
  };
}

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "purchase" | "redemption">("all");
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState<string>("");

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    let filtered = transactions;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (transaction) =>
          transaction.customer.name.toLowerCase().includes(searchLower) ||
          transaction.customer.cpf.includes(search) ||
          transaction.customer.code.includes(search)
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((transaction) => transaction.type === typeFilter);
    }

    setFilteredTransactions(filtered);
  }, [search, typeFilter, transactions]);

  const loadBusinessName = async (businessId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("business_name")
      .eq("id", businessId)
      .single();

    if (error) {
      console.error("Erro ao carregar nome da empresa:", error);
      setBusinessName("Nome da Empresa");
      return;
    }
    setBusinessName(data.business_name);
  };

  const loadTransactions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await loadBusinessName(session.user.id);

      const { data, error } = await supabase
        .from("transactions")
        .select(`
          id,
          type,
          amount,
          points,
          created_at,
          customer:customers (
            name,
            cpf,
            code
          )
        `)
        .eq("business_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTransactions(data as Transaction[] || []);
      setFilteredTransactions(data as Transaction[] || []);
    } catch (error: any) {
      console.error("Error loading transactions:", error);
      toast.error("Erro ao carregar histórico");
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

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const generateDailyWithdrawalsPDF = () => {
    const hojeDate = new Date();
    hojeDate.setHours(0, 0, 0, 0);
    const hojeStr = hojeDate.toLocaleDateString("pt-BR");

    const todayWithdrawals = transactions.filter(
      (t) => t.type === "redemption" && new Date(t.created_at) >= hojeDate
    );

    if (todayWithdrawals.length === 0) {
      toast.error("Nenhuma retirada encontrada hoje");
      return;
    }

    const totalWithdrawn = todayWithdrawals.reduce((sum, t) => sum + t.amount, 0);

    const doc = new jsPDF();

    // Cabeçalho
    doc.setFontSize(18);
    doc.text(businessName || "Nome da Empresa", 105, 15, { align: "center" });
    doc.setFontSize(14);
    doc.text("Relatório de Saídas do Dia", 105, 25, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Data: ${hojeStr}`, 105, 32, { align: "center" });

    // Dados da tabela
    const tableData = todayWithdrawals.map(t => [
      new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      t.customer.name,
      t.customer.code,
      formatCurrency(t.amount)
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["Hora", "Cliente", "Código", "Valor"]],
      body: tableData,
      foot: [["", "", "TOTAL:", formatCurrency(totalWithdrawn)]],
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" }
    });

    doc.save(`saidas-${hojeStr.replace(/\//g, "-")}.pdf`);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando histórico...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Transações
        </CardTitle>
        <CardDescription>
          {transactions.length} {transactions.length === 1 ? "transação registrada" : "transações registradas"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={typeFilter === "all" ? "default" : "outline"}
              onClick={() => setTypeFilter("all")}
            >
              Todas
            </Button>
            <Button
              variant={typeFilter === "purchase" ? "default" : "outline"}
              onClick={() => setTypeFilter("purchase")}
            >
              Compras
            </Button>
            <Button
              variant={typeFilter === "redemption" ? "default" : "outline"}
              onClick={() => setTypeFilter("redemption")}
            >
              Retiradas
            </Button>
            <Button
              variant="outline"
              onClick={generateDailyWithdrawalsPDF}
            >
              <FileText className="h-4 w-4 mr-2" />
              PDF Saídas do Dia
            </Button>
          </div>
        </div>
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {search ? "Nenhuma transação encontrada" : "Nenhuma transação registrada ainda"}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Pontos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="text-sm">
                      {formatDate(transaction.created_at)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{transaction.customer.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Código: {transaction.customer.code}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {transaction.type === "purchase" ? (
                        <Badge className="bg-success">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Compra
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          Retirada
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {transaction.points !== 0 && (
                        <span
                          className={
                            transaction.type === "purchase"
                              ? "text-success font-semibold"
                              : "text-destructive font-semibold"
                          }
                        >
                          {transaction.type === "purchase" ? "+" : "-"}
                          {Math.abs(transaction.points)}
                        </span>
                      )}
                    </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionHistory;