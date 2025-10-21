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
import { collection, query, where, writeBatch, doc, getDocs, Firestore, setDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, ArrowLeft, UploadCloud, X, File as FileIcon, Plus, Camera } from 'lucide-react';
import Image from 'next/image';
import { format, parseISO, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { processReceiptAction } from '../actions';
import type { ProcessReceiptOutput } from '@/ai/flows/ocr-receipt-processing';
import type { Category, Subcategory, User as UserType, Currency, Entity } from '@/lib/types';
import { logAuditEvent } from '../../audit/actions';


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
  installments: z.coerce.number().optional(),
  cardType: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface FilePreview {
    file: File;
    previewUrl: string;
}

export default function NewExpensePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [receiptFiles, setReceiptFiles] = React.useState<FilePreview[]>([]);
  const [isProcessingReceipt, setIsProcessingReceipt] = React.useState(false);
  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [isEntityPopupOpen, setIsEntityPopupOpen] = React.useState(false);
  const [foundEntities, setFoundEntities] = React.useState<Entity[]>([]);


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
      installments: 1,
    }
  });

  React.useEffect(() => {
    // Set date default value on client side to avoid hydration error
    setValue('date', new Date());
  }, [setValue]);


  const selectedCategoryId = watch('categoryId');
  const paymentMethod = watch('paymentMethod');
  const entityNameValue = watch('entityName');

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
  
  const currenciesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'currencies');
  }, [firestore]);
  const { data: currencies } = useCollection<Currency>(currenciesQuery);
  
  const entitiesQuery = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return query(collection(firestore, 'entities'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: entities, isLoading: isLoadingEntities } = useCollection<Entity>(entitiesQuery);

  React.useEffect(() => {
    if (entityNameValue && entityNameValue.length >= 3 && entities) {
      const searchLower = entityNameValue.toLowerCase();
      const matches = entities.filter(e => e.razonSocial.toLowerCase().includes(searchLower));
      if (matches.length > 0) {
        setFoundEntities(matches);
        setIsEntityPopupOpen(true);
      } else {
        setIsEntityPopupOpen(false);
      }
    } else {
        setIsEntityPopupOpen(false);
    }
  }, [entityNameValue, entities]);

  const handleEntitySelect = (entity: Entity) => {
    setValue('entityName', entity.razonSocial);
    if(entity.cuit) setValue('entityCuit', entity.cuit);
    setIsEntityPopupOpen(false);
  }


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


  const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
      });
  };

  const handleReceiptChange = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user || !tenantId || !categoriesForAI) return;

    setIsProcessingReceipt(true);
    toast({ title: 'Procesando recibo(s)...' });

    try {
        const filePreviews: FilePreview[] = [];
        const base64Promises: Promise<string>[] = [];

        const isPdfUpload = files[0].type === 'application/pdf';
        
        if (isPdfUpload) {
            const file = files[0];
            filePreviews.push({ file, previewUrl: '' }); // No preview for PDF
            base64Promises.push(fileToBase64(file));
        } else {
             for (const f of Array.from(files)) {
                if (f.type.startsWith('image/')) {
                    base64Promises.push(fileToBase64(f));
                    filePreviews.push({ file: f, previewUrl: URL.createObjectURL(f) });
                }
            }
        }
        
        setReceiptFiles(prev => [...prev, ...filePreviews]);
        const base64Contents = await Promise.all(base64Promises);
        
        const result = await processReceiptAction({
            receiptId: crypto.randomUUID(),
            base64Contents: base64Contents,
            tenantId,
            userId: user.uid,
            fileType: isPdfUpload ? 'pdf' : 'image',
            categories: categoriesForAI,
        });
        
        handleAIResult(result);

    } catch (error: any) {
        console.error("Error processing receipt:", error);
        toast({ variant: 'destructive', title: 'Error Inesperado', description: error.message || 'No se pudo procesar el recibo.' });
        setReceiptFiles([]);
    } finally {
        setIsProcessingReceipt(false);
    }
};

  const handleAIResult = (result: { success: boolean; data?: ProcessReceiptOutput; error?: string; }) => {
    if (!result.success || !result.data) {
        toast({
            variant: "destructive",
            title: 'Error de IA',
            description: result.error || 'No se pudo procesar el recibo. Intente con una imagen más clara.',
        });
        setReceiptFiles([]);
        return;
    }
    
    const processedData = result.data;
    
    toast({
      title: '¡Recibo procesado!',
      description: 'Los datos extraídos se han cargado en el formulario.',
    });
    
    if (processedData.razonSocial) setValue('entityName', processedData.razonSocial);
    if (processedData.cuit) setValue('entityCuit', processedData.cuit.replace(/[^0-9]/g, ''));
    if (processedData.total) setValue('amount', processedData.total);
    if (processedData.fecha) {
        try {
            const parsedDate = parseISO(processedData.fecha);
            if (!isNaN(parsedDate.getTime())) {
                setValue('date', parsedDate);
            }
        } catch (e) {
            console.warn("Could not parse date from AI", processedData.fecha);
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

  const removeReceiptFile = (index: number) => {
      setReceiptFiles(files => files.filter((_, i) => i !== index));
  }
  
  async function findOrCreateEntity(firestore: Firestore, tenantId: string, data: ExpenseFormValues): Promise<string | null> {
    const entityName = data.entityName?.trim();
    if (!entityName) return null;

    const entityCuit = data.entityCuit?.trim();
    const entitiesRef = collection(firestore, 'entities');

    // 1. Try to find by CUIT if it's valid
    if (entityCuit && entityCuit.length === 11) {
        const q = query(entitiesRef, where('tenantId', '==', tenantId), where('cuit', '==', entityCuit));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].id;
        }
    }

    // 2. If not found by CUIT, try by name
    const qByName = query(entitiesRef, where('tenantId', '==', tenantId), where('razonSocial', '==', entityName));
    const byNameSnapshot = await getDocs(qByName);
    if (!byNameSnapshot.empty) {
        return byNameSnapshot.docs[0].id;
    }

    // 3. Create a new entity if none was found
    const newEntityRef = doc(entitiesRef);
    const newEntityData = {
        id: newEntityRef.id,
        tenantId: tenantId,
        cuit: entityCuit || '',
        razonSocial: entityName,
        tipo: 'comercio',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    
    await setDoc(newEntityRef, newEntityData);

    return newEntityRef.id;
  }

  const onSubmit = async (data: ExpenseFormValues) => {
    if (!tenantId || !user || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al usuario o tenant.' });
        return;
    }
    setIsSubmitting(true);
    toast({ title: "Procesando...", description: "Guardando el gasto." });

    const writes: {path: string, data: any}[] = [];

    try {
        let finalAmountARS = data.amount;
        if (data.currency === 'USD') {
            try {
                const response = await fetch('https://dolarapi.com/v1/dolares/oficial');
                if (!response.ok) throw new Error('No se pudo obtener el tipo de cambio.');
                const rates = await response.json();
                finalAmountARS = data.amount * rates.venta;
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error de Red', description: 'No se pudo obtener el tipo de cambio del dólar. El gasto no fue guardado.' });
                setIsSubmitting(false);
                return;
            }
        }
        
        const entityId = await findOrCreateEntity(firestore, tenantId, data);
        
        const batch = writeBatch(firestore);

        const installments = data.paymentMethod === 'credit' ? data.installments || 1 : 1;
        const installmentAmount = data.amount / installments;
        const installmentAmountARS = finalAmountARS / installments;
        const originalNotes = data.notes || '';
        const createdExpenseIds: string[] = [];

        for (let i = 0; i < installments; i++) {
            const newExpenseRef = doc(collection(firestore, 'expenses'));
            createdExpenseIds.push(newExpenseRef.id);
            
            const expenseDate = addMonths(data.date, i);
            
            const notesWithInstallment = installments > 1 
                ? `${originalNotes} (Cuota ${i + 1}/${installments})`.trim()
                : originalNotes;

            const expenseData = {
                id: newExpenseRef.id,
                tenantId: tenantId,
                userId: user.uid,
                date: expenseDate.toISOString(),
                amount: parseFloat(installmentAmount.toFixed(2)),
                currency: data.currency,
                amountARS: parseFloat(installmentAmountARS.toFixed(2)),
                categoryId: data.categoryId,
                subcategoryId: data.subcategoryId || null,
                entityId: entityId,
                entityCuit: data.entityCuit?.trim() || '',
                entityName: data.entityName?.trim(),
                paymentMethod: data.paymentMethod,
                isRecurring: false,
                notes: notesWithInstallment,
                source: 'manual',
                status: 'posted',
                deleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...(installments > 1 && {
                    installments: installments,
                    installmentNumber: i + 1,
                    cardType: data.cardType || null,
                })
            };

            batch.set(newExpenseRef, expenseData);
            writes.push({ path: newExpenseRef.path, data: expenseData });
        }
        
        await batch.commit();

        for (const expenseId of createdExpenseIds) {
            const finalData = writes.find(w => w.path.includes(expenseId))?.data;
            if (finalData) {
                logAuditEvent({
                    tenantId: tenantId,
                    userId: user.uid,
                    action: 'create',
                    entity: 'expense',
                    entityId: expenseId,
                    before: null,
                    after: finalData,
                });
            }
        }

        toast({ title: "¡Éxito!", description: "El gasto ha sido guardado correctamente." });
        router.push('/dashboard/expenses');

    } catch (error) {
        console.error("Error in onSubmit:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'batch-write',
            operation: 'write',
            requestResourceData: writes,
        }));
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
                        <CardDescription>Sube imágenes o un PDF de tu recibo para autocompletar los datos con IA.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isProcessingReceipt ? (
                             <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-primary/50 rounded-md bg-primary/10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                <p className="mt-4 text-sm text-primary">Procesando con IA...</p>
                            </div>
                        ) : receiptFiles.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {receiptFiles.map((file, index) => (
                                    <div key={index} className="relative group aspect-square">
                                        {file.file.type.startsWith('image/') ? (
                                            <Image src={file.previewUrl} alt={`Vista previa ${index + 1}`} fill className="object-cover rounded-md border" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full bg-muted rounded-md border">
                                                <FileIcon className="h-10 w-10 text-muted-foreground" />
                                                <p className="text-xs text-center text-muted-foreground mt-2 px-1 truncate">{file.file.name}</p>
                                            </div>
                                        )}
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => removeReceiptFile(index)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                {receiptFiles.length > 0 && !receiptFiles.some(f => f.file.type === 'application/pdf') && (
                                <label htmlFor="receipt-file-input" className="flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary/50">
                                    <div className="flex flex-col items-center justify-center">
                                        <Plus className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <input id="receipt-file-input" type="file" className="hidden" multiple onChange={(e) => handleReceiptChange(e.target.files)} accept="image/png, image/jpeg"/>
                                </label>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center w-full gap-4">
                                <input id="receipt-file-input" type="file" className="hidden" multiple onChange={(e) => handleReceiptChange(e.target.files)} accept="image/png, image/jpeg, application/pdf" />
                                <label htmlFor="receipt-file-input" className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary/50" onClick={() => document.getElementById('receipt-file-input')?.removeAttribute('capture')}>
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Subir archivo</span></p>
                                        <p className="text-xs text-muted-foreground">Imágenes o PDF (MAX 5MB)</p>
                                    </div>
                                </label>
                                <label htmlFor="receipt-file-input" className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary/50" onClick={() => {
                                  const input = document.getElementById('receipt-file-input');
                                  if (input) {
                                      input.setAttribute('capture', 'environment')
                                      input.click();
                                  }
                                }}>
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Camera className="w-8 h-8 mb-2 text-muted-foreground" />
                                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Tomar Foto</span></p>
                                        <p className="text-xs text-muted-foreground">Usa la cámara de tu dispositivo</p>
                                    </div>
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
                           <Popover open={isEntityPopupOpen} onOpenChange={setIsEntityPopupOpen}>
                                <PopoverTrigger asChild>
                                    <div className="relative">
                                         <Controller
                                            name="entityName"
                                            control={control}
                                            render={({ field }) => <Input id="entityName" {...field} autoComplete="off" />}
                                        />
                                    </div>
                                </PopoverTrigger>
                                {foundEntities.length > 0 && (
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                    <div className="space-y-1 max-h-60 overflow-y-auto">
                                        {foundEntities.map(entity => (
                                            <div key={entity.id} className="p-3 border-b last:border-b-0 rounded-md hover:bg-accent cursor-pointer" onClick={() => handleEntitySelect(entity)}>
                                                <p className="font-semibold">{entity.razonSocial}</p>
                                                {entity.cuit && <p className="text-sm text-muted-foreground">CUIT: {entity.cuit}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </PopoverContent>
                                )}
                            </Popover>
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
                                                <SelectItem value="USD">USD</SelectItem>
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

                        {paymentMethod === 'credit' && (
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="installments">Cuotas</Label>
                                    <Controller
                                        name="installments"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {[1, 3, 6, 12, 24].map(i => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cardType">Tipo de Tarjeta</Label>
                                    <Controller
                                        name="cardType"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="visa">Visa</SelectItem>
                                                    <SelectItem value="mastercard">Mastercard</SelectItem>
                                                    <SelectItem value="amex">American Express</SelectItem>
                                                    <SelectItem value="diners">Diners</SelectItem>
                                                    <SelectItem value="other">Otra</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="categoryId">Categoría</Label>
                            <Controller
                                name="categoryId"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={(value) => {
                                        field.onChange(value);
                                        setValue('subcategoryId', '');
                                    }} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona una categoría" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories?.map((cat) => (
                                                <SelectItem key={cat.id} value={cat.id}>
                                                    {cat.name}
                                                </SelectItem>
                                            ))}
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
