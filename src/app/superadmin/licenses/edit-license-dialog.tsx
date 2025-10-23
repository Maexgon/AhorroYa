
'use client';
import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { License } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface EditLicenseDialogProps {
  license: License;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const planUserLimits: { [key: string]: number } = {
    demo: 1,
    personal: 1,
    familiar: 4,
    empresa: 10,
};

const licenseFormSchema = z.object({
    plan: z.string().min(1, "El plan es requerido."),
    status: z.string().min(1, "El estado es requerido."),
    endDate: z.date({ required_error: "La fecha de fin es requerida." }),
    maxUsers: z.coerce.number().min(1, "Debe haber al menos 1 usuario."),
});

type LicenseFormValues = z.infer<typeof licenseFormSchema>;

export function EditLicenseDialog({ license, open, onOpenChange, onSuccess }: EditLicenseDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<LicenseFormValues>({
    resolver: zodResolver(licenseFormSchema),
  });
  
  const selectedPlan = watch('plan');

  React.useEffect(() => {
    if (license) {
      reset({
        plan: license.plan,
        status: license.status,
        endDate: new Date(license.endDate),
        maxUsers: license.maxUsers,
      });
    }
  }, [license, reset]);
  
  React.useEffect(() => {
    if (selectedPlan && planUserLimits[selectedPlan]) {
      setValue('maxUsers', planUserLimits[selectedPlan]);
    }
  }, [selectedPlan, setValue]);

  const handleSave = async (data: LicenseFormValues) => {
    if (!firestore) return;
    setIsProcessing(true);
    
    const licenseRef = doc(firestore, 'licenses', license.id);
    
    const updateData = {
        ...data,
        endDate: data.endDate.toISOString(),
    };

    try {
      await updateDoc(licenseRef, updateData);
      toast({ title: "¡Éxito!", description: "La licencia ha sido actualizada." });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating license:", error);
      toast({ variant: 'destructive', title: "Error", description: "No se pudo actualizar la licencia." });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Licencia</DialogTitle>
          <DialogDescription>
            Modifica los detalles de la licencia para el tenant. ID: <code className="text-xs">{license.id}</code>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="plan">Plan</Label>
                    <Controller
                        name="plan"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger id="plan"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="demo">Demo</SelectItem>
                                    <SelectItem value="personal">Personal</SelectItem>
                                    <SelectItem value="familiar">Familiar</SelectItem>
                                    <SelectItem value="empresa">Empresa</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.plan && <p className="text-sm text-destructive">{errors.plan.message}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="status">Estado</Label>
                     <Controller
                        name="status"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="expired">Expired</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="grace_period">Grace Period</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="endDate">Fecha de Vencimiento</Label>
                <Controller
                    name="endDate"
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
                {errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="maxUsers">Máximo de Usuarios</Label>
                <Controller
                    name="maxUsers"
                    control={control}
                    render={({ field }) => <Input id="maxUsers" type="number" {...field} />}
                />
                {errors.maxUsers && <p className="text-sm text-destructive">{errors.maxUsers.message}</p>}
            </div>
            
             <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={isProcessing}>
                    {isProcessing ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
