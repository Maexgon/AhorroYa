
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ArrowLeft, Loader2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Income, Membership } from '@/lib/types';
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
import { getColumns } from './columns';
import { DataTable } from './data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const incomeCategories = [
  { value: "salarios", label: "Salarios" },
  { value: "inversiones", label: "Inversiones" },
  { value: "premios o comisiones", label: "Premios o Comisiones" },
  { value: "otros", label: "Otros" },
];

export default function IncomePage() {
    const { user, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isAlertDialogOpen, setIsAlertDialogOpen] = React.useState(false);
    const [incomeToDelete, setIncomeToDelete] = React.useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = React.useState(new Date().getMonth() + 1);
    const [currentYear, setCurrentYear] = React.useState(new Date().getFullYear());
    const [isOwnerOrAdmin, setIsOwnerOrAdmin] = React.useState(false);

    const membershipQuery = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return query(collection(firestore, 'memberships'), where('uid', '==', user.uid));
    }, [firestore, user?.uid]);

    const { data: memberships, isLoading: isLoadingMemberships } = useCollection<Membership>(membershipQuery);
    const tenantId = memberships?.[0]?.tenantId;

    React.useEffect(() => {
        if (memberships && memberships.length > 0) {
            const currentMembership = memberships[0];
            setIsOwnerOrAdmin(currentMembership.role === 'owner' || currentMembership.role === 'admin');
        }
    }, [memberships]);

    const incomesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId || !user) return null;

        const baseQuery = query(
            collection(firestore, 'incomes'), 
            where('tenantId', '==', tenantId),
            where('deleted', '==', false)
        );

        if (isOwnerOrAdmin) {
            return baseQuery;
        }
        
        return query(baseQuery, where('userId', '==', user.uid));

    }, [firestore, tenantId, user, isOwnerOrAdmin]);

    const { data: incomes, isLoading: isLoadingIncomes, setData: setIncomes } = useCollection<Income>(incomesQuery);
    
    const membersQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId || !isOwnerOrAdmin) return null;
        return query(collection(firestore, 'memberships'), where('tenantId', '==', tenantId));
    }, [firestore, tenantId, isOwnerOrAdmin]);
    const { data: members, isLoading: isLoadingMembers } = useCollection<Membership>(membersQuery);

    const tableData = React.useMemo(() => {
        if (!incomes) return [];
        
        const memberMap = new Map<string, string>();
        if (members) {
            members.forEach(m => {
                if (m.uid && m.displayName) {
                    memberMap.set(m.uid, m.displayName);
                }
            });
        }
        if (user && memberships) {
             memberships.forEach(m => {
                 if (m.uid && m.displayName && !memberMap.has(m.uid)) {
                    memberMap.set(m.uid, m.displayName);
                }
            })
        }

        return incomes
            .filter(income => {
                const incomeDate = new Date(income.date);
                return incomeDate.getMonth() + 1 === currentMonth && incomeDate.getFullYear() === currentYear;
            })
            .map(income => ({
                ...income,
                userName: memberMap.get(income.userId) || 'Usuario desconocido',
            }));

    }, [incomes, members, user, memberships, currentMonth, currentYear]);


    const totalIncome = React.useMemo(() => {
        return tableData.reduce((acc, income) => acc + income.amountARS, 0);
    }, [tableData]);

    const handleOpenDeleteDialog = (id: string) => {
        setIncomeToDelete(id);
        setIsAlertDialogOpen(true);
    };

    const handleDeleteIncome = async () => {
        if (!incomeToDelete || !firestore) return;
        setIsDeleting(true);

        const incomeRef = doc(firestore, 'incomes', incomeToDelete);
        const updateData = { deleted: true, updatedAt: new Date().toISOString() };

        updateDoc(incomeRef, updateData)
            .then(() => {
                toast({ title: 'Ingreso eliminado', description: 'El ingreso ha sido marcado como eliminado.' });
                if(incomes && setIncomes) {
                    setIncomes(incomes.filter(i => i.id !== incomeToDelete));
                }
            })
            .catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: incomeRef.path,
                    operation: 'update',
                    requestResourceData: updateData,
                }));
            })
            .finally(() => {
                setIsDeleting(false);
                setIsAlertDialogOpen(false);
                setIncomeToDelete(null);
            });
    };
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat("es-AR", { style: 'currency', currency: 'ARS' }).format(amount);
    
    const columns = React.useMemo(() => getColumns(handleOpenDeleteDialog, formatCurrency, isOwnerOrAdmin, user?.uid || ''), [isOwnerOrAdmin, user?.uid]);
    
    const months = Array.from({length: 12}, (_, i) => ({ value: i + 1, name: new Date(0, i).toLocaleString('es', { month: 'long' }) }));
    const uniqueYears = React.useMemo(() => {
        if (!incomes) return [new Date().getFullYear()];
        const yearsSet = new Set(incomes.map(e => new Date(e.date).getFullYear()));
        return Array.from(yearsSet).sort((a,b) => b - a);
    }, [incomes]);

    const isLoading = isAuthLoading || isLoadingMemberships || isLoadingIncomes || (isOwnerOrAdmin && isLoadingMembers);

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Cargando datos de ingresos...</p>
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
                    <h1 className="ml-4 font-headline text-xl font-bold">Ingresos</h1>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
                            <div>
                                <CardTitle>Mis Ingresos</CardTitle>
                                <CardDescription>Administra todos tus ingresos registrados.</CardDescription>
                            </div>
                            <Button asChild>
                                <Link href="/dashboard/income/new">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Registrar Ingreso
                                </Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 py-4">
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
                            <div className="ml-auto flex items-baseline gap-2">
                                <span className="text-sm text-muted-foreground">Total del Período:</span>
                                <span className="text-xl font-bold text-primary">{formatCurrency(totalIncome)}</span>
                            </div>
                        </div>
                       <DataTable
                            columns={columns}
                            data={tableData || []}
                            onDelete={handleOpenDeleteDialog}
                            categories={incomeCategories}
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
                            Esta acción eliminará permanentemente el ingreso. No podrás deshacer esta acción.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsAlertDialogOpen(false)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDeleteIncome}
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
