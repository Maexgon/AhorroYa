
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
import { getColumns, type BudgetRow } from './columns';
import { DataTable } from './data-table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addMonths } from 'date-fns';
import { Input } from '@/components/ui/input';


export default function BudgetPage() {
    const { user, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isAlertDialogOpen, setIsAlertDialogOpen] = React.useState(false);
    const [budgetToDelete, setBudgetToDelete] = React.useState<string | null>(null);
    
    // State for duplication dialog
    const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = React.useState(false);
    const [isDuplicating, setIsDuplicating] = React.useState(false);
    const [targetMonth, setTargetMonth] = React.useState(new Date().getMonth() + 1);
    const [targetYear, setTargetYear] = React.useState(new Date().getFullYear());
    const [repeatCount, setRepeatCount] = React.useState(0);

    // State for table selections
    const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
    const [detailRowSelection, setDetailRowSelection] = React.useState<Record<string, boolean>>({});
    
    // State for filters
    const [filterMonth, setFilterMonth] = React.useState<string>(String(new Date().getMonth() + 1));
    const [filterYear, setFilterYear] = React.useState<string>(String(new Date().getFullYear()));


    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user?.uid]);

    const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

    const tenantId = userData?.tenantIds?.[0];

    const budgetsQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) return null;
        return query(collection(firestore, 'budgets'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId]);
    const { data: budgets, isLoading: isLoadingBudgets, setData: setBudgets, error: budgetsError } = useCollection<Budget>(budgetsQuery);

    const categoriesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) return null;
        return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId), orderBy('order'));
    }, [firestore, tenantId]);
    const { data: categories, isLoading: isLoadingCategories, error: categoriesError } = useCollection<Category>(categoriesQuery);
    
    const expensesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) return null;
        return query(
            collection(firestore, 'expenses'), 
            where('tenantId', '==', tenantId),
            where('deleted', '==', false)
        );
    }, [firestore, tenantId]);
    const { data: expenses, isLoading: isLoadingExpenses, error: expensesError } = useCollection<Expense>(expensesQuery);

    // 🔍 --- INICIO DEL CÓDIGO DE DIAGNÓSTICO ---
    React.useEffect(() => {
        console.log('🩺 Estado del Componente BudgetPage:', {
            isAuthLoading,
            isUserDocLoading,
            isLoadingBudgets,
            isLoadingCategories,
            isLoadingExpenses,
            hasTenantId: !!tenantId,
            budgetsQuery: budgetsQuery ? 'definida' : 'null',
            categoriesQuery: categoriesQuery ? 'definida' : 'null',
            expensesQuery: expensesQuery ? 'definida' : 'null',
            budgetsError: budgetsError?.message || null,
            categoriesError: categoriesError?.message || null,
            expensesError: expensesError?.message || null,
        });
    }, [
        isAuthLoading, isUserDocLoading, isLoadingBudgets, isLoadingCategories, isLoadingExpenses, 
        tenantId, budgetsQuery, categoriesQuery, expensesQuery,
        budgetsError, categoriesError, expensesError
    ]);
    // 🔍 --- FIN DEL CÓDIGO DE DIAGNÓSTICO ---


    const budgetData = React.useMemo(() => {
        if (!budgets || !categories || !expenses) return [];
    
        const categoryMap = new Map(categories.map(c => [c.id, c]));
    
        const groupedBudgets: { [key: string]: BudgetRow } = {};
    
        budgets.forEach(budget => {
            const key = `${budget.year}-${budget.month}-${budget.categoryId}`;
            if (!groupedBudgets[key]) {
                 const category = categoryMap.get(budget.categoryId);
                groupedBudgets[key] = {
                    id: key, // Composite key for the group
                    categoryId: budget.categoryId,
                    categoryName: category?.name || 'N/A',
                    categoryColor: category?.color || '#888888',
                    year: budget.year,
                    month: budget.month,
                    amountARS: 0,
                    spent: 0,
                    remaining: 0,
                    percentage: 0,
                    details: []
                };
            }
            groupedBudgets[key].amountARS += budget.amountARS;
            groupedBudgets[key].details.push(budget);
        });
    
        Object.values(groupedBudgets).forEach(group => {
            const spent = expenses
                .filter(e => e.categoryId === group.categoryId && new Date(e.date).getMonth() + 1 === group.month && new Date(e.date).getFullYear() === group.year)
                .reduce((acc, e) => acc + e.amountARS, 0);
            
            group.spent = spent;
            group.remaining = group.amountARS - spent;
            group.percentage = group.amountARS > 0 ? (spent / group.amountARS) * 100 : 0;
        });
    
        return Object.values(groupedBudgets);
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
    
    const selectedItemsForDuplication = React.useMemo(() => {
        const selectedGroupKeys = Object.keys(rowSelection).filter(key => rowSelection[key]);
        const selectedDetailIds = Object.keys(detailRowSelection).filter(key => detailRowSelection[key]);

        let items: Budget[] = [];

        // Add items from fully selected categories
        const selectedGroups = filteredBudgetData.filter(group => selectedGroupKeys.includes(group.id));
        selectedGroups.forEach(group => {
            items.push(...group.details);
        });

        // Add individually selected items, avoiding duplicates
        const selectedGroupCategoryIds = new Set(selectedGroups.map(g => g.categoryId));
        if (budgets) {
            budgets.forEach(budget => {
                if (selectedDetailIds.includes(budget.id) && !selectedGroupCategoryIds.has(budget.categoryId)) {
                    if (!items.find(i => i.id === budget.id)) {
                        items.push(budget);
                    }
                }
            });
        }
        
        return items;
    }, [rowSelection, detailRowSelection, filteredBudgetData, budgets]);


    const handleDuplicateBudgets = async () => {
        if (!firestore || !user || !tenantId || selectedItemsForDuplication.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'No hay items de presupuesto seleccionados para duplicar.' });
            return;
        }

        setIsDuplicating(true);
        toast({ title: "Procesando...", description: "Duplicando presupuestos." });

        try {
            const batch = writeBatch(firestore);
            let totalDuplicatedCount = 0;

            for (let i = 0; i <= repeatCount; i++) {
                const currentDate = addMonths(new Date(targetYear, targetMonth - 1), i);
                const currentTargetYear = currentDate.getFullYear();
                const currentTargetMonth = currentDate.getMonth() + 1;

                const budgetsRef = collection(firestore, 'budgets');
                const q = query(budgetsRef,
                    where('tenantId', '==', tenantId),
                    where('year', '==', currentTargetYear),
                    where('month', '==', currentTargetMonth)
                );
                const existingDocsSnap = await getDocs(q);
                
                // Create a unique key for existing budgets: `categoryId_description`
                const existingBudgets = new Set(existingDocsSnap.docs.map(d => `${d.data().categoryId}_${d.data().description || ''}`));

                let duplicatedInThisMonth = 0;
                
                selectedItemsForDuplication.forEach(budget => {
                    const budgetKey = `${budget.categoryId}_${budget.description || ''}`;
                    if (!existingBudgets.has(budgetKey)) {
                        const newBudgetRef = doc(collection(firestore, 'budgets'));
                        const newBudgetData = {
                            id: newBudgetRef.id,
                            tenantId: budget.tenantId,
                            year: currentTargetYear,
                            month: currentTargetMonth,
                            categoryId: budget.categoryId,
                            subcategoryId: budget.subcategoryId || null,
                            amountARS: budget.amountARS,
                            description: budget.description || "",
                            rolloverFromPrevARS: 0,
                        };
                        batch.set(newBudgetRef, newBudgetData);
                        duplicatedInThisMonth++;
                        existingBudgets.add(budgetKey); // Prevent duplicating the same item twice in the same run
                    }
                });
                totalDuplicatedCount += duplicatedInThisMonth;
            }


            if (totalDuplicatedCount > 0) {
                await batch.commit();
            }

            toast({
                title: "Proceso completado",
                description: `${totalDuplicatedCount} items de presupuesto duplicados en ${repeatCount + 1} mes(es).`
            });

        } catch (error) {
            console.error("Error duplicating budgets:", error);
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'batch-write',
                operation: 'write',
                requestResourceData: 'Duplicating budgets'
            }));
        } finally {
            setIsDuplicating(false);
            setIsDuplicateDialogOpen(false);
            setRowSelection({});
            setDetailRowSelection({});
        }
    };
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat("es-AR", { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(amount);
    
    const columns = React.useMemo(() => getColumns(handleOpenDeleteDialog, formatCurrency), [handleOpenDeleteDialog]);

    const months = Array.from({length: 12}, (_, i) => ({ value: i + 1, name: new Date(0, i).toLocaleString('es', { month: 'long' }) }));
    const uniqueYearsInBudgets = React.useMemo(() => {
        if (!budgetData) return [new Date().getFullYear()];
        const yearsSet = new Set(budgetData.map(b => b.year));
        const currentYear = new Date().getFullYear();
        if(!yearsSet.has(currentYear)) yearsSet.add(currentYear);
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
                                        <Button variant="outline" disabled={selectedItemsForDuplication.length === 0}>
                                            <Repeat className="mr-2 h-4 w-4" />
                                            Duplicar ({selectedItemsForDuplication.length})
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Duplicar Presupuestos</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Selecciona el mes y año de inicio, y cuántas veces repetir la operación para los
                                                <span className="font-bold"> {selectedItemsForDuplication.length}</span> items seleccionados.
                                                Los items que ya existan en un mes de destino no se duplicarán.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="grid grid-cols-2 gap-4 py-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="target-month">Mes de Inicio</Label>
                                                <Select value={String(targetMonth)} onValueChange={(val) => setTargetMonth(Number(val))}>
                                                    <SelectTrigger id="target-month"><SelectValue/></SelectTrigger>
                                                    <SelectContent>
                                                        {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.name.charAt(0).toUpperCase() + m.name.slice(1)}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="target-year">Año de Inicio</Label>
                                                <Select value={String(targetYear)} onValueChange={(val) => setTargetYear(Number(val))}>
                                                    <SelectTrigger id="target-year"><SelectValue/></SelectTrigger>
                                                    <SelectContent>
                                                        {uniqueYearsInBudgets.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2 col-span-2">
                                                <Label htmlFor="repeat-count">Repetir (veces)</Label>
                                                <Input 
                                                    id="repeat-count" 
                                                    type="number" 
                                                    min="0"
                                                    value={repeatCount}
                                                    onChange={(e) => setRepeatCount(Number(e.target.value))}
                                                    placeholder="0"
                                                />
                                                <p className="text-xs text-muted-foreground">0 = solo el mes de inicio, 1 = mes de inicio + 1 mes extra.</p>
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
                            data={filteredBudgetData}
                            onDelete={handleOpenDeleteDialog}
                            rowSelection={rowSelection}
                            setRowSelection={setRowSelection}
                            detailRowSelection={detailRowSelection}
                            setDetailRowSelection={setDetailRowSelection}
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

    
