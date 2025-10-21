
'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, updateDoc, orderBy } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { Category, Budget, User as UserType } from '@/lib/types';
import { DropdownCat } from '@/components/ui/dropdowncat';
import { Textarea } from '@/components/ui/textarea';


const budgetFormSchema = z.object({
  year: z.coerce.number().min(new Date().getFullYear(), "El año no puede ser anterior al actual."),
  month: z.coerce.number().min(1).max(12),
  categoryId: z.string().min(1, "La categoría es requerida."),
  amount: z.coerce.number().min(0.01, "El monto debe ser mayor a 0."),
  currency: z.string(),
  description: z.string().optional(),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export default function EditBudgetPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const firestore = useFirestore();
  const budgetId = params.id as string;
  const { user, isUserLoading } = useUser();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [tenantId, setTenantId] = React.useState<string | null>(null);


  const budgetRef = useMemoFirebase(() => {
    if (!firestore || !budgetId) return null;
    return doc(firestore, 'budgets', budgetId);
  }, [firestore, budgetId]);
  const { data: budgetData, isLoading: isLoadingBudget } = useDoc<Budget>(budgetRef);

  const { control, handleSubmit, formState: { errors }, reset } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
  });

  React.useEffect(() => {
    if (budgetData) {
      reset({
        ...budgetData,
        amount: budgetData.amountARS,
        currency: 'ARS',
      });
    }
  }, [budgetData, reset]);

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
    if (!firestore || !budgetId) return;

    setIsSubmitting(true);
    toast({ title: "Procesando...", description: "Actualizando el presupuesto." });
    
    let amountARS = data.amount;
    if (data.currency === 'USD') {
        try {
            const response = await fetch('https://dolarapi.com/v1/dolares/oficial');
            if (!response.ok) throw new Error('No se pudo obtener el tipo de cambio.');
            const rates = await response.json();
            amountARS = data.amount * rates.venta;
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error de Red', description: 'No se pudo obtener el tipo de cambio del dólar. El presupuesto no fue actualizado.' });
            setIsSubmitting(false);
            return;
        }
    }

    const budgetToUpdateRef = doc(firestore, 'budgets', budgetId);
    
    const updatedData = {
      year: data.year,
      month: data.month,
      categoryId: data.categoryId,
      description: data.description || '',
      amountARS,
      tenantId: budgetData?.tenantId,
    };

    updateDoc(budgetToUpdateRef, updatedData)
      .then(() => {
        toast({ title: "¡Éxito!", description: "El presupuesto ha sido actualizado." });
        router.push('/dashboard/budget');
      })
      .catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: budgetToUpdateRef.path,
            operation: 'update',
            requestResourceData: updatedData,
        }));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const months = Array.from({length: 12}, (_, i) => ({ value: i + 1, name: new Date(0, i).toLocaleString('es', { month: 'long' }) }));
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 5}, (_, i) => currentYear + i);
  
  const categoryOptions = React.useMemo(() => {
    if (!categories) return [];
    return categories.map(c => ({ label: c.name, value: c.id }));
  }, [categories]);

  if (isLoadingBudget || isLoadingCategories || isUserDocLoading) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Cargando presupuesto...</p>
        </div>
    );
  }
  
   if (!budgetData) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50">
            <p className="text-destructive">No se pudo encontrar el presupuesto.</p>
             <Button variant="outline" asChild className="mt-4">
                <Link href="/dashboard/budget">Volver a Presupuestos</Link>
            </Button>
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
                <h1 className="ml-4 font-headline text-xl font-bold">Editar Presupuesto</h1>
            </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-lg">
            <form onSubmit={handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Editar Presupuesto Mensual</CardTitle>
                        <CardDescription>Ajusta el límite de gasto para esta categoría.</CardDescription>
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

                        <div className="space-y-2">
                            <Label htmlFor="description">Descripción (Opcional)</Label>
                            <Controller
                                name="description"
                                control={control}
                                render={({ field }) => <Textarea id="description" {...field} />}
                            />
                        </div>
                       
                        <div className='grid grid-cols-3 gap-4'>
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="amount">Monto</Label>
                                <Controller name="amount" control={control} render={({ field }) => <Input id="amount" type="number" step="0.01" {...field} />} />
                                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="currency">Moneda</Label>
                                <Controller
                                    name="currency"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ARS">ARS</SelectItem>
                                                <SelectItem value="USD">USD</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>

                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
      </main>
    </div>
  );
}
