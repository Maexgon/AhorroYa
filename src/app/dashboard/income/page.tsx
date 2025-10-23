
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ArrowLeft, Loader2, Calendar as CalendarIcon, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Income, Membership, User as UserType } from '@/lib/types';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    });

    const membershipQuery = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return query(collection(firestore, 'memberships'), where('uid', '==', user.uid));
    }, [firestore, user?.uid]);

    const { data: memberships, isLoading: isLoadingMemberships } = useCollection<Membership>(membershipQuery);
    const tenantId = memberships?.[0]?.tenantId;

    const incomesQuery = useMemoFirebase(() => {
        if (!firestore || !tenantId) return null;
        return query(
            collection(firestore, 'incomes'), 
            where('tenantId', '==', tenantId),
            where('deleted', '==', false)
        );
    }, [firestore, tenantId]);
    const { data: incomes, isLoading: isLoadingIncomes, setData: setIncomes } = useCollection<Income>(incomesQuery);

    const filteredIncomes = React.useMemo(() => {
        if (!incomes) return [];
        if (!date || !date.from) return incomes;

        const fromDate = new Date(date.from.setHours(0, 0, 0, 0));
        const toDate = date.to ? new Date(date.to.setHours(23, 59, 59, 999)) : fromDate;

        return incomes.filter(income => {
            const incomeDate = new Date(income.date);
            return incomeDate >= fromDate && incomeDate <= toDate;
        });
    }, [incomes, date]);

    const totalIncome = React.useMemo(() => {
        return filteredIncomes.reduce((acc, income) => acc + income.amountARS, 0);
    }, [filteredIncomes]);

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
    
    const columns = React.useMemo(() => getColumns(handleOpenDeleteDialog, formatCurrency), []);
    
    const isLoading = isAuthLoading || isLoadingMemberships || isLoadingIncomes;

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
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className="w-[300px] justify-start text-left font-normal"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date?.from ? (
                                            date.to ? (
                                                <>
                                                    {format(date.from, "LLL dd, y", { locale: es })} -{" "}
                                                    {format(date.to, "LLL dd, y", { locale: es })}
                                                </>
                                            ) : (
                                                format(date.from, "LLL dd, y", { locale: es })
                                            )
                                        ) : (
                                            <span>Selecciona un rango de fechas</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={date?.from}
                                        selected={date}
                                        onSelect={setDate}
                                        numberOfMonths={2}
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                            <div className="ml-auto flex items-baseline gap-2">
                                <span className="text-sm text-muted-foreground">Total del Período:</span>
                                <span className="text-xl font-bold text-primary">{formatCurrency(totalIncome)}</span>
                            </div>
                        </div>
                       <DataTable
                            columns={columns}
                            data={filteredIncomes || []}
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

    