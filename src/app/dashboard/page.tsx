
'use client';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useMemo } from 'react';
import { AhorroYaLogo } from '@/components/shared/icons';
import { Button } from '@/components/ui/button';
import { getAuth, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, writeBatch, getDocs, doc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { WithId } from '@/firebase/firestore/use-collection';
import type { Tenant, License, Membership, Category, User as UserType, Expense, FxRate, Budget, Currency } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, UserPlus, FileText, Repeat, XCircle, Plus, Calendar as CalendarIcon, ChevronDown, Utensils, ShoppingCart, Bus, Film, Home, Sparkles } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MultiSelect } from '@/components/shared/multi-select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { defaultCategories } from '@/lib/default-categories';
import Link from 'next/link';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];


function OwnerDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState('ARS');

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

  useEffect(() => {
    if (userData?.tenantIds && userData.tenantIds.length > 0) {
      setTenantId(userData.tenantIds[0]);
    }
  }, [userData]);

  const tenantRef = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return doc(firestore, 'tenants', tenantId);
  }, [firestore, tenantId]);
  const { data: activeTenant, isLoading: isLoadingTenant } = useDoc<Tenant>(tenantRef);

  const licenseQuery = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return query(collection(firestore, 'licenses'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: licenses, isLoading: isLoadingLicenses } = useCollection<License>(licenseQuery);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);

  const expensesQuery = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return query(collection(firestore, 'expenses'), where('tenantId', '==', tenantId), where('deleted', '==', false));
  }, [firestore, tenantId]);
  const { data: expenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

  const budgetsQuery = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return query(collection(firestore, 'budgets'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: allBudgets, isLoading: isLoadingBudgets } = useCollection<Budget>(budgetsQuery);

  const fxRatesQuery = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return query(collection(firestore, 'fx_rates'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: fxRates, isLoading: isLoadingFxRates } = useCollection<FxRate>(fxRatesQuery);

  const currenciesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'currencies'));
  }, [firestore]);
  const { data: currencies, isLoading: isLoadingCurrencies } = useCollection<Currency>(currenciesQuery);


  const isLoading = isLoadingTenant || isLoadingLicenses || isLoadingCategories || isUserDocLoading || isLoadingExpenses || isLoadingBudgets || isLoadingFxRates || isLoadingCurrencies;
  const activeLicense = licenses?.[0];

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
            batch.set(categoryRef, {
                id: categoryId,
                tenantId: activeTenant.id,
                name: category.name,
                color: category.color,
                order: catIndex
            });

            category.subcategories.forEach((subcategoryName, subCatIndex) => {
                const subcategoryId = crypto.randomUUID();
                const subcategoryRef = doc(firestore, "subcategories", subcategoryId);
                batch.set(subcategoryRef, {
                    id: subcategoryId,
                    tenantId: activeTenant.id,
                    categoryId: categoryId,
                    name: subcategoryName,
                    order: subCatIndex
                });
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

  const currencyConverter = useMemo(() => {
    if (selectedCurrency === 'ARS') {
      return (amount: number) => amount;
    }
    const rate = fxRates?.find(r => r.code === selectedCurrency)?.rateToARS;
    if (!rate) {
      return (amount: number) => amount;
    }
    return (amount: number) => amount / rate;
  }, [selectedCurrency, fxRates]);

  const formatCurrency = useMemo(() => {
    return (amount: number) => {
      if (!selectedCurrency) {
        return ''; // Guard clause to prevent error
      }
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: selectedCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    }
  }, [selectedCurrency]);

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        const fromDate = date?.from ? new Date(date.from.setHours(0, 0, 0, 0)) : null;
        const toDate = date?.to ? new Date(date.to.setHours(23, 59, 59, 999)) : null;

        if (fromDate && expenseDate < fromDate) return false;
        if (toDate && expenseDate > toDate) return false;
        if (selectedCategories.length > 0 && !selectedCategories.includes(expense.categoryId)) return false;
        // User filter placeholder
        return true;
    });
  }, [expenses, date, selectedCategories]);

  const barData = useMemo(() => {
    if (!filteredExpenses || !categories) return [];
    const expenseByCategory = filteredExpenses.reduce((acc, expense) => {
        const categoryName = categories.find(c => c.id === expense.categoryId)?.name || 'Sin Categoría';
        if (!acc[categoryName]) {
            acc[categoryName] = 0;
        }
        acc[categoryName] += expense.amountARS;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(expenseByCategory)
        .map(([name, total]) => ({ name, total: currencyConverter(total) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
  }, [filteredExpenses, categories, currencyConverter]);

  const recentExpenses = useMemo(() => {
    const expenseIcons: { [key: string]: React.ElementType } = {
        default: Sparkles,
        'Comestibles': Utensils,
        'Ropa y Accesorios': ShoppingCart,
        'Mobilidad': Bus,
        'Vida y Entretenimiento': Film,
        'Vivienda': Home,
    };

    return filteredExpenses
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)
        .map(expense => {
            const categoryName = categories?.find(c => c.id === expense.categoryId)?.name || 'Sin Categoría';
            return {
                icon: expenseIcons[categoryName] || expenseIcons.default,
                entity: expense.entityName || 'N/A',
                category: categoryName,
                amount: currencyConverter(expense.amountARS),
            }
        });
  }, [filteredExpenses, categories, currencyConverter]);

  const budgets = useMemo(() => {
    if (!allBudgets || !expenses || !categories) return [];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    return allBudgets
        .filter(b => b.month === currentMonth && b.year === currentYear)
        .map(budget => {
            const spent = expenses
                .filter(e => e.categoryId === budget.categoryId && new Date(e.date).getMonth() + 1 === budget.month && new Date(e.date).getFullYear() === budget.year)
                .reduce((acc, e) => acc + e.amountARS, 0);

            return {
                name: categories.find(c => c.id === budget.categoryId)?.name || 'N/A',
                spent: currencyConverter(spent),
                total: currencyConverter(budget.amountARS),
            };
        }).slice(0, 4);
  }, [allBudgets, expenses, categories, currencyConverter]);
  
  const userOptions: { value: string; label: string; }[] = []; 
  const categoryOptions = categories?.map(c => ({ value: c.id, label: c.name })) || [];
  
  const currencyOptions = useMemo(() => {
    const uniqueCurrencies = new Map<string, Currency>();
    // Ensure ARS is always present
    uniqueCurrencies.set('ARS', { code: 'ARS', name: 'Peso Argentino' });
    
    if (currencies) {
        currencies.forEach(c => {
            if (!uniqueCurrencies.has(c.code)) {
                uniqueCurrencies.set(c.code, c);
            }
        });
    }
    return Array.from(uniqueCurrencies.values());
  }, [currencies]);


  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <AhorroYaLogo className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const showSeedButton = !isLoading && (!categories || categories.length === 0) && !!activeTenant;

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
                        <DropdownMenuItem><UserPlus className="mr-2 h-4 w-4" />Invitar usuarios</DropdownMenuItem>
                        <DropdownMenuItem><FileText className="mr-2 h-4 w-4" />Administrar licencia</DropdownMenuItem>
                        <DropdownMenuItem><Repeat className="mr-2 h-4 w-4" />Renovar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10"><XCircle className="mr-2 h-4 w-4" />Cancelar</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

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
                    <Plus className="mr-2 h-4 w-4" /> Ver Presupuesto
                </Link>
            </Button>
            <Button asChild>
                <Link href="/dashboard/expenses">
                    <Plus className="mr-2 h-4 w-4" /> Ver Gastos
                </Link>
            </Button>
        </div>


        <div className="bg-card shadow rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <MultiSelect
                    options={userOptions}
                    selected={selectedUsers}
                    onChange={setSelectedUsers}
                    placeholder="Miembros"
                    className="w-full"
                />
                <MultiSelect
                    options={categoryOptions}
                    selected={selectedCategories}
                    onChange={setSelectedCategories}
                    placeholder="Categorías"
                    className="w-full"
                />
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Moneda" />
                    </SelectTrigger>
                    <SelectContent>
                        {currencyOptions.map(c => (
                            <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

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
            </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Análisis de Gastos</CardTitle>
                 <CardDescription>Resumen por categoría del período seleccionado en {selectedCurrency}.</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                 <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                     <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="name" position="top" offset={8} className="fill-foreground" fontSize={12} />
                      {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Presupuestos</CardTitle>
                <CardDescription>Tu progreso de gastos del mes en {selectedCurrency}.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                 {budgets.map(budget => {
                    const percentage = budget.total > 0 ? (budget.spent / budget.total) * 100 : 0;
                    return (
                        <div key={budget.name}>
                            <div className="flex justify-between text-sm mb-1 font-medium">
                                <span>{budget.name}</span>
                                <span className="text-muted-foreground">
                                    {formatCurrency(budget.spent)} / {formatCurrency(budget.total)}
                                </span>
                            </div>
                            <Progress value={percentage > 100 ? 100 : percentage} className="h-2" />
                             {percentage > 100 && <p className="text-xs text-destructive mt-1">Excedido por {formatCurrency(budget.spent - budget.total)}</p>}
                        </div>
                    )
                })}
              </CardContent>
            </Card>
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
                    <TableHead>Entidad</TableHead>
                    <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentExpenses.map((expense, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="bg-muted p-2 rounded-md hidden sm:block">
                            <expense.icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <span className="font-medium">{expense.entity}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{expense.category}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(expense.amount)}
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
                        Notamos que tus gastos en <span className="text-foreground font-medium">"Ocio"</span> superaron el presupuesto.
                    </p>
                    <p className="mt-2 font-medium text-foreground">
                        Considera reasignar <span className="text-primary">{formatCurrency(2500)}</span> de esta categoría a <span className="text-primary">"Ahorros"</span> el próximo mes.
                    </p>
                </div>
            </CardContent>
            <CardFooter>
                <Button variant="outline" className="w-full">Ver más insights</Button>
            </CardFooter>
          </Card>
        </div>


    </div>
  );
}


export default function DashboardPageContainer() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

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

  if (isUserLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <AhorroYaLogo className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }
  
  // TODO: Add logic to differentiate between owner and member dashboard
  const isOwner = true; 

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
        {isOwner ? <OwnerDashboard /> : <div className="p-8"><p>Dashboard de Miembro Próximamente</p></div>}
      </main>
    </div>
  );
}
