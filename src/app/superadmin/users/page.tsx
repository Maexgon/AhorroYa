'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { User as UserType, Membership } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { UsersDataTable } from './data-table';
import { columns } from './columns';

export default function SuperAdminUsersPage() {
    const firestore = useFirestore();

    // The parent layout now ensures that the user is authenticated.
    const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
    const { data: users, isLoading: isLoadingUsers } = useCollection<UserType>(usersQuery);

    const membershipsQuery = useMemoFirebase(() => collection(firestore, 'memberships'), [firestore]);
    const { data: memberships, isLoading: isLoadingMemberships } = useCollection<Membership>(membershipsQuery);

    const tableData = React.useMemo(() => {
        if (!users || !memberships) return [];
        
        const membershipCountMap = new Map<string, number>();
        memberships.forEach(m => {
            membershipCountMap.set(m.uid, (membershipCountMap.get(m.uid) || 0) + 1);
        });

        return users.map(user => ({
            user,
            tenantCount: membershipCountMap.get(user.uid) || 0,
        }));
    }, [users, memberships]);

    const isLoading = isLoadingUsers || isLoadingMemberships;
  
  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
      <main className="flex-1 p-4 md:p-8">
         <Card>
            <CardHeader>
                <CardTitle>Gestión de Usuarios</CardTitle>
                <CardDescription>Visualiza y administra todos los usuarios de la plataforma.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : (
                    <UsersDataTable columns={columns} data={tableData} />
                )}
            </CardContent>
         </Card>
      </main>
    </div>
  );
}
