'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ArrowLeft, Loader2 } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Budget, Category, Expense, User as UserType } from '@/lib/types';
import { useDoc } from '@/firebase/firestore/use-doc';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function BudgetPage() {
    const { user, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();

    // Step 1: Get User document to derive tenantId
    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

    // Derive tenantId only when userData is available
    const tenantId = userData?.tenantIds?.[0];

    // Step 2: Create queries ONLY when tenantId is available
    const budgetsQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) return null;
        return query(collection(firestore, 'budgets'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId]);
    const { data: budgets, isLoading: isLoadingBudgets } = useCollection<Budget>(budgetsQuery);

    const categoriesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) return null;
        return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId), orderBy('order'));
    }, [firestore, tenantId]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);
    
    const expensesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) return null;
        // This query needs to be filtered by tenantId to be secure
        return query(collection(firestore, 'expenses'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId]);
    const { data: expenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

    // Step 3: Memoize the derived data for the table
    const budgetData = React.useMemo(() => {
        // Ensure all required data is loaded before processing
        if (!budgets || !categories || !expenses) return [];
        
        const categoryMap = new Map(categories.map(c => [c.id, c]));
        
        return budgets.map(budget => {
            const category = categoryMap.get(budget.categoryId);
            const spent = expenses
                .filter(e => e.categoryId === budget.categoryId && new Date(e.date).getMonth() + 1 === budget.month && new Date(e.date).getFullYear() === budget.year)
                .reduce((acc, e) => acc + e.amountARS, 0);
            
            const remaining = budget.amountARS - spent;
            const percentage = budget.amountARS > 0 ? (spent / budget.amountARS) * 100 : 0;

            return {
                ...budget,
                categoryName: category?.name || 'N/A',
                categoryColor: category?.color || '#888888',
                spent,
                remaining,
                percentage,
            };
        });
    }, [budgets, categories, expenses]);
    
    // Unified loading state that respects the data dependency chain
    const isLoading = isAuthLoading || isUserDocLoading || (user && !tenantId) || isLoadingBudgets || isLoadingCategories || isLoadingExpenses;

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Cargando datos del presupuesto...</p>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col bg-secondary/50">
            <header className="sticky top-0 z-40 w-full border-b bg-background">
                <div className="container flex h-16 items-center">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard">
                            <ArrowLeft />
                        </Link>
                    </Button>
                    <h1 className="ml-4 font-headline text-xl font-bold">Presupuestos Mensuales</h1>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Mis Presupuestos</CardTitle>
                                <CardDescription>Administra tus presupuestos por categoría para cada mes.</CardDescription>
                            </div>
                            <Button asChild>
                                <Link href="/dashboard/budget/new">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Crear Presupuesto
                                </Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                    
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className='w-[200px]'>Categoría</TableHead>
                                    <TableHead>Mes/Año</TableHead>
                                    <TableHead className="text-right">Presupuestado</TableHead>
                                    <TableHead className="text-right">Gastado</TableHead>
                                    <TableHead className="text-right">Restante</TableHead>
                                    <TableHead className='w-[200px]'>Progreso</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {budgetData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No has creado ningún presupuesto todavía.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    budgetData.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <Badge style={{ backgroundColor: item.categoryColor, color: '#fff' }}>
                                                    {item.categoryName}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{item.month}/{item.year}</TableCell>
                                            <TableCell className="text-right font-mono">${item.amountARS.toLocaleString('es-AR')}</TableCell>
                                            <TableCell className="text-right font-mono">${item.spent.toLocaleString('es-AR')}</TableCell>
                                            <TableCell className={`text-right font-mono ${item.remaining < 0 ? 'text-destructive' : 'text-green-600'}`}>
                                                ${item.remaining.toLocaleString('es-AR')}
                                            </TableCell>
                                            <TableCell>
                                                <div className='flex items-center gap-2'>
                                                    <Progress value={item.percentage > 100 ? 100 : item.percentage} className="h-2" />
                                                    <span className='text-xs font-mono'>{Math.round(item.percentage)}%</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}