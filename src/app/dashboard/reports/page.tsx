

'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Loader2, Calendar as CalendarIcon, Filter, Columns, Play, Save, GripVertical } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { Category, Entity, User as UserType, Tenant } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { MultiSelect, type MultiSelectOption } from '@/components/shared/multi-select';
import { Separator } from '@/components/ui/separator';

const paymentMethodOptions: MultiSelectOption[] = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'debit', label: 'Tarjeta de Débito' },
    { value: 'credit', label: 'Tarjeta de Crédito' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'other', label: 'Otro' },
];

const staticIncomeCategories: MultiSelectOption[] = [
    { value: "salarios", label: "Salarios" },
    { value: "inversiones", label: "Inversiones" },
    { value: "premios o comisiones", label: "Premios o Comisiones" },
    { value: "otros", label: "Otros" },
];


export default function ReportsPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [tenantId, setTenantId] = React.useState<string | null>(null);
    const [date, setDate] = React.useState<DateRange | undefined>(undefined);
    
    const [selectedPaymentMethods, setSelectedPaymentMethods] = React.useState<string[]>([]);
    const [selectedEntities, setSelectedEntities] = React.useState<string[]>([]);
    const [selectedUsers, setSelectedUsers] = React.useState<string[]>([]);

    const [selectedColumns, setSelectedColumns] = React.useState<MultiSelectOption[]>([]);


    React.useEffect(() => {
        setDate({
          from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        });
    }, []);

    // --- Data Fetching ---
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
    
    const tenantDocRef = useMemoFirebase(() => {
        if (!firestore || !tenantId) return null;
        return doc(firestore, 'tenants', tenantId);
    }, [firestore, tenantId]);
    const { data: tenantData } = useDoc<Tenant>(tenantDocRef);

    const categoriesQuery = useMemoFirebase(() => {
        if (!tenantId) return null;
        return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId));
    }, [tenantId]);
    const { data: expenseCategories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);

    const entitiesQuery = useMemoFirebase(() => {
        if (!tenantId) return null;
        return query(collection(firestore, 'entities'), where('tenantId', '==', tenantId));
    }, [tenantId]);
    const { data: entities, isLoading: isLoadingEntities } = useCollection<Entity>(entitiesQuery);
    
    const membersQuery = useMemoFirebase(() => {
        if (!tenantId) return null;
        return query(collection(firestore, 'memberships'), where('tenantId', '==', tenantId));
    }, [tenantId]);
    const { data: members, isLoading: isLoadingMembers } = useCollection<UserType>(membersQuery);
    
    const entityOptions = React.useMemo<MultiSelectOption[]>(() => 
        entities?.map(e => ({ value: e.id, label: e.razonSocial })) || [], 
    [entities]);

    const userOptions = React.useMemo<MultiSelectOption[]>(() => 
        members?.map(m => ({ value: m.uid, label: m.displayName })) || [], 
    [members]);
    
    const incomeColumnOptions = React.useMemo<MultiSelectOption[]>(() => [
        { value: 'all-incomes', label: 'Todos los Ingresos' },
        ...staticIncomeCategories
    ], []);

    const expenseColumnOptions = React.useMemo<MultiSelectOption[]>(() => {
        const expenseCols = expenseCategories?.map(c => ({ value: c.id, label: c.name })) || [];
        return [
            { value: 'all-expenses', label: 'Todos los Gastos' },
            ...expenseCols
        ];
    },[expenseCategories]);
    
    const budgetColumnOptions = React.useMemo<MultiSelectOption[]>(() => [
        { value: 'all-budgets', label: 'Todos los Presupuestos' },
    ], []);


    const isLoading = isUserLoading || isUserDocLoading || isLoadingCategories || isLoadingEntities || (tenantData?.type !== 'PERSONAL' && isLoadingMembers);

    const handleToggleColumn = (option: MultiSelectOption) => {
        setSelectedColumns(prev => 
            prev.find(c => c.value === option.value) 
            ? prev.filter(c => c.value !== option.value) 
            : [...prev, option]
        );
    }
    
    const setDateRange = (preset: string) => {
        const now = new Date();
        switch (preset) {
            case 'currentMonth':
                setDate({ from: startOfMonth(now), to: endOfMonth(now) });
                break;
            case 'currentQuarter':
                setDate({ from: startOfMonth(subMonths(now, 3)), to: endOfMonth(now) });
                break;
            case 'currentSemester':
                setDate({ from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) });
                break;
            case 'currentYear':
                setDate({ from: startOfYear(now), to: endOfYear(now) });
                break;
            case 'ytd':
                setDate({ from: startOfYear(now), to: now });
                break;
        }
    };


    return (
        <div className="flex min-h-screen flex-col bg-secondary/50">
            <header className="sticky top-0 z-40 w-full border-b bg-background">
                <div className="container flex h-16 items-center">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard">
                            <ArrowLeft />
                        </Link>
                    </Button>
                    <h1 className="ml-4 font-headline text-xl font-bold">Reportes Personalizados</h1>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8">
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Constructor de Reportes</CardTitle>
                        <CardDescription>Crea y personaliza tus propios reportes financieros.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {/* --- FILTERS --- */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Filter className="h-5 w-5 text-primary" />
                                <h3 className="text-lg font-semibold">Filtros</h3>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {date?.from ? (
                                                date.to ? (<>
                                                    {format(date.from, "LLL dd, y", { locale: es })} - {format(date.to, "LLL dd, y", { locale: es })}
                                                </>) : (format(date.from, "LLL dd, y", { locale: es }))
                                            ) : (<span>Selecciona un rango</span>)}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 flex" align="start">
                                        <div className="flex flex-col space-y-1 border-r p-2">
                                            <Button variant="ghost" size="sm" className="justify-start" onClick={() => setDateRange('currentMonth')}>Mes Actual</Button>
                                            <Button variant="ghost" size="sm" className="justify-start" onClick={() => setDateRange('currentQuarter')}>Cuatrimestre</Button>
                                            <Button variant="ghost" size="sm" className="justify-start" onClick={() => setDateRange('currentSemester')}>Semestre</Button>
                                            <Button variant="ghost" size="sm" className="justify-start" onClick={() => setDateRange('currentYear')}>Año Actual</Button>
                                            <Button variant="ghost" size="sm" className="justify-start" onClick={() => setDateRange('ytd')}>Year-to-Date</Button>
                                        </div>
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={date?.from}
                                            selected={date}
                                            onSelect={setDate}
                                            numberOfMonths={1}
                                            locale={es}
                                        />
                                    </PopoverContent>
                                </Popover>
                                 <MultiSelect
                                    options={paymentMethodOptions}
                                    selected={selectedPaymentMethods}
                                    onChange={setSelectedPaymentMethods}
                                    placeholder="Todos los medios de pago"
                                />
                                <MultiSelect
                                    options={entityOptions}
                                    selected={selectedEntities}
                                    onChange={setSelectedEntities}
                                    placeholder="Todas las entidades"
                                />
                                {tenantData?.type !== 'PERSONAL' && (
                                    <MultiSelect
                                        options={userOptions}
                                        selected={selectedUsers}
                                        onChange={setSelectedUsers}
                                        placeholder="Todos los usuarios"
                                    />
                                )}
                            </div>
                        </div>

                        <Separator />
                        
                        {/* --- COLUMNS --- */}
                        <div className="space-y-4">
                             <div className="flex items-center gap-2">
                                <Columns className="h-5 w-5 text-primary" />
                                <h3 className="text-lg font-semibold">Columnas del Reporte</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <Card className="p-4">
                                    <CardHeader className="p-2">
                                        <CardTitle className="text-base">Columnas Disponibles</CardTitle>
                                        <CardDescription className="text-sm">Haz clic en una categoría para agregarla a tu reporte.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-2 space-y-4">
                                        <div>
                                            <h4 className="font-semibold text-primary text-sm mb-2">Ingresos</h4>
                                            <div className="space-y-2">
                                                {incomeColumnOptions.map(col => (
                                                    <Button key={`inc-${col.value}`} variant="outline" className="w-full justify-start font-normal" onClick={() => handleToggleColumn(col)}>
                                                        {col.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                         <div>
                                            <h4 className="font-semibold text-destructive text-sm mb-2">Gastos</h4>
                                            <div className="space-y-2">
                                               {expenseColumnOptions.map(col => (
                                                    <Button key={`exp-${col.value}`} variant="outline" className="w-full justify-start font-normal" onClick={() => handleToggleColumn(col)}>
                                                        {col.label}
                                                    </Button>
                                               ))}
                                            </div>
                                        </div>
                                         <div>
                                            <h4 className="font-semibold text-yellow-600 text-sm mb-2">Presupuestos</h4>
                                            <div className="space-y-2">
                                               {budgetColumnOptions.map(col => (
                                                    <Button key={`bud-${col.value}`} variant="outline" className="w-full justify-start font-normal" onClick={() => handleToggleColumn(col)}>
                                                        {col.label}
                                                    </Button>
                                               ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="p-4 bg-muted/30">
                                    <CardHeader className="p-2">
                                        <CardTitle className="text-base">Columnas Seleccionadas</CardTitle>
                                        <CardDescription className="text-sm">Las columnas aparecerán en el reporte en este orden.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-2 min-h-[200px] border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col justify-center items-center">
                                       {selectedColumns.length > 0 ? (
                                            <div className="w-full space-y-2">
                                                {selectedColumns.map(col => (
                                                    <Button key={`sel-${col.value}`} variant="secondary" className="w-full justify-start font-semibold cursor-grab" onClick={() => handleToggleColumn(col)}>
                                                        <GripVertical className="h-4 w-4 mr-2 text-muted-foreground" />
                                                        {col.label}
                                                    </Button>
                                                ))}
                                            </div>
                                       ) : (
                                            <div className="text-center text-muted-foreground">
                                                <p>Arrastra o haz clic en las columnas aquí</p>
                                            </div>
                                       )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-end gap-2">
                        <Button variant="outline"><Save className="mr-2 h-4 w-4" /> Guardar Configuración</Button>
                        <Button><Play className="mr-2 h-4 w-4" /> Ejecutar Reporte</Button>
                    </CardFooter>
                </Card>
                )}
            </main>
        </div>
    );
}
