
'use client';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, query, where, collection } from 'firebase/firestore';
import type { Tenant, License, Membership, User } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface TenantDetailsDialogProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TenantDetailsDialog({ tenantId, open, onOpenChange }: TenantDetailsDialogProps) {
  const firestore = useFirestore();

  // --- Data Fetching for the selected tenant ---
  const tenantRef = useMemoFirebase(() => doc(firestore, 'tenants', tenantId), [firestore, tenantId]);
  const { data: tenant, isLoading: isLoadingTenant } = useDoc<Tenant>(tenantRef);

  const licenseQuery = useMemoFirebase(() => query(collection(firestore, 'licenses'), where('tenantId', '==', tenantId)), [firestore, tenantId]);
  const { data: licenses, isLoading: isLoadingLicense } = useCollection<License>(licenseQuery);
  const license = licenses?.[0];
  
  const ownerRef = useMemoFirebase(() => tenant ? doc(firestore, 'users', tenant.ownerUid) : null, [firestore, tenant]);
  const { data: owner, isLoading: isLoadingOwner } = useDoc<User>(ownerRef);

  const membersQuery = useMemoFirebase(() => query(collection(firestore, 'memberships'), where('tenantId', '==', tenantId)), [firestore, tenantId]);
  const { data: members, isLoading: isLoadingMembers } = useCollection<Membership>(membersQuery);
  
  const isLoading = isLoadingTenant || isLoadingLicense || isLoadingOwner || isLoadingMembers;
  
  const DetailItem = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="text-base font-semibold">{value || 'N/A'}</div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalles del Tenant</DialogTitle>
          <DialogDescription>
            Información detallada sobre el tenant, su licencia y sus miembros.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="mt-4 space-y-6 max-h-[70vh] overflow-y-auto pr-4">
            
            {/* Tenant and Owner Details */}
            <section>
                <h3 className="text-lg font-semibold mb-2">Información General</h3>
                <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                    <DetailItem label="Nombre del Tenant" value={tenant?.name} />
                    <DetailItem label="ID del Tenant" value={<code className="text-xs">{tenant?.id}</code>} />
                    <DetailItem label="Propietario" value={owner?.displayName} />
                    <DetailItem label="Email del Propietario" value={owner?.email} />
                </div>
            </section>
            
            <Separator />
            
            {/* License Details */}
            <section>
                <h3 className="text-lg font-semibold mb-2">Licencia</h3>
                 <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                    <DetailItem label="Plan" value={license ? <Badge className="capitalize">{license.plan}</Badge> : 'N/A'} />
                    <DetailItem label="Estado" value={license ? <Badge variant={license.status === 'active' ? 'default' : 'destructive'} className={license.status === 'active' ? 'bg-green-600' : ''}>{license.status}</Badge> : 'N/A'} />
                    <DetailItem label="Fecha de Inicio" value={license ? new Date(license.startDate).toLocaleDateString('es-AR') : 'N/A'} />
                    <DetailItem label="Fecha de Vencimiento" value={license ? new Date(license.endDate).toLocaleDateString('es-AR') : 'N/A'} />
                    <DetailItem label="Límite de Usuarios" value={`${members?.length || 0} / ${license?.maxUsers || 0}`} />
                 </div>
            </section>

            <Separator />

            {/* Members Table */}
            <section>
                <h3 className="text-lg font-semibold mb-2">Miembros</h3>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {members && members.length > 0 ? members.map(member => (
                                <TableRow key={member.uid}>
                                    <TableCell className="font-medium">{member.displayName}</TableCell>
                                    <TableCell>{member.email}</TableCell>
                                    <TableCell><Badge variant={member.role === 'owner' ? 'secondary' : 'outline'} className="capitalize">{member.role}</Badge></TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">No se encontraron miembros.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
