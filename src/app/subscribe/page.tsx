
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useUser } from '@/firebase';
import { AhorroYaLogo } from '@/components/shared/icons';
import PricingSection from '@/components/landing/pricing-section';


export default function SubscribePage() {
    const router = useRouter();
    const { user, isUserLoading } = useUser();

    React.useEffect(() => {
        // If user is loaded and not authenticated, redirect to login
        if (!isUserLoading && !user) {
            router.replace('/login');
        }
    }, [user, isUserLoading, router]);
    
    if (isUserLoading) {
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


    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50 p-4">
             <PricingSection isSubscribeFlow={true} />
        </div>
    );
}

    
