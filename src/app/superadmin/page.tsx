'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Building, FileKey, Loader2 } from 'lucide-react';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Tenant, User as UserType, License } from '@/lib/types';
import { collection } from 'firebase/firestore';


export default function SuperAdminPage() {
    const firestore = useFirestore();

    const tenantsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'tenants');
    }, [firestore]);
    const { data: tenants, isLoading: isLoadingTenants } = useCollection<Tenant>(tenantsQuery);

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);
    const { data: users, isLoading: isLoadingUsers } = useCollection<UserType>(usersQuery);

    const licensesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'licenses');
    }, [firestore]);
    const { data: licenses, isLoading: isLoadingLicenses } = useCollection<License>(licensesQuery);

    const activeLicenses = licenses?.filter(l => l.status === 'active').length || 0;
    const isLoading = isLoadingTenants || isLoadingUsers || isLoadingLicenses;
  
  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex h-16 items-center">
          <h1 className="font-headline text-xl font-bold">Panel de Superadministrador</h1>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-8">
         {isLoading ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
         ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Tenants</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">{tenants?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Total de clientes registrados.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Usuarios</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">{users?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Usuarios en toda la plataforma.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Licencias Activas</CardTitle>
                <FileKey className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">{activeLicenses}</div>
                <p className="text-xs text-muted-foreground">Del total de {licenses?.length || 0} licencias.</p>
                </CardContent>
            </Card>
            </div>
         )}
      </main>
    </div>
  );
}
