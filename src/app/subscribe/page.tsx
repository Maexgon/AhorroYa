
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { AhorroYaLogo } from '@/components/shared/icons';
import PricingSection from '@/components/landing/pricing-section';
import { doc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { User as UserType } from '@/lib/types';


export default function SubscribePage() {
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    // Check if the user already has an active tenant.
    const userDocRef = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      return doc(firestore, 'users', user.uid);
    }, [user, firestore]);
    const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

    const tenantId = userData?.tenantIds?.[0];
    const tenantDocRef = useMemoFirebase(() => {
        if (!tenantId || !firestore) return null;
        return doc(firestore, 'tenants', tenantId);
    }, [tenantId, firestore]);
    const { data: tenantData, isLoading: isTenantLoading } = useDoc(tenantDocRef);

    React.useEffect(() => {
        const isLoading = isUserLoading || isUserDocLoading || isTenantLoading;

        // If not loading and user is not authenticated, redirect to login
        if (!isLoading && !user) {
            router.replace('/login');
        }

        // If not loading and user has an active tenant, redirect to dashboard
        if (!isLoading && tenantData?.status === 'active') {
             router.replace('/dashboard');
        }

    }, [user, isUserLoading, userData, isUserDocLoading, tenantData, isTenantLoading, router]);
    
    if (isUserLoading || isUserDocLoading || isTenantLoading) {
        return (
          <div className="flex h-screen items-center justify-center">
            <AhorroYaLogo className="h-12 w-12 animate-spin text-primary" />
          </div>
        );
    }

    // This check prevents rendering the page for an unauthenticated user while redirecting
    if (!user) {
        return null;
    }

    // If tenant exists and is active, this will be null while redirecting
    if (tenantData?.status === 'active') {
        return (
             <div className="flex h-screen items-center justify-center">
                <AhorroYaLogo className="h-12 w-12 animate-spin text-primary" />
                <p className="ml-4">Ya tienes un plan activo, redirigiendo...</p>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50 p-4">
             <PricingSection isSubscribeFlow={true} />
        </div>
    );
}
