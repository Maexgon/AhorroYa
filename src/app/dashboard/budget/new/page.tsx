
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, getDocs, orderBy, doc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { Category, User as UserType } from '@/lib/types';


const budgetFormSchema = z.object({
  year: z.coerce.number().min(new Date().getFullYear(), "El año no puede ser anterior al actual."),
  month: z.coerce.number().min(1).max(12),
  categoryId: z.string().min(1, "La categoría es requerida."),
  amountARS: z.coerce.number().min(0.01, "El monto debe ser mayor a 0."),
  currency: z.string(),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export default function NewBudgetPage() {
  console.log('NewBudgetPage: Component rendering');
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  console.log('NewBudgetPage: useUser hook state', { user: !!user, isUserLoading });
  const firestore = useFirestore();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [tenantId, setTenantId] = React.useState<string | null>(null);
  console.log('NewBudgetPage: Current tenantId state:', tenantId);


  const { control, handleSubmit, formState: { errors } } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      categoryId: '',
      amountARS: 0,
      currency: 'ARS',
    }
  });

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) {
        console.log('NewBudgetPage: userDocRef not created (no firestore or user)');
        return null;
    }
    console.log('NewBudgetPage: Creating userDocRef for user:', user.uid);
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);
  console.log('NewBudgetPage: useDoc<UserType> hook state', { userData: !!userData, isUserDocLoading });


  React.useEffect(() => {
    console.log('NewBudgetPage: useEffect for setting tenantId triggered. userData:', userData);
    if (userData?.tenantIds && userData.tenantIds.length > 0) {
      console.log('NewBudgetPage: Setting tenantId from userData:', userData.tenantIds[0]);
      setTenantId(userData.tenantIds[0]);
    } else {
       console.log('NewBudgetPage: Not setting tenantId, userData is not ready or has no tenantIds');
    }
  }, [userData]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore || !tenantId) {
        console.log('NewBudgetPage: categoriesQuery not created (no firestore or tenantId)');
        return null;
    }
    console.log('NewBudgetPage: CREATING categories query for tenantId:', tenantId);
    return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId), orderBy('order'));
  }, [firestore, tenantId]);

  const { data: categories, isLoading: isLoadingCategories, error: categoriesError } = useCollection<Category>(categoriesQuery);
  console.log('NewBudgetPage: useCollection<Category> hook state', { hasCategories: !!categories, isLoadingCategories, categoriesError });


  const onSubmit = async (data: BudgetFormValues) => {
    if (!tenantId || !user || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al usuario o tenant.' });
        return;
    }
    setIsSubmitting(true);
    toast({ title: "Procesando...", description: "Guardando el presupuesto." });

    try {
        const budgetsRef = collection(firestore, 'budgets');
        const q = query(budgetsRef, 
            where('tenantId', '==', tenantId),
            where('year', '==', data.year),
            where('month', '==', data.month),
            where('categoryId', '==', data.categoryId)
        );

        const existingBudget = await getDocs(q);
        if (!existingBudget.empty) {
            toast({ variant: 'destructive', title: 'Error', description: 'Ya existe un presupuesto para esta categoría en el mes y año seleccionados.' });
            setIsSubmitting(false);
            return;
        }
        
        await addDoc(budgetsRef, {
            ...data,
            tenantId: tenantId,
            rolloverFromPrevARS: 0, // Default value for now
        });

        toast({ title: "¡Éxito!", description: "El presupuesto ha sido guardado correctamente." });
        router.push('/dashboard/budget');

    } catch (error) {
        console.error("Error saving budget:", error);
        toast({ variant: 'destructive', title: 'Error al Guardar', description: 'No se pudo guardar el presupuesto.' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const months = Array.from({length: 12}, (_, i) => ({ value: i + 1, name: new Date(0, i).toLocaleString('es', { month: 'long' }) }));
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 5}, (_, i) => currentYear + i);

  const isLoading = isUserLoading || isUserDocLoading || (user && !tenantId) || isLoadingCategories;
  console.log('NewBudgetPage: Final isLoading check:', isLoading);

  if (isLoading) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
        <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="container flex h-16 items-center">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/budget">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="ml-4 font-headline text-xl font-bold">Nuevo Presupuesto</h1>
            </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-lg">
            <form onSubmit={handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Crear Presupuesto Mensual</CardTitle>
                        <CardDescription>Define un límite de gasto para una categoría en un mes específico.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="month">Mes</Label>
                                <Controller
                                    name="month"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={String(field.value)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.name.charAt(0).toUpperCase() + m.name.slice(1)}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.month && <p className="text-sm text-destructive">{errors.month.message}</p>}
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="year">Año</Label>
                                <Controller
                                    name="year"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={String(field.value)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.year && <p className="text-sm text-destructive">{errors.year.message}</p>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="categoryId">Categoría</Label>
                            <Controller
                                name="categoryId"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
                                        <SelectContent>
                                            {categories?.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
                        </div>
                       
                        <div className='grid grid-cols-3 gap-4'>
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="amountARS">Monto</Label>
                                <Controller name="amountARS" control={control} render={({ field }) => <Input id="amountARS" type="number" step="0.01" {...field} />} />
                                {errors.amountARS && <p className="text-sm text-destructive">{errors.amountARS.message}</p>}
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="currency">Moneda</Label>
                                <Controller
                                    name="currency"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value} disabled>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ARS">ARS</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>

                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Guardando...' : 'Guardar Presupuesto'}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
      </main>
    </div>
  );
}

    