
'use client';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useMemo } from 'react';
import { AhorroYaLogo } from '@/components/shared/icons';
import { Button } from '@/components/ui/button';
import { getAuth, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, writeBatch, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { WithId } from '@/firebase/firestore/use-collection';
import type { Tenant, License, Membership, Category, User as UserType, Expense, Budget, Income } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, UserPlus, FileText, Repeat, XCircle, Plus, Calendar as CalendarIcon, Utensils, ShoppingCart, Bus, Film, Home, Sparkles, Loader2, TableIcon, ArrowLeft, View, Banknote } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, subQuarters, endOfQuarter, subYears, startOfSemester, endOfSemester, subSemesters } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, ResponsiveContainer, Cell, LabelList, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Line, ComposedChart, Area } from 'recharts';
import { defaultCategories } from '@/lib/default-categories';
import Link from 'next/link';
import { useDoc } from '@/firebase/firestore/use-doc';
import { DropdownCat } from '@/components/ui/dropdowncat';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as XLSX from 'xlsx';
import { columns as expenseColumns } from './expenses/columns';
import { DataTable as ExpensesDataTable } from './expenses/data-table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const SAFE_DEFAULTS = {
    barData: [],
    recentExpenses: [],
    budgetChartData: [],
    totalExpenses: 0,
    budgetBalance: 0,
    formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
    toCurrencyCode: 'ARS',
    monthlyOverviewData: [],
    cumulativeChartData: [],
    isOwner: false,
};

const CustomizedYAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const words = payload.value.split(' ');
  const maxCharsPerLine = 15; // Adjust as needed
  
  if (payload.value.length < maxCharsPerLine) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={4} textAnchor="end" fill="hsl(var(--foreground))" fontSize={12}>
          {payload.value}
        </text>
      </g>
    );
  }

  let line = '';
  const lines = [];
  for (const word of words) {
    if ((line + word).length > maxCharsPerLine) {
      lines.push(line.trim());
      line = word + ' ';
    } else {
      line += word + ' ';
    }
  }
  lines.push(line.trim());

  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((l, i) => (
        <text key={i} x={0} y={0} dy={(i * 12) - (lines.length > 1 ? 5 : 0) } textAnchor="end" fill="hsl(var(--foreground))" fontSize={12}>
          {l}
        </text>
      ))}
    </g>
  );
};

const CurrencyRates = () => {
    const [rates, setRates] = useState<any>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                const endpoints = {
                    oficial: 'https://dolarapi.com/v1/dolares/oficial',
                    tarjeta: 'https://dolarapi.com/v1/dolares/tarjeta',
                    real: 'https://dolarapi.com/v1/cotizaciones/brl',
                    chileno: 'https://dolarapi.com/v1/cotizaciones/clp',
                    uruguayo: 'https://dolarapi.com/v1/cotizaciones/uyu',
                };

                const responses = await Promise.all(
                    Object.values(endpoints).map(url => fetch(url).then(res => res.json()))
                );

                const newRates = {
                    oficial: responses[0],
                    tarjeta: responses[1],
                    real: responses[2],
                    chileno: responses[3],
                    uruguayo: responses[4],
                };
                
                setRates(newRates);
            } catch (error) {
                console.error("Failed to fetch currency rates:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRates();
    }, []);

    const formatCurrencyValue = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Cotizaciones de Referencia</CardTitle>
                <CardDescription>Valores de venta actualizados.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
                        <div className="flex flex-col p-3 bg-secondary/50 rounded-lg">
                            <span className="text-sm font-medium text-muted-foreground">Dólar Oficial</span>
                            <span className="text-xl font-bold font-mono text-primary">{formatCurrencyValue(rates.oficial.venta)}</span>
                        </div>
                         <div className="flex flex-col p-3 bg-secondary/50 rounded-lg">
                            <span className="text-sm font-medium text-muted-foreground">Dólar Tarjeta</span>
                            <span className="text-xl font-bold font-mono text-primary">{formatCurrencyValue(rates.tarjeta.venta)}</span>
                        </div>
                        <div className="flex flex-col p-3 bg-secondary/50 rounded-lg">
                            <span className="text-sm font-medium text-muted-foreground">Real Brasileño</span>
                            <span className="text-xl font-bold font-mono text-primary">{formatCurrencyValue(rates.real.venta)}</span>
                        </div>
                        <div className="flex flex-col p-3 bg-secondary/50 rounded-lg">
                            <span className="text-sm font-medium text-muted-foreground">Peso Chileno</span>
                            <span className="text-xl font-bold font-mono text-primary">{formatCurrencyValue(rates.chileno.venta)}</span>
                        </div>
                        <div className="flex flex-col p-3 bg-secondary/50 rounded-lg">
                            <span className="text-sm font-medium text-muted-foreground">Peso Uruguayo</span>
                            <span className="text-xl font-bold font-mono text-primary">{formatCurrencyValue(rates.uruguayo.venta)}</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


