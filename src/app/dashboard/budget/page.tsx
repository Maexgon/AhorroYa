
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDocs, orderBy } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Budget, Category, Expense, Subcategory, User as UserType } from '@/lib/types';
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
    console.log("BudgetPage: Component rendering");
    const { user, isUserLoading: isAuthLoading } = useUser();
    console.log("BudgetPage: useUser hook state", { user: !!user, isAuthLoading });

    const firestore = useFirestore();
    const { toast } = useToast();
    const [tenantId, setTenantId] = React.useState<string | null>(null);
    console.log("BudgetPage: Current tenantId state:", tenantId);

    // 1. Fetch user's data to get the first tenantId
    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !user) {
            console.log("BudgetPage: userDocRef not created (no firestore or user)");
            return null;
        }
        console.log("BudgetPage: Creating userDocRef for user:", user.uid);
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);
     console.log("BudgetPage: useDoc<UserType> hook state", { userData: !!userData, isUserDocLoading });

    
    // Set tenantId only after we have the user document
    React.useEffect(() => {
        console.log("BudgetPage: useEffect for setting tenantId triggered. userData:", userData);
        if (userData?.tenantIds && userData.tenantIds.length > 0) {
            console.log("BudgetPage: Setting tenantId from userData:", userData.tenantIds[0]);
            setTenantId(userData.tenantIds[0]);
        } else {
            console.log("BudgetPage: Not setting tenantId, userData is not ready or has no tenantIds");
        }
    }, [userData]);

    // 2. Fetch data based on tenantId
    const budgetsQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) {
            console.log("BudgetPage: budgetsQuery not created (no firestore or tenantId)");
            return null;
        }
        console.log(`BudgetPage: CREATING budgets query for tenantId: ${tenantId}`);
        return query(collection(firestore, 'budgets'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId]);
    const { data: budgets, isLoading: isLoadingBudgets, error: budgetsError } = useCollection<Budget>(budgetsQuery);
    console.log("BudgetPage: useCollection<Budget> hook state", { hasBudgets: !!budgets, isLoadingBudgets, budgetsError });
    if(budgetsError) {
        console.error("BudgetPage: Error from useCollection<Budget>:", budgetsError);
    }

    const categoriesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) {
            console.log("BudgetPage: categoriesQuery not created (no firestore or tenantId)");
            return null;
        }
        console.log(`BudgetPage: CREATING categories query for tenantId: ${tenantId}`);
        return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId), orderBy('order'));
    }, [firestore, tenantId]);
    const { data: categories, isLoading: isLoadingCategories, error: categoriesError } = useCollection<Category>(categoriesQuery);
    console.log("BudgetPage: useCollection<Category> hook state", { hasCategories: !!categories, isLoadingCategories, categoriesError });
     if(categoriesError) {
        console.error("BudgetPage: Error from useCollection<Category>:", categoriesError);
    }
    
    const expensesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) {
            console.log("BudgetPage: expensesQuery not created (no firestore or tenantId)");
            return null;
        }
        console.log(`BudgetPage: CREATING expenses query for tenantId: ${tenantId}`);
        // This could be further optimized to only fetch expenses for the relevant budget months
        return query(collection(firestore, 'expenses'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId]);
    const { data: expenses, isLoading: isLoadingExpenses, error: expensesError } = useCollection<Expense>(expensesQuery);
    console.log("BudgetPage: useCollection<Expense> hook state", { hasExpenses: !!expenses, isLoadingExpenses, expensesError });
     if(expensesError) {
        console.error("BudgetPage: Error from useCollection<Expense>:", expensesError);
    }
    

    const budgetData = React.useMemo(() => {
        if (!budgets || !categories || !expenses) return [];
        console.log("BudgetPage: Recalculating budgetData memo");

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

    const isLoading = isAuthLoading || isUserDocLoading || isLoadingBudgets || isLoadingCategories || isLoadingExpenses;
    console.log("BudgetPage: Final isLoading check:", isLoading);

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
                    {isLoading ? (
                        <div className="text-center p-8">Cargando presupuestos...</div>
                    ) : (
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
                    )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
