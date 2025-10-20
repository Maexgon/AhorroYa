
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useUser, errorEmitter, FirestorePermissionError, useFirestore } from '@/firebase';
import { writeBatch, doc, collection, query, where, getDocs } from "firebase/firestore";
import { defaultCategories } from '@/lib/default-categories';

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
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = React.useState(''); // Store planId of loading plan

     const handleSelectPlan = async (plan: typeof plans[0]) => {
        if (!user || !user.displayName) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes iniciar sesión para seleccionar un plan.' });
            router.push('/login');
            return;
        }

        if (plan.planId === 'demo' && !isSubscribeFlow) {
            router.push('/register');
            return;
        }

        setIsLoading(plan.planId);
        let writes: any[] = [];
        
        try {
            // Check if tenant already exists
            const tenantsRef = collection(firestore, "tenants");
            const q = query(tenantsRef, where("ownerUid", "==", user.uid));
            const querySnapshot = await getDocs(q);

            let tenantId: string;
            let tenantRef;

            if (querySnapshot.empty) {
                // --- No tenant exists, create a new one ---
                const batch = writeBatch(firestore);
                tenantRef = doc(collection(firestore, "tenants"));
                tenantId = tenantRef.id;

                // 1. Create User doc
                const userRef = doc(firestore, "users", user.uid);
                const userData = {
                    uid: user.uid,
                    displayName: user.displayName,
                    email: user.email,
                    photoURL: user.photoURL,
                    tenantIds: [tenantId],
                    isSuperadmin: false,
                };
                batch.set(userRef, userData);
                writes.push({ path: userRef.path, data: userData });

                // 2. Create Tenant doc
                const tenantData = {
                    id: tenantId,
                    type: plan.planId.toUpperCase(),
                    name: `Espacio de ${user.displayName.split(' ')[0]}`,
                    baseCurrency: "ARS",
                    createdAt: new Date().toISOString(),
                    ownerUid: user.uid,
                    status: "pending", // Will be activated by license
                    settings: JSON.stringify({ quietHours: true, rollover: false }),
                };
                batch.set(tenantRef, tenantData);
                writes.push({ path: tenantRef.path, data: tenantData });

                // 3. Create Membership doc
                const membershipRef = doc(firestore, "memberships", `${tenantId}_${user.uid}`);
                const membershipData = {
                    tenantId: tenantId,
                    uid: user.uid,
                    displayName: user.displayName,
                    email: user.email,
                    role: 'owner',
                    status: 'active',
                    joinedAt: new Date().toISOString()
                };
                batch.set(membershipRef, membershipData);
                writes.push({ path: membershipRef.path, data: membershipData });

                // 4. Create default categories
                defaultCategories.forEach((category, catIndex) => {
                    const categoryId = crypto.randomUUID();
                    const categoryRef = doc(firestore, "categories", categoryId);
                    const categoryData = { id: categoryId, tenantId: tenantId, name: category.name, color: category.color, order: catIndex };
                    batch.set(categoryRef, categoryData);
                    writes.push({ path: categoryRef.path, data: categoryData });

                    category.subcategories.forEach((subcategoryName, subCatIndex) => {
                        const subcategoryId = crypto.randomUUID();
                        const subcategoryRef = doc(firestore, "subcategories", subcategoryId);
                        const subData = { id: subcategoryId, tenantId: tenantId, categoryId: categoryId, name: subcategoryName, order: subCatIndex };
                        batch.set(subcategoryRef, subData);
                        writes.push({ path: subcategoryRef.path, data: subData });
                    });
                });
                await batch.commit();
                writes = []; // Reset after commit
            } else {
                const tenantDoc = querySnapshot.docs[0];
                tenantId = tenantDoc.id;
                tenantRef = tenantDoc.ref;
                if(tenantDoc.data().status === 'active') {
                    toast({ title: 'Ya tienes un plan activo.', description: 'Redirigiendo al dashboard.' });
                    router.push('/dashboard');
                    setIsLoading('');
                    return;
                }
            }
            
            // --- Create License and Activate Tenant ---
            const licenseBatch = writeBatch(firestore);
            const licenseRef = doc(collection(firestore, "licenses"));

            const startDate = new Date();
            const endDate = new Date();
            if (plan.planId === 'demo') {
                endDate.setDate(startDate.getDate() + 15);
            } else {
                endDate.setFullYear(startDate.getFullYear() + 1);
            }

            const maxUsersMapping: { [key: string]: number } = {
                personal: 1, familiar: 4, empresa: 10, demo: 1,
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
            licenseBatch.set(licenseRef, licenseData);
            writes.push({ path: licenseRef.path, data: licenseData });
            
            const tenantUpdateData = { status: "active" };
            licenseBatch.update(tenantRef, tenantUpdateData);
            writes.push({ path: tenantRef.path, data: tenantUpdateData });

            await licenseBatch.commit();

            toast({
                title: '¡Plan activado!',
                description: `Has seleccionado el plan ${plan.name}. ¡Bienvenido a Ahorro Ya!`,
            });
            router.push('/dashboard');

        } catch (error: any) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'batch-write-subscription',
                operation: 'write',
                requestResourceData: writes
            }));
        } finally {
            setIsLoading('');
        }
    }


    const getButtonAction = (plan: typeof plans[0]) => {
        if (isSubscribeFlow) {
            handleSelectPlan(plan);
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
                                    disabled={isUserLoading || (isLoading !== '' && isLoading !== plan.planId)}
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
