
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
import type { Tenant, License, Membership, Category, User as UserType, Expense, Budget, Currency } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, UserPlus, FileText, Repeat, XCircle, Plus, Calendar as CalendarIcon, ChevronDown, Utensils, ShoppingCart, Bus, Film, Home, Sparkles, Loader2, TableIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, ResponsiveContainer, Cell, LabelList, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { defaultCategories } from '@/lib/default-categories';
import Link from 'next/link';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function OwnerDashboard() {
  console.log("--- RENDER START ---");
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  // --- STATE MANAGEMENT ---
  const [isSeeding, setIsSeeding] = useState(false);
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('');
  
  console.log("Estado actual:", { selectedCategory, selectedCurrency });

  // --- DATA FETCHING (SEQUENTIAL & CONTROLLED) ---

  // 1. Fetch user data
  console.log("useMemo: Creando userDocRef. Deps:", { firestore, user });
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

  // 2. Derive tenantId directly from userData
  const tenantId = useMemo(() => {
    const id = userData?.tenantIds?.[0];
    console.log(`useMemo [tenantId]: Derivando tenantId. Resultado: ${id}`);
    return id;
  }, [userData]);


  // 3. Fetch all tenant-dependent data only when tenantId is available
  console.log("useMemo: Creando tenantRef. Deps:", { tenantId });
  const tenantRef = useMemoFirebase(() => tenantId ? doc(firestore, 'tenants', tenantId) : null, [firestore, tenantId]);
  const { data: activeTenant, isLoading: isLoadingTenant } = useDoc<Tenant>(tenantRef);

  console.log("useMemo: Creando licenseQuery. Deps:", { firestore, tenantId });
  const licenseQuery = useMemoFirebase(() => tenantId ? query(collection(firestore, 'licenses'), where('tenantId', '==', tenantId)) : null, [firestore, tenantId]);
  const { data: licenses, isLoading: isLoadingLicenses } = useCollection<License>(licenseQuery);

  console.log("useMemo: Creando categoriesQuery. Deps:", { firestore, tenantId });
  const categoriesQuery = useMemoFirebase(() => tenantId ? query(collection(firestore, 'categories'), where('tenantId', '==', tenantId)) : null, [firestore, tenantId]);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<WithId<Category>>(categoriesQuery);

  console.log("useMemo: Creando expensesQuery. Deps:", { firestore, tenantId });
  const expensesQuery = useMemoFirebase(() => tenantId ? query(collection(firestore, 'expenses'), where('tenantId', '==', tenantId), where('deleted', '==', false)) : null, [firestore, tenantId]);
  const { data: allExpenses, isLoading: isLoadingExpenses } = useCollection<WithId<Expense>>(expensesQuery);

  console.log("useMemo: Creando budgetsQuery. Deps:", { firestore, tenantId });
  const budgetsQuery = useMemoFirebase(() => tenantId ? query(collection(firestore, 'budgets'), where('tenantId', '==', tenantId)) : null, [firestore, tenantId]);
  const { data: allBudgets, isLoading: isLoadingBudgets } = useCollection<WithId<Budget>>(budgetsQuery);
  
  // 4. Fetch currencies (independent)
  console.log("useMemo: Creando currenciesQuery. Deps:", { firestore });
  const currenciesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'currencies') : null, [firestore]);
  const { data: currencies, isLoading: isLoadingCurrencies } = useCollection<WithId<Currency>>(currenciesQuery);
  
  // --- EFFECT FOR DEFAULT CURRENCY ---
  // This effect runs ONLY when currencies are loaded or change. It won't cause a loop.
  useEffect(() => {
    console.log("useEffect [currencies]: Se ejecuta. currencies:", currencies);
    if (currencies && !selectedCurrency) {
      const arsCurrency = currencies.find(c => c.code === 'ARS');
      if (arsCurrency) {
        console.log("useEffect [currencies]: Estableciendo moneda por defecto a ARS:", arsCurrency.id);
        setSelectedCurrency(arsCurrency.id);
      }
    }
  }, [currencies]);

  // --- DERIVED STATE & MEMOIZED CALCULATIONS ---

  const filteredExpenses = useMemo(() => {
     console.log("useMemo: Calculando filteredExpenses. Deps:", { allExpenses, date, selectedCategory });
    if (!allExpenses || !date?.from) return [];
    return allExpenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        const fromDate = new Date(date.from!.setHours(0, 0, 0, 0));
        const toDate = date.to ? new Date(date.to.setHours(23, 59, 59, 999)) : new Date(date.from!.setHours(23, 59, 59, 999));

        if (expenseDate < fromDate || expenseDate > toDate) return false;
        if (selectedCategory !== 'all' && expense.categoryId !== selectedCategory) return false;
        return true;
    });
  }, [allExpenses, date, selectedCategory]);

  const processedData = useMemo(() => {
    console.log("useMemo: Calculando processedData. Deps:", { filteredExpenses, categories, currencies, allBudgets, allExpenses, selectedCurrency, date });
    if (!currencies || !allExpenses || !categories || !allBudgets || !selectedCurrency) {
       console.log("useMemo [processedData]: Salida temprana, datos incompletos.");
      return null;
    }
    
    const toCurrency = currencies.find(c => c.id === selectedCurrency);
    if (!toCurrency) {
      console.log("useMemo [processedData]: Salida temprana, moneda seleccionada no encontrada.");
      return null;
    };

    const convertAmount = (amount: number, fromCurrencyCode: string) => {
        const fromCurrency = currencies.find(c => c.code === fromCurrencyCode);
        if (!fromCurrency || fromCurrency.id === toCurrency.id) {
          return amount;
        }
        if (!fromCurrency.exchangeRate || !toCurrency.exchangeRate) {
          return 0; // Or handle as an error
        }
        // Base conversion through USD as the common denominator
        const amountInBase = amount / fromCurrency.exchangeRate;
        return amountInBase * toCurrency.exchangeRate;
    };

    const finalFormatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: toCurrency.code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    const barData = Object.entries(filteredExpenses.reduce((acc, expense) => {
        const categoryName = categories.find(c => c.id === expense.categoryId)?.name || 'Sin Categoría';
        const convertedAmount = convertAmount(expense.amount, expense.currency);
        if (!acc[categoryName]) acc[categoryName] = 0;
        acc[categoryName] += convertedAmount;
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
                ...expense, icon: expenseIcons[categoryName] || expenseIcons.default, entity: expense.entityName || 'N/A', category: categoryName, amountConverted: convertAmount(expense.amount, expense.currency),
            }
        });

    const budgetChartData = (() => {
        const currentMonth = date?.from?.getMonth() ?? new Date().getMonth();
        const currentYear = date?.from?.getFullYear() ?? new Date().getFullYear();
        return allBudgets
            .filter(b => b.month === currentMonth + 1 && b.year === currentYear)
            .map(budget => {
                const spentInARS = allExpenses
                    .filter(e => e.categoryId === budget.categoryId && new Date(e.date).getMonth() === currentMonth && new Date(e.date).getFullYear() === currentYear)
                    .reduce((acc, e) => acc + e.amountARS, 0);
                const spentConverted = convertAmount(spentInARS, 'ARS');
                const budgetAmountConverted = convertAmount(budget.amountARS, 'ARS');
                return {
                    name: categories.find(c => c.id === budget.categoryId)?.name?.substring(0, 10) || 'N/A', Presupuestado: budgetAmountConverted, Gastado: spentConverted,
                };
            }).slice(0, 5);
    })();
    console.log("useMemo [processedData]: ¡Cálculo Exitoso!");
    return { barData, recentExpenses, budgetChartData, formatCurrency: finalFormatCurrency, toCurrencyCode: toCurrency.code };
  }, [filteredExpenses, categories, currencies, allBudgets, allExpenses, selectedCurrency, date]);
  
  // --- SEEDING LOGIC ---
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

  // --- RENDER LOGIC ---

  // Master loading state. Render loader until all initial data is ready.
  const isLoading = isUserDocLoading || isLoadingTenant || isLoadingLicenses || isLoadingCategories || isLoadingExpenses || isLoadingBudgets || isLoadingCurrencies || !selectedCurrency || !processedData;
  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
  
  console.log("Estado de carga:", { isLoading, isUserDocLoading, isLoadingTenant, isLoadingLicenses, isLoadingCategories, isLoadingExpenses, isLoadingBudgets, isLoadingCurrencies, tenantId, selectedCurrency, processedData: !!processedData });

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
                    <TableIcon className="mr-2 h-4 w-4" /> Ver Presupuesto
                </Link>
            </Button>
            <Button asChild>
                <Link href="/dashboard/expenses">
                    <TableIcon className="mr-2 h-4 w-4" /> Ver Gastos
                </Link>
            </Button>
        </div>


        <div className="bg-card shadow rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value)}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {categories?.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                    <SelectTrigger className="w-full">
                         <SelectValue placeholder="Moneda" />
                    </SelectTrigger>
                    <SelectContent>
                        {currencies?.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                                {c.name}
                            </SelectItem>
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
                 <CardDescription>Resumen por categoría del período seleccionado en {processedData.toCurrencyCode}.</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                 <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={processedData.barData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
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
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Presupuestos</CardTitle>
                <CardDescription>Tu progreso de gastos del mes en {processedData.toCurrencyCode}.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={processedData.budgetChartData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false}/>
                        <Tooltip
                            cursor={{ fill: 'hsl(var(--secondary))' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                return (
                                    <div className="rounded-lg border bg-card p-2 shadow-sm text-sm">
                                        <p className="font-bold">{payload[0].payload.name}</p>
                                        <p>Gastado: {processedData.formatCurrency(payload[1].value as number)}</p>
                                        <p>Presupuestado: {processedData.formatCurrency(payload[0].value as number)}</p>
                                    </div>
                                );
                                }
                                return null;
                            }}
                        />
                        <Legend />
                        <Bar dataKey="Presupuestado" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="Gastado" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
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
                  {processedData.recentExpenses.map((expense, i) => (
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
