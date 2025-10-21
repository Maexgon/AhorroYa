

'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Loader2, Calendar as CalendarIcon, Filter, Columns, Play, Save } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { Category, Entity, User as UserType, Tenant } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MultiSelect, type MultiSelectOption } from '@/components/shared/multi-select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const expenseColumns = [
    { id: 'date', label: 'Fecha' },
    { id: 'amount', label: 'Monto' },
    { id: 'currency', label: 'Moneda' },
    { id: 'amountARS', label: 'Monto (ARS)' },
    { id: 'categoryId', label: 'Categoría' },
    { id: 'subcategoryId', label: 'Subcategoría' },
    { id: 'entityName', label: 'Entidad' },
    { id: 'paymentMethod', label: 'Método de Pago' },
    { id: 'notes', label: 'Notas' },
    { id: 'userId', label: 'Usuario' },
];

const incomeColumns = [
    { id: 'date', label: 'Fecha' },
    { id: 'amount', label: 'Monto' },
    { id: 'currency', label: 'Moneda' },
    { id: 'amountARS', label: 'Monto (ARS)' },
    { id: 'category', label: 'Categoría' },
    { id: 'description', label: 'Descripción' },
    { id: 'userId', label: 'Usuario' },
];

const budgetColumns = [
    { id: 'year', label: 'Año' },
    { id: 'month', label: 'Mes' },
    { id: 'categoryId', label: 'Categoría' },
    { id: 'amountARS', label: 'Monto Presupuestado (ARS)' },
];


export default function ReportsPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [tenantId, setTenantId] = React.useState<string | null>(null);
    const [date, setDate] = React.useState<DateRange | undefined>(undefined);
    const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
    const [selectedEntities, setSelectedEntities] = React.useState<string[]>([]);
    const [selectedUsers, setSelectedUsers] = React.useState<string[]>([]);

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
    const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);

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
    
    const categoryOptions = React.useMemo<MultiSelectOption[]>(() => 
        categories?.map(c => ({ value: c.id, label: c.name })) || [], 
    [categories]);

    const entityOptions = React.useMemo<MultiSelectOption[]>(() => 
        entities?.map(e => ({ value: e.id, label: e.razonSocial })) || [], 
    [entities]);

    const userOptions = React.useMemo<MultiSelectOption[]>(() => 
        members?.map(m => ({ value: m.uid, label: m.displayName })) || [], 
    [members]);

    const isLoading = isUserLoading || isUserDocLoading || isLoadingCategories || isLoadingEntities || (tenantData?.type !== 'PERSONAL' && isLoadingMembers);

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
                                <MultiSelect
                                    options={categoryOptions}
                                    selected={selectedCategories}
                                    onChange={setSelectedCategories}
                                    placeholder="Filtrar por categorías..."
                                />
                                <MultiSelect
                                    options={entityOptions}
                                    selected={selectedEntities}
                                    onChange={setSelectedEntities}
                                    placeholder="Filtrar por entidades..."
                                />
                                {tenantData?.type !== 'PERSONAL' && (
                                    <MultiSelect
                                        options={userOptions}
                                        selected={selectedUsers}
                                        onChange={setSelectedUsers}
                                        placeholder="Filtrar por usuarios..."
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
                                <div>
                                    <h4 className="font-medium mb-3">Columnas Disponibles</h4>
                                    <Accordion type="multiple" className="w-full" defaultValue={['gastos']}>
                                        <AccordionItem value="gastos">
                                            <AccordionTrigger>Gastos</AccordionTrigger>
                                            <AccordionContent className="p-2 space-y-2">
                                               {expenseColumns.map(col => (
                                                    <div key={`exp-${col.id}`} className="flex items-center space-x-2">
                                                        <Checkbox id={`exp-${col.id}`} />
                                                        <Label htmlFor={`exp-${col.id}`}>{col.label}</Label>
                                                    </div>
                                               ))}
                                            </AccordionContent>
                                        </AccordionItem>
                                        <AccordionItem value="ingresos">
                                            <AccordionTrigger>Ingresos</AccordionTrigger>
                                            <AccordionContent className="p-2 space-y-2">
                                                {incomeColumns.map(col => (
                                                    <div key={`inc-${col.id}`} className="flex items-center space-x-2">
                                                        <Checkbox id={`inc-${col.id}`} />
                                                        <Label htmlFor={`inc-${col.id}`}>{col.label}</Label>
                                                    </div>
                                                ))}
                                            </AccordionContent>
                                        </AccordionItem>
                                        <AccordionItem value="presupuestos">
                                            <AccordionTrigger>Presupuestos</AccordionTrigger>
                                            <AccordionContent className="p-2 space-y-2">
                                               {budgetColumns.map(col => (
                                                    <div key={`bud-${col.id}`} className="flex items-center space-x-2">
                                                        <Checkbox id={`bud-${col.id}`} />
                                                        <Label htmlFor={`bud-${col.id}`}>{col.label}</Label>
                                                    </div>
                                               ))}
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </div>
                                <div className="border border-dashed rounded-lg p-4 bg-muted/30">
                                    <h4 className="font-medium mb-3">Columnas Seleccionadas</h4>
                                    <div className="h-64 flex items-center justify-center">
                                        <p className="text-sm text-muted-foreground">Arrastra y suelta columnas aquí</p>
                                    </div>
                                </div>
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
