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
import { collection, query, where, writeBatch, doc, getDocs } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, UploadCloud, ArrowLeft, FileCheck2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { uploadReceiptAction } from '../actions';


const expenseFormSchema = z.object({
  receipt: z.any().optional(),
  entityName: z.string().min(1, "El nombre de la entidad es requerido."),
  entityCuit: z.string().min(11, "El CUIT debe tener 11 dígitos.").max(11, "El CUIT debe tener 11 dígitos."),
  date: z.date({ required_error: "La fecha es requerida." }),
  amount: z.coerce.number().min(0.01, "El monto debe ser mayor a 0."),
  currency: z.string().min(1, "La moneda es requerida."),
  categoryId: z.string().min(1, "La categoría es requerida."),
  subcategoryId: z.string().optional(),
  paymentMethod: z.string().min(1, "El método de pago es requerido."),
  notes: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export default function NewExpensePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isProcessingReceipt, setIsProcessingReceipt] = React.useState(false);
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(null);


  const { control, handleSubmit, watch, formState: { errors }, setValue, register } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      currency: 'ARS',
      paymentMethod: 'cash',
    }
  });

  const selectedCategoryId = watch('categoryId');

  // Fetch Tenant
  const tenantsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'tenants'), where('ownerUid', '==', user.uid), where('status', '==', 'active'));
  }, [firestore, user]);
  const { data: tenants } = useCollection(tenantsQuery);
  const activeTenant = tenants?.[0];

  // Fetch Categories
  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore || !activeTenant) return null;
    return query(collection(firestore, 'categories'), where('tenantId', '==', activeTenant.id));
  }, [firestore, activeTenant]);
  const { data: categories } = useCollection(categoriesQuery);

  // Fetch Subcategories based on selected category
  const subcategoriesQuery = useMemoFirebase(() => {
    if (!firestore || !activeTenant || !selectedCategoryId) return null;
    return query(collection(firestore, 'subcategories'), where('tenantId', '==', activeTenant.id), where('categoryId', '==', selectedCategoryId));
  }, [firestore, activeTenant, selectedCategoryId]);
  const { data: subcategories } = useCollection(subcategoriesQuery);


  const handleReceiptChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeTenant || !user) return;
    
    setSelectedFileName(file.name);
    setIsProcessingReceipt(true);
    toast({ title: 'Procesando Recibo...', description: 'La IA está extrayendo los datos. Por favor, espera.' });

    try {
        const formData = new FormData();
        formData.append('receipt', file);
        formData.append('tenantId', activeTenant.id);
        formData.append('userId', user.uid);

        const result = await uploadReceiptAction(formData);
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        if (result.data) {
            const { data } = result;
            if (data.razonSocial) setValue('entityName', data.razonSocial, { shouldValidate: true });
            if (data.cuit) setValue('entityCuit', data.cuit, { shouldValidate: true });
            if (data.fecha) {
                // The date can come as YYYY-MM-DD, we need to adjust for timezone issues.
                const dateParts = data.fecha.split('-').map(p => parseInt(p, 10));
                const utcDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
                setValue('date', utcDate, { shouldValidate: true });
            }
            if (data.total) setValue('amount', data.total, { shouldValidate: true });
            if (data.medioPago) setValue('paymentMethod', data.medioPago.toLowerCase(), { shouldValidate: true });
            toast({ title: '¡Datos Extraídos!', description: 'Los campos del formulario han sido actualizados. Por favor, revísalos.' });
        } else {
            toast({ variant: 'destructive', title: 'Error de Procesamiento', description: 'No se pudieron extraer datos del recibo.' });
        }

    } catch (error: any) {
        console.error("Error processing receipt: ", error);
        toast({ 
            variant: 'destructive', 
            title: 'Error al procesar recibo', 
            description: error.message || 'Ocurrió un problema al procesar el recibo.',
            duration: 10000,
        });
        setSelectedFileName(null);
    } finally {
        setIsProcessingReceipt(false);
    }
  };


  const onSubmit = async (data: ExpenseFormValues) => {
    if (!activeTenant || !user || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al usuario o tenant.' });
        return;
    }
    setIsSubmitting(true);
    toast({ title: "Procesando...", description: "Guardando el gasto." });

    try {
        const batch = writeBatch(firestore);

        // 1. Check if entity exists or create it
        const entitiesRef = collection(firestore, 'entities');
        const q = query(entitiesRef, where('tenantId', '==', activeTenant.id), where('cuit', '==', data.entityCuit));
        const entitySnapshot = await getDocs(q);

        let entityId;
        if (entitySnapshot.empty) {
            const newEntityRef = doc(entitiesRef);
            entityId = newEntityRef.id;
            batch.set(newEntityRef, {
                id: entityId,
                tenantId: activeTenant.id,
                cuit: data.entityCuit,
                razonSocial: data.entityName,
                tipo: 'comercio', // default type
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        } else {
            entityId = entitySnapshot.docs[0].id;
        }

        // 2. Create the expense document
        const newExpenseRef = doc(collection(firestore, 'expenses'));
        batch.set(newExpenseRef, {
            id: newExpenseRef.id,
            tenantId: activeTenant.id,
            userId: user.uid,
            date: data.date.toISOString(),
            amount: data.amount,
            currency: data.currency,
            amountARS: data.currency === 'ARS' ? data.amount : data.amount, // TODO: Add currency conversion
            categoryId: data.categoryId,
            subcategoryId: data.subcategoryId || null,
            entityCuit: data.entityCuit,
            entityName: data.entityName,
            paymentMethod: data.paymentMethod,
            notes: data.notes || '',
            source: selectedFileName ? 'ocr' : 'manual',
            status: 'posted',
            isRecurring: false,
            deleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        
        await batch.commit();

        toast({ title: "¡Éxito!", description: "El gasto ha sido guardado correctamente." });
        router.push('/dashboard/expenses');

    } catch (error) {
        console.error("Error saving expense:", error);
        toast({ variant: 'destructive', title: 'Error al Guardar', description: 'No se pudo guardar el gasto.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
        <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="container flex h-16 items-center">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/expenses">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="ml-4 font-headline text-xl font-bold">Cargar Gasto</h1>
            </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recibo</CardTitle>
                            <CardDescription>Sube una foto o PDF de tu recibo para que la IA extraiga los datos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="flex items-center justify-center w-full">
                                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary/50">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                                        { isProcessingReceipt ? (
                                            <>
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                                                <p className="text-sm text-muted-foreground">Procesando...</p>
                                            </>
                                        ) : selectedFileName ? (
                                             <>
                                                <FileCheck2 className="w-8 h-8 mb-4 text-green-500" />
                                                <p className="mb-2 text-sm text-muted-foreground font-semibold">{selectedFileName}</p>
                                                <p className="text-xs text-muted-foreground">Click para reemplazar</p>
                                            </>
                                        ) : (
                                            <>
                                                <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
                                                <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click para subir</span> o arrastra</p>
                                                <p className="text-xs text-muted-foreground">PNG, JPG, PDF (MAX. 5MB)</p>
                                            </>
                                        )}
                                    </div>
                                     <Input 
                                        id="dropzone-file" 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*,application/pdf" 
                                        {...register('receipt')}
                                        onChange={handleReceiptChange}
                                        disabled={isProcessingReceipt} 
                                    />
                                </label>
                            </div> 
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                     <Card>
                        <CardHeader>
                            <CardTitle>Detalles del Gasto</CardTitle>
                            <CardDescription>Completa la información manualmente o ajústala después del análisis del recibo.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                                <Label htmlFor="entityName">Nombre de la Entidad</Label>
                                <Controller name="entityName" control={control} render={({ field }) => <Input id="entityName" {...field} />} />
                                {errors.entityName && <p className="text-sm text-destructive">{errors.entityName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="entityCuit">CUIT de la Entidad</Label>
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
                           
                            <div className="space-y-2">
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
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ARS">ARS - Peso Argentino</SelectItem>
                                                <SelectItem value="USD">USD - Dólar Estadounidense</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="paymentMethod">Método de Pago</Label>
                                <Controller
                                    name="paymentMethod"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                             <div className="space-y-2">
                                <Label htmlFor="subcategoryId">Subcategoría (Opcional)</Label>
                                <Controller
                                    name="subcategoryId"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCategoryId || !subcategories || subcategories.length === 0}>
                                            <SelectTrigger><SelectValue placeholder="Selecciona una subcategoría" /></SelectTrigger>
                                            <SelectContent>
                                                {subcategories?.map(sub => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
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
                            <Button type="submit" disabled={isSubmitting || isProcessingReceipt}>
                                {isSubmitting ? 'Guardando...' : 'Guardar Gasto'}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </form>
      </main>
    </div>
  );
}
    

    