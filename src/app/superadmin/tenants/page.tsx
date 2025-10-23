'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Tenant, User as UserType, License } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { TenantsDataTable } from './data-table';
import { columns } from './columns';

export default function SuperAdminTenantsPage() {
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

    const tableData = React.useMemo(() => {
        if (!tenants || !users || !licenses) return [];
        
        const userMap = new Map(users.map(u => [u.uid, u]));
        const licenseMap = new Map(licenses.map(l => [l.tenantId, l]));

        return tenants.map(tenant => ({
            tenant,
            owner: userMap.get(tenant.ownerUid),
            license: licenseMap.get(tenant.id)
        }));
    }, [tenants, users, licenses]);

    const isLoading = isLoadingTenants || isLoadingUsers || isLoadingLicenses;
  
  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex h-16 items-center">
          <h1 className="font-headline text-xl font-bold">Gestión de Tenants</h1>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-8">
         <Card>
            <CardHeader>
                <CardTitle>Todos los Tenants</CardTitle>
                <CardDescription>Visualiza y administra todos los tenants de la plataforma.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : (
                    <TenantsDataTable columns={columns} data={tableData} />
                )}
            </CardContent>
         </Card>
      </main>
    </div>
  );
}
