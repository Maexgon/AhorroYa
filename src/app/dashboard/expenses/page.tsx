
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Expense, Category, Subcategory, Membership, User as UserType } from '@/lib/types';
import { DataTable } from './data-table';
import { columns } from './columns';
import { useDoc } from '@/firebase/firestore/use-doc';

export default function ExpensesPage() {
    const { user, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [tenantId, setTenantId] = React.useState<string | null>(null);

    const [isAlertDialogOpen, setIsAlertDialogOpen] = React.useState(false);
    const [expenseToDelete, setExpenseToDelete] = React.useState<string | null>(null);
    const [deleteConfirmationText, setDeleteConfirmationText] = React.useState('');

    // 1. Fetch user's data to get the first tenantId
    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);
    
    // Set tenantId only after we have the user document
    React.useEffect(() => {
        if (userData?.tenantIds && userData.tenantIds.length > 0) {
            setTenantId(userData.tenantIds[0]);
        }
    }, [userData]);
    
    // 2. Fetch Expenses, which depends on tenantId and the user
    const expensesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId || !user) return null;
        
        return query(
            collection(firestore, 'expenses'), 
            where('tenantId', '==', tenantId), 
            where('deleted', '==', false),
            where('userId', '==', user.uid)
        );

    }, [firestore, tenantId, user]);
    const { data: expenses, isLoading: isLoadingExpenses, setData: setExpenses } = useCollection<Expense>(expensesQuery);

    // Fetch Categories, depends on tenantId
    const categoriesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) return null;
        return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);

    // Fetch Subcategories, depends on tenantId
    const subcategoriesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) return null;
        return query(collection(firestore, 'subcategories'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId]);
    const { data: subcategories, isLoading: isLoadingSubcategories } = useCollection<Subcategory>(subcategoriesQuery);

    const handleOpenDeleteDialog = (expenseId: string) => {
        setExpenseToDelete(expenseId);
        setIsAlertDialogOpen(true);
    };
    
    const resetDeleteDialog = () => {
        setIsAlertDialogOpen(false);
        setExpenseToDelete(null);
        setDeleteConfirmationText('');
    }

    const handleDeleteExpense = async () => {
        if (!expenseToDelete || !firestore) return;

        try {
            const expenseRef = doc(firestore, 'expenses', expenseToDelete);
            await updateDoc(expenseRef, {
                deleted: true,
                updatedAt: new Date().toISOString()
            });

            toast({ title: 'Gasto eliminado', description: 'El gasto ha sido marcado como eliminado.' });
            if (expenses && setExpenses) {
                setExpenses(expenses.filter(exp => exp.id !== expenseToDelete));
            }
        } catch (error) {
            console.error("Error deleting expense:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el gasto. Verifica tus permisos.' });
        }

        resetDeleteDialog();
    };


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

    const isLoading = isAuthLoading || isUserDocLoading || isLoadingExpenses || isLoadingCategories || isLoadingSubcategories;

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
                        {isLoading || !tableData || !categories ? (
                            <div className="text-center p-8">Cargando gastos...</div>
                        ) : (
                            <DataTable 
                                    columns={columns} 
                                    data={tableData}
                                    categories={categories}
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
                            Esta acción marcará el gasto como eliminado de forma permanente. Para confirmar, escribe <strong className="text-foreground">BORRAR</strong> en el campo de abajo.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
                        <Label htmlFor="delete-confirm" className="sr-only">Confirmación</Label>
                        <Input 
                            id="delete-confirm"
                            value={deleteConfirmationText}
                            onChange={(e) => setDeleteConfirmationText(e.target.value)}
                            placeholder='Escribe "BORRAR"'
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={resetDeleteDialog}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDeleteExpense}
                            disabled={deleteConfirmationText !== 'BORRAR'}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Continuar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
