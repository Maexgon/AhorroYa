
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ArrowLeft, Loader2 } from 'lucide-react';
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
import { collection, query, where, doc, updateDoc, getDocs } from 'firebase/firestore';
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
    const [isOwner, setIsOwner] = React.useState(false);

    const [isAlertDialogOpen, setIsAlertDialogOpen] = React.useState(false);
    const [expenseToDelete, setExpenseToDelete] = React.useState<string | null>(null);
    const [deleteConfirmationText, setDeleteConfirmationText] = React.useState('');

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
    
    const membershipDocRef = useMemoFirebase(() => {
        if (!tenantId || !user) return null;
        // The membership document ID is composite: {tenantId}_{userId}
        return doc(firestore, 'memberships', `${tenantId}_${user.uid}`);
    }, [tenantId, user]);
    const { data: membershipData, isLoading: isLoadingMembership } = useDoc<Membership>(membershipDocRef);


    React.useEffect(() => {
        if (membershipData) {
            setIsOwner(membershipData.role === 'owner');
        }
    }, [membershipData]);

    const expensesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId || !user) return null;
        
        const baseQuery = query(
            collection(firestore, 'expenses'), 
            where('tenantId', '==', tenantId), 
            where('deleted', '==', false)
        );

        // If user is not the owner, filter by their own user ID
        if (!isOwner && !isLoadingMembership) { // ensure we know the role before querying
            return query(baseQuery, where('userId', '==', user.uid));
        }

        return baseQuery;

    }, [firestore, tenantId, user, isOwner, isLoadingMembership]);
    const { data: expenses, isLoading: isLoadingExpenses, setData: setExpenses } = useCollection<Expense>(expensesQuery);

    const categoriesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) return null;
        return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);

    const subcategoriesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) return null;
        return query(collection(firestore, 'subcategories'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId]);
    const { data: subcategories, isLoading: isLoadingSubcategories } = useCollection<Subcategory>(subcategoriesQuery);
    
    // Fetch all members of the tenant to map user IDs to names
    const membersQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId || !isOwner) return null; // Only fetch all members if owner
        return query(collection(firestore, 'memberships'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId, isOwner]);
    const { data: members, isLoading: isLoadingMembers } = useCollection<Membership>(membersQuery);


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

        const expenseRef = doc(firestore, 'expenses', expenseToDelete);
        const updatedData = {
            deleted: true,
            updatedAt: new Date().toISOString()
        };

        updateDoc(expenseRef, updatedData)
            .then(() => {
                toast({ title: 'Gasto eliminado', description: 'El gasto ha sido marcado como eliminado.' });
                if (expenses && setExpenses) {
                    setExpenses(expenses.filter(exp => exp.id !== expenseToDelete));
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
        
        // Use the 'members' (from memberships collection) to build the name map
        const memberMap = new Map(members?.map(m => [m.uid, m.displayName]) || []);
        // Fallback for non-owners who only have their own data
        if (!isOwner && user && userData) {
             if(!memberMap.has(user.uid)) {
                memberMap.set(user.uid, userData.displayName);
             }
        }

        return expenses.map(expense => ({
            ...expense,
            category: categoryMap.get(expense.categoryId),
            subcategory: expense.subcategoryId ? subcategoryMap.get(expense.subcategoryId) : undefined,
            userName: memberMap.get(expense.userId) || 'Usuario desconocido',
        }));
    }, [expenses, categories, subcategories, members, isOwner, user, userData]);

    const isLoading = isAuthLoading || isUserDocLoading || isLoadingMembership || isLoadingExpenses || isLoadingCategories || isLoadingSubcategories || (isOwner && isLoadingMembers);

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
                            <DataTable 
                                    columns={columns(isOwner)} 
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
