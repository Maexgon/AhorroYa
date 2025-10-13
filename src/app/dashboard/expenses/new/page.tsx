
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
import { useDoc } from '@/firebase/firestore/use-doc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, ArrowLeft, UploadCloud, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { processReceiptAction } from '../actions';
import { ProcessReceiptOutput } from '@/ai/flows/ocr-receipt-processing';
import type { Category, Subcategory, User as UserType, FxRate } from '@/lib/types';


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

export default function NewExpensePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = React.useState<string | null>(null);
  const [receiptBase64, setReceiptBase64] = React.useState<string | null>(null);
  const [isProcessingReceipt, setIsProcessingReceipt] = React.useState(false);
  const [tenantId, setTenantId] = React.useState<string | null>(null);


  const { control, handleSubmit, watch, formState: { errors }, setValue, reset } = useForm<ExpenseFormValues>({
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

  const selectedCategoryId = watch('categoryId');

  // 1. Fetch user's data to get the first tenantId
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData } = useDoc<UserType>(userDocRef);

  // Set tenantId only after we have the user document
  React.useEffect(() => {
    if (userData?.tenantIds && userData.tenantIds.length > 0) {
      setTenantId(userData.tenantIds[0]);
    }
  }, [userData]);


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

  const categoriesForAI = React.useMemo(() => {
    if (!categories || !allSubcategories) return '';
    const data = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      subcategories: allSubcategories.filter(sub => sub.categoryId === cat.id).map(sub => ({ id: sub.id, name: sub.name }))
    }));
    return JSON.stringify(data, null, 2);
  }, [categories, allSubcategories]);


  const handleReceiptChange = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !user || !tenantId || !categoriesForAI) return;

    if (file.size > 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Archivo demasiado grande', description: 'El tamaño máximo es 1MB.' });
      return;
    }

    setReceiptFile(file);
    setIsProcessingReceipt(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        setReceiptPreview(URL.createObjectURL(file));
        setReceiptBase64(base64String);

        const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
        
        const result = await processReceiptAction(base64String, tenantId, user.uid, fileType, categoriesForAI);
        
        setIsProcessingReceipt(false);

        if (!result.success || !result.data) {
            toast({
                variant: "destructive",
                title: 'Error de IA',
                description: result.error || 'No se pudo procesar el recibo. Intente con una imagen más clara.',
            });
             setReceiptFile(null);
             setReceiptPreview(null);
             setReceiptBase64(null);
            return;
        }
        
        const processedData = result.data;
        
        toast({
          title: 'Recibo procesado!',
          description: 'Los datos extraídos se han cargado en el formulario.',
        });
        
        if (processedData.razonSocial) setValue('entityName', processedData.razonSocial);
        if (processedData.cuit) setValue('entityCuit', processedData.cuit.replace(/[^0-9]/g, ''));
        if (processedData.total) setValue('amount', processedData.total);
        if (processedData.fecha) {
            const parsedDate = parseISO(processedData.fecha);
            if (!isNaN(parsedDate.getTime())) {
                setValue('date', parsedDate);
            }
        }
        if (processedData.categoryId) setValue('categoryId', processedData.categoryId);
        if (processedData.subcategoryId) setValue('subcategoryId', processedData.subcategoryId);
        if(processedData.medioPago) {
            const paymentMethodMap: { [key: string]: string } = {
                'efectivo': 'cash',
                'tarjeta de debito': 'debit',
                'tarjeta de credito': 'credit',
                'transferencia': 'transfer'
            };
            const mappedMethod = paymentMethodMap[processedData.medioPago.toLowerCase()];
            if (mappedMethod) setValue('paymentMethod', mappedMethod);
        }
      };
      reader.onerror = () => {
          setIsProcessingReceipt(false);
          toast({ variant: 'destructive', title: 'Error de Lectura', description: 'No se pudo leer el archivo seleccionado.' });
      }

    } catch (error: any) {
        console.error("Error processing receipt:", error);
        toast({ variant: 'destructive', title: 'Error Inesperado', description: error.message || 'No se pudo procesar el recibo.' });
        setReceiptFile(null);
        setReceiptPreview(null);
        setReceiptBase64(null);
        setIsProcessingReceipt(false);
    }
  };
  
  const onSubmit = async (data: ExpenseFormValues) => {
    if (!tenantId || !user || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al usuario o tenant.' });
        return;
    }
    setIsSubmitting(true);
    toast({ title: "Procesando...", description: "Guardando el gasto." });

    try {
        const batch = writeBatch(firestore);

        // 1. Handle Entity
        if (data.entityCuit) {
            const entitiesRef = collection(firestore, 'entities');
            const q = query(entitiesRef, where('tenantId', '==', tenantId), where('cuit', '==', data.entityCuit));
            const entitySnapshot = await getDocs(q);

            if (entitySnapshot.empty) {
                const newEntityRef = doc(collection(firestore, 'entities'));
                batch.set(newEntityRef, {
                    id: newEntityRef.id,
                    tenantId: tenantId,
                    cuit: data.entityCuit,
                    razonSocial: data.entityName,
                    tipo: 'comercio',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }
        }
        
        const newExpenseRef = doc(collection(firestore, 'expenses'));
        
        // 2. Handle Receipt if it exists
        if (receiptBase64 && receiptFile) {
             const newReceiptRef = doc(collection(firestore, 'receipts_raw'));
             batch.set(newReceiptRef, {
                id: newReceiptRef.id,
                tenantId: tenantId,
                userId: user.uid,
                expenseId: newExpenseRef.id,
                base64Content: receiptBase64,
                fileType: receiptFile.type.startsWith('image/') ? 'image' : 'pdf',
                status: 'processed',
                createdAt: new Date().toISOString(),
            });
        }
        
        let amountARS = data.amount;
        if (data.currency !== 'ARS' && fxRates) {
            const rate = fxRates.find(r => r.code === data.currency);
            if (rate) {
                amountARS = data.amount * rate.rateToARS;
            } else {
                toast({ variant: 'destructive', title: 'Error de Conversión', description: `No se encontró tipo de cambio para ${data.currency}. No se puede guardar el gasto.` });
                setIsSubmitting(false);
                return;
            }
        }


        // 3. Handle Expense
        batch.set(newExpenseRef, {
            id: newExpenseRef.id,
            tenantId: tenantId,
            userId: user.uid,
            date: data.date.toISOString(),
            amount: data.amount,
            currency: data.currency,
            amountARS: amountARS,
            categoryId: data.categoryId,
            subcategoryId: data.subcategoryId || null,
            entityCuit: data.entityCuit || '',
            entityName: data.entityName,
            paymentMethod: data.paymentMethod,
            notes: data.notes || '',
            source: receiptBase64 ? 'ocr' : 'manual',
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
        <div className="mx-auto max-w-2xl">
            <form onSubmit={handleSubmit(onSubmit)}>
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Cargar Recibo (Opcional)</CardTitle>
                        <CardDescription>Sube una imagen o PDF de tu recibo para autocompletar los datos con IA.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isProcessingReceipt ? (
                             <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-primary/50 rounded-md bg-primary/10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                <p className="mt-4 text-sm text-primary">Procesando con IA...</p>
                            </div>
                        ) : receiptPreview ? (
                            <div className="relative">
                                <img src={receiptPreview} alt="Vista previa del recibo" className="w-full h-auto max-h-60 object-contain rounded-md border" />
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-2 right-2 h-6 w-6"
                                    onClick={() => {
                                        setReceiptFile(null);
                                        setReceiptPreview(null);
                                        setReceiptBase64(null);
                                        reset(watch()); // Keep existing form values
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center w-full">
                                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary/50">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Haz clic para subir</span> o arrastra y suelta</p>
                                        <p className="text-xs text-muted-foreground">PNG, JPG, PDF (MAX. 1MB)</p>
                                    </div>
                                    <input id="dropzone-file" type="file" className="hidden" onChange={(e) => handleReceiptChange(e.target.files)} accept="image/png, image/jpeg, application/pdf" />
                                </label>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Detalles del Gasto</CardTitle>
                        <CardDescription>Completa o ajusta la información del gasto.</CardDescription>
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
                            </div>
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
                                    <Select onValueChange={(value) => { field.onChange(value); setValue('subcategoryId', ''); }} value={field.value}>
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
                        <Button type="submit" disabled={isSubmitting || isProcessingReceipt}>
                            {isSubmitting ? 'Guardando...' : 'Guardar Gasto'}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
      </main>
    </div>
  );
}
