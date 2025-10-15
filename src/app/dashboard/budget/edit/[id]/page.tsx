
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
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { ArrowLeft, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import type { Category, Budget } from '@/lib/types';
import { cn } from '@/lib/utils';


const budgetFormSchema = z.object({
  year: z.coerce.number().min(new Date().getFullYear(), "El año no puede ser anterior al actual."),
  month: z.coerce.number().min(1).max(12),
  categoryId: z.string().min(1, "La categoría es requerida."),
  amountARS: z.coerce.number().min(0.01, "El monto debe ser mayor a 0."),
  currency: z.string(),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export default function EditBudgetPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const firestore = useFirestore();
  const budgetId = params.id as string;

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [openCategoryCombobox, setOpenCategoryCombobox] = React.useState(false);


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
        currency: 'ARS',
      });
    }
  }, [budgetData, reset]);

  const tenantId = budgetData?.tenantId;

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);

  const onSubmit = async (data: BudgetFormValues) => {
    if (!firestore || !budgetId) return;

    setIsSubmitting(true);
    toast({ title: "Procesando...", description: "Actualizando el presupuesto." });
    
    const budgetToUpdateRef = doc(firestore, 'budgets', budgetId);
    
    const updatedData = {
      ...data,
      // Ensure we don't accidentally overwrite tenantId or other crucial fields
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

  if (isLoadingBudget || isLoadingCategories) {
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
                                            onPointerDownOutside={(e) => e.preventDefault()}
                                        >
                                            <Command
                                                filter={(value, search) => {
                                                    const category = categories?.find(cat => cat.id === value);
                                                    if (category?.name.toLowerCase().includes(search.toLowerCase())) return 1;
                                                    return 0;
                                                }}
                                            >
                                                <CommandInput placeholder="Buscar categoría..." />
                                                <CommandEmpty>No se encontraron categorías.</CommandEmpty>
                                                <CommandGroup>
                                                    {categories?.map((cat) => (
                                                        <CommandItem
                                                            key={cat.id}
                                                            value={cat.id}
                                                            onSelect={(currentValue) => {
                                                                field.onChange(currentValue);
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

