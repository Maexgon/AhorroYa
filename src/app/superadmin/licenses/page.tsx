'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Tenant, License, Membership } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { LicensesDataTable } from './data-table';
import { columns } from './columns';

export default function SuperAdminLicensesPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    // The parent layout now ensures that 'user' is available here.
    // We can safely assume firestore and user exist.
    const licensesQuery = useMemoFirebase(() => collection(firestore, 'licenses'), [firestore]);
    const { data: licenses, isLoading: isLoadingLicenses } = useCollection<License>(licensesQuery);

    const tenantsQuery = useMemoFirebase(() => collection(firestore, 'tenants'), [firestore]);
    const { data: tenants, isLoading: isLoadingTenants } = useCollection<Tenant>(tenantsQuery);

    const membershipsQuery = useMemoFirebase(() => collection(firestore, 'memberships'), [firestore]);
    const { data: memberships, isLoading: isLoadingMemberships } = useCollection<Membership>(membershipsQuery);

    const tableData = React.useMemo(() => {
        if (!licenses || !tenants || !memberships) return [];

        const tenantMap = new Map(tenants.map(t => [t.id, t]));
        const userCountMap = new Map<string, number>();
        memberships.forEach(m => {
            userCountMap.set(m.tenantId, (userCountMap.get(m.tenantId) || 0) + 1);
        });

        return licenses.map(license => ({
            license,
            tenant: tenantMap.get(license.tenantId),
            userCount: userCountMap.get(license.tenantId) || 0,
        }));
    }, [licenses, tenants, memberships]);

    const isLoading = isLoadingLicenses || isLoadingTenants || isLoadingMemberships;
  
  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
      <main className="flex-1 p-4 md:p-8">
         <Card>
            <CardHeader>
                <CardTitle>Gestión de Licencias</CardTitle>
                <CardDescription>Visualiza y administra todas las licencias de la plataforma.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : (
                    <LicensesDataTable columns={columns} data={tableData} />
                )}
            </CardContent>
         </Card>
      </main>
    </div>
  );
}
