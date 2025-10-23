
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ArrowLeft, Loader2, Settings } from 'lucide-react';
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
import { useUser, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Expense, Category, Subcategory, Membership, User as UserType } from '@/lib/types';
import { DataTable } from './data-table';
import { columns } from './columns';
import { useDoc } from '@/firebase/firestore/use-doc';
import { logAuditEvent } from '../audit/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ExpensesPage() {
    const { user, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [tenantId, setTenantId] = React.useState<string | null>(null);
    const [isOwner, setIsOwner] = React.useState(false);
    const [isReady, setIsReady] = React.useState(false);

    const [isAlertDialogOpen, setIsAlertDialogOpen] = React.useState(false);
    const [expenseToDelete, setExpenseToDelete] = React.useState<Expense | null>(null);
    const [deleteConfirmationText, setDeleteConfirmationText] = React.useState('');

    const [currentMonth, setCurrentMonth] = React.useState(new Date().getMonth() + 1);
    const [currentYear, setCurrentYear] = React.useState(new Date().getFullYear());

    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);
    
    // Fetch the user's membership to determine tenantId and role
    const membershipQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'memberships'), where('uid', '==', user.uid));
    }, [firestore, user]);
    const { data: memberships, isLoading: isLoadingMemberships } = useCollection<Membership>(membershipQuery);

    React.useEffect(() => {
        if (memberships && memberships.length > 0) {
            const currentMembership = memberships[0];
            setTenantId(currentMembership.tenantId);
            setIsOwner(currentMembership.role === 'owner');
        }
        // Set ready state when auth and membership queries are done
        if (!isAuthLoading && !isLoadingMemberships) {
            setIsReady(true);
        }
    }, [memberships, isAuthLoading, isLoadingMemberships]);

    const expensesQuery = useMemoFirebase(() => {
        if (!isReady || !firestore || !tenantId || !user) return null;
        
        const baseQuery = query(
            collection(firestore, 'expenses'), 
            where('tenantId', '==', tenantId), 
            where('deleted', '==', false)
        );

        // If the user is owner, they can see all expenses for the tenant.
        if (isOwner) {
            return baseQuery;
        }
        
        // Otherwise, they only see their own expenses.
        return query(baseQuery, where('userId', '==', user.uid));

    }, [firestore, tenantId, user, isOwner, isReady]);
    const { data: expenses, isLoading: isLoadingExpenses, setData: setExpenses } = useCollection<Expense>(expensesQuery);

    const categoriesQuery = useMemoFirebase(() => {
        if (!isReady || !tenantId) return null;
        return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId, isReady]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);

    const subcategoriesQuery = useMemoFirebase(() => {
        if (!isReady || !tenantId) return null;
        return query(collection(firestore, 'subcategories'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId, isReady]);
    const { data: subcategories, isLoading: isLoadingSubcategories } = useCollection<Subcategory>(subcategoriesQuery);
    
    // Fetch all members of the tenant to map user IDs to names, only if the user is an owner.
    const membersQuery = useMemoFirebase(() => {
        if (!isReady || !firestore || !tenantId || !isOwner) return null;
        return query(collection(firestore, 'memberships'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId, isOwner, isReady]);
    const { data: members, isLoading: isLoadingMembers } = useCollection<Membership>(membersQuery);


    const handleOpenDeleteDialog = (expenseId: string) => {
        const expense = expenses?.find(e => e.id === expenseId) || null;
        setExpenseToDelete(expense);
        setIsAlertDialogOpen(true);
    };
    
    const resetDeleteDialog = () => {
        setIsAlertDialogOpen(false);
        setExpenseToDelete(null);
        setDeleteConfirmationText('');
    }

    const handleDeleteExpense = async () => {
        if (!expenseToDelete || !firestore || !user || !tenantId) return;

        const expenseRef = doc(firestore, 'expenses', expenseToDelete.id);
        const updatedData = {
            deleted: true,
            updatedAt: new Date().toISOString()
        };

        updateDoc(expenseRef, updatedData)
            .then(() => {
                 logAuditEvent({
                    tenantId: tenantId,
                    userId: user.uid,
                    action: 'soft-delete',
                    entity: 'expense',
                    entityId: expenseToDelete.id,
                    before: expenseToDelete,
                    after: { ...expenseToDelete, ...updatedData },
                });
                toast({ title: 'Gasto eliminado', description: 'El gasto ha sido marcado como eliminado.' });
                if (expenses && setExpenses) {
                    setExpenses(expenses.filter(exp => exp.id !== expenseToDelete.id));
                }
                resetDeleteDialog();
            })
            .catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: expenseRef.path,
                    operation: 'update',
                    requestResourceData: updatedData,
                }));
                resetDeleteDialog();
            });
    };

    const tableData = React.useMemo(() => {
        if (!expenses || !categories || !subcategories) return [];

        const categoryMap = new Map(categories.map(c => [c.id, c]));
        const subcategoryMap = new Map(subcategories.map(s => [s.id, s]));
        const memberMap = new Map<string, string>();

        // Populate map with members from the memberships collection
        if (members) {
            members.forEach(m => {
                if (m.uid && m.displayName) {
                    memberMap.set(m.uid, m.displayName);
                }
            });
        }
        
        // Ensure the current user (who might not be owner) is in the map.
        if (user && memberships) {
            memberships.forEach(m => {
                 if (m.uid && m.displayName && !memberMap.has(m.uid)) {
                    memberMap.set(m.uid, m.displayName);
                }
            })
        }

        return expenses
            .filter(expense => {
                const expenseDate = new Date(expense.date);
                return expenseDate.getMonth() + 1 === currentMonth && expenseDate.getFullYear() === currentYear;
            })
            .map(expense => ({
                ...expense,
                category: categoryMap.get(expense.categoryId),
                subcategory: expense.subcategoryId ? subcategoryMap.get(expense.subcategoryId) : undefined,
                userName: memberMap.get(expense.userId) || 'Usuario desconocido',
            }));
    }, [expenses, categories, subcategories, members, user, memberships, currentMonth, currentYear]);

    const months = Array.from({length: 12}, (_, i) => ({ value: i + 1, name: new Date(0, i).toLocaleString('es', { month: 'long' }) }));
    const uniqueYears = React.useMemo(() => {
        if (!expenses) return [new Date().getFullYear()];
        const yearsSet = new Set(expenses.map(e => new Date(e.date).getFullYear()));
        return Array.from(yearsSet).sort((a,b) => b - a);
    }, [expenses]);

    const isLoading = !isReady || isLoadingExpenses || isLoadingCategories || isLoadingSubcategories || (isOwner && isLoadingMembers);

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
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center py-4 gap-4">
                                    <Select value={String(currentMonth)} onValueChange={(val) => setCurrentMonth(Number(val))}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {months.map(m => (
                                                <SelectItem key={m.value} value={String(m.value)}>{m.name.charAt(0).toUpperCase() + m.name.slice(1)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                     <Select value={String(currentYear)} onValueChange={(val) => setCurrentYear(Number(val))}>
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {uniqueYears.map(y => (
                                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <DataTable 
                                    columns={columns(isOwner)} 
                                    data={tableData}
                                    categories={categories || []}
                                    onDelete={handleOpenDeleteDialog}
                                />
                            </>
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

    

    