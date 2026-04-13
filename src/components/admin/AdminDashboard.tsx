import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Users, DollarSign, Bus, Loader2 } from "lucide-react";
import { SeletorAno } from "@/components/SeletorAno";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00C49F",
];

interface UnidadeData {
  unidade: string;
  totalFuncionarios: number;
  totalVT: number;
}

export const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [data, setData] = useState<UnidadeData[]>([]);

  useEffect(() => {
    loadData();
  }, [ano]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get all admissoes with unidade
      const { data: admissoes } = await supabase
        .from("admissoes")
        .select("cpf, unidade");

      // Get vale transporte for the year
      const { data: vts } = await supabase
        .from("vale_transporte")
        .select("cpf, valor")
        .eq("ano", ano);

      // Group by unidade
      const unidadeMap = new Map<string, { funcionarios: Set<string>; totalVT: number }>();

      (admissoes || []).forEach((a) => {
        const unidade = a.unidade || "Sem unidade";
        if (!unidadeMap.has(unidade)) {
          unidadeMap.set(unidade, { funcionarios: new Set(), totalVT: 0 });
        }
        unidadeMap.get(unidade)!.funcionarios.add(a.cpf);
      });

      // Map CPF -> unidade for VT lookup
      const cpfUnidade = new Map<string, string>();
      (admissoes || []).forEach((a) => {
        cpfUnidade.set(a.cpf, a.unidade || "Sem unidade");
      });

      (vts || []).forEach((vt) => {
        const unidade = cpfUnidade.get(vt.cpf) || "Sem unidade";
        if (!unidadeMap.has(unidade)) {
          unidadeMap.set(unidade, { funcionarios: new Set(), totalVT: 0 });
        }
        unidadeMap.get(unidade)!.totalVT += Number(vt.valor) || 0;
      });

      const result: UnidadeData[] = Array.from(unidadeMap.entries())
        .map(([unidade, info]) => ({
          unidade,
          totalFuncionarios: info.funcionarios.size,
          totalVT: info.totalVT,
        }))
        .sort((a, b) => b.totalFuncionarios - a.totalFuncionarios);

      setData(result);
    } catch (err) {
      console.error("Error loading dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalFunc = data.reduce((s, d) => s + d.totalFuncionarios, 0);
  const totalVT = data.reduce((s, d) => s + d.totalVT, 0);

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <SeletorAno ano={ano} onAnoChange={setAno} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Funcionários</p>
                <p className="text-2xl font-bold text-foreground">{totalFunc}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-chart-2/10" style={{ backgroundColor: "hsl(var(--chart-2) / 0.1)" }}>
                <DollarSign className="h-6 w-6" style={{ color: "hsl(var(--chart-2))" }} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unidades</p>
                <p className="text-2xl font-bold text-foreground">{data.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg" style={{ backgroundColor: "hsl(var(--chart-3) / 0.1)" }}>
                <Bus className="h-6 w-6" style={{ color: "hsl(var(--chart-3))" }} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Vale Transporte ({ano})</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalVT)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funcionários por Unidade - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Funcionários por Unidade</CardTitle>
          </CardHeader>
          <CardContent>
            {data.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    dataKey="unidade"
                    type="category"
                    width={150}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickFormatter={(v) => v.length > 20 ? v.slice(0, 20) + "…" : v}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="totalFuncionarios" name="Funcionários" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Funcionários por Unidade - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Unidade</CardTitle>
          </CardHeader>
          <CardContent>
            {data.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.filter(d => d.totalFuncionarios > 0)}
                    dataKey="totalFuncionarios"
                    nameKey="unidade"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ unidade, percent }) =>
                      `${unidade.length > 12 ? unidade.slice(0, 12) + "…" : unidade} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={true}
                    fontSize={11}
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Vale Transporte por Unidade */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Vale Transporte por Unidade ({ano})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.filter(d => d.totalVT > 0).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum dado de vale transporte para {ano}</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.filter(d => d.totalVT > 0)} margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="unidade"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickFormatter={(v) => v.length > 15 ? v.slice(0, 15) + "…" : v}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Vale Transporte"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="totalVT" name="Vale Transporte" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo por Unidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Unidade</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Funcionários</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Vale Transporte ({ano})</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-3 px-4 text-foreground">{d.unidade}</td>
                    <td className="py-3 px-4 text-right text-foreground">{d.totalFuncionarios}</td>
                    <td className="py-3 px-4 text-right text-foreground">{formatCurrency(d.totalVT)}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-muted/30">
                  <td className="py-3 px-4 text-foreground">Total</td>
                  <td className="py-3 px-4 text-right text-foreground">{totalFunc}</td>
                  <td className="py-3 px-4 text-right text-foreground">{formatCurrency(totalVT)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
