
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
import { useUser, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, addDoc, getDocs, orderBy, doc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { Category, User as UserType } from '@/lib/types';
import { DropdownCat } from '@/components/ui/dropdowncat';

const budgetFormSchema = z.object({
  year: z.coerce.number().min(new Date().getFullYear(), "El año no puede ser anterior al actual."),
  month: z.coerce.number().min(1).max(12),
  categoryId: z.string().min(1, "La categoría es requerida."),
  amountARS: z.coerce.number().min(0.01, "El monto debe ser mayor a 0."),
  currency: z.string(),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export default function NewBudgetPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [tenantId, setTenantId] = React.useState<string | null>(null);

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
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

  React.useEffect(() => {
    if (userData?.tenantIds && userData.tenantIds.length > 0) {
      setTenantId(userData.tenantIds[0]);
    }
  }, [userData]);
  
  const ready = !!firestore && !!user && !isUserLoading && !isUserDocLoading && !!tenantId;

  const categoriesQuery = useMemoFirebase(() => {
    if (!ready) return null;
    return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId), orderBy('order'));
  }, [firestore, ready, tenantId]);

  const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);


  const onSubmit = async (data: BudgetFormValues) => {
    if (!tenantId || !user || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al usuario o tenant.' });
        return;
    }
    setIsSubmitting(true);
    toast({ title: "Procesando...", description: "Guardando el presupuesto." });

    const budgetsRef = collection(firestore, 'budgets');
    const newBudgetData = {
        ...data,
        tenantId: tenantId,
        rolloverFromPrevARS: 0, // Default value for now
    };

    try {
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
        
        addDoc(budgetsRef, newBudgetData)
            .then(() => {
                toast({ title: "¡Éxito!", description: "El presupuesto ha sido guardado correctamente." });
                router.push('/dashboard/budget');
            })
            .catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: budgetsRef.path,
                    operation: 'create',
                    requestResourceData: newBudgetData,
                }));
            });

    } catch (error) {
        console.error("Unexpected error checking for existing budget:", error);
        toast({ variant: 'destructive', title: 'Error Inesperado', description: 'No se pudo verificar el presupuesto existente.' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const months = Array.from({length: 12}, (_, i) => ({ value: i + 1, name: new Date(0, i).toLocaleString('es', { month: 'long' }) }));
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 5}, (_, i) => currentYear + i);
  
  const categoryOptions = React.useMemo(() => {
    if (!categories) return [];
    return categories.map(c => ({ label: c.name, value: c.id }));
  }, [categories]);

  if (!ready || isLoadingCategories) {
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
                                    <DropdownCat
                                        options={categoryOptions}
                                        value={field.value}
                                        onSelect={field.onChange}
                                        placeholder="Seleccionar categoría"
                                        searchPlaceholder="Buscar categoría..."
                                        emptyPlaceholder="No se encontró la categoría."
                                    />
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
