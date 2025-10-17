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
import { doc, updateDoc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, ArrowLeft, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import type { Income } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';

const incomeFormSchema = z.object({
  date: z.date({ required_error: "La fecha es requerida." }),
  amount: z.coerce.number().min(0.01, "El monto debe ser mayor a 0."),
  currency: z.string().min(1, "La moneda es requerida."),
  category: z.string().min(1, "La categoría es requerida."),
  description: z.string().optional(),
});

type IncomeFormValues = z.infer<typeof incomeFormSchema>;

const incomeCategories = [
  { value: "salarios", label: "Salarios" },
  { value: "inversiones", label: "Inversiones" },
  { value: "premios o comisiones", label: "Premios o Comisiones" },
  { value: "otros", label: "Otros" },
];

export default function EditIncomePage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const firestore = useFirestore();

  const incomeId = params.id as string;
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const incomeRef = useMemoFirebase(() => {
    if (!firestore || !incomeId) return null;
    return doc(firestore, 'incomes', incomeId);
  }, [firestore, incomeId]);
  const { data: incomeData, isLoading: isLoadingIncome } = useDoc<Income>(incomeRef);

  const { control, handleSubmit, formState: { errors }, reset } = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeFormSchema),
  });

  React.useEffect(() => {
    if (incomeData) {
      reset({
        ...incomeData,
        date: new Date(incomeData.date),
        description: incomeData.description || '',
      });
    }
  }, [incomeData, reset]);

  const onSubmit = async (data: IncomeFormValues) => {
    if (!firestore || !incomeId) return;

    setIsSubmitting(true);
    toast({ title: "Procesando...", description: "Actualizando el ingreso." });

    const incomeToUpdateRef = doc(firestore, 'incomes', incomeId);
    
    // Assuming ARS for now, logic can be expanded
    const amountARS = data.amount;

    const updatedData = {
        ...data,
        date: data.date.toISOString(),
        amountARS,
        updatedAt: new Date().toISOString(),
    };

    updateDoc(incomeToUpdateRef, updatedData)
      .then(() => {
        toast({ title: "¡Éxito!", description: "El ingreso ha sido actualizado." });
        router.push('/dashboard/income');
      })
      .catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: incomeToUpdateRef.path,
          operation: 'update',
          requestResourceData: updatedData,
        }));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  if (isLoadingIncome) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Cargando ingreso...</p>
      </div>
    );
  }

  if (!incomeData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50">
        <p className="text-destructive">No se pudo encontrar el ingreso.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/dashboard/income">Volver a Ingresos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex h-16 items-center">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/income">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="ml-4 font-headline text-xl font-bold">Editar Ingreso</h1>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-lg">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle>Detalles del Ingreso</CardTitle>
                <CardDescription>Ajusta la información de tu ingreso.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="date">Fecha del Ingreso</Label>
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
                    <div className="space-y-2">
                        <Label htmlFor="category">Categoría</Label>
                        <Controller
                            name="category"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
                                    <SelectContent>
                                        {incomeCategories.map(cat => (
                                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
                    </div>
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

                <div className="space-y-2">
                    <Label htmlFor="description">Descripción (Opcional)</Label>
                    <Controller name="description" control={control} render={({ field }) => <Textarea id="description" {...field} />} />
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
