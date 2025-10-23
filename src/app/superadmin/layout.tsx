'use client';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import type { User as UserType } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

  useEffect(() => {
    const isLoading = isUserLoading || isUserDocLoading;
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
    } else if (!userData?.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [user, userData, isUserLoading, isUserDocLoading, router]);

  const isLoading = isUserLoading || isUserDocLoading;
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!userData?.isSuperAdmin) {
     return (
        <div className="flex h-screen flex-col items-center justify-center bg-secondary/50 p-4 text-center">
            <ShieldAlert className="h-16 w-16 text-destructive" />
            <h1 className="mt-4 font-headline text-2xl font-bold">Acceso Denegado</h1>
            <p className="mt-2 text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
            <Button asChild className="mt-6">
            <Link href="/dashboard">Volver al Dashboard</Link>
            </Button>
        </div>
    );
  }

  return <>{children}</>;
}
