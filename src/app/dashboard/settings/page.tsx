'use client';
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { collection, query, where, doc, writeBatch, updateDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, ShieldAlert, Plus, Trash2, Pencil, GripVertical, UserPlus, Repeat, Copy, RefreshCw } from 'lucide-react';
import { MembersDataTable } from './data-table-members';
import { getColumns } from './columns';
import type { Tenant, User as UserType, License, Membership, Category, Subcategory } from '@/lib/types';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { inviteUserAction, sendInvitationEmailAction, deleteMemberAction, getMembersAction } from './actions';
import { useCollection } from '@/firebase/firestore/use-collection';


function ManageCategories({ tenantId }: { tenantId: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [categories, setCategories] = useState<Array<Category & { subcategories: Subcategory[] }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'newCat' | 'editCat' | 'newSub' | 'editSub'>('newCat');
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [currentSubCategory, setCurrentSubCategory] = useState<Subcategory | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#00C2A8');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{type: 'category' | 'subcategory', id: string} | null>(null);

  const categoriesQuery = useMemoFirebase(() => {
      if (!firestore || !tenantId) return null;
      return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: rawCategories } = useCollection<Category>(categoriesQuery);

  const subcategoriesQuery = useMemoFirebase(() => {
      if (!firestore || !tenantId) return null;
      return query(collection(firestore, 'subcategories'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: rawSubcategories } = useCollection<Subcategory>(subcategoriesQuery);


  useMemo(() => {
      if(rawCategories && rawSubcategories) {
          const grouped = rawCategories.map(cat => ({
              ...cat,
              subcategories: rawSubcategories.filter(sub => sub.categoryId === cat.id).sort((a,b) => a.order - b.order)
          })).sort((a,b) => a.order - b.order);
          setCategories(grouped);
          setIsLoading(false);
      }
  }, [rawCategories, rawSubcategories]);

  const openDialog = (mode: 'newCat' | 'editCat' | 'newSub' | 'editSub', category?: Category, subCategory?: Subcategory) => {
    setDialogMode(mode);
    setCurrentCategory(category || null);
    setCurrentSubCategory(subCategory || null);
    if(mode === 'editCat' && category) {
      setName(category.name);
      setColor(category.color);
    } else if (mode === 'editSub' && subCategory) {
      setName(subCategory.name);
    } else {
      setName('');
      setColor('#00C2A8');
    }
    setIsDialogOpen(true);
  };
  
  const handleSave = async () => {
    if (!name || !firestore) return;
    setIsProcessing(true);

    try {
      if (dialogMode === 'newCat') {
        const newCatRef = doc(collection(firestore, 'categories'));
        const newCategoryData = { id: newCatRef.id, tenantId, name, color, order: categories.length };
        await writeBatch(firestore).set(newCatRef, newCategoryData).commit();
      } else if (dialogMode === 'editCat' && currentCategory) {
        const catRef = doc(firestore, 'categories', currentCategory.id);
        const updatedData = { name, color };
        updateDoc(catRef, updatedData)
        .catch(e => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: catRef.path, operation: 'update', requestResourceData: updatedData,
            }))
        });
      } else if (dialogMode === 'newSub' && currentCategory) {
        const newSubRef = doc(collection(firestore, 'subcategories'));
        const newSubData = { id: newSubRef.id, tenantId, categoryId: currentCategory.id, name, order: currentCategory.subcategories.length };
        await writeBatch(firestore).set(newSubRef, newSubData).commit();
      } else if (dialogMode === 'editSub' && currentSubCategory) {
        const subCatRef = doc(firestore, 'subcategories', currentSubCategory.id);
        const updatedData = { name };
        updateDoc(subCatRef, updatedData).catch(e => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: subCatRef.path, operation: 'update', requestResourceData: updatedData,
            }))
        });
      }
      toast({ title: "¡Éxito!", description: "La operación se completó correctamente." });
    } catch(e) {
      toast({ variant: 'destructive', title: "Error", description: "No se pudo guardar el cambio." });
    } finally {
      setIsProcessing(false);
      setIsDialogOpen(false);
    }
  }
  
  const openDeleteAlert = (type: 'category' | 'subcategory', id: string) => {
    setItemToDelete({ type, id });
    setIsAlertOpen(true);
  }

  const handleDelete = async () => {
      if (!firestore || !itemToDelete) return;

      const { type, id } = itemToDelete;
      setIsProcessing(true);
      
      try {
        let docRef;
        if (type === 'category') {
          const catToDelete = categories.find(c => c.id === id);
          if (catToDelete && catToDelete.subcategories.length > 0) {
            toast({ variant: 'destructive', title: "Error", description: "No puedes eliminar una categoría con subcategorías. Elimínalas primero." });
            setIsProcessing(false);
            setIsAlertOpen(false);
            return;
          }
          docRef = doc(firestore, 'categories', id);
        } else {
          docRef = doc(firestore, 'subcategories', id);
        }
        
        await deleteDoc(docRef);
        
        toast({ title: "Eliminado", description: "El elemento ha sido eliminado." });
      } catch (e) {
         const pathToDelete = itemToDelete.type === 'category' ? `categories/${itemToDelete.id}` : `subcategories/${itemToDelete.id}`;
         errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: pathToDelete, operation: 'delete',
         }));
      } finally {
        setIsProcessing(false);
        setIsAlertOpen(false);
        setItemToDelete(null);
      }
  }


  if (isLoading) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Categorías y Subcategorías</CardTitle>
          <CardDescription>Organiza tus clasificaciones de gastos.</CardDescription>
        </div>
        <Button onClick={() => openDialog('newCat')}> <Plus className="mr-2 h-4 w-4" /> Nueva Categoría</Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          {categories.map(category => (
            <div key={category.id} className="border-b last:border-b-0">
              <div className="flex items-center p-4 bg-muted/50">
                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                  <div className="w-4 h-4 rounded-full mx-4" style={{ backgroundColor: category.color }} />
                  <span className="flex-1 font-semibold">{category.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => openDialog('newSub', category)}>Agregar Subcategoría</Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog('editCat', category)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeleteAlert('category', category.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {category.subcategories.length > 0 && (
                 <div className="pl-12 py-2 space-y-1">
                    {category.subcategories.map(sub => (
                      <div key={sub.id} className="flex items-center group">
                          <span className="flex-1 text-sm text-muted-foreground">{sub.name}</span>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog('editSub', category, sub)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => openDeleteAlert('subcategory', sub.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                      </div>
                    ))}
                 </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>
                    {dialogMode === 'newCat' && 'Nueva Categoría'}
                    {dialogMode === 'editCat' && 'Editar Categoría'}
                    {dialogMode === 'newSub' && `Nueva Subcategoría en "${currentCategory?.name}"`}
                    {dialogMode === 'editSub' && 'Editar Subcategoría'}
                  </DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                  <div className="space-y-2">
                      <Label htmlFor="name">Nombre</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  {(dialogMode === 'newCat' || dialogMode === 'editCat') && (
                    <div className="space-y-2">
                      <Label htmlFor="color">Color</Label>
                      <div className="relative">
                        <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} className="pl-8" />
                        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 border-none cursor-pointer" />
                      </div>
                  </div>
                  )}
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} disabled={isProcessing}>{isProcessing ? 'Guardando...' : 'Guardar'}</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </Card>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción es permanente y no se puede deshacer. ¿Estás seguro de que quieres eliminar este elemento?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
                    {isProcessing ? 'Eliminando...' : 'Eliminar'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}


function InviteUserDialog({ open, onOpenChange, onInvite }: { open: boolean; onOpenChange: (open: boolean) => void; onInvite: (data: any) => void }) {
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const generatePassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const specialChars = '!@#$%^&*()';
        let newPassword = '';
        for (let i = 0; i < 9; i++) {
            newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        newPassword += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
        newPassword = newPassword.split('').sort(() => 0.5 - Math.random()).join('');
        setPassword(newPassword);
    };

    const copyToClipboard = () => {
        if (!password) return;
        navigator.clipboard.writeText(password);
        toast({ title: "Copiado", description: "Contraseña temporal copiada al portapapeles." });
    };

    const handleInvite = async () => {
        if (!email || !firstName || !lastName || !password) {
            toast({ variant: "destructive", title: "Error", description: "Por favor, completa todos los campos requeridos." });
            return;
        }
        setIsProcessing(true);
        await onInvite({ email, firstName, lastName, phone, password });
        setIsProcessing(false);
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Invitar Nuevo Miembro</DialogTitle>
                    <DialogDescription>
                        Crea una cuenta para un nuevo miembro. Se le asignará una contraseña temporal que deberás compartir de forma segura.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">Nombre</Label>
                            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Apellido</Label>
                            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono (Opcional)</Label>
                        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="tempPassword">Contraseña Temporal</Label>
                        <div className="flex items-center gap-2">
                            <Input id="tempPassword" value={password} onChange={(e) => setPassword(e.target.value)} />
                            <Button type="button" variant="secondary" size="icon" onClick={generatePassword}><RefreshCw className="h-4 w-4" /></Button>
                            <Button type="button" variant="outline" size="icon" onClick={copyToClipboard} disabled={!password}><Copy className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleInvite} disabled={isProcessing}>
                        {isProcessing ? "Creando usuario..." : "Crear e Invitar Usuario"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function SettingsPage() {
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Membership | null>(null);
  
  const firestore = useFirestore();

  const [members, setMembers] = useState<Membership[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);
  
  useEffect(() => {
    if (userData?.tenantIds && userData.tenantIds.length > 0) {
      setTenantId(userData.tenantIds[0]);
    }
  }, [userData]);
  
  const tenantDocRef = useMemoFirebase(() => {
    if (!tenantId || !firestore) return null;
    return doc(firestore, 'tenants', tenantId);
  }, [tenantId, firestore]);
  const { data: tenantData, isLoading: isTenantLoading } = useDoc<Tenant>(tenantDocRef);

  useEffect(() => {
    if(tenantData && user) {
        setIsOwner(tenantData.ownerUid === user.uid);
    }
  }, [tenantData, user]);

  const licenseQuery = useMemoFirebase(() => {
      if (!tenantId || !firestore) return null;
      return query(collection(firestore, 'licenses'), where('tenantId', '==', tenantId));
  }, [tenantId, firestore]);
  const { data: licenses, isLoading: isLoadingLicenses } = useCollection<License>(licenseQuery);

  const activeLicense = licenses?.[0];

  const fetchMembers = React.useCallback(async () => {
    if (!tenantId || !user) return;

    setIsLoadingMembers(true);
    try {
      const adminIdToken = await user.getIdToken();
      const result = await getMembersAction({ tenantId, adminIdToken });

      if (result.success && result.members) {
        setMembers(result.members);
      } else {
        throw new Error(result.error || "No se pudieron cargar los miembros.");
      }
    } catch (e: any) {
      console.error("Error fetching members:", e);
      toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
      setIsLoadingMembers(false);
    }
  }, [tenantId, user, toast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);


  const isLoading = isUserLoading || isUserDocLoading || isTenantLoading || isLoadingLicenses;
  
  const handleInviteUser = async (data: any) => {
    if (!user || !firestore || !tenantId || !activeLicense) {
        toast({ variant: "destructive", title: "Error", description: "No se pueden cargar los datos del tenant o la licencia." });
        return;
    }

    if (members && members.length >= activeLicense.maxUsers) {
        toast({ variant: "destructive", title: "Límite alcanzado", description: "Has alcanzado el número máximo de usuarios para tu plan." });
        return;
    }
    
    const actionResult = await inviteUserAction({
        email: data.email,
        password: data.password,
    });
    
    if (actionResult.success && actionResult.uid) {
      try {
        const batch = writeBatch(firestore);
        
        const userData = {
            uid: actionResult.uid,
            displayName: `${data.firstName} ${data.lastName}`,
            email: data.email,
            photoURL: '',
            tenantIds: [tenantId],
        };
        const userRef = doc(firestore, 'users', actionResult.uid);
        batch.set(userRef, userData);

        const membershipData: Membership = {
            tenantId: tenantId,
            uid: actionResult.uid,
            displayName: userData.displayName,
            email: userData.email,
            role: 'member',
            status: 'active',
            joinedAt: new Date().toISOString(),
        };
        const membershipRef = doc(firestore, 'memberships', `${tenantId}_${actionResult.uid}`);
        batch.set(membershipRef, membershipData);
        
        await batch.commit();

        await fetchMembers(); // Refetch members list
        
        toast({ title: "¡Usuario Creado!", description: "El usuario ha sido creado correctamente. Ahora enviando invitación..." });

        const emailResult = await sendInvitationEmailAction(data.email);
        if (emailResult.success) {
            toast({ title: "¡Invitación Enviada!", description: "Se ha enviado un correo al nuevo miembro para que establezca su contraseña." });
        } else {
             toast({ variant: "destructive", title: "Error al enviar correo", description: emailResult.error });
        }

        setIsInviteDialogOpen(false);

      } catch (error) {
           errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: 'batch-write',
              operation: 'write',
              requestResourceData: 'Creating new user and membership'
          }));
      }
    } else {
        toast({ variant: "destructive", title: "Error en la invitación", description: actionResult.error });
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete || !tenantId || !firestore || !user) return;

    setIsDeletingMember(true);
    toast({ title: "Eliminando miembro..." });

    try {
        const adminIdToken = await user.getIdToken();
        
        const batch = writeBatch(firestore);
        const userRef = doc(firestore, 'users', memberToDelete.uid);
        const membershipRef = doc(firestore, 'memberships', `${tenantId}_${memberToDelete.uid}`);

        batch.delete(userRef);
        batch.delete(membershipRef);
        
        await batch.commit();
        
        const deleteResult = await deleteMemberAction({
            memberUid: memberToDelete.uid,
            adminIdToken: adminIdToken,
        });

        if (deleteResult.success) {
            toast({ title: "Éxito", description: `El miembro ${memberToDelete.displayName} ha sido eliminado.` });
            await fetchMembers();
        } else {
           console.error("Failed to delete user from Auth:", deleteResult.error);
           toast({ variant: "destructive", title: "Error de Autenticación", description: deleteResult.error || "El usuario fue eliminado de la app, pero no se pudo eliminar de la autenticación. Contacte a soporte." });
        }

    } catch (error: any) {
        console.error("Error deleting member:", error);
         errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'batch-write-delete',
            operation: 'delete',
            requestResourceData: `Deleting user ${memberToDelete.uid}`
        }));
    } finally {
        setIsDeletingMember(false);
        setMemberToDelete(null);
    }
  };

  const columns = useMemo(() => getColumns((member) => setMemberToDelete(member)), []);
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-secondary/50 p-4 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="mt-4 font-headline text-2xl font-bold">Acceso Denegado</h1>
        <p className="mt-2 text-muted-foreground">Solo el propietario de la cuenta puede acceder a esta sección.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Volver al Dashboard</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
    <div className="flex min-h-screen flex-col bg-secondary/50">
        <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="container flex h-16 items-center">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="ml-4 font-headline text-xl font-bold">Administración</h1>
            </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
             <Tabs defaultValue="members" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="members">Miembros</TabsTrigger>
                    <TabsTrigger value="categories">Categorías</TabsTrigger>
                    <TabsTrigger value="license">Licencia</TabsTrigger>
                </TabsList>
                <TabsContent value="members">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Miembros del Tenant</CardTitle>
                                <CardDescription>
                                    Administra los usuarios que tienen acceso a este espacio de trabajo.
                                </CardDescription>
                            </div>
                            <Button 
                                onClick={() => setIsInviteDialogOpen(true)}
                                disabled={!activeLicense || (members?.length ?? 0) >= activeLicense.maxUsers}
                            >
                                <UserPlus className="mr-2 h-4 w-4" />
                                Invitar usuarios
                            </Button>
                        </CardHeader>
                        <CardContent>
                           <MembersDataTable columns={columns} data={members || []} />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="categories">
                   {tenantId && <ManageCategories tenantId={tenantId} />}
                </TabsContent>
                <TabsContent value="license">
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalles de la Licencia</CardTitle>
                             <CardDescription>
                                Información sobre tu plan actual y límites.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {activeLicense ? (
                                <>
                                    <div><strong>Plan:</strong> <Badge>{activeLicense.plan}</Badge></div>
                                    <div><strong>Estado:</strong> <Badge variant={activeLicense.status === 'active' ? 'default' : 'destructive'} className={activeLicense.status === 'active' ? 'bg-green-500' : ''}>{activeLicense.status}</Badge></div>
                                    <div><strong>Usuarios:</strong> {members?.length || 0} de {activeLicense.maxUsers}</div>
                                    <div><strong>Válida hasta:</strong> {new Date(activeLicense.endDate).toLocaleDateString()}</div>
                                </>
                            ) : (
                                <p>No se encontró información de la licencia.</p>
                            )}
                        </CardContent>
                        <CardFooter>
                           <Button>
                                <Repeat className="mr-2 h-4 w-4" />
                                Renovar Licencia
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
             </Tabs>
        </main>
    </div>
    <InviteUserDialog 
        open={isInviteDialogOpen} 
        onOpenChange={setIsInviteDialogOpen}
        onInvite={handleInviteUser}
    />
     <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción eliminará permanentemente a <span className="font-bold">{memberToDelete?.displayName}</span>. 
                    Se borrará su cuenta y todos sus datos asociados. Esta acción no se puede deshacer.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setMemberToDelete(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteMember} disabled={isDeletingMember} className="bg-destructive hover:bg-destructive/90">
                    {isDeletingMember ? 'Eliminando...' : 'Sí, eliminar miembro'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
