"use client";

import { Bar, BarChart, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AhorroYaLogo } from "@/components/shared/icons";
import { MoreHorizontal, Sparkles, Plus, ChevronDown, ShoppingCart, Bus, Film, Home, Utensils } from "lucide-react";

const barData = [
  { name: "Comida", total: 48900 },
  { name: "Transporte", total: 18750 },
  { name: "Vivienda", total: 125000 },
  { name: "Ocio", total: 32500 },
  { name: "Compras", total: 21000 },
];

const pieData = [
  { name: 'Vivienda', value: 125000 },
  { name: 'Comida', value: 48900 },
  { name: 'Ocio', value: 32500 },
  { name: 'Transporte', value: 18750 },
  { name: 'Compras', value: 21000 },
];

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const recentExpenses = [
  { icon: Utensils, entity: "Don Julio", category: "Restaurantes", amount: 25500 },
  { icon: ShoppingCart, entity: "Supermercado Coto", category: "Supermercado", amount: 18345 },
  { icon: Bus, entity: "SUBE", category: "Transporte", amount: 1500 },
  { icon: Film, entity: "Cine Hoyts", category: "Ocio", amount: 9800 },
  { icon: Home, entity: "Alquiler Depto", category: "Vivienda", amount: 125000 },
];

const budgets = [
    { name: "Comida", spent: 48900, total: 60000, color: "bg-green-500" },
    { name: "Transporte", spent: 18750, total: 20000, color: "bg-blue-500" },
    { name: "Ocio", spent: 32500, total: 30000, color: "bg-red-500" },
    { name: "Vivienda", spent: 125000, total: 125000, color: "bg-yellow-500" },
];

export default function DashboardPreview() {
  return (
    <div className="relative rounded-xl border bg-card text-card-foreground shadow-2xl transition-transform-gpu will-change-transform animate-in fade-in zoom-in-95">
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <AhorroYaLogo className="h-6 w-6 text-primary" />
          <h2 className="font-headline text-lg font-semibold">Dashboard</h2>
        </div>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                    Personal
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem>Personal</DropdownMenuItem>
                <DropdownMenuItem>Familia</DropdownMenuItem>
                <DropdownMenuItem>Empresa</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-9 w-9 cursor-pointer">
                <AvatarImage src="https://picsum.photos/seed/user/40/40" alt="User" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Perfil</DropdownMenuItem>
              <DropdownMenuItem>Ajustes</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Cerrar Sesión</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="p-4 md:p-6 grid gap-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Análisis de Gastos</CardTitle>
              <CardDescription>Resumen por categoría del último mes.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Presupuestos</CardTitle>
              <CardDescription>Tu progreso de gastos del mes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {budgets.map(budget => {
                const percentage = (budget.spent / budget.total) * 100;
                return (
                    <div key={budget.name}>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{budget.name}</span>
                            <span className="text-muted-foreground">
                                ${budget.spent.toLocaleString()} / ${budget.total.toLocaleString()}
                            </span>
                        </div>
                        <Progress value={percentage} className="h-2" indicatorclassname={percentage > 100 ? "bg-destructive" : "bg-primary"} />
                    </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-headline">Gastos Recientes</CardTitle>
                <CardDescription>Tus últimas transacciones registradas.</CardDescription>
              </div>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Agregar Gasto</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entidad</TableHead>
                    <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentExpenses.map((expense, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="bg-muted p-2 rounded-md hidden sm:block">
                            <expense.icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <span className="font-medium">{expense.entity}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{expense.category}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${expense.amount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                Recomendaciones IA
              </CardTitle>
              <CardDescription>Sugerencias para optimizar tus finanzas.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center p-4 border-2 border-dashed rounded-lg">
                    <p className="text-sm text-muted-foreground">
                        Notamos que tus gastos en <span className="text-foreground font-medium">"Ocio"</span> superaron el presupuesto.
                    </p>
                    <p className="mt-2 font-medium text-foreground">
                        Considera reasignar <span className="text-primary">$2,500</span> de esta categoría a <span className="text-primary">"Ahorros"</span> el próximo mes.
                    </p>
                </div>
            </CardContent>
            <CardFooter>
                <Button variant="outline" className="w-full">Ver más insights</Button>
            </CardFooter>
          </Card>

        </div>
      </div>
    </div>
  );
}
