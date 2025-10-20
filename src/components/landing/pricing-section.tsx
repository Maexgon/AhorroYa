
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Check, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useUser } from '@/firebase';
import { subscribeToPlanAction } from '@/app/subscribe/actions';

const plans = [
    {
        name: 'Demo',
        price: 'Gratis',
        description: 'Prueba las funcionalidades básicas por 15 días.',
        features: ['1 Usuario', 'Funcionalidades básicas', 'Válido por 15 días'],
        planId: 'demo'
    },
    {
        name: 'Personal',
        price: 'ARS 25.200',
        description: 'Ideal para empezar a tomar el control de tus finanzas.',
        features: ['1 Usuario', 'Seguimiento de gastos', 'Presupuestos mensuales', 'Análisis IA Básico'],
        planId: 'personal'
    },
    {
        name: 'Familiar',
        price: 'ARS 80.640',
        description: 'Perfecto para gestionar las finanzas de toda la familia.',
        features: ['Hasta 4 usuarios', 'Presupuestos compartidos', 'Reportes consolidados', 'Análisis IA Avanzado'],
        planId: 'familiar',
        highlight: true,
    },
    {
        name: 'Empresa',
        price: 'ARS 176.400',
        description: 'La solución para pequeñas empresas y emprendedores.',
        features: ['Hasta 10 usuarios', 'Gestión de recibos con IA', 'Exportación de datos', 'Soporte prioritario'],
        planId: 'empresa'
    }
]

export default function PricingSection({ isSubscribeFlow = false }: { isSubscribeFlow?: boolean }) {
    const router = useRouter();
    const { toast } = useToast();
    const { user, isUserLoading } = useUser();
    const [isLoading, setIsLoading] = React.useState('');

    const handleSelectPlan = async (planId: string) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes iniciar sesión para seleccionar un plan.' });
            router.push('/login');
            return;
        }

        setIsLoading(planId);

        try {
            const result = await subscribeToPlanAction({ planId, userId: user.uid });

            if (result.success) {
                toast({
                    title: '¡Plan activado!',
                    description: `Has seleccionado el plan ${planId}. ¡Bienvenido a Ahorro Ya!`,
                });
                router.push('/dashboard');
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Error al suscribirse',
                    description: result.error || 'No se pudo activar el plan.',
                });
            }
        } catch (error: any) {
            console.error("Error in handleSelectPlan:", error);
            toast({
                variant: 'destructive',
                title: 'Error inesperado',
                description: error.message || 'Ocurrió un error al procesar tu solicitud.',
            });
        } finally {
            setIsLoading('');
        }
    };

    const getButtonAction = (plan: typeof plans[0]) => {
        if (isSubscribeFlow) {
            handleSelectPlan(plan.planId);
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full max-w-7xl mx-auto">
                    {plans.map((plan) => (
                        <Card key={plan.planId} className={`flex flex-col ${plan.highlight ? 'border-primary ring-2 ring-primary shadow-lg' : ''}`}>
                            <CardHeader className="pb-4">
                                <CardTitle className="font-headline text-2xl">{plan.name}</CardTitle>
                                <CardDescription>{plan.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 space-y-6">
                                <div className="text-4xl font-bold font-headline">{plan.price}<span className="text-sm font-normal text-muted-foreground">{plan.planId !== 'demo' && '/año'}</span></div>
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
                                    onClick={() => getButtonAction(plan)}
                                    disabled={isUserLoading || isLoading !== ''}
                                >
                                    {isLoading === plan.planId ? <Loader2 className="animate-spin" /> : (isSubscribeFlow ? 'Seleccionar Plan' : 'Comenzar Ahora')}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
