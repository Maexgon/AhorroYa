
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { getFirestore, writeBatch, doc, collection, query, where, getDocs } from "firebase/firestore";

const plans = [
    {
        name: 'Personal',
        price: '$1.000',
        description: 'Ideal para empezar a tomar el control de tus finanzas.',
        features: ['1 Usuario', 'Seguimiento de gastos', 'Presupuestos mensuales', 'Análisis IA Básico'],
        planId: 'personal'
    },
    {
        name: 'Familiar',
        price: '$3.000',
        description: 'Perfecto para gestionar las finanzas de toda la familia.',
        features: ['Hasta 4 usuarios', 'Presupuestos compartidos', 'Reportes consolidados', 'Análisis IA Avanzado'],
        planId: 'familiar',
        highlight: true,
    },
    {
        name: 'Empresa',
        price: '$8.000',
        description: 'La solución para pequeñas empresas y emprendedores.',
        features: ['Hasta 10 usuarios', 'Gestión de recibos con IA', 'Exportación de datos', 'Soporte prioritario'],
        planId: 'empresa'
    }
]

export default function PricingSection({ isSubscribeFlow = false }: { isSubscribeFlow?: boolean }) {
    const router = useRouter();
    const { toast } = useToast();
    const { user, isUserLoading } = useUser();
    const [isLoading, setIsLoading] = React.useState(''); // Store planId of loading plan

     const handleSelectPlan = async (plan: typeof plans[0]) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes iniciar sesión para seleccionar un plan.' });
            router.push('/login');
            return;
        }

        setIsLoading(plan.planId);
        const firestore = getFirestore();
        let requestResourceData: any[] = [];
        
        try {
            const tenantsRef = collection(firestore, "tenants");
            const q = query(tenantsRef, where("ownerUid", "==", user.uid), where("status", "==", "pending"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                const activeQuery = query(tenantsRef, where("ownerUid", "==", user.uid), where("status", "==", "active"));
                const activeSnapshot = await getDocs(activeQuery);
                if (!activeSnapshot.empty) {
                    toast({ title: 'Ya tienes un plan activo.', description: 'Redirigiendo al dashboard.' });
                    router.push('/dashboard');
                    return;
                }
                throw new Error("No se encontró un tenant pendiente para este usuario. Contacta a soporte.");
            }

            const tenantDoc = querySnapshot.docs[0];
            const tenantId = tenantDoc.id;

            const batch = writeBatch(firestore);
            const licenseRef = doc(collection(firestore, "licenses"));
            const tenantRef = doc(firestore, "tenants", tenantId);
            
            const startDate = new Date();
            const endDate = new Date();
            endDate.setFullYear(endDate.getFullYear() + 1);

            const maxUsersMapping = {
                personal: 1,
                familiar: 4,
                empresa: 10,
            };

            const licenseData = {
                id: licenseRef.id,
                tenantId: tenantId,
                plan: plan.planId,
                status: 'active',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                maxUsers: maxUsersMapping[plan.planId as keyof typeof maxUsersMapping],
                paymentId: `sim_${crypto.randomUUID()}`,
            };
            batch.set(licenseRef, licenseData);
            requestResourceData.push({ path: licenseRef.path, data: licenseData });
            
            const tenantUpdateData = { status: "active" };
            batch.update(tenantRef, tenantUpdateData);
            requestResourceData.push({ path: tenantRef.path, data: tenantUpdateData });

            await batch.commit();

            toast({
                title: '¡Plan activado!',
                description: `Has seleccionado el plan ${plan.name}. ¡Bienvenido a Ahorro Ya!`,
            });
            router.push('/dashboard');

        } catch (error: any) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'batch-write',
                operation: 'write',
                requestResourceData: requestResourceData
            }));
        } finally {
            setIsLoading('');
        }
    }


    const getButtonAction = (planId: string) => {
        if (isSubscribeFlow) {
            handleSelectPlan(plans.find(p => p.planId === planId)!);
        } else {
            router.push('/register');
        }
    };
    
    return (
        <section id="pricing" className="w-full py-12 md:py-24 lg:py-32">
            <div className="container px-4 md:px-6">
                <div className="mx-auto max-w-4xl w-full text-center mb-12">
                    <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl">Planes para cada necesidad</h2>
                    <p className="text-muted-foreground mt-2 text-lg">Elige el plan que mejor se adapte a tu vida financiera. Simple y transparente.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mx-auto">
                    {plans.map((plan) => (
                        <Card key={plan.planId} className={`flex flex-col ${plan.highlight ? 'border-primary ring-2 ring-primary shadow-lg' : ''}`}>
                            <CardHeader className="pb-4">
                                <CardTitle className="font-headline text-2xl">{plan.name}</CardTitle>
                                <CardDescription>{plan.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 space-y-6">
                                <div className="text-4xl font-bold font-headline">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mes</span></div>
                                <ul className="space-y-3 text-sm">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-primary" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                            <CardFooter>
                                <Button 
                                    className="w-full" 
                                    variant={plan.highlight ? 'default' : 'outline'}
                                    onClick={() => getButtonAction(plan.planId)}
                                    disabled={isUserLoading || isLoading !== ''}
                                >
                                    {isLoading === plan.planId ? 'Procesando...' : (isSubscribeFlow ? 'Seleccionar Plan' : 'Comenzar Ahora')}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
