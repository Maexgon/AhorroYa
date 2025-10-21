
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ArrowLeft, Loader2, Repeat, Settings, Banknote } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, deleteDoc, writeBatch, getDocs, orderBy } from 'firebase/firestore';
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
    
    const [filterMonth, setFilterMonth] = React.useState<string>(String(new Date().getMonth() + 1));
    const [filterYear, setFilterYear] = React.useState<string>(String(new Date().getFullYear()));


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

    const ready = !!firestore && !!user && !isAuthLoading && !isUserDocLoading && !!tenantId;

    const budgetsQuery = useMemoFirebase(() => {
        if (!ready) return null;
        return query(collection(firestore, 'budgets'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId, ready]);
    const { data: budgets, isLoading: isLoadingBudgets, setData: setBudgets } = useCollection<Budget>(budgetsQuery);

    const categoriesQuery = useMemoFirebase(() => {
        if (!ready) return null;
        return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId), orderBy('order'));
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
    
        // First, group all individual budgets by their category-month-year key
        const groupedBudgets: { [key: string]: { summary: any, items: Budget[] } } = {};
    
        budgets.forEach(budget => {
            const key = `${budget.year}-${budget.month}-${budget.categoryId}`;
            if (!groupedBudgets[key]) {
                 const category = categoryMap.get(budget.categoryId);
                groupedBudgets[key] = {
                    summary: {
                        id: key, // Composite key for the group
                        categoryId: budget.categoryId,
                        categoryName: category?.name || 'N/A',
                        categoryColor: category?.color || '#888888',
                        year: budget.year,
                        month: budget.month,
                        amountARS: 0,
                        spent: 0,
                    },
                    items: []
                };
            }
            groupedBudgets[key].summary.amountARS += budget.amountARS;
            groupedBudgets[key].items.push(budget);
        });
    
        // Now, calculate expenses for each group
        Object.values(groupedBudgets).forEach(group => {
            const spent = expenses
                .filter(e => e.categoryId === group.summary.categoryId && new Date(e.date).getMonth() + 1 === group.summary.month && new Date(e.date).getFullYear() === group.summary.year)
                .reduce((acc, e) => acc + e.amountARS, 0);
            
            group.summary.spent = spent;
            group.summary.remaining = group.summary.amountARS - spent;
            group.summary.percentage = group.summary.amountARS > 0 ? (spent / group.summary.amountARS) * 100 : 0;
        });
    
        // Finally, return an array of the combined structure
        return Object.values(groupedBudgets).map(g => ({
            ...g.summary,
            details: g.items
        }));
    }, [budgets, categories, expenses]);

    const filteredBudgetData = React.useMemo(() => {
        return budgetData.filter(b => {
            const monthMatch = filterMonth === 'all' || b.month === parseInt(filterMonth);
            const yearMatch = filterYear === 'all' || b.year === parseInt(filterYear);
            return monthMatch && yearMatch;
        });
    }, [budgetData, filterMonth, filterYear]);
    
    const totalFilteredBudget = React.useMemo(() => {
        return filteredBudgetData.reduce((acc, b) => acc + b.amountARS, 0);
    }, [filteredBudgetData]);

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

        const selectedRowIndices = Object.keys(rowSelection).map(Number);
        const budgetsToDuplicate = budgetData.filter((_, index) => selectedRowIndices.includes(index));

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
            
            const originalBudgetsToDuplicate = budgets?.filter(b => 
                budgetsToDuplicate.some(bd => bd.categoryId === b.categoryId && bd.month === b.month && bd.year === b.year)
            ) || [];

            originalBudgetsToDuplicate.forEach(budget => {
                if (!existingCategoryIds.has(budget.categoryId)) {
                     const newBudgetRef = doc(collection(firestore, 'budgets'));
                    const newBudgetData = {
                        tenantId: budget.tenantId,
                        year: targetYear,
                        month: targetMonth,
                        categoryId: budget.categoryId,
                        subcategoryId: budget.subcategoryId || null,
                        amountARS: budget.amountARS,
                        description: budget.description || "",
                        rolloverFromPrevARS: 0, 
                    };
                    batch.set(newBudgetRef, newBudgetData);
                    duplicatedCount++;
                    existingCategoryIds.add(budget.categoryId);
                } else {
                    skippedCount++;
                }
            });

            if (duplicatedCount > 0) {
                await batch.commit();
            }

            toast({
                title: "Proceso completado",
                description: `${duplicatedCount} presupuestos únicos duplicados. ${skippedCount} entradas omitidas por ya existir en el mes de destino.`
            });

        } catch (error) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'batch-write',
                operation: 'write',
                requestResourceData: 'Duplicating budgets'
            }));
        } finally {
            setIsDuplicating(false);
            setIsDuplicateDialogOpen(false);
            setRowSelection({});
        }
    };
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat("es-AR", { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(amount);
    
    const columns = React.useMemo(() => getColumns(handleOpenDeleteDialog, formatCurrency), []);

    const months = Array.from({length: 12}, (_, i) => ({ value: i + 1, name: new Date(0, i).toLocaleString('es', { month: 'long' }) }));
    const uniqueYearsInBudgets = React.useMemo(() => {
        if (!budgetData) return [];
        const yearsSet = new Set(budgetData.map(b => b.year));
        return Array.from(yearsSet).sort((a,b) => b - a);
    }, [budgetData]);
    
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

            <main className="flex-1 p-4 md:p-8 space-y-6">
                 <Card>
                    <CardHeader>
                        <div className="flex items-center gap-4">
                             <div className="bg-primary/10 p-3 rounded-lg">
                                <Banknote className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <CardTitle>Total Presupuestado</CardTitle>
                                <CardDescription>Suma total para el período seleccionado.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold font-headline text-primary">{formatCurrency(totalFilteredBudget)}</p>
                    </CardContent>
                </Card>
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
                                                        {uniqueYearsInBudgets.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
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
                            years={uniqueYearsInBudgets.map(y => ({ value: y, label: String(y)}))}
                            filterMonth={filterMonth}
                            setFilterMonth={setFilterMonth}
                            filterYear={filterYear}
                            setFilterYear={setFilterYear}
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
