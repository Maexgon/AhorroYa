
'use client';
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, writeBatch, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, deleteUser } from 'firebase/auth';
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
import { cn } from '@/lib/utils';


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
      const batch = writeBatch(firestore);
      if (dialogMode === 'newCat') {
        const newCatRef = doc(collection(firestore, 'categories'));
        const newCategoryData = { id: newCatRef.id, tenantId, name, color, order: categories.length };
        batch.set(newCatRef, newCategoryData);
      } else if (dialogMode === 'editCat' && currentCategory) {
        const catRef = doc(firestore, 'categories', currentCategory.id);
        batch.update(catRef, { name, color });
      } else if (dialogMode === 'newSub' && currentCategory) {
        const newSubRef = doc(collection(firestore, 'subcategories'));
        const newSubData = { id: newSubRef.id, tenantId, categoryId: currentCategory.id, name, order: currentCategory.subcategories.length };
        batch.set(newSubRef, newSubData);
      } else if (dialogMode === 'editSub' && currentSubCategory) {
        const subCatRef = doc(firestore, 'subcategories', currentSubCategory.id);
        batch.update(subCatRef, { name });
      }
      await batch.commit();
      toast({ title: "¡Éxito!", description: "La operación se completó correctamente." });
    } catch(e) {
      console.error("Error saving category/subcategory", e);
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
      } catch (e: any) {
        console.error("Error deleting item:", e);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: itemToDelete.type === 'category' ? `categories/${itemToDelete.id}` : `subcategories/${itemToDelete.id}`, 
            operation: 'delete',
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
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Membership | null>(null);
  
  const firestore = useFirestore();

  // Step 1: Get user's membership to find tenantId and role
  const membershipsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'memberships'), where('uid', '==', user.uid));
  }, [user]);
  const { data: memberships, isLoading: isLoadingMemberships } = useCollection<Membership>(membershipsQuery);

  useEffect(() => {
    if (!isLoadingMemberships && memberships) {
      if (memberships.length > 0) {
        const firstMembership = memberships[0];
        setTenantId(firstMembership.tenantId);
        setIsOwner(firstMembership.role === 'owner');
      }
      setIsLoading(false); // We have our answer, stop loading
    }
  }, [memberships, isLoadingMemberships]);

  // Step 2: Fetch tenant-specific data once tenantId is known
  const membersQuery = useMemoFirebase(() => {
    if (!tenantId) return null;
    return query(collection(firestore, 'memberships'), where('tenantId', '==', tenantId));
  }, [tenantId]);
  const { data: members, isLoading: isLoadingMembers, setData: setMembers } = useCollection<Membership>(membersQuery);

  const tenantDocRef = useMemoFirebase(() => {
    if (!tenantId) return null;
    return doc(firestore, 'tenants', tenantId);
  }, [tenantId]);
  const { data: tenantData } = useDoc<Tenant>(tenantDocRef);
  
  const licenseQuery = useMemoFirebase(() => {
    if (!tenantId) return null;
    return query(collection(firestore, 'licenses'), where('tenantId', '==', tenantId));
  }, [tenantId]);
  const { data: licenses } = useCollection<License>(licenseQuery);

  const activeLicense = licenses?.[0];
  
  const handleInviteUser = async (data: any) => {
    if (!user || !firestore || !tenantId || !activeLicense) {
        toast({ variant: "destructive", title: "Error", description: "No se pueden cargar los datos del tenant o la licencia." });
        return;
    }

    if (members && members.length >= activeLicense.maxUsers) {
        toast({ variant: "destructive", title: "Límite alcanzado", description: "Has alcanzado el número máximo de usuarios para tu plan." });
        return;
    }

    try {
        const auth = getAuth();
        // This is a temporary solution. In a real app, this should be done via a secure backend function.
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        const newUser = userCredential.user;
        const displayName = `${data.firstName} ${data.lastName}`;
        await updateProfile(newUser, { displayName });

        const batch = writeBatch(firestore);

        const userDocData = {
            uid: newUser.uid,
            displayName,
            email: newUser.email,
        };
        batch.set(doc(firestore, 'users', newUser.uid), userDocData);

        const membershipData: Membership = {
            tenantId: tenantId,
            uid: newUser.uid,
            displayName: displayName,
            email: data.email,
            role: 'member',
            status: 'active',
            joinedAt: new Date().toISOString(),
        };
        batch.set(doc(firestore, 'memberships', `${tenantId}_${newUser.uid}`), membershipData);

        await batch.commit();

        await sendPasswordResetEmail(auth, data.email);

        toast({ title: "¡Usuario Creado!", description: "Se ha enviado un correo al nuevo miembro para que establezca su contraseña." });
        setIsInviteDialogOpen(false);
        if (members && setMembers) {
            setMembers([...members, membershipData]);
        }

    } catch (e: any) {
        console.error("Error inviting user:", e);
        toast({ variant: "destructive", title: "Error en la invitación", description: e.message });
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete || !tenantId || !user || !firestore) {
        toast({ variant: "destructive", title: "Error", description: "No se ha seleccionado ningún miembro para eliminar." });
        return;
    }
    
    setIsDeletingMember(true);
    toast({ title: "Eliminando miembro..." });

    try {
        const membershipRef = doc(firestore, 'memberships', `${tenantId}_${memberToDelete.uid}`);
        await deleteDoc(membershipRef);

        // This is not ideal, as deleting users from the client is risky.
        // A proper implementation would use a Cloud Function.
        toast({ title: "Advertencia", description: "La membresía fue eliminada. La eliminación de la cuenta de Auth debe hacerse desde la consola de Firebase por seguridad." });
        
        if (members && setMembers) {
            setMembers(members.filter(m => m.uid !== memberToDelete.uid));
        }
    } catch (error: any) {
        console.error("Error deleting member:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `memberships/${tenantId}_${memberToDelete.uid}`, 
            operation: 'delete',
        }));
    } finally {
        setIsDeletingMember(false);
        setMemberToDelete(null);
    }
  };


  const columns = useMemo(() => getColumns((member) => setMemberToDelete(member)), []);
  
  if (isUserLoading || isLoading) {
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

  const isCollaborativePlan = activeLicense?.plan === 'familiar' || activeLicense?.plan === 'empresa';

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
                <h1 className="ml-4 font-headline text-xl font-bold">Administración de {tenantData?.name || '...'}</h1>
            </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
             <Tabs defaultValue="categories" className="w-full">
                <TabsList className={cn("grid w-full", isCollaborativePlan ? "grid-cols-3" : "grid-cols-2")}>
                    {isCollaborativePlan && <TabsTrigger value="members">Miembros</TabsTrigger>}
                    <TabsTrigger value="categories">Categorías</TabsTrigger>
                    <TabsTrigger value="license">Licencia</TabsTrigger>
                </TabsList>
                 {isCollaborativePlan && (
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
                            {isLoadingMembers ? <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : <MembersDataTable columns={columns} data={members || []} />}
                            </CardContent>
                        </Card>
                    </TabsContent>
                 )}
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
                            {!activeLicense ? <Loader2 className="animate-spin" /> : (
                                <>
                                    <div><strong>Plan:</strong> <Badge>{activeLicense.plan}</Badge></div>
                                    <div><strong>Estado:</strong> <Badge variant={activeLicense.status === 'active' ? 'default' : 'destructive'} className={activeLicense.status === 'active' ? 'bg-green-500' : ''}>{activeLicense.status}</Badge></div>
                                    <div><strong>Usuarios:</strong> {members?.length || 0} de {activeLicense.maxUsers}</div>
                                    <div><strong>Válida hasta:</strong> {new Date(activeLicense.endDate).toLocaleDateString()}</div>
                                </>
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
                    Esta acción eliminará la membresía de <span className="font-bold">{memberToDelete?.displayName}</span> del tenant.
                    La cuenta del usuario no se borrará de Firebase Authentication.
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
