
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser, useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import type { User as UserType } from '@/lib/types';

const profileFormSchema = z.object({
  displayName: z.string().min(1, 'El nombre es requerido.'),
  email: z.string().email('Email inválido.'),
  address: z.string().optional(),
  phone: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: '',
      email: '',
      address: '',
      phone: '',
    },
  });

  React.useEffect(() => {
    if (userData) {
      reset({
        displayName: userData.displayName || '',
        email: userData.email || '',
        address: userData.address || '',
        phone: userData.phone || '',
      });
    }
  }, [userData, reset]);
  
  const getInitials = (name: string = "") => {
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  const onSubmit = async (data: ProfileFormValues) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser || !firestore) return;

    setIsSubmitting(true);
    toast({ title: 'Actualizando...', description: 'Guardando tu información.' });

    try {
      const userDocToUpdateRef = doc(firestore, 'users', currentUser.uid);
      
      const firestoreUpdateData = {
          displayName: data.displayName,
          address: data.address,
          phone: data.phone,
      };

      // Update Firestore
      await updateDoc(userDocToUpdateRef, firestoreUpdateData);

      // Update Auth profile
      if (currentUser.displayName !== data.displayName) {
          await updateProfile(currentUser, { displayName: data.displayName });
      }
      
      toast({ title: '¡Éxito!', description: 'Tu perfil ha sido actualizado.' });

    } catch (error) {
       errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `users/${currentUser.uid}`,
            operation: 'update',
            requestResourceData: data,
        }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("[DEBUG] handleFileChange triggered");
    const file = event.target.files?.[0];
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (!file || !currentUser) {
        console.log("[DEBUG] No file selected or user not logged in.");
        return;
    }
    console.log("[DEBUG] File selected:", { name: file.name, size: file.size, type: file.type });


    if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ variant: 'destructive', title: 'Archivo demasiado grande', description: 'El tamaño máximo es 2MB.' });
        return;
    }

    setIsUploading(true);
    toast({ title: 'Subiendo imagen...' });

    try {
        const storage = getStorage();
        const storageRef = ref(storage, `avatars/${currentUser.uid}/${file.name}`);
        console.log("[DEBUG] Uploading to storageRef path:", storageRef.fullPath);

        const snapshot = await uploadBytes(storageRef, file);
        console.log("[DEBUG] Upload successful, snapshot:", snapshot);
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log("[DEBUG] Got download URL:", downloadURL);

        // Update Auth and Firestore with the new URL
        await updateProfile(currentUser, { photoURL: downloadURL });
        const userDocToUpdateRef = doc(firestore, 'users', currentUser.uid);
        await updateDoc(userDocToUpdateRef, { photoURL: downloadURL });

        toast({ title: '¡Foto actualizada!', description: 'Tu nueva foto de perfil está lista.' });
    } catch (error) {
         console.error("[DEBUG] Full error object during upload:", error);
         toast({ variant: 'destructive', title: 'Error al subir', description: 'No se pudo subir la imagen. Revisa la consola para más detalles.' });
    } finally {
        setIsUploading(false);
    }
  };

  if (isUserLoading || isUserDocLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex h-16 items-center">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="ml-4 font-headline text-xl font-bold">Mi Perfil</h1>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle>Información Personal</CardTitle>
                <CardDescription>Actualiza tus datos personales y foto de perfil.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <Avatar className="h-24 w-24 cursor-pointer" onClick={handleAvatarClick}>
                      <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "Usuario"} />
                      <AvatarFallback className="text-3xl">
                        {getInitials(user?.displayName || "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    </div>
                     <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/png, image/jpeg"
                    />
                  </div>
                  <div className="space-y-1">
                      <h3 className="font-bold text-lg">{user?.displayName}</h3>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                      <Button type="button" variant="outline" size="sm" onClick={handleAvatarClick} disabled={isUploading}>
                        Cambiar foto
                      </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="displayName">Nombre Completo</Label>
                        <Controller
                            name="displayName"
                            control={control}
                            render={({ field }) => <Input {...field} />}
                        />
                         {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Controller
                            name="email"
                            control={control}
                            render={({ field }) => <Input {...field} disabled />}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Controller
                            name="phone"
                            control={control}
                            render={({ field }) => <Input {...field} placeholder="Ej: +54 9 11 12345678" />}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="address">Dirección</Label>
                        <Controller
                            name="address"
                            control={control}
                            render={({ field }) => <Input {...field} placeholder="Ej: Av. Corrientes 1234, CABA" />}
                        />
                    </div>
                </div>

              </CardContent>
              <CardFooter>
                 <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>
      </main>
    </div>
  );
}
