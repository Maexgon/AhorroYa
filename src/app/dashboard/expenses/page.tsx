'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, Plus, ArrowLeft } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Placeholder data for expenses table
const expenses = [
  { id: '1', date: '2024-05-20', entity: 'Supermercado Coto', category: 'Comestibles', subcategory: 'Supermercados', amount: 18345.50 },
  { id: '2', date: '2024-05-20', entity: 'Don Julio', category: 'Vida y Entretenimiento', subcategory: 'Restaurantes', amount: 25500.00 },
  { id: '3', date: '2024-05-19', entity: 'Cine Hoyts', category: 'Vida y Entretenimiento', subcategory: 'Cines/Teatros', amount: 9800.00 },
  { id: '4', date: '2024-05-18', entity: 'SUBE', category: 'Mobilidad', subcategory: 'SUBE', amount: 1500.00 },
  { id: '5', date: '2024-05-15', entity: 'Alquiler Depto', category: 'Vivienda', subcategory: 'Alquileres', amount: 125000.00 },
];

export default function ExpensesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
        <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="container flex h-16 items-center">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="ml-4 font-headline text-xl font-bold">Mis Gastos</h1>
            </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Historial de Gastos</CardTitle>
                    <CardDescription>Aquí puedes ver y administrar todos tus gastos registrados.</CardDescription>
                </div>
                <Button asChild>
                    <Link href="/dashboard/expenses/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Nuevo Gasto
                    </Link>
                </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Subcategoría</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{new Date(expense.date).toLocaleDateString('es-AR')}</TableCell>
                    <TableCell className="font-medium">{expense.entity}</TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>{expense.subcategory}</TableCell>
                    <TableCell className="text-right font-mono">${expense.amount.toLocaleString('es-AR')}</TableCell>
                    <TableCell>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem>Editar</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
    