

'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Calendar as CalendarIcon, Filter, Columns, Play, Save, GripVertical, MoreVertical } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { Category, Entity, User as UserType, Tenant, Expense, Income, Budget } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { MultiSelect, type MultiSelectOption } from '@/components/shared/multi-select';
import { Separator } from '@/components/ui/separator';
import { ResponsiveContainer, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, Brush } from 'recharts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import * as XLSX from 'xlsx';


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
    const [brushRange, setBrushRange] = React.useState<{ startIndex?: number; endIndex?: number }>({});
    
    const [selectedPaymentMethods, setSelectedPaymentMethods] = React.useState<string[]>([]);
    const [selectedEntities, setSelectedEntities] = React.useState<string[]>([]);
    const [selectedUsers, setSelectedUsers] = React.useState<string[]>([]);

    const [selectedColumns, setSelectedColumns] = React.useState<MultiSelectOption[]>([]);


    React.useEffect(() => {
        setDate({
          from: startOfYear(new Date()),
          to: endOfYear(new Date()),
        });
        setSelectedColumns([
            { value: 'all-incomes', label: 'Todos los Ingresos' },
            { value: 'all-expenses', label: 'Todos los Gastos' },
            { value: 'all-budgets', label: 'Todos los Presupuestos' },
        ]);
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
    
    const expensesQuery = useMemoFirebase(() => (tenantId && firestore ? query(collection(firestore, 'expenses'), where('tenantId', '==', tenantId), where('deleted', '==', false)) : null), [firestore, tenantId]);
    const { data: allExpenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

    const incomesQuery = useMemoFirebase(() => (tenantId && firestore ? query(collection(firestore, 'incomes'), where('tenantId', '==', tenantId), where('deleted', '==', false)) : null), [firestore, tenantId]);
    const { data: allIncomes, isLoading: isLoadingIncomes } = useCollection<Income>(incomesQuery);
    
    const budgetsQuery = useMemoFirebase(() => (tenantId && firestore ? query(collection(firestore, 'budgets'), where('tenantId', '==', tenantId)) : null), [firestore, tenantId]);
    const { data: allBudgets, isLoading: isLoadingBudgets } = useCollection<Budget>(budgetsQuery);


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
    
    const entityOptions = React.useMemo<MultiSelectOption[]>(() => {
        const entityMap = new Map<string, string>();
        allExpenses?.forEach(exp => {
            if(exp.entityName && !entityMap.has(exp.entityName)) {
                entityMap.set(exp.entityName, exp.entityName);
            }
        });
        return Array.from(entityMap.entries()).map(([value, label]) => ({value, label}));
    }, [allExpenses]);

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
    
     const budgetColumnOptions = React.useMemo<MultiSelectOption[]>(() => {
        const budgetCols = expenseCategories?.map(c => ({ value: `budget-${c.id}`, label: `Presupuesto: ${c.name}` })) || [];
        return [
            { value: 'all-budgets', label: 'Todos los Presupuestos' },
            ...budgetCols
        ];
    }, [expenseCategories]);

     const { chartData, totalIncome, totalExpense, totalBudget, lineKeys } = React.useMemo(() => {
        if (!allIncomes || !allExpenses || !allBudgets || !date?.from) return { chartData: [], totalIncome: 0, totalExpense: 0, totalBudget: 0, lineKeys: [] };

        const dataMap = new Map<string, any>();
        const from = startOfMonth(date.from);
        const to = endOfMonth(date.to || date.from);

        let current = from;
        while (current <= to) {
            const monthKey = format(current, 'yyyy-MM');
            dataMap.set(monthKey, { date: new Date(current), month: format(current, 'MMM yy', { locale: es }) });
            current = addMonths(current, 1);
        }
        
        const dynamicKeys: {key: string, label: string, color: string, type: 'income' | 'expense' | 'budget'}[] = [];

        selectedColumns.forEach(col => {
            let key: string, label: string, color: string, type: 'income' | 'expense' | 'budget';
            
            if (col.value === 'all-incomes') { key = 'ingresos'; label = 'Ingresos Totales'; color = '#22c55e'; type = 'income'; } 
            else if (col.value === 'all-expenses') { key = 'egresos'; label = 'Egresos Totales'; color = '#ea580c'; type = 'expense'; } 
            else if (col.value === 'all-budgets') { key = 'presupuesto'; label = 'Presupuesto Total'; color = '#3b82f6'; type = 'budget'; } 
            else if (col.value.startsWith('budget-')) {
                 const cat = expenseCategories?.find(c => `budget-${c.id}` === col.value);
                 if (cat) {
                    key = col.value; label = `Ppto: ${cat.name}`; color = '#60a5fa'; type = 'budget';
                 } else return;
            } else {
                const incomeCat = staticIncomeCategories.find(c => c.value === col.value);
                const expenseCat = expenseCategories?.find(c => c.id === col.value);
                if (incomeCat) {
                    key = col.value; label = col.label; color = '#6ee7b7'; type = 'income';
                } else if (expenseCat) {
                    key = col.value; label = col.label; color = '#f97316'; type = 'expense';
                } else {
                    return;
                }
            }
            dynamicKeys.push({ key, label, color, type });
        });

        for (const monthData of dataMap.values()) {
            dynamicKeys.forEach(k => monthData[k.key] = 0);
        }

        const filteredExpenses = allExpenses.filter(exp => {
            const expDate = new Date(exp.date);
            return expDate >= from && expDate <= to &&
                (selectedPaymentMethods.length === 0 || selectedPaymentMethods.includes(exp.paymentMethod)) &&
                (selectedEntities.length === 0 || (exp.entityName && selectedEntities.includes(exp.entityName))) &&
                (selectedUsers.length === 0 || selectedUsers.includes(exp.userId));
        });

        const filteredIncomes = allIncomes.filter(inc => {
            const incDate = new Date(inc.date);
            return incDate >= from && incDate <= to &&
                (selectedUsers.length === 0 || selectedUsers.includes(inc.userId));
        });
        
        const filteredBudgets = allBudgets.filter(b => {
             const budgetDate = startOfMonth(new Date(b.year, b.month - 1));
             return budgetDate >= from && budgetDate <= to;
        });

        dynamicKeys.forEach(({ key, type }) => {
             for (const monthData of dataMap.values()) {
                const currentMonth = monthData.date.getMonth();
                const currentYear = monthData.date.getFullYear();
                
                if (type === 'income') {
                    const relevantIncomes = key === 'ingresos' ? filteredIncomes : filteredIncomes.filter(i => i.category === key);
                    monthData[key] = relevantIncomes
                        .filter(i => new Date(i.date).getMonth() === currentMonth && new Date(i.date).getFullYear() === currentYear)
                        .reduce((sum, i) => sum + i.amountARS, 0);
                } else if (type === 'expense') {
                    const relevantExpenses = key === 'egresos' ? filteredExpenses : filteredExpenses.filter(e => e.categoryId === key);
                     monthData[key] = relevantExpenses
                        .filter(e => new Date(e.date).getMonth() === currentMonth && new Date(e.date).getFullYear() === currentYear)
                        .reduce((sum, e) => sum + e.amountARS, 0);
                } else if (type === 'budget') {
                    const categoryId = key.startsWith('budget-') ? key.replace('budget-', '') : null;
                    const relevantBudgets = categoryId ? filteredBudgets.filter(b => b.categoryId === categoryId) : filteredBudgets;

                    monthData[key] = relevantBudgets
                        .filter(b => b.month === currentMonth + 1 && b.year === currentYear)
                        .reduce((sum, b) => sum + b.amountARS, 0);
                }
            }
        });
        
        const finalChartData = Array.from(dataMap.values());
        
        const incomeKeys = dynamicKeys.filter(k => k.type === 'income').map(k => k.key);
        const expenseKeys = dynamicKeys.filter(k => k.type === 'expense').map(k => k.key);
        const budgetKeys = dynamicKeys.filter(k => k.type === 'budget').map(k => k.key);

        const totalIncome = finalChartData.reduce((acc, data) => {
            let monthTotal = 0;
            incomeKeys.forEach(key => monthTotal += (data[key] || 0));
            return acc + monthTotal;
        }, 0);
        
        const totalExpense = finalChartData.reduce((acc, data) => {
            let monthTotal = 0;
            expenseKeys.forEach(key => monthTotal += (data[key] || 0));
            return acc + monthTotal;
        }, 0);

        const totalBudget = finalChartData.reduce((acc, data) => {
            let monthTotal = 0;
            budgetKeys.forEach(key => monthTotal += (data[key] || 0));
            return acc + monthTotal;
        }, 0);


        return { chartData: finalChartData, totalIncome, totalExpense, totalBudget, lineKeys: dynamicKeys };

    }, [allIncomes, allExpenses, allBudgets, date, selectedColumns, expenseCategories, selectedPaymentMethods, selectedEntities, selectedUsers]);


    const formatCurrency = (amount: number) => new Intl.NumberFormat("es-AR", { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);


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

    const handleExport = () => {
        const dataToExport = chartData.slice(brushRange.startIndex, brushRange.endIndex !== undefined ? brushRange.endIndex + 1 : undefined);
        const ws = XLSX.utils.json_to_sheet(dataToExport.map(d => {
            const row: any = { Mes: d.month };
            lineKeys.forEach(lk => {
                row[lk.label] = d[lk.key];
            });
            return row;
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Datos del Gráfico");
        XLSX.writeFile(wb, "reporte_flujo_caja.xlsx");
    };
    
    const showIncomeTotal = selectedColumns.some(c => staticIncomeCategories.some(sc => sc.value === c.value) || c.value === 'all-incomes');
    const showExpenseTotal = selectedColumns.some(c => expenseCategories?.some(ec => ec.id === c.value) || c.value === 'all-expenses');
    const showBudgetTotal = selectedColumns.some(c => c.value.startsWith('budget-'));


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

            <main className="flex-1 p-4 md:p-8 space-y-8">
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : (
                <>
                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent>
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
                                placeholder="Medios de pago"
                            />
                            <MultiSelect
                                options={entityOptions}
                                selected={selectedEntities}
                                onChange={setSelectedEntities}
                                placeholder="Entidades"
                            />
                            {tenantData?.type !== 'PERSONAL' && (
                                <MultiSelect
                                    options={userOptions}
                                    selected={selectedUsers}
                                    onChange={setSelectedUsers}
                                    placeholder="Usuarios"
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle>Análisis de Flujo de Caja</CardTitle>
                                <CardDescription>Ingresos vs. Egresos en el período seleccionado.</CardDescription>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={handleExport}>
                                        Exportar a Excel
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <div className="flex pt-4 gap-6 text-right">
                                {showIncomeTotal && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Ingresos Totales</p>
                                        <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
                                    </div>
                                )}
                                {showExpenseTotal && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Egresos Totales</p>
                                        <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalExpense)}</p>
                                    </div>
                                )}
                                {showBudgetTotal && (
                                     <div>
                                        <p className="text-sm text-muted-foreground">Presupuesto Total</p>
                                        <p className="text-2xl font-bold text-sky-600">{formatCurrency(totalBudget)}</p>
                                    </div>
                                )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" stroke="hsl(var(--foreground))" fontSize={12} />
                                <YAxis stroke="hsl(var(--foreground))" fontSize={12} tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="rounded-lg border bg-card p-2 shadow-sm text-sm">
                                                    <p className="font-bold">{label}</p>
                                                    {payload.map(p => (
                                                        <p key={p.dataKey} style={{ color: p.stroke }}>{p.name}: {formatCurrency(p.value as number)}</p>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend />
                                {lineKeys.map(line => (
                                    <Line key={line.key} type="monotone" dataKey={line.key} name={line.label} stroke={line.color} strokeWidth={2} dot={false} />
                                ))}
                                <Brush dataKey="month" height={30} stroke="hsl(var(--primary))" onChange={(range) => setBrushRange(range)} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>


                <Card>
                    <CardHeader>
                        <CardTitle>Constructor de Reportes</CardTitle>
                        <CardDescription>Crea y personaliza tus propios reportes financieros.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
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
                                            <h4 className="font-semibold text-green-600 text-sm mb-2">Ingresos</h4>
                                            <div className="space-y-2">
                                                {incomeColumnOptions.map(col => (
                                                    <Button key={`inc-${col.value}`} variant="outline" className="w-full justify-start font-normal bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50" onClick={() => handleToggleColumn(col)}>
                                                        {col.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                         <div>
                                            <h4 className="font-semibold text-orange-600 text-sm mb-2 mt-4">Gastos</h4>
                                            <div className="space-y-2">
                                               {expenseColumnOptions.map(col => (
                                                    <Button key={`exp-${col.value}`} variant="outline" className="w-full justify-start font-normal bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50" onClick={() => handleToggleColumn(col)}>
                                                        {col.label}
                                                    </Button>
                                               ))}
                                            </div>
                                        </div>
                                         <div>
                                            <h4 className="font-semibold text-sky-600 text-sm mb-2 mt-4">Presupuestos</h4>
                                            <div className="space-y-2">
                                               {budgetColumnOptions.map(col => (
                                                    <Button key={`bud-${col.value}`} variant="outline" className="w-full justify-start font-normal bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/30 dark:hover:bg-sky-900/50" onClick={() => handleToggleColumn(col)}>
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
                                                    <Button 
                                                        key={`sel-${col.value}`} 
                                                        variant="secondary" 
                                                        className="w-full justify-start font-semibold cursor-grab" 
                                                        onClick={() => handleToggleColumn(col)}
                                                    >
                                                        <GripVertical className="h-4 w-4 mr-2 text-muted-foreground" />
                                                        {col.label}
                                                    </Button>
                                                ))}
                                            </div>
                                       ) : (
                                            <div className="text-center text-muted-foreground">
                                                <p>Haz clic en las columnas de la izquierda para agregarlas aquí</p>
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
                </>
                )}
            </main>
        </div>
    );
}
