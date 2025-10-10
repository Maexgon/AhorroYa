'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ArrowLeft } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Expense, Category, Subcategory } from '@/lib/types';
import { DataTable } from './data-table';
import { columns } from './columns';
import { deleteExpenseAction } from './actions';

export default function ExpensesPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isAlertDialogOpen, setIsAlertDialogOpen] = React.useState(false);
    const [expenseToDelete, setExpenseToDelete] = React.useState<string | null>(null);

    // Fetch Tenant
    const tenantsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'tenants'), where('ownerUid', '==', user.uid), where('status', '==', 'active'));
    }, [firestore, user]);
    const { data: tenants } = useCollection(tenantsQuery);
    const activeTenant = tenants?.[0];

    // Fetch Expenses for the active tenant
    const expensesQuery = useMemoFirebase(() => {
        if (!firestore || !activeTenant) return null;
        return query(collection(firestore, 'expenses'), where('tenantId', '==', activeTenant.id), where('deleted', '==', false));
    }, [firestore, activeTenant]);
    const { data: expenses, isLoading: isLoadingExpenses, setData: setExpenses } = useCollection<Expense>(expensesQuery);

    // Fetch Categories for the tenant
    const categoriesQuery = useMemoFirebase(() => {
        if (!firestore || !activeTenant) return null;
        return query(collection(firestore, 'categories'), where('tenantId', '==', activeTenant.id));
    }, [firestore, activeTenant]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);

    // Fetch Subcategories for the tenant
    const subcategoriesQuery = useMemoFirebase(() => {
        if (!firestore || !activeTenant) return null;
        return query(collection(firestore, 'subcategories'), where('tenantId', '==', activeTenant.id));
    }, [firestore, activeTenant]);
    const { data: subcategories, isLoading: isLoadingSubcategories } = useCollection<Subcategory>(subcategoriesQuery);

    const handleOpenDeleteDialog = (expenseId: string) => {
        setExpenseToDelete(expenseId);
        setIsAlertDialogOpen(true);
    };

    const handleDeleteExpense = async () => {
        if (!expenseToDelete) return;

        const result = await deleteExpenseAction(expenseToDelete);

        if (result.success) {
            toast({ title: 'Gasto eliminado', description: 'El gasto ha sido marcado como eliminado.' });
            // Optimistically update the UI
            if (expenses && setExpenses) {
                setExpenses(expenses.filter(exp => exp.id !== expenseToDelete));
            }
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }

        setIsAlertDialogOpen(false);
        setExpenseToDelete(null);
    };


    // Combine data for the table
    const tableData = React.useMemo(() => {
        if (!expenses || !categories || !subcategories) return [];

        const categoryMap = new Map(categories.map(c => [c.id, c]));
        const subcategoryMap = new Map(subcategories.map(s => [s.id, s]));

        return expenses.map(expense => ({
            ...expense,
            category: categoryMap.get(expense.categoryId),
            subcategory: expense.subcategoryId ? subcategoryMap.get(expense.subcategoryId) : undefined,
        }));
    }, [expenses, categories, subcategories]);

    const isLoading = isLoadingExpenses || isLoadingCategories || isLoadingSubcategories;

    return (
        <>
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
                        {isLoading ? (
                            <div className="text-center p-8">Cargando gastos...</div>
                        ) : (
                            <DataTable 
                                    columns={columns} 
                                    data={tableData}
                                    categories={categories || []}
                                    onDelete={handleOpenDeleteDialog}
                                />
                        )}
                        </CardContent>
                    </Card>
                </main>
            </div>
            <AlertDialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción marcará el gasto como eliminado. No se podrá recuperar
                        directamente desde la aplicación.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setExpenseToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteExpense}>Continuar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
