
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
import { useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, ArrowLeft, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import type { Category, Subcategory, Expense, FxRate } from '@/lib/types';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';


const expenseFormSchema = z.object({
  entityName: z.string().min(1, "El nombre de la entidad es requerido."),
  entityCuit: z.string().min(11, "El CUIT debe tener 11 dígitos.").max(11, "El CUIT debe tener 11 dígitos.").optional().or(z.literal('')),
  date: z.date({ required_error: "La fecha es requerida." }),
  amount: z.coerce.number().min(0.01, "El monto debe ser mayor a 0."),
  currency: z.string().min(1, "La moneda es requerida."),
  categoryId: z.string().min(1, "La categoría es requerida."),
  subcategoryId: z.string().optional(),
  paymentMethod: z.string().min(1, "El método de pago es requerido."),
  notes: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const firestore = useFirestore();

  const expenseId = params.id as string;

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [openCategoryCombobox, setOpenCategoryCombobox] = React.useState(false);

  // Fetch the expense to edit
  const expenseRef = useMemoFirebase(() => {
    if (!firestore || !expenseId) return null;
    return doc(firestore, 'expenses', expenseId);
  }, [firestore, expenseId]);
  const { data: expenseData, isLoading: isLoadingExpense } = useDoc<Expense>(expenseRef);

  const { control, handleSubmit, watch, formState: { errors }, reset, setValue } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      entityName: '',
      entityCuit: '',
      amount: 0,
      currency: 'ARS',
      categoryId: '',
      subcategoryId: '',
      paymentMethod: 'cash',
      notes: '',
      date: new Date(),
    }
  });
  
  // When expense data loads, reset the form with its values
  React.useEffect(() => {
    if (expenseData) {
      reset({
        ...expenseData,
        date: new Date(expenseData.date),
        notes: expenseData.notes || '',
        entityCuit: expenseData.entityCuit || '',
        subcategoryId: expenseData.subcategoryId || '',
      });
    }
  }, [expenseData, reset]);


  const selectedCategoryId = watch('categoryId');
  const tenantId = expenseData?.tenantId;

  // Fetch categories and subcategories for the tenant
  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const subcategoriesQuery = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return query(collection(firestore, 'subcategories'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: allSubcategories } = useCollection<Subcategory>(subcategoriesQuery);
  
  const fxRatesQuery = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return query(collection(firestore, 'fx_rates'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: fxRates } = useCollection<FxRate>(fxRatesQuery);


  const subcategoriesForSelectedCategory = React.useMemo(() => {
    if (!allSubcategories || !selectedCategoryId) return [];
    return allSubcategories.filter(s => s.categoryId === selectedCategoryId);
  }, [allSubcategories, selectedCategoryId]);

  const onSubmit = async (data: ExpenseFormValues) => {
     if (!firestore || !expenseId || !tenantId) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo encontrar el gasto para actualizar.' });
        return;
    }
    setIsSubmitting(true);
    toast({ title: "Procesando...", description: "Actualizando el gasto." });

    const expenseToUpdateRef = doc(firestore, 'expenses', expenseId);
    let amountARS = data.amount;
    if (data.currency !== 'ARS' && fxRates) {
        const rate = fxRates.find(r => r.code === data.currency);
        if (rate) {
            amountARS = data.amount * rate.rateToARS;
        } else {
            toast({ variant: 'destructive', title: 'Error de Conversión', description: `No se encontró tipo de cambio para ${data.currency}.` });
            setIsSubmitting(false);
            return;
        }
    }
    
    const updatedData = {
        ...data,
        date: data.date.toISOString(),
        amountARS: amountARS,
        subcategoryId: data.subcategoryId || null,
        updatedAt: new Date().toISOString(),
    };

    updateDoc(expenseToUpdateRef, updatedData)
        .then(() => {
            toast({ title: "¡Éxito!", description: "El gasto ha sido actualizado correctamente." });
            router.push('/dashboard/expenses');
        })
        .catch((error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: expenseToUpdateRef.path,
                operation: 'update',
                requestResourceData: updatedData,
            }));
        })
        .finally(() => {
            setIsSubmitting(false);
        });
  };

  if (isLoadingExpense) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Cargando gasto...</p>
        </div>
    )
  }
   if (!expenseData) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50">
            <p className="text-destructive">No se pudo encontrar el gasto.</p>
             <Button variant="outline" asChild className="mt-4">
                <Link href="/dashboard/expenses">Volver a Gastos</Link>
            </Button>
        </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
        <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="container flex h-16 items-center">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/expenses">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="ml-4 font-headline text-xl font-bold">Editar Gasto</h1>
            </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
            <form onSubmit={handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Detalles del Gasto</CardTitle>
                        <CardDescription>Ajusta la información del gasto.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="entityName">Nombre de la Entidad</Label>
                            <Controller name="entityName" control={control} render={({ field }) => <Input id="entityName" {...field} />} />
                            {errors.entityName && <p className="text-sm text-destructive">{errors.entityName.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="entityCuit">CUIT de la Entidad (Opcional)</Label>
                            <Controller name="entityCuit" control={control} render={({ field }) => <Input id="entityCuit" {...field} />} />
                            {errors.entityCuit && <p className="text-sm text-destructive">{errors.entityCuit.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="date">Fecha del Gasto</Label>
                            <Controller
                                name="date"
                                control={control}
                                render={({ field }) => (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                )}
                            />
                            {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
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
                                                {fxRates?.map(rate => (
                                                    <SelectItem key={rate.code} value={rate.code}>{rate.code}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="paymentMethod">Método de Pago</Label>
                            <Controller
                                name="paymentMethod"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Efectivo</SelectItem>
                                            <SelectItem value="debit">Tarjeta de Débito</SelectItem>
                                            <SelectItem value="credit">Tarjeta de Crédito</SelectItem>
                                            <SelectItem value="transfer">Transferencia</SelectItem>
                                            <SelectItem value="other">Otro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.paymentMethod && <p className="text-sm text-destructive">{errors.paymentMethod.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="categoryId">Categoría</Label>
                            <Controller
                                name="categoryId"
                                control={control}
                                render={({ field }) => (
                                     <Popover open={openCategoryCombobox} onOpenChange={setOpenCategoryCombobox}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openCategoryCombobox}
                                                className="w-full justify-between"
                                            >
                                                {field.value
                                                    ? categories?.find((cat) => cat.id === field.value)?.name
                                                    : "Selecciona una categoría"}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent 
                                            className="w-[--radix-popover-trigger-width] p-0"
                                        >
                                            <Command>
                                                <CommandInput placeholder="Buscar categoría..." />
                                                <CommandEmpty>No se encontraron categorías.</CommandEmpty>
                                                <CommandGroup>
                                                    {categories?.map((cat) => (
                                                        <CommandItem
                                                            key={cat.id}
                                                            value={cat.name}
                                                            onSelect={(currentValue) => {
                                                                const selectedCategory = categories.find(c => c.name.toLowerCase() === currentValue.toLowerCase());
                                                                if (selectedCategory) {
                                                                    field.onChange(selectedCategory.id);
                                                                    setValue('subcategoryId', '');
                                                                }
                                                                setOpenCategoryCombobox(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    field.value === cat.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {cat.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            />
                            {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
                        </div>

                         <div className="space-y-2">
                            <Label htmlFor="subcategoryId">Subcategoría (Opcional)</Label>
                            <Controller
                                name="subcategoryId"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={!selectedCategoryId || !subcategoriesForSelectedCategory || subcategoriesForSelectedCategory.length === 0}>
                                        <SelectTrigger><SelectValue placeholder="Selecciona una subcategoría" /></SelectTrigger>
                                        <SelectContent>
                                            {subcategoriesForSelectedCategory?.map(sub => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>

                        <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="notes">Notas (Opcional)</Label>
                            <Controller name="notes" control={control} render={({ field }) => <Input id="notes" {...field} />} />
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

    
