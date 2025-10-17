
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ArrowLeft, Loader2, Repeat } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Budget, Category, Expense, User as UserType } from '@/lib/types';
import { useDoc } from '@/firebase/firestore/use-doc';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { getColumns } from './columns';
import { DataTable } from './data-table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function BudgetPage() {
    const { user, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [tenantId, setTenantId] = React.useState<string | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isAlertDialogOpen, setIsAlertDialogOpen] = React.useState(false);
    const [budgetToDelete, setBudgetToDelete] = React.useState<string | null>(null);
    const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = React.useState(false);
    const [isDuplicating, setIsDuplicating] = React.useState(false);
    const [targetMonth, setTargetMonth] = React.useState(new Date().getMonth() + 1);
    const [targetYear, setTargetYear] = React.useState(new Date().getFullYear());
    const [rowSelection, setRowSelection] = React.useState({});

    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);

    const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

    React.useEffect(() => {
        if (userData?.tenantIds && userData.tenantIds.length > 0) {
            setTenantId(userData.tenantIds[0]);
        }
    }, [userData]);

    const ready = !!firestore && !!user && !isAuthLoading && !!tenantId;

    const budgetsQuery = useMemoFirebase(() => {
        if (!ready) return null;
        return query(collection(firestore, 'budgets'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId, ready]);
    const { data: budgets, isLoading: isLoadingBudgets, setData: setBudgets } = useCollection<Budget>(budgetsQuery);

    const categoriesQuery = useMemoFirebase(() => {
        if (!ready) return null;
        return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId, ready]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);
    
    const expensesQuery = useMemoFirebase(() => {
        if (!ready) return null;
        return query(
            collection(firestore, 'expenses'), 
            where('tenantId', '==', tenantId),
            where('deleted', '==', false)
        );
    }, [firestore, tenantId, ready]);
    const { data: expenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

    const budgetData = React.useMemo(() => {
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

    const handleOpenDeleteDialog = (id: string) => {
        setBudgetToDelete(id);
        setIsAlertDialogOpen(true);
    };

    const handleDeleteBudget = async () => {
        if (!budgetToDelete || !firestore) return;
        setIsDeleting(true);

        const budgetRef = doc(firestore, 'budgets', budgetToDelete);
        
        deleteDoc(budgetRef)
            .then(() => {
                toast({ title: 'Presupuesto eliminado', description: 'El presupuesto ha sido eliminado correctamente.' });
                // Optimistic update
                if(budgets && setBudgets) {
                    setBudgets(budgets.filter(b => b.id !== budgetToDelete));
                }
            })
            .catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: budgetRef.path,
                    operation: 'delete',
                }));
            })
            .finally(() => {
                setIsDeleting(false);
                setIsAlertDialogOpen(false);
                setBudgetToDelete(null);
            });
    };
    
    const handleDuplicateBudgets = async () => {
        if (!firestore || !user || !tenantId) return;

        const selectedIds = Object.keys(rowSelection);
        const budgetsToDuplicate = budgets?.filter(b => selectedIds.includes(b.id)) || [];

        if (budgetsToDuplicate.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'No hay presupuestos seleccionados para duplicar.' });
            return;
        }

        setIsDuplicating(true);
        toast({ title: "Procesando...", description: "Duplicando presupuestos." });

        try {
            const budgetsRef = collection(firestore, 'budgets');
            const q = query(budgetsRef, 
                where('tenantId', '==', tenantId),
                where('year', '==', targetYear),
                where('month', '==', targetMonth)
            );
            const existingDocsSnap = await getDocs(q);
            const existingCategoryIds = new Set(existingDocsSnap.docs.map(d => d.data().categoryId));

            const batch = writeBatch(firestore);
            let duplicatedCount = 0;
            let skippedCount = 0;
            const writes: {path: string, data: any}[] = [];

            budgetsToDuplicate.forEach(budget => {
                if (existingCategoryIds.has(budget.categoryId)) {
                    skippedCount++;
                } else {
                    const newBudgetRef = doc(collection(firestore, 'budgets'));
                    const newBudgetData = {
                        tenantId: budget.tenantId,
                        year: targetYear,
                        month: targetMonth,
                        categoryId: budget.categoryId,
                        subcategoryId: budget.subcategoryId || null,
                        amountARS: budget.amountARS,
                        rolloverFromPrevARS: 0, // Reset rollover for new month
                    };
                    batch.set(newBudgetRef, newBudgetData);
                    writes.push({path: newBudgetRef.path, data: newBudgetData});
                    duplicatedCount++;
                }
            });

            if (duplicatedCount > 0) {
                await batch.commit();
            }

            toast({
                title: "Proceso completado",
                description: `${duplicatedCount} presupuestos duplicados. ${skippedCount} omitidos por ya existir.`
            });

        } catch (error) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'batch-write',
                operation: 'write',
                requestResourceData: 'Duplicating budgets' // simplified data for error
            }));
        } finally {
            setIsDuplicating(false);
            setIsDuplicateDialogOpen(false);
            setRowSelection({});
        }
    };
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat("es-AR").format(amount);
    
    const columns = React.useMemo(() => getColumns(handleOpenDeleteDialog, formatCurrency), [handleOpenDeleteDialog]);

    const months = Array.from({length: 12}, (_, i) => ({ value: i + 1, name: new Date(0, i).toLocaleString('es', { month: 'long' }) }));
    const currentYear = new Date().getFullYear();
    const years = Array.from({length: 5}, (_, i) => currentYear + i);
    
    const isLoading = isAuthLoading || isUserDocLoading || isLoadingBudgets || isLoadingCategories || isLoadingExpenses;

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Cargando datos del presupuesto...</p>
            </div>
        )
    }

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
                    <h1 className="ml-4 font-headline text-xl font-bold">Presupuestos Mensuales</h1>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
                            <div>
                                <CardTitle>Mis Presupuestos</CardTitle>
                                <CardDescription>Administra tus presupuestos por categoría para cada mes.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <AlertDialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" disabled={Object.keys(rowSelection).length === 0}>
                                            <Repeat className="mr-2 h-4 w-4" />
                                            Duplicar ({Object.keys(rowSelection).length})
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Duplicar Presupuestos</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Selecciona el mes y año de destino para los
                                                <span className="font-bold"> {Object.keys(rowSelection).length}</span> presupuestos seleccionados. Los presupuestos para categorías que ya existan en el mes de destino no serán duplicados.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="grid grid-cols-2 gap-4 py-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="target-month">Mes</Label>
                                                <Select value={String(targetMonth)} onValueChange={(val) => setTargetMonth(Number(val))}>
                                                    <SelectTrigger id="target-month"><SelectValue/></SelectTrigger>
                                                    <SelectContent>
                                                        {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.name.charAt(0).toUpperCase() + m.name.slice(1)}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="target-year">Año</Label>
                                                <Select value={String(targetYear)} onValueChange={(val) => setTargetYear(Number(val))}>
                                                    <SelectTrigger id="target-year"><SelectValue/></SelectTrigger>
                                                    <SelectContent>
                                                        {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDuplicateBudgets} disabled={isDuplicating}>
                                                {isDuplicating ? 'Duplicando...' : 'Confirmar Duplicación'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Button asChild>
                                    <Link href="/dashboard/budget/new">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Crear Presupuesto
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                       <DataTable
                            columns={columns}
                            data={budgetData}
                            onDelete={handleOpenDeleteDialog}
                            rowSelection={rowSelection}
                            setRowSelection={setRowSelection}
                            months={months}
                            years={years.map(y => ({ value: y, label: String(y)}))}
                       />
                    </CardContent>
                </Card>
            </main>
        </div>
         <AlertDialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente el presupuesto. No podrás deshacer esta acción.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsAlertDialogOpen(false)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDeleteBudget}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeleting ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