function OwnerDashboard({ tenantId }: { tenantId: string }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSeeding, setIsSeeding] = useState(false);
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [chartVisibility, setChartVisibility] = useState({
    monthlyFlow: true,
    cumulativeBalance: true,
    expenseAnalysis: true,
    budgets: true,
  });

  const toggleChartVisibility = (chartKey: keyof typeof chartVisibility) => {
    setChartVisibility(prev => ({ ...prev, [chartKey]: !prev[chartKey] }));
  };
  
  // --- Data Fetching ---
  const tenantRef = useMemo(() => (tenantId ? doc(firestore, 'tenants', tenantId) : null), [tenantId, firestore]);
  const { data: activeTenant, isLoading: isLoadingTenant } = useDoc<Tenant>(tenantRef);
  
  const licenseQuery = useMemo(() => (tenantId && firestore ? query(collection(firestore, 'licenses'), where('tenantId', '==', tenantId)) : null), [tenantId, firestore]);
  const { data: licenses, isLoading: isLoadingLicenses } = useCollection<License>(licenseQuery);
  
  const categoriesQuery = useMemo(() => (tenantId && firestore ? query(collection(firestore, 'categories'), where('tenantId', '==', tenantId)) : null), [tenantId, firestore]);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<WithId<Category>>(categoriesQuery);
  
  const expensesQuery = useMemo(() => (tenantId && firestore ? query(collection(firestore, 'expenses'), where('tenantId', '==', tenantId), where('deleted', '==', false)) : null), [tenantId, firestore]);
  const { data: allExpenses, isLoading: isLoadingExpenses } = useCollection<WithId<Expense>>(expensesQuery);

  const incomesQuery = useMemo(() => (tenantId && firestore ? query(collection(firestore, 'incomes'), where('tenantId', '==', tenantId), where('deleted', '==', false)) : null), [tenantId, firestore]);
  const { data: allIncomes, isLoading: isLoadingIncomes } = useCollection<WithId<Income>>(incomesQuery);

  const budgetsQuery = useMemo(() => (tenantId && firestore ? query(collection(firestore, 'budgets'), where('tenantId', '==', tenantId)) : null), [tenantId, firestore]);
  const { data: allBudgets, isLoading: isLoadingBudgets } = useCollection<WithId<Budget>>(budgetsQuery);
  
  const isLoading = isLoadingTenant || isLoadingLicenses || isLoadingCategories || isLoadingExpenses || isLoadingBudgets || isLoadingIncomes;
  
 const processedData = useMemo(() => {
    if (isLoading || !categories || !allExpenses || !allBudgets || !allIncomes || !activeTenant || !user) {
      return SAFE_DEFAULTS;
    }

    const finalFormatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const currentMonth = date?.from?.getMonth() ?? new Date().getMonth();
    const currentYear = date?.from?.getFullYear() ?? new Date().getFullYear();

    const filteredExpenses = allExpenses.filter(expense => {
        if (!date?.from) return false;
        const expenseDate = new Date(expense.date);
        const fromDate = new Date(date.from.setHours(0, 0, 0, 0));
        const toDate = date.to ? new Date(date.to.setHours(23, 59, 59, 999)) : new Date(date.from.setHours(23, 59, 59, 999));
        if (expenseDate < fromDate || expenseDate > toDate) return false;
        if (selectedCategoryId !== 'all' && expense.categoryId !== selectedCategoryId) return false;
        return true;
    });

    const totalExpenses = filteredExpenses.reduce((acc, expense) => acc + expense.amountARS, 0);

    const totalBudgetForPeriod = allBudgets
      .filter(b => b.month === currentMonth + 1 && b.year === currentYear)
      .reduce((acc, budget) => acc + budget.amountARS, 0);

    const budgetBalance = totalBudgetForPeriod - totalExpenses;

    const barData = Object.entries(filteredExpenses.reduce((acc, expense) => {
        const categoryName = categories.find(c => c.id === expense.categoryId)?.name || 'Sin Categoría';
        if (!acc[categoryName]) acc[categoryName] = 0;
        acc[categoryName] += expense.amountARS;
        return acc;
    }, {} as Record<string, number>))
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

    const expenseIcons: { [key: string]: React.ElementType } = {
        default: Sparkles, 'Comestibles': Utensils, 'Ropa y Accesorios': ShoppingCart, 'Mobilidad': Bus, 'Vida y Entretenimiento': Film, 'Vivienda': Home,
    };

    const recentExpenses = filteredExpenses
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)
        .map(expense => {
            const categoryName = categories.find(c => c.id === expense.categoryId)?.name || 'Sin Categoría';
            return {
                ...expense, icon: expenseIcons[categoryName] || expenseIcons.default, entity: expense.entityName || 'N/A', category: categoryName, amountConverted: expense.amountARS,
            }
        });

    const budgetChartData = (() => {
        return allBudgets
            .filter(b => b.month === currentMonth + 1 && b.year === currentYear)
            .map(budget => {
                const spentInARS = allExpenses
                    .filter(e => e.categoryId === budget.categoryId && new Date(e.date).getMonth() === currentMonth && new Date(e.date).getFullYear() === currentYear)
                    .reduce((acc, e) => acc + e.amountARS, 0);

                const percentage = budget.amountARS > 0 ? Math.round((spentInARS / budget.amountARS) * 100) : 0;
                
                return {
                    name: categories.find(c => c.id === budget.categoryId)?.name || 'N/A', 
                    Presupuestado: budget.amountARS, 
                    Gastado: spentInARS,
                    percentage: percentage,
                };
            }).slice(0, 5);
    })();
    
    let cumulativeExpenses = 0;
    let cumulativeIncomes = 0;
    
    const monthlyData = Array.from({ length: 12 }).map((_, i) => {
        const monthDate = subMonths(new Date(), 11 - i); // Iterate from 12 months ago to now
        const month = monthDate.getMonth();
        const year = monthDate.getFullYear();
        
        const monthlyExpenses = allExpenses
          .filter(e => new Date(e.date).getMonth() === month && new Date(e.date).getFullYear() === year)
          .reduce((sum, e) => sum + e.amountARS, 0);
          
        const monthlyIncomes = allIncomes
          .filter(inc => new Date(inc.date).getMonth() === month && new Date(inc.date).getFullYear() === year)
          .reduce((sum, inc) => sum + inc.amountARS, 0);

        cumulativeExpenses += monthlyExpenses;
        cumulativeIncomes += monthlyIncomes;

        return {
          month: format(monthDate, 'MMM', { locale: es }),
          ingresos: monthlyIncomes,
          gastos: monthlyExpenses,
          ingresosAcumulados: cumulativeIncomes,
          gastosAcumulados: cumulativeExpenses,
        };
    });

    const isOwner = activeTenant?.ownerUid === user.uid;


    return { 
        barData, 
        recentExpenses, 
        budgetChartData, 
        totalExpenses, 
        budgetBalance, 
        formatCurrency: finalFormatCurrency, 
        toCurrencyCode: 'ARS', 
        monthlyOverviewData: monthlyData, // Use the enriched monthly data
        cumulativeChartData: monthlyData, // Use the same data for the new chart
        isOwner 
    };
  }, [isLoading, allExpenses, allBudgets, categories, date, selectedCategoryId, allIncomes, activeTenant, user]);
  
  const handleSeedCategories = async () => {
    if (!firestore || !activeTenant) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo encontrar el tenant activo.' });
        return;
    }
    setIsSeeding(true);
    try {
        const batch = writeBatch(firestore);
        defaultCategories.forEach((category, catIndex) => {
            const categoryId = crypto.randomUUID();
            const categoryRef = doc(firestore, "categories", categoryId);
            batch.set(categoryRef, { id: categoryId, tenantId: activeTenant.id, name: category.name, color: category.color, order: catIndex });
            category.subcategories.forEach((subcategoryName, subCatIndex) => {
                const subcategoryId = crypto.randomUUID();
                const subcategoryRef = doc(firestore, "subcategories", subcategoryId);
                batch.set(subcategoryRef, { id: subcategoryId, tenantId: activeTenant.id, categoryId: categoryId, name: subcategoryName, order: subCatIndex });
            });
        });
        await batch.commit();
        toast({ title: '¡Éxito!', description: 'Las categorías por defecto han sido creadas. La página se refrescará.' });
    } catch (error) {
        console.error("Error seeding categories:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron crear las categorías.' });
    } finally {
        setIsSeeding(false);
    }
  };


  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
  
  const categoryOptions = useMemo(() => {
    if (!categories) return [];
    const options = categories.map(c => ({ label: c.name, value: c.id }));
    return [{ label: 'Todas las categorías', value: 'all' }, ...options];
  }, [categories]);

  const handleExport = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    toast({ title: "Exportación exitosa", description: `${fileName}.xlsx ha sido descargado.`});
  };

  const setDateRange = (preset: string) => {
    const now = new Date();
    switch (preset) {
        case 'currentMonth':
            setDate({ from: startOfMonth(now), to: endOfMonth(now) });
            break;
        case 'currentYear':
            setDate({ from: startOfYear(now), to: endOfYear(now) });
            break;
        case 'ytd':
            setDate({ from: startOfYear(now), to: now });
            break;
        case 'lastQuarter':
            setDate({ from: startOfMonth(subMonths(now, 3)), to: endOfMonth(subMonths(now, 1)) });
            break;
        case 'lastSemester':
            setDate({ from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) });
            break;
    }
  };


  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const showSeedButton = !isLoadingCategories && (!categories || categories.length === 0) && !!activeTenant;
  const activeLicense = licenses?.[0];

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        <div className="bg-card shadow rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <AhorroYaLogo className="h-10 w-10 text-primary" />
                <div>
                    <h2 className="text-lg font-bold text-foreground">
                        {activeLicense ? `Licencia ${activeLicense.plan.charAt(0).toUpperCase() + activeLicense.plan.slice(1)} - Hasta ${activeLicense.maxUsers} usuarios.` : 'No se pudo cargar la licencia'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Vencimiento: {activeLicense ? format(new Date(activeLicense.endDate), 'P', { locale: es }) : 'N/A'}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                {activeLicense && (
                  <Badge variant={activeLicense?.status === 'active' ? 'default' : 'destructive'} className={activeLicense?.status === 'active' ? 'bg-green-500 hover:bg-green-600' : ''}>
                      {activeLicense?.status === 'active' ? 'Activa' : 'Inactiva'}
                  </Badge>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {processedData.isOwner && (
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/settings">
                                    <FileText className="mr-2 h-4 w-4" />Administrar
                                </Link>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10"><XCircle className="mr-2 h-4 w-4" />Cancelar Licencia</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
        
        <CurrencyRates />

        {showSeedButton && (
            <Card>
                <CardHeader>
                    <CardTitle>Configuración Inicial Requerida</CardTitle>
                    <CardDescription>
                        Parece que tu cuenta no tiene categorías de gastos. Puedes crearlas ahora usando nuestra plantilla por defecto.
                    </CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button onClick={handleSeedCategories} disabled={isSeeding}>
                        {isSeeding ? 'Creando...' : 'Generar Categorías por Defecto'}
                    </Button>
                </CardFooter>
            </Card>
        )}

        <div className="flex flex-wrap gap-2">
            <Button asChild>
                <Link href="/dashboard/budget">
                    <TableIcon className="mr-2 h-4 w-4" /> Ver Presupuesto
                </Link>
            </Button>
            <Button asChild>
                <Link href="/dashboard/expenses">
                    <TableIcon className="mr-2 h-4 w-4" /> Ver Gastos
                </Link>
            </Button>
            <Button asChild>
                <Link href="/dashboard/income">
                    <TableIcon className="mr-2 h-4 w-4" /> Ver Ingresos
                </Link>
            </Button>
        </div>


        <div className="bg-card shadow rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <DropdownCat
                    options={categoryOptions}
                    value={selectedCategoryId}
                    onSelect={(value) => setSelectedCategoryId(value === 'all' ? 'all' : value)}
                    placeholder="Seleccionar categoría"
                    searchPlaceholder="Buscar categoría..."
                    emptyPlaceholder="No se encontró la categoría."
                />
                 
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className="w-full justify-start text-left font-normal"
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
                                <span>Selecciona un rango</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 flex" align="start">
                        <div className="flex flex-col space-y-2 border-r p-4">
                            <Button variant="ghost" className="justify-start" onClick={() => setDateRange('currentMonth')}>Mes Actual</Button>
                            <Button variant="ghost" className="justify-start" onClick={() => setDateRange('currentYear')}>Año Actual</Button>
                            <Button variant="ghost" className="justify-start" onClick={() => setDateRange('ytd')}>Year-to-Date</Button>
                            <Button variant="ghost" className="justify-start" onClick={() => setDateRange('lastQuarter')}>Último Cuatrimestre</Button>
                            <Button variant="ghost" className="justify-start" onClick={() => setDateRange('lastSemester')}>Último Semestre</Button>
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

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full md:w-auto">
                            <View className="mr-2 h-4 w-4" />
                            Mostrar/Ocultar Gráficos
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuLabel>Gráficos Visibles</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem checked={chartVisibility.monthlyFlow} onCheckedChange={() => toggleChartVisibility('monthlyFlow')}>Flujo de Caja Mensual</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={chartVisibility.cumulativeBalance} onCheckedChange={() => toggleChartVisibility('cumulativeBalance')}>Balance Acumulado</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={chartVisibility.expenseAnalysis} onCheckedChange={() => toggleChartVisibility('expenseAnalysis')}>Análisis de Gastos</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={chartVisibility.budgets} onCheckedChange={() => toggleChartVisibility('budgets')}>Presupuestos</DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                </DropdownMenu>

            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {chartVisibility.monthlyFlow && (
                <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Resumen Mensual de Flujo de Caja</CardTitle>
                        <CardDescription>Ingresos vs. Gastos de los últimos 12 meses.</CardDescription>
                    </div>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExport(processedData.monthlyOverviewData, "flujo_de_caja_mensual")}>Exportar a Excel</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleChartVisibility('monthlyFlow')}>Cerrar</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={processedData.monthlyOverviewData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" stroke="hsl(var(--foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--foreground))" fontSize={12} tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="rounded-lg border bg-card p-2 shadow-sm text-sm">
                                            <p className="font-bold">{label}</p>
                                            <p style={{ color: 'hsl(var(--chart-3))' }}>Ingresos: {processedData.formatCurrency(payload[0].value as number)}</p>
                                            <p style={{ color: 'hsl(var(--destructive))' }}>Gastos: {processedData.formatCurrency(payload[1].value as number)}</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend />
                        <Bar dataKey="ingresos" name="Ingresos" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="gastos" name="Gastos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                    </ResponsiveContainer>
                </CardContent>
                </Card>
            )}
            {chartVisibility.cumulativeBalance && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Balance Acumulado Anual</CardTitle>
                            <CardDescription>Evolución de ingresos y gastos acumulados.</CardDescription>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleExport(processedData.cumulativeChartData, "balance_acumulado")}>Exportar a Excel</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleChartVisibility('cumulativeBalance')}>Cerrar</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <ComposedChart data={processedData.cumulativeChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" stroke="hsl(var(--foreground))" fontSize={12} />
                                <YAxis stroke="hsl(var(--foreground))" fontSize={12} tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const income = payload.find(p => p.dataKey === 'ingresosAcumulados')?.value || 0;
                                            const expense = payload.find(p => p.dataKey === 'gastosAcumulados')?.value || 0;
                                            return (
                                                <div className="rounded-lg border bg-card p-2 shadow-sm text-sm">
                                                    <p className="font-bold">{label}</p>
                                                    <p style={{ color: 'hsl(var(--chart-3))' }}>Ing. Acum: {processedData.formatCurrency(income as number)}</p>
                                                    <p style={{ color: 'hsl(var(--destructive))' }}>Gas. Acum: {processedData.formatCurrency(expense as number)}</p>
                                                    <p className="font-semibold mt-1">Balance: {processedData.formatCurrency(income as number - (expense as number))}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="gastosAcumulados" fill="hsl(var(--destructive) / 0.1)" stroke="transparent" name="Gastos Acumulados" />
                                <Area type="monotone" dataKey="ingresosAcumulados" fill="hsl(var(--chart-3) / 0.1)" stroke="transparent" name="Ingresos Acumulados" />
                                <Line type="monotone" dataKey="ingresosAcumulados" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} name="Ingresos Acum." />
                                <Line type="monotone" dataKey="gastosAcumulados" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="Gastos Acum." />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            {chartVisibility.expenseAnalysis && (
                <Card className="lg:col-span-4">
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle>Análisis de Gastos</CardTitle>
                            <CardDescription>Resumen por categoría del período seleccionado.</CardDescription>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleExport(processedData.barData, "analisis_de_gastos")}>Exportar a Excel</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleChartVisibility('expenseAnalysis')}>Cerrar</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="text-2xl font-bold font-headline text-primary pt-2">
                        {processedData.formatCurrency(processedData.totalExpenses)}
                        <p className="text-xs font-normal text-muted-foreground">Total de Gastos en {processedData.toCurrencyCode}</p>
                    </div>
                </CardHeader>
                <CardContent className="pl-2">
                    <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={processedData.barData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                        <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis hide={true} />
                        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                            <LabelList
                                dataKey="total"
                                position="top"
                                offset={8}
                                className="fill-foreground"
                                fontSize={12}
                                formatter={(value: number) => processedData.formatCurrency(value)}
                            />
                        {processedData.barData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                        </Bar>
                    </BarChart>
                    </ResponsiveContainer>
                </CardContent>
                </Card>
            )}
            {chartVisibility.budgets && (
                <Card className="lg:col-span-3">
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle>Presupuestos</CardTitle>
                            <CardDescription>Tu progreso de gastos del mes en {processedData.toCurrencyCode}.</CardDescription>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleExport(processedData.budgetChartData, "presupuestos")}>Exportar a Excel</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleChartVisibility('budgets')}>Cerrar</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className={`text-2xl font-bold font-headline pt-2 ${processedData.budgetBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {processedData.formatCurrency(processedData.budgetBalance)}
                        <p className="text-xs font-normal text-muted-foreground">
                            {processedData.budgetBalance >= 0 ? 'Restante del presupuesto' : 'Excedido del presupuesto'}
                        </p>
                    </div>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={processedData.budgetChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }} barCategoryGap="20%">
                            <XAxis type="number" hide />
                            <YAxis 
                                type="category" 
                                dataKey="name" 
                                tickLine={false} 
                                axisLine={false} 
                                width={100}
                                tick={<CustomizedYAxisTick />}
                            />
                            <Tooltip
                                cursor={{ fill: 'hsl(var(--secondary))' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="rounded-lg border bg-card p-2 shadow-sm text-sm">
                                            <p className="font-bold">{data.name}</p>
                                            <p>Gastado: {processedData.formatCurrency(data.Gastado)}</p>
                                            <p>Presupuestado: {processedData.formatCurrency(data.Presupuestado)}</p>
                                        </div>
                                    );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="Presupuestado" fill="hsl(var(--chart-3) / 0.2)" radius={[0, 8, 8, 0]} barSize={40}>
                                <LabelList 
                                    dataKey="Presupuestado" 
                                    position="insideLeft" 
                                    offset={15}
                                    style={{ fill: 'hsl(var(--foreground))' }}
                                    fontSize={13}
                                    fontWeight="600"
                                    formatter={(value: number) => processedData.formatCurrency(value)}
                                />
                            </Bar>
                            <Bar dataKey="Gastado" fill="hsl(var(--chart-3))" radius={[0, 8, 8, 0]} barSize={40}>
                                <LabelList
                                    dataKey="percentage"
                                    position="center"
                                    style={{ fill: 'white' }}
                                    fontSize={13}
                                    fontWeight="700"
                                    formatter={(value: number) => `${value}%`}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
                </Card>
            )}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle>Gastos Recientes</CardTitle>
                <CardDescription>Tus últimas transacciones registradas.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2">Entidad</TableHead>
                    <TableHead className="hidden sm:table-cell py-2">Categoría</TableHead>
                    <TableHead className="text-right py-2">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedData.recentExpenses.map((expense, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-3">
                          <div className="bg-muted p-2 rounded-md hidden sm:block">
                            <expense.icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="text-sm font-medium">{expense.entity}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm py-2">{expense.category}</TableCell>
                      <TableCell className="text-right font-mono text-sm py-2">
                        {processedData.formatCurrency(expense.amountConverted)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="lg:col-span-3 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                Recomendaciones IA
              </CardTitle>
              <CardDescription>Sugerencias para optimizar tus finanzas.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center p-4 border-2 border-dashed rounded-lg">
                    <p className="text-sm text-muted-foreground">
                        Notamos que tus gastos en <span className="text-foreground font-medium">"Vida y Entretenimiento"</span> superaron el presupuesto.
                    </p>
                    <p className="mt-2 font-medium text-foreground">
                        Considera reasignar <span className="text-primary">{processedData.formatCurrency(2500)}</span> de esta categoría a <span className="text-primary">"Ahorros"</span> el próximo mes.
                    </p>
                </div>
            </CardContent>
            <CardFooter>
                <Button variant="outline" className="w-full" asChild>
                    <Link href="/dashboard/insights">Ver más insights</Link>
                </Button>
            </CardFooter>
          </Card>
        </div>


    </div>
  );
}

function MemberDashboard({ tenantId }: { tenantId: string }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [expenseToDelete, setExpenseToDelete] = React.useState<string | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = React.useState('');
  
  // --- Data Fetching ---
  const expensesQuery = useMemo(() => {
      if (!firestore || !tenantId || !user) return null;
      return query(
          collection(firestore, 'expenses'), 
          where('tenantId', '==', tenantId), 
          where('deleted', '==', false),
          where('userId', '==', user.uid)
      );
  }, [firestore, tenantId, user]);
  const { data: expenses, isLoading: isLoadingExpenses, setData: setExpenses } = useCollection<Expense>(expensesQuery);

  const categoriesQuery = useMemo(() => {
      if (!firestore || !tenantId) return null;
      return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);

  const tableData = React.useMemo(() => {
      if (!expenses || !categories) return [];
      const categoryMap = new Map(categories.map(c => [c.id, c]));
      return expenses.map(expense => ({
          ...expense,
          category: categoryMap.get(expense.categoryId),
      }));
  }, [expenses, categories]);

  const handleOpenDeleteDialog = (expenseId: string) => {
    setExpenseToDelete(expenseId);
  };
  
  const resetDeleteDialog = () => {
    setExpenseToDelete(null);
    setDeleteConfirmationText('');
  }

  const handleDeleteExpense = async () => {
    if (!expenseToDelete || !firestore) return;

    const expenseRef = doc(firestore, 'expenses', expenseToDelete);
    const updatedData = { deleted: true, updatedAt: new Date().toISOString() };
    
    updateDoc(expenseRef, updatedData).then(() => {
        toast({ title: 'Gasto eliminado', description: 'El gasto ha sido marcado como eliminado.' });
        if (expenses && setExpenses) {
            setExpenses(expenses.filter(exp => exp.id !== expenseToDelete));
        }
        resetDeleteDialog();
    }).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: expenseRef.path, operation: 'update', requestResourceData: updatedData }));
        resetDeleteDialog();
    });
  };

  const columns = useMemo(() => expenseColumns(false).filter(c => c.id !== 'select' && c.id !== 'actions'), []);

  const isLoading = isLoadingExpenses || isLoadingCategories;

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
              <div>
                  <CardTitle>Mis Gastos</CardTitle>
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
              <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
          ) : (
              <ExpensesDataTable 
                columns={columns} 
                data={tableData}
                categories={categories || []}
                onDelete={handleOpenDeleteDialog}
              />
          )}
        </CardContent>
      </Card>
      <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => !open && resetDeleteDialog()}>
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
    </div>
  )
}

export default function DashboardPageContainer() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'owner' | 'member' | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);

  // 1. Get user's tenantId
  const userDocRef = useMemo(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userData } = useDoc<UserType>(userDocRef);

  useEffect(() => {
    if (userData?.tenantIds?.[0]) {
      setTenantId(userData.tenantIds[0]);
    }
  }, [userData]);

  // 2. Get user's membership to determine role
  const membershipDocRef = useMemo(() => {
    if (!tenantId || !user) return null;
    return doc(firestore, 'memberships', `${tenantId}_${user.uid}`);
  }, [tenantId, user]);
  const { data: membershipData, isLoading: isLoadingMembership } = useDoc<Membership>(membershipDocRef);

  useEffect(() => {
    if (!isLoadingMembership) {
      if (membershipData?.role) {
        setUserRole(membershipData.role as 'owner' | 'member');
      }
      setIsLoadingRole(false);
    }
  }, [membershipData, isLoadingMembership]);


  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      toast({
        title: 'Sesión cerrada',
        description: 'Has cerrado sesión correctamente.',
      });
      router.push('/login');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cerrar la sesión. Inténtalo de nuevo.',
      });
    }
  };

  if (isUserLoading || isLoadingRole) {
    return (
      <div className="flex h-screen items-center justify-center">
        <AhorroYaLogo className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }
  
  return (
    <div className="flex min-h-screen flex-col">
       <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex h-16 items-center">
          <div  className="mr-6 flex items-center space-x-2">
            <AhorroYaLogo className="h-6 w-6 text-primary" />
            <span className="font-bold font-headline text-foreground">Ahorro Ya</span>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
             <Button onClick={handleLogout} variant="ghost">Cerrar Sesión</Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {userRole === 'owner' && tenantId && <OwnerDashboard tenantId={tenantId} />}
        {userRole === 'member' && tenantId && <MemberDashboard tenantId={tenantId} />}
      </main>
    </div>
  );
}
