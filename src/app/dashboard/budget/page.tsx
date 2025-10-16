
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ArrowLeft, Loader2, Pencil, Trash2, TableIcon } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, orderBy, deleteDoc } from 'firebase/firestore';
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
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

export default function BudgetPage() {
    const { user, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [tenantId, setTenantId] = React.useState<string | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isAlertDialogOpen, setIsAlertDialogOpen] = React.useState(false);
    const [budgetToDelete, setBudgetToDelete] = React.useState<string | null>(null);

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
        return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId), orderBy('order'));
    }, [firestore, tenantId, ready]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);
    
    const expensesQuery = useMemoFirebase(() => {
        if (!ready) return null;
        return query(
            collection(firestore, 'expenses'), 
            where('tenantId', '==', tenantId),
            where('userId', '==', user!.uid)
        );
    }, [firestore, tenantId, ready, user]);
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
    
    if (!ready || isLoadingBudgets || isLoadingCategories || isLoadingExpenses) {
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
                                    <TableHead className="w-[100px] text-center">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {budgetData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
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
                                            <TableCell>
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`/dashboard/budget/edit/${item.id}`}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleOpenDeleteDialog(item.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
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

