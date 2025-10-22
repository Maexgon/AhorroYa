
'use client';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { AhorroYaLogo } from '@/components/shared/icons';
import { Button } from '@/components/ui/button';
import { getAuth, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, writeBatch, getDocs, doc, deleteDoc, updateDoc, orderBy } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { WithId } from '@/firebase/firestore/use-collection';
import type { Tenant, License, Membership, Category, User as UserType, Expense, Budget, Income, Subcategory } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, UserPlus, FileText, Repeat, XCircle, Plus, Calendar as CalendarIcon, Utensils, ShoppingCart, Bus, Film, Home, Sparkles, Loader2, Settings, ArrowLeft, Banknote, GripVertical, User as UserIcon, LogOut, ShieldAlert, View, FileBarChart, Info } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, subQuarters, endOfQuarter, subYears, startOfSemester, endOfSemester, isAfter, endOfToday, differenceInDays, eachMonthOfInterval, lastDayOfMonth, addMonths, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, ResponsiveContainer, Cell, LabelList, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Line, ComposedChart, Area, PieChart, Pie } from 'recharts';
import { defaultCategories } from '@/lib/default-categories';
import Link from 'next/link';
import { useDoc } from '@/firebase/firestore/use-doc';
import { DropdownCat } from '@/components/ui/dropdowncat';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as XLSX from 'xlsx';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useSessionTimeout } from '@/hooks/use-session-timeout';
import { TooltipProvider, Tooltip as TooltipPrimitive, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';


const SAFE_DEFAULTS = {
    barData: [],
    recentExpenses: [],
    budgetChartData: [],
    totalExpenses: 0,
    totalExpensesUSD: 0,
    budgetBalance: 0,
    formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
    formatCurrencyUSD: (amount: number) => `$${amount.toFixed(2)}`,
    toCurrencyCode: 'ARS',
    periodData: [],
    cumulativeChartData: [],
    isOwner: false,
    installmentsChartData: {
      totalPending: 0,
      monthlyTotals: [],
    },
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


function AdminOrOwnerDashboard({ tenantId, licenseStatus, userRole }: { tenantId: string, licenseStatus: 'active' | 'grace_period' | 'expired' | 'loading', userRole: 'owner' | 'admin' }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSeeding, setIsSeeding] = useState(false);
  const [date, setDate] = React.useState<DateRange | undefined>(undefined);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  
  const [dashboardLayout, setDashboardLayout] = useState([
    { id: 'budgetDistribution', name: 'Distribución de Presupuestos', visible: true },
    { id: 'pendingInstallments', name: 'Cuotas Pendientes', visible: true },
    { id: 'monthlyFlow', name: 'Flujo de Caja Mensual', visible: true },
    { id: 'cumulativeBalance', name: 'Balance Acumulado', visible: true },
    { id: 'expenseAnalysis', name: 'Análisis de Gastos', visible: true },
    { id: 'budgets', name: 'Presupuestos', visible: true },
  ]);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const newLayout = [...dashboardLayout];
    const draggedItemContent = newLayout.splice(dragItem.current, 1)[0];
    newLayout.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setDashboardLayout(newLayout);
  };

  useEffect(() => {
    // Set initial date range on client side to avoid hydration error
    setDate({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    });
  }, []);


  const toggleChartVisibility = (chartId: string) => {
    setDashboardLayout(prevLayout =>
      prevLayout.map(chart =>
        chart.id === chartId ? { ...chart, visible: !chart.visible } : chart
      )
    );
  };
  
  // --- Data Fetching ---
  const tenantRef = useMemoFirebase(() => (tenantId ? doc(firestore, 'tenants', tenantId) : null), [firestore, tenantId]);
  const { data: activeTenant, isLoading: isLoadingTenant } = useDoc<Tenant>(tenantRef);
  
  const categoriesQuery = useMemoFirebase(() => (tenantId ? query(collection(firestore, 'categories'), where('tenantId', '==', tenantId)) : null), [firestore, tenantId]);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<WithId<Category>>(categoriesQuery);

  const subcategoriesQuery = useMemoFirebase(() => (tenantId ? query(collection(firestore, 'subcategories'), where('tenantId', '==', tenantId)) : null), [firestore, tenantId]);
  const { data: allSubcategories, isLoading: isLoadingSubcategories } = useCollection<WithId<Subcategory>>(subcategoriesQuery);
  
  const expensesQuery = useMemoFirebase(() => (tenantId ? query(collection(firestore, 'expenses'), where('tenantId', '==', tenantId), where('deleted', '==', false)) : null), [firestore, tenantId]);
  const { data: allExpenses, isLoading: isLoadingExpenses } = useCollection<WithId<Expense>>(expensesQuery);

  const incomesQuery = useMemoFirebase(() => (tenantId ? query(collection(firestore, 'incomes'), where('tenantId', '==', tenantId), where('deleted', '==', false)) : null), [firestore, tenantId]);
  const { data: allIncomes, isLoading: isLoadingIncomes } = useCollection<WithId<Income>>(incomesQuery);

  const budgetsQuery = useMemoFirebase(() => (tenantId ? query(collection(firestore, 'budgets'), where('tenantId', '==', tenantId)) : null), [firestore, tenantId]);
  const { data: allBudgets, isLoading: isLoadingBudgets } = useCollection<WithId<Budget>>(budgetsQuery);
  
  const isLoading = isLoadingTenant || isLoadingCategories || isLoadingExpenses || isLoadingBudgets || isLoadingIncomes || isLoadingSubcategories;
  
 const processedData = useMemo(() => {
    if (isLoading || !categories || !allExpenses || !allBudgets || !allIncomes || !activeTenant || !user || !allSubcategories || !date?.from) {
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
    
     const finalFormatCurrencyUSD = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    const fromDateFilter = date.from ? startOfMonth(date.from) : startOfYear(new Date());
    const toDateFilter = date.to ? endOfMonth(date.to) : endOfYear(new Date());
    
    const periodFilteredExpenses = allExpenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        const categoryMatch = selectedCategoryId === 'all' || expense.categoryId === selectedCategoryId;
        return expenseDate >= fromDateFilter && expenseDate <= toDateFilter && categoryMatch;
    });

    const periodFilteredIncomes = allIncomes.filter(income => {
        const incomeDate = new Date(income.date);
        return incomeDate >= fromDateFilter && incomeDate <= toDateFilter;
    });
    
    const totalExpenses = periodFilteredExpenses.reduce((acc, expense) => acc + expense.amountARS, 0);
    const totalExpensesUSD = periodFilteredExpenses.reduce((acc, expense) => acc + (expense.amountUSD || 0), 0);

    const periodFilteredBudgets = allBudgets.filter(b => {
        const budgetDate = new Date(b.year, b.month - 1);
        const isInDateRange = budgetDate >= startOfMonth(fromDateFilter) && budgetDate <= endOfMonth(toDateFilter);
        const categoryMatch = selectedCategoryId === 'all' || b.categoryId === selectedCategoryId;
        return isInDateRange && categoryMatch;
    });

    const totalBudgetForPeriod = periodFilteredBudgets.reduce((acc, budget) => acc + budget.amountARS, 0);

    const budgetBalance = totalBudgetForPeriod - totalExpenses;

    const barData = Object.entries(periodFilteredExpenses.reduce((acc, expense) => {
        const categoryName = categories.find(c => c.id === expense.categoryId)?.name || 'Sin Categoría';
        if (!acc[categoryName]) acc[categoryName] = 0;
        acc[categoryName] += expense.amountARS;
        return acc;
    }, {} as Record<string, number>))
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);


    const expenseIcons: { [key: string]: React.ElementType } = {
        default: Sparkles, 'Comestibles': Utensils, 'Ropa y Accesorios': ShoppingCart, 'Mobilidad': Bus, 'Vida y Entretenimiento': Film, 'Vivienda': Home,
    };

    const recentExpenses = allExpenses
        .filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= fromDateFilter && expenseDate <= toDateFilter;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)
        .map(expense => {
            const categoryName = categories.find(c => c.id === expense.categoryId)?.name || 'Sin Categoría';
            return {
                ...expense, icon: expenseIcons[categoryName] || expenseIcons.default, entity: expense.entityName || 'N/A', category: categoryName, amountConverted: expense.amountARS,
            }
        });

    const budgetChartData = (() => {
        const groupedData = periodFilteredBudgets.reduce((acc, budget) => {
            const category = categories.find(c => c.id === budget.categoryId);
            const categoryName = category?.name || 'N/A';
            const categoryColor = category?.color || '#888888';
            if (!acc[categoryName]) {
                acc[categoryName] = { name: categoryName, color: categoryColor, Presupuestado: 0, Gastado: 0 };
            }
            acc[categoryName].Presupuestado += budget.amountARS;
            return acc;
        }, {} as Record<string, { name: string; color: string; Presupuestado: number; Gastado: number }>);
        
        return Object.values(groupedData)
            .map(group => {
                const categoryId = categories.find(c => c.name === group.name)?.id;
                const spentInARS = periodFilteredExpenses
                    .filter(e => e.categoryId === categoryId)
                    .reduce((acc, e) => acc + e.amountARS, 0);
                group.Gastado = spentInARS;
                return group;
            })
            .map(group => ({
                ...group,
                percentage: group.Presupuestado > 0 ? (group.Gastado / group.Presupuestado) * 100 : 0,
            }));
    })();
    
    const isMonthlyView = date.from && date.to && differenceInDays(date.to, date.from) <= 31;
    const interval = isMonthlyView
        ? eachDayOfInterval({ start: fromDateFilter, end: toDateFilter })
        : eachMonthOfInterval({ start: fromDateFilter, end: toDateFilter });

    const periodData = interval.map(dateItem => {
        const key = isMonthlyView ? format(dateItem, 'yyyy-MM-dd') : format(dateItem, 'yyyy-MM');
        const label = isMonthlyView ? format(dateItem, 'dd MMM', { locale: es }) : format(dateItem, 'MMM yy', { locale: es });

        const expensesForPeriod = periodFilteredExpenses.filter(e => {
            const d = new Date(e.date);
            return isMonthlyView ? format(d, 'yyyy-MM-dd') === key : (d.getMonth() === dateItem.getMonth() && d.getFullYear() === dateItem.getFullYear());
        }).reduce((sum, e) => sum + e.amountARS, 0);
          
        const incomesForPeriod = periodFilteredIncomes.filter(inc => {
            const d = new Date(inc.date);
            return isMonthlyView ? format(d, 'yyyy-MM-dd') === key : (d.getMonth() === dateItem.getMonth() && d.getFullYear() === dateItem.getFullYear());
        }).reduce((sum, inc) => sum + inc.amountARS, 0);

        return {
          label: label,
          ingresos: incomesForPeriod,
          gastos: expensesForPeriod,
        };
    });
    

    let cumulativeIncomes = 0;
    let cumulativeExpenses = 0;
    const cumulativeChartData = periodData.map(data => {
        cumulativeIncomes += data.ingresos;
        cumulativeExpenses += data.gastos;
        return {
            ...data,
            ingresosAcumulados: cumulativeIncomes,
            gastosAcumulados: cumulativeExpenses,
        };
    });
    
    const installmentsFilteredExpenses = (selectedCategoryId === 'all' ? allExpenses : allExpenses.filter(e => e.categoryId === selectedCategoryId));
    const installmentsChartData = (() => {
        const allPendingInstallments = installmentsFilteredExpenses
            .filter(e => e.paymentMethod === 'credit' && isAfter(new Date(e.date), endOfToday()));

        const today = new Date();
        const sixMonthsFromNow = addMonths(today, 5); // 1 (current) + 5 = 6 months
        const monthInterval = eachMonthOfInterval({ start: today, end: sixMonthsFromNow });

        const monthlyTotalsMap = new Map<string, number>();
        monthInterval.forEach(month => {
            const monthKey = format(month, 'yyyy-MM');
            monthlyTotalsMap.set(monthKey, 0);
        });

        allPendingInstallments.forEach(expense => {
            const monthKey = format(new Date(expense.date), 'yyyy-MM');
            if (monthlyTotalsMap.has(monthKey)) {
                monthlyTotalsMap.set(monthKey, monthlyTotalsMap.get(monthKey)! + expense.amountARS);
            }
        });

        const sortedMonthlyTotals = Array.from(monthlyTotalsMap.entries())
            .map(([key, total]) => ({
                name: format(new Date(`${key}-02`), 'MMM yy', { locale: es }), // Use day 02 to avoid TZ issues
                total,
            }));
        
        const totalPending = allPendingInstallments.reduce((sum, e) => sum + e.amountARS, 0);

        return { totalPending, monthlyTotals: sortedMonthlyTotals };
    })();

    return { 
        barData, 
        recentExpenses, 
        budgetChartData, 
        totalExpenses, 
        totalExpensesUSD,
        budgetBalance, 
        formatCurrency: finalFormatCurrency,
        formatCurrencyUSD: finalFormatCurrencyUSD,
        toCurrencyCode: 'ARS', 
        periodData,
        cumulativeChartData,
        isOwner: userRole === 'owner',
        installmentsChartData
    };
  }, [isLoading, allExpenses, allBudgets, categories, date, selectedCategoryId, allIncomes, activeTenant, user, allSubcategories, userRole]);
  
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
        case 'nextMonth':
            const nextMonth = addMonths(now, 1);
            setDate({ from: startOfMonth(nextMonth), to: endOfMonth(nextMonth) });
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

  const renderChart = (chartId: string) => {
    switch (chartId) {
        case 'budgetDistribution':
            return (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Distribución de Presupuestos</CardTitle>
                            <CardDescription>
                                Cómo se divide tu presupuesto total.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <TooltipPrimitive>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.preventDefault()}>
                                <Info className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Este gráfico muestra la proporción de cada categoría en tu presupuesto total para el período seleccionado.</p>
                            </TooltipContent>
                          </TooltipPrimitive>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleExport(processedData.budgetChartData.map(d => ({ Categoría: d.name, Presupuestado: d.Presupuestado })), "distribucion_presupuesto")}>Exportar a Excel</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleChartVisibility('budgetDistribution')}>Cerrar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                    </CardHeader>
                    <CardContent>
                       <ResponsiveContainer width="100%" height={200}>
                           <PieChart>
                                <Pie
                                    data={processedData.budgetChartData}
                                    cx="40%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                        const RADIAN = Math.PI / 180;
                                        if (typeof innerRadius !== 'number' || typeof outerRadius !== 'number' || typeof cx !== 'number' || typeof cy !== 'number' || typeof midAngle !== 'number' || typeof percent !== 'number') {
                                            return null;
                                        }
                                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                        const y = cy + radius * Math.sin(-midAngle * RADIAN);

                                        return (
                                            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
                                                {`${(percent * 100).toFixed(0)}%`}
                                            </text>
                                        );
                                    }}
                                    outerRadius={80}
                                    innerRadius={40}
                                    paddingAngle={2}
                                    fill="#8884d8"
                                    dataKey="Presupuestado"
                                    nameKey="name"
                                >
                                    {processedData.budgetChartData.map((entry) => (
                                        <Cell key={`cell-${entry.name}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <TooltipPrimitive
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="rounded-lg border bg-card p-2 shadow-sm text-sm">
                                                    <p className="font-bold">{payload[0].name}</p>
                                                    <p>Presupuestado: {processedData.formatCurrency(payload[0].value as number)}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend 
                                    layout="vertical" 
                                    verticalAlign="middle" 
                                    align="right" 
                                    wrapperStyle={{ fontSize: '10px', lineHeight: '16px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            );
        case 'pendingInstallments':
            return (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Cuotas Pendientes de Tarjeta</CardTitle>
                            <CardDescription>
                                Total pendiente de pago: <span className="font-bold text-primary">{processedData.formatCurrency(processedData.installmentsChartData.totalPending)}</span>
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                           <TooltipPrimitive>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.preventDefault()}>
                                <Info className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Muestra el total de cuotas futuras de tus compras con tarjeta de crédito, agrupadas por mes.</p>
                            </TooltipContent>
                          </TooltipPrimitive>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleExport(processedData.installmentsChartData.monthlyTotals, "cuotas_pendientes")}>Exportar a Excel</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleChartVisibility('pendingInstallments')}>Cerrar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={processedData.installmentsChartData.monthlyTotals}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} />
                                <YAxis stroke="hsl(var(--foreground))" fontSize={12} tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="rounded-lg border bg-card p-2 shadow-sm text-sm">
                                                    <p className="font-bold">{label}</p>
                                                    <p style={{ color: 'hsl(var(--chart-2))' }}>Total: {processedData.formatCurrency(payload[0].value as number)}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="total" name="Total" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]}>
                                    <LabelList
                                        dataKey="total"
                                        position="top"
                                        offset={8}
                                        className="fill-foreground"
                                        fontSize={12}
                                        formatter={(value: number) => processedData.formatCurrency(value)}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            );
        case 'monthlyFlow':
             return (
                <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Resumen de Flujo de Caja</CardTitle>
                        <CardDescription>Ingresos vs. Gastos del período.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                       <TooltipPrimitive>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.preventDefault()}>
                            <Info className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Compara el total de tus ingresos y gastos para cada mes o día en el período seleccionado.</p>
                        </TooltipContent>
                      </TooltipPrimitive>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExport(processedData.periodData, "flujo_de_caja_mensual")}>Exportar a Excel</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleChartVisibility('monthlyFlow')}>Cerrar</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={processedData.periodData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" stroke="hsl(var(--foreground))" fontSize={12} />
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
            );
        case 'cumulativeBalance':
            return (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Balance Acumulado</CardTitle>
                            <CardDescription>Evolución de ingresos y gastos acumulados en el período.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                           <TooltipPrimitive>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.preventDefault()}>
                                <Info className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Muestra cómo tu balance (ingresos menos gastos) ha evolucionado a lo largo del tiempo seleccionado.</p>
                            </TooltipContent>
                          </TooltipPrimitive>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleExport(processedData.cumulativeChartData, "balance_acumulado")}>Exportar a Excel</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleChartVisibility('cumulativeBalance')}>Cerrar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <ComposedChart data={processedData.cumulativeChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" stroke="hsl(var(--foreground))" fontSize={12} />
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
            );
        case 'expenseAnalysis':
             return (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Análisis de Gastos</CardTitle>
                            <CardDescription>
                                <p>Resumen por categoría del período seleccionado.</p>
                                <p className="font-medium text-foreground">
                                    Total Gastado (ARS): <span className="font-bold text-destructive">{processedData.formatCurrency(processedData.totalExpenses)}</span>
                                </p>
                                {processedData.totalExpensesUSD > 0 && (
                                    <p className="font-medium text-foreground">
                                        Total Gastado (USD): <span className="font-bold text-destructive">{processedData.formatCurrencyUSD(processedData.totalExpensesUSD)}</span>
                                    </p>
                                )}
                            </CardDescription>
                        </div>
                         <div className="flex items-center gap-2">
                           <TooltipPrimitive>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.preventDefault()}>
                                <Info className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Compara el total gastado en cada categoría. Las categorías se ordenan de mayor a menor gasto.</p>
                            </TooltipContent>
                          </TooltipPrimitive>
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
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={processedData.barData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" stroke="hsl(var(--foreground))" fontSize={12} tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                                <YAxis type="category" dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} width={120} tick={<CustomizedYAxisTick />}/>
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="rounded-lg border bg-card p-2 shadow-sm text-sm">
                                                    <p className="font-bold">{label}</p>
                                                    <p>Total: {processedData.formatCurrency(payload[0].value as number)}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                                    <LabelList
                                        dataKey="total"
                                        position="right"
                                        offset={8}
                                        className="fill-foreground"
                                        fontSize={12}
                                        formatter={(value: number) => processedData.formatCurrency(value)}
                                    />
                                {processedData.barData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={categories.find(c => c.name === entry.name)?.color || '#888888'} />
                                ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            );
        case 'budgets':
            return (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Presupuestos</CardTitle>
                            <CardDescription>Tu progreso de gastos del mes.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <TooltipPrimitive>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.preventDefault()}>
                                        <Info className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Compara tus gastos reales con el presupuesto asignado para cada categoría.</p>
                                </TooltipContent>
                            </TooltipPrimitive>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleExport(processedData.budgetChartData.map(d => ({ Categoría: d.name, Presupuestado: d.Presupuestado, Gastado: d.Gastado })), "presupuestos")}>Exportar a Excel</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toggleChartVisibility('budgets')}>Cerrar</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {processedData.budgetChartData.map((budget) => {
                            const percentage = budget.percentage > 100 ? 100 : budget.percentage;
                            return (
                                <div key={budget.name}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium">{budget.name}</span>
                                        <span className="text-muted-foreground font-mono">
                                            {processedData.formatCurrency(budget.Gastado)} / {processedData.formatCurrency(budget.Presupuestado)}
                                        </span>
                                    </div>
                                    <Progress value={percentage} className="h-2" indicatorClassName={budget.percentage > 100 ? "bg-destructive" : ""} />
                                </div>
                            )
                        })}
                    </CardContent>
                </Card>
            );
        default:
            return null;
    }
  }


  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const showSeedButton = !isLoadingCategories && (!categories || categories.length === 0) && !!activeTenant;
  
  if (licenseStatus !== 'active') {
    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
            <Card className="border-destructive">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit">
                        <ShieldAlert className="h-10 w-10 text-destructive" />
                    </div>
                    <CardTitle className="text-destructive mt-4">Tu Licencia ha Expirado</CardTitle>
                    <CardDescription>
                        El acceso completo a tu dashboard está restringido. Por favor, renueva tu licencia para continuar.
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-center">
                    <Button asChild>
                        <Link href="/dashboard/settings">
                            Administrar Licencia
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        
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
            <TooltipPrimitive>
              <TooltipTrigger asChild>
                <Button asChild>
                    <Link href="/dashboard/budget">
                        <Plus className="mr-2 h-4 w-4" /> Crear Presupuesto
                    </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Define límites de gasto mensuales por categoría.</p>
              </TooltipContent>
            </TooltipPrimitive>
             <TooltipPrimitive>
              <TooltipTrigger asChild>
                <Button asChild>
                    <Link href="/dashboard/expenses">
                        <Plus className="mr-2 h-4 w-4" /> Crear Gasto
                    </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Registra una nueva transacción o gasto.</p>
              </TooltipContent>
            </TooltipPrimitive>
            <TooltipPrimitive>
                <TooltipTrigger asChild>
                    <Button asChild>
                        <Link href="/dashboard/income">
                            <Plus className="mr-2 h-4 w-4" /> Crear Ingreso
                        </Link>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Registra cualquier ingreso de dinero.</p>
                </TooltipContent>
            </TooltipPrimitive>
             {userRole === 'owner' && (
                <>
                <TooltipPrimitive>
                    <TooltipTrigger asChild>
                        <Button asChild>
                            <Link href="/dashboard/reports">
                                <FileBarChart className="mr-2 h-4 w-4" /> Reportes Manuales
                            </Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Genera reportes personalizados con filtros avanzados.</p>
                    </TooltipContent>
                </TooltipPrimitive>
                <TooltipPrimitive>
                    <TooltipTrigger asChild>
                        <Button asChild>
                            <Link href="/dashboard/insights">
                                <Sparkles className="mr-2 h-4 w-4" /> Análisis con IA
                            </Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Obtén análisis y recomendaciones automáticas de tus finanzas.</p>
                    </TooltipContent>
                </TooltipPrimitive>
                </>
            )}
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
                            <Button variant="ghost" className="justify-start" onClick={() => setDateRange('nextMonth')}>Mes Siguiente</Button>
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

                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" className="w-full md:w-auto">
                            <Settings className="mr-2 h-4 w-4" />
                            Diseño Dashboard
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Diseño del Dashboard</DialogTitle>
                            <DialogDescription>
                                Selecciona los gráficos que quieres ver y cambia su orden arrastrando y soltando.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-2">
                            {dashboardLayout.map((chart, index) => (
                                <div 
                                    key={chart.id} 
                                    className={cn("flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors",
                                        dragOverItem.current === index && "bg-accent"
                                    )}
                                    draggable
                                    onDragStart={() => dragItem.current = index}
                                    onDragEnter={() => dragOverItem.current = index}
                                    onDragEnd={handleDragSort}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <div className="flex items-center gap-3">
                                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                                        <Label htmlFor={chart.id} className="font-medium cursor-grab">{chart.name}</Label>
                                    </div>
                                    <Checkbox
                                        id={chart.id}
                                        checked={chart.visible}
                                        onCheckedChange={() => toggleChartVisibility(chart.id)}
                                    />
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>

            </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
            {dashboardLayout.map(chart => chart.visible && (
                <div key={chart.id}>
                    {renderChart(chart.id)}
                </div>
            ))}
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
          {userRole === 'owner' && (
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
          )}
        </div>


    </div>
  );
}

function MemberDashboard({ tenantId, licenseStatus }: { tenantId: string, licenseStatus: 'active' | 'grace_period' | 'expired' | 'loading' }) {
  const { user } = useUser();
  const firestore = useFirestore();

  const [date, setDate] = React.useState<DateRange | undefined>(undefined);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  useEffect(() => {
    // Set initial date range on client side to avoid hydration error
    setDate({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    });
  }, []);
  
  const expensesQuery = useMemoFirebase(() => (tenantId ? query(collection(firestore, 'expenses'), where('tenantId', '==', tenantId), where('deleted', '==', false), where('userId', '==', user?.uid)) : null), [firestore, tenantId, user]);
  const { data: allExpenses, isLoading: isLoadingExpenses } = useCollection<WithId<Expense>>(expensesQuery);
  
  const incomesQuery = useMemoFirebase(() => (tenantId ? query(collection(firestore, 'incomes'), where('tenantId', '==', tenantId), where('deleted', '==', false), where('userId', '==', user?.uid)) : null), [firestore, tenantId, user]);
  const { data: allIncomes, isLoading: isLoadingIncomes } = useCollection<WithId<Income>>(incomesQuery);
  
  const budgetsQuery = useMemoFirebase(() => (tenantId ? query(collection(firestore, 'budgets'), where('tenantId', '==', tenantId)) : null), [firestore, tenantId]);
  const { data: allBudgets, isLoading: isLoadingBudgets } = useCollection<WithId<Budget>>(budgetsQuery);

  const categoriesQuery = useMemoFirebase(() => (tenantId ? query(collection(firestore, 'categories'), where('tenantId', '==', tenantId)) : null), [firestore, tenantId]);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<WithId<Category>>(categoriesQuery);

  const isLoading = isLoadingExpenses || isLoadingIncomes || isLoadingBudgets || isLoadingCategories;

  const processedData = useMemo(() => {
    if (isLoading || !categories || !allExpenses || !allBudgets || !allIncomes || !user || !date?.from) {
      return SAFE_DEFAULTS;
    }

    const finalFormatCurrency = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    const finalFormatCurrencyUSD = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    
    const fromDateFilter = date.from ? startOfMonth(date.from) : startOfYear(new Date());
    const toDateFilter = date.to ? endOfMonth(date.to) : endOfYear(new Date());

    const periodFilteredExpenses = allExpenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        const categoryMatch = selectedCategoryId === 'all' || expense.categoryId === selectedCategoryId;
        return expenseDate >= fromDateFilter && expenseDate <= toDateFilter && categoryMatch;
    });
    
     const periodFilteredIncomes = allIncomes.filter(income => {
        const incomeDate = new Date(income.date);
        return incomeDate >= fromDateFilter && incomeDate <= toDateFilter;
    });

    const periodFilteredBudgets = allBudgets.filter(b => {
        const budgetDate = new Date(b.year, b.month - 1);
        const categoryMatch = selectedCategoryId === 'all' || b.categoryId === selectedCategoryId;
        return budgetDate >= startOfMonth(fromDateFilter) && budgetDate <= endOfMonth(toDateFilter) && categoryMatch;
    });

    const totalExpenses = periodFilteredExpenses.reduce((acc, expense) => acc + expense.amountARS, 0);
    const totalExpensesUSD = periodFilteredExpenses.reduce((acc, expense) => acc + (expense.amountUSD || 0), 0);

    const barData = Object.entries(periodFilteredExpenses.reduce((acc, expense) => {
        const categoryName = categories.find(c => c.id === expense.categoryId)?.name || 'Sin Categoría';
        if (!acc[categoryName]) acc[categoryName] = 0;
        acc[categoryName] += expense.amountARS;
        return acc;
    }, {} as Record<string, number>))
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

    const isMonthlyView = date.from && date.to && differenceInDays(date.to, date.from) <= 31;
    const interval = isMonthlyView
        ? eachDayOfInterval({ start: fromDateFilter, end: toDateFilter })
        : eachMonthOfInterval({ start: fromDateFilter, end: toDateFilter });

    const periodData = interval.map(dateItem => {
        const key = isMonthlyView ? format(dateItem, 'yyyy-MM-dd') : format(dateItem, 'yyyy-MM');
        const label = isMonthlyView ? format(dateItem, 'dd MMM', { locale: es }) : format(dateItem, 'MMM yy', { locale: es });

        const expensesForPeriod = periodFilteredExpenses.filter(e => {
            const d = new Date(e.date);
            return isMonthlyView ? format(d, 'yyyy-MM-dd') === key : (d.getMonth() === dateItem.getMonth() && d.getFullYear() === dateItem.getFullYear());
        }).reduce((sum, e) => sum + e.amountARS, 0);
          
        const incomesForPeriod = periodFilteredIncomes.filter(inc => {
            const d = new Date(inc.date);
            return isMonthlyView ? format(d, 'yyyy-MM-dd') === key : (d.getMonth() === dateItem.getMonth() && d.getFullYear() === dateItem.getFullYear());
        }).reduce((sum, inc) => sum + inc.amountARS, 0);

        return {
          label: label,
          ingresos: incomesForPeriod,
          gastos: expensesForPeriod,
        };
    });
    
    const budgetChartData = (() => {
        const groupedData = periodFilteredBudgets.reduce((acc, budget) => {
            const category = categories.find(c => c.id === budget.categoryId);
            const categoryName = category?.name || 'N/A';
            const categoryColor = category?.color || '#888888';
            if (!acc[categoryName]) {
                acc[categoryName] = { name: categoryName, color: categoryColor, Presupuestado: 0, Gastado: 0 };
            }
            acc[categoryName].Presupuestado += budget.amountARS;
            return acc;
        }, {} as Record<string, { name: string; color: string; Presupuestado: number; Gastado: number }>);
        
        return Object.values(groupedData)
            .map(group => {
                const categoryId = categories.find(c => c.name === group.name)?.id;
                const spentInARS = periodFilteredExpenses
                    .filter(e => e.categoryId === categoryId)
                    .reduce((acc, e) => acc + e.amountARS, 0);
                group.Gastado = spentInARS;
                return group;
            })
            .map(group => ({
                ...group,
                percentage: group.Presupuestado > 0 ? (group.Gastado / group.Presupuestado) * 100 : 0,
            }));
    })();


    let cumulativeIncomes = 0;
    let cumulativeExpenses = 0;
    const cumulativeChartData = periodData.map(data => {
        cumulativeIncomes += data.ingresos;
        cumulativeExpenses += data.gastos;
        return {
            ...data,
            ingresosAcumulados: cumulativeIncomes,
            gastosAcumulados: cumulativeExpenses,
        };
    });
    
    const installmentsChartData = (() => {
      const allPendingInstallments = allExpenses
        .filter(e => e.paymentMethod === 'credit' && isAfter(new Date(e.date), endOfToday()));

      const today = new Date();
      const sixMonthsFromNow = addMonths(today, 5);
      const monthInterval = eachMonthOfInterval({ start: today, end: sixMonthsFromNow });

      const monthlyTotalsMap = new Map<string, number>();
      monthInterval.forEach(month => {
        const monthKey = format(month, 'yyyy-MM');
        monthlyTotalsMap.set(monthKey, 0);
      });

      allPendingInstallments.forEach(expense => {
        const monthKey = format(new Date(expense.date), 'yyyy-MM');
        if (monthlyTotalsMap.has(monthKey)) {
          monthlyTotalsMap.set(monthKey, monthlyTotalsMap.get(monthKey)! + expense.amountARS);
        }
      });

      const sortedMonthlyTotals = Array.from(monthlyTotalsMap.entries())
        .map(([key, total]) => ({
          name: format(new Date(`${key}-02`), 'MMM yy', { locale: es }),
          total,
        }));
      
      const totalPending = allPendingInstallments.reduce((sum, e) => sum + e.amountARS, 0);

      return { totalPending, monthlyTotals: sortedMonthlyTotals };
    })();
    
    return { barData, totalExpenses, totalExpensesUSD, formatCurrency: finalFormatCurrency, formatCurrencyUSD: finalFormatCurrencyUSD, periodData, cumulativeChartData: cumulativeChartData, installmentsChartData, budgetChartData };
  }, [isLoading, allExpenses, allIncomes, allBudgets, categories, date, user, selectedCategoryId]);
  
  const categoryOptions = useMemo(() => {
    if (!categories) return [];
    const options = categories.map(c => ({ label: c.name, value: c.id }));
    return [{ label: 'Todas las categorías', value: 'all' }, ...options];
  }, [categories]);

  const setDateRange = (preset: string) => {
    const now = new Date();
    switch (preset) {
        case 'currentMonth':
            setDate({ from: startOfMonth(now), to: endOfMonth(now) });
            break;
        case 'nextMonth':
            const nextMonth = addMonths(now, 1);
            setDate({ from: startOfMonth(nextMonth), to: endOfMonth(nextMonth) });
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

  if (licenseStatus !== 'active') {
    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
            <Card className="border-destructive">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit">
                        <ShieldAlert className="h-10 w-10 text-destructive" />
                    </div>
                    <CardTitle className="text-destructive mt-4">La Licencia del Grupo ha Expirado</CardTitle>
                    <CardDescription>
                       El acceso está restringido. Por favor, contacta al propietario de la cuenta para que renueve la licencia.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    )
  }

  if (isLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <CurrencyRates />
      <div className="flex flex-wrap gap-2">
          <Button asChild>
              <Link href="/dashboard/expenses/new">
                  <Plus className="mr-2 h-4 w-4" /> Crear Gasto
              </Link>
          </Button>
           <Button asChild>
              <Link href="/dashboard/income/new">
                  <Plus className="mr-2 h-4 w-4" /> Crear Ingreso
              </Link>
          </Button>
      </div>

       <div className="bg-card shadow rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <Button variant="ghost" className="justify-start" onClick={() => setDateRange('nextMonth')}>Mes Siguiente</Button>
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
                 <DropdownCat
                    options={categoryOptions}
                    value={selectedCategoryId}
                    onSelect={(value) => setSelectedCategoryId(value === 'all' ? 'all' : value)}
                    placeholder="Seleccionar categoría"
                    searchPlaceholder="Buscar categoría..."
                    emptyPlaceholder="No se encontró la categoría."
                />
            </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
             <Card>
                <CardHeader>
                    <CardTitle>Distribución de Presupuestos</CardTitle>
                    <CardDescription>
                        Cómo se divide tu presupuesto total.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie
                                data={processedData.budgetChartData}
                                cx="40%"
                                cy="50%"
                                labelLine={false}
                                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                    const RADIAN = Math.PI / 180;
                                    if (typeof innerRadius !== 'number' || typeof outerRadius !== 'number' || typeof cx !== 'number' || typeof cy !== 'number' || typeof midAngle !== 'number' || typeof percent !== 'number') return null;
                                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">{`${(percent * 100).toFixed(0)}%`}</text>;
                                }}
                                outerRadius={80}
                                innerRadius={40}
                                paddingAngle={2}
                                fill="#8884d8"
                                dataKey="Presupuestado"
                                nameKey="name"
                            >
                                {processedData.budgetChartData.map((entry) => <Cell key={`cell-${entry.name}`} fill={entry.color} />)}
                            </Pie>
                            <Tooltip content={({ active, payload }) => active && payload && payload.length ? <div className="rounded-lg border bg-card p-2 shadow-sm text-sm"><p className="font-bold">{payload[0].name}</p><p>Presupuestado: {processedData.formatCurrency(payload[0].value as number)}</p></div> : null} />
                            <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px', lineHeight: '20px' }}/>
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Presupuestos</CardTitle>
                    <CardDescription>Tu progreso de gastos del mes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {processedData.budgetChartData.map((budget) => {
                        const percentage = budget.percentage > 100 ? 100 : budget.percentage;
                        return (
                            <div key={budget.name}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium">{budget.name}</span>
                                    <span className="text-muted-foreground font-mono">
                                        {processedData.formatCurrency(budget.Gastado)} / {processedData.formatCurrency(budget.Presupuestado)}
                                    </span>
                                </div>
                                <Progress value={percentage} className="h-2" indicatorClassName={budget.percentage > 100 ? "bg-destructive" : ""} />
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Cuotas Pendientes de Tarjeta</CardTitle>
                    <CardDescription>Total pendiente de pago: <span className="font-bold text-primary">{processedData.formatCurrency(processedData.installmentsChartData.totalPending)}</span></CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={processedData.installmentsChartData.monthlyTotals}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--foreground))" fontSize={12} tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                            <Tooltip content={({ active, payload, label }) => active && payload && payload.length ? <div className="rounded-lg border bg-card p-2 shadow-sm text-sm"><p className="font-bold">{label}</p><p style={{ color: 'hsl(var(--chart-2))' }}>Total: {processedData.formatCurrency(payload[0].value as number)}</p></div> : null} />
                            <Bar dataKey="total" name="Total" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Análisis de Gastos</CardTitle>
                    <CardDescription>
                      <p>Resumen por categoría del período seleccionado.</p>
                       <p className="font-medium text-foreground">
                          Total Gastado (ARS): <span className="font-bold text-destructive">{processedData.formatCurrency(processedData.totalExpenses)}</span>
                      </p>
                      {processedData.totalExpensesUSD > 0 && (
                          <p className="font-medium text-foreground">
                              Total Gastado (USD): <span className="font-bold text-destructive">{processedData.formatCurrencyUSD(processedData.totalExpensesUSD)}</span>
                          </p>
                      )}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={processedData.barData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                            <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis hide={true} />
                            <Tooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="rounded-lg border bg-card p-2 shadow-sm text-sm">
                                                <p className="font-bold">{label}</p>
                                                <p>Total: {processedData.formatCurrency(payload[0].value as number)}</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="total" position="top" offset={8} className="fill-foreground" fontSize={12} formatter={(value: number) => processedData.formatCurrency(value)} />
                                {processedData.barData.map((entry, index) => <Cell key={`cell-${index}`} fill={categories.find(c => c.name === entry.name)?.color || '#888888'} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

type LicenseStatus = 'active' | 'grace_period' | 'expired' | 'loading';
type UserRole = 'owner' | 'admin' | 'member' | null;

export default function DashboardPageContainer() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { InactivityWarningDialog } = useSessionTimeout();


  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>('loading');
  const [isLoading, setIsLoading] = useState(true);

  // Get user's membership to find tenantId and role
  const membershipsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'memberships'), where('uid', '==', user.uid));
  }, [user, firestore]);
  const { data: memberships, isLoading: isLoadingMemberships } = useCollection<Membership>(membershipsQuery);

  const derivedTenantId = memberships?.[0]?.tenantId;
  const derivedUserRole = memberships?.[0]?.role as UserRole;
  
  // Get license once we have a tenantId
  const licenseQuery = useMemoFirebase(() => {
    if (!derivedTenantId || !firestore) return null;
    return query(collection(firestore, 'licenses'), where('tenantId', '==', derivedTenantId));
  }, [derivedTenantId, firestore]);
  const { data: licenses, isLoading: isLoadingLicenses } = useCollection<License>(licenseQuery);


  useEffect(() => {
    const isDataLoading = isUserLoading || isLoadingMemberships || isLoadingLicenses;
    
    if (isDataLoading) {
      setIsLoading(true);
      return;
    }
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    if (memberships && memberships.length > 0) {
      setTenantId(derivedTenantId);
      setUserRole(derivedUserRole);

      if (licenses && licenses.length > 0) {
        const license = licenses[0];
        const endDate = new Date(license.endDate);
        const now = new Date();
        const daysDiff = differenceInDays(endDate, now);
        
        if (daysDiff >= 0) {
            setLicenseStatus('active');
        } else if (daysDiff < 0 && daysDiff >= -15) {
            setLicenseStatus('grace_period');
            toast({
                variant: 'destructive',
                title: 'Tu licencia ha expirado',
                description: `Tienes ${15 + daysDiff} días para renovarla antes de que tus datos sean eliminados.`,
                duration: Infinity,
            });
        } else {
            setLicenseStatus('expired');
            toast({
                variant: 'destructive',
                title: 'Licencia Expirada Definitivamente',
                description: 'El acceso a tu cuenta está restringido. Renueva para continuar.',
                duration: Infinity,
            });
        }
      } else {
          // No license found, treat as expired
          setLicenseStatus('expired');
      }

      setIsLoading(false);

    } else if (!isLoadingMemberships) {
      // User is authenticated but has no memberships
      router.push('/subscribe');
    }
  }, [user, isUserLoading, memberships, isLoadingMemberships, licenses, isLoadingLicenses, router, derivedTenantId, derivedUserRole, toast]);


  const getInitials = (name: string = "") => {
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

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
  
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<UserType>(userDocRef);


  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <AhorroYaLogo className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !tenantId || !userRole) {
    return (
         <div className="flex h-screen items-center justify-center">
            <AhorroYaLogo className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }
  
  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col">
        <InactivityWarningDialog />
        <header className="sticky top-0 z-40 w-full border-b bg-background">
          <div className="container flex h-16 items-center">
            <div  className="mr-6 flex items-center space-x-2">
              <AhorroYaLogo className="h-10 w-10 text-primary" />
              <span className="font-bold font-headline text-foreground">Ahorro Ya</span>
            </div>
            <div className="flex flex-1 items-center justify-end space-x-4">
              {licenses && licenses.length > 0 && userRole === 'owner' && (
                  <Badge variant={licenseStatus === 'active' ? 'default' : 'destructive'} className={licenseStatus === 'active' ? 'bg-green-500 hover:bg-green-600' : ''}>
                      {licenseStatus === 'active' ? 'Licencia Activa' : (licenseStatus === 'grace_period' ? 'Período de Gracia' : 'Licencia Expirada')}
                  </Badge>
              )}
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                          <Avatar className="h-9 w-9">
                              <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "Usuario"} />
                              <AvatarFallback>{getInitials(user.displayName || "")}</AvatarFallback>
                          </Avatar>
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                      <DropdownMenuLabel>
                          <p className="font-medium">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                          <Link href="/dashboard/profile">
                              <UserIcon className="mr-2 h-4 w-4" />
                              <span>Perfil</span>
                          </Link>
                      </DropdownMenuItem>
                      {userRole === 'owner' && (
                          <DropdownMenuItem asChild>
                              <Link href="/dashboard/settings">
                                  <FileText className="mr-2 h-4 w-4" />Administrar
                              </Link>
                          </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={handleLogout}>
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Cerrar Sesión</span>
                      </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="flex-1">
          {(userRole === 'owner' || userRole === 'admin') && tenantId && <AdminOrOwnerDashboard tenantId={tenantId} licenseStatus={licenseStatus} userRole={userRole} />}
          {userRole === 'member' && tenantId && <MemberDashboard tenantId={tenantId} licenseStatus={licenseStatus} />}
        </main>
      </div>
    </TooltipProvider>
  );
}
