
'use client';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Shield, UserCog, UserX, Trash2 } from 'lucide-react';
import type { MembershipRow } from './columns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UserDetailsDialogProps {
  membershipRow: MembershipRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <div className="text-base font-semibold">{value || 'N/A'}</div>
  </div>
);

const getInitials = (name: string = "") => {
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

export function UserDetailsDialog({ membershipRow, open, onOpenChange }: UserDetailsDialogProps) {
    const [actionToConfirm, setActionToConfirm] = React.useState<'suspend' | 'makeOwner' | 'promote' | 'delete' | null>(null);
    const [deleteInput, setDeleteInput] = React.useState('');

    if (!membershipRow) return null;
    const { user, tenant, membership } = membershipRow;

    const handleActionClick = (action: 'suspend' | 'makeOwner' | 'promote' | 'delete') => {
        setActionToConfirm(action);
    };

    const performAction = () => {
        // Here you would call the server action based on `actionToConfirm`
        console.log(`Performing action: ${actionToConfirm} for user ${user?.uid} in tenant ${tenant?.id}`);
        setActionToConfirm(null);
        setDeleteInput('');
    };

    const isCurrentUserOwner = membership.role === 'owner';
    const canBePromoted = membership.role === 'member';
    const canBeMadeOwner = membership.role !== 'owner';
    
    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Detalles de Usuario</DialogTitle>
                        <DialogDescription>
                            Información detallada del usuario y su membresía en el tenant.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="mt-4 space-y-6 max-h-[70vh] overflow-y-auto pr-4">
                        <section className="flex items-center gap-4">
                             <Avatar className="h-14 w-14 sm:h-16 sm:w-16">
                                <AvatarImage src={user?.photoURL || ''} alt={user?.displayName} />
                                <AvatarFallback className="text-xl">{getInitials(user?.displayName)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold">{user?.displayName}</h3>
                                <p className="text-sm text-muted-foreground">{user?.email}</p>
                            </div>
                        </section>
                        
                        <Separator />
                        
                        <section>
                            <h3 className="text-lg font-semibold mb-2">Membresía</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border p-4">
                                <DetailItem label="Tenant" value={tenant?.name} />
                                <DetailItem label="Rol" value={<Badge className="capitalize">{membership.role}</Badge>} />
                                <DetailItem label="Estado" value={<Badge variant={membership.status === 'active' ? 'default' : 'destructive'} className={membership.status === 'active' ? 'bg-green-600' : ''}>{membership.status}</Badge>} />
                                <DetailItem label="Miembro desde" value={new Date(membership.joinedAt).toLocaleDateString('es-AR')} />
                            </div>
                        </section>
                        
                         <Separator />

                        <section>
                            <h3 className="text-lg font-semibold mb-2">Acciones de Gestión</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {canBePromoted && (
                                <Button variant="outline" onClick={() => handleActionClick('promote')}>
                                    <Shield className="mr-2 h-4 w-4" /> Promover a Admin
                                </Button>
                                )}
                                {canBeMadeOwner && (
                                <Button variant="outline" onClick={() => handleActionClick('makeOwner')}>
                                    <UserCog className="mr-2 h-4 w-4" /> Hacer Propietario
                                </Button>
                                )}
                                <Button variant="outline" onClick={() => handleActionClick('suspend')}>
                                    <UserX className="mr-2 h-4 w-4" /> Suspender Usuario
                                </Button>
                                {!isCurrentUserOwner && (
                                <Button variant="destructive" onClick={() => handleActionClick('delete')}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar Usuario
                                </Button>
                                )}
                            </div>
                        </section>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!actionToConfirm} onOpenChange={(isOpen) => !isOpen && setActionToConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                         <AlertDialogDescription>
                            {actionToConfirm === 'delete' && "Esta acción es IRREVERSIBLE. Se reasignarán todos los registros del usuario al propietario del tenant y se revocará su acceso. Para confirmar, escribe BORRAR."}
                            {actionToConfirm === 'suspend' && `Esto suspenderá al usuario ${user?.displayName}, impidiendo su acceso.`}
                            {actionToConfirm === 'makeOwner' && `Esto transferirá la propiedad del tenant a ${user?.displayName}. El propietario actual pasará a ser un miembro normal.`}
                            {actionToConfirm === 'promote' && `Esto concederá permisos de administrador a ${user?.displayName}.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {actionToConfirm === 'delete' && (
                        <div className="py-2">
                            <Label htmlFor="delete-confirm" className="sr-only">Confirmar borrado</Label>
                            <Input
                                id="delete-confirm"
                                value={deleteInput}
                                onChange={(e) => setDeleteInput(e.target.value)}
                                placeholder='Escribe "BORRAR" aquí'
                            />
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setActionToConfirm(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={performAction}
                            disabled={actionToConfirm === 'delete' && deleteInput !== 'BORRAR'}
                        >
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
