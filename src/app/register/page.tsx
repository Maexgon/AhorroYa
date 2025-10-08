'use client';

import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AhorroYaLogo } from '@/components/shared/icons';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const [num1, setNum1] = React.useState(0);
  const [num2, setNum2] = React.useState(0);
  const [captcha, setCaptcha] = React.useState('');

  React.useEffect(() => {
    setNum1(Math.floor(Math.random() * 10) + 1);
    setNum2(Math.floor(Math.random() * 10) + 1);
  }, []);

  const passwordValidations = {
    length: password.length >= 8,
    specialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password),
    number: /\d/.test(password),
  };

  const allPasswordReqsMet = Object.values(passwordValidations).every(Boolean);
  const passwordsMatch = password && password === confirmPassword;
  const isCaptchaCorrect = num1 > 0 && parseInt(captcha) === num1 + num2;

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <AhorroYaLogo className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-2xl">Crea tu cuenta</CardTitle>
          <CardDescription>Comienza a tomar el control de tus finanzas hoy mismo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre</Label>
                <Input id="firstName" type="text" placeholder="Tu Nombre" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido</Label>
                <Input id="lastName" type="text" placeholder="Tu Apellido" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="tu@email.com" required />
            </div>
            <div className="space-y-2 relative">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                {allPasswordReqsMet && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </div>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[2.25rem] text-muted-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="text-xs text-muted-foreground grid grid-cols-2 gap-x-4">
                 <div className={`flex items-center gap-2 ${passwordValidations.length ? 'text-green-500' : ''}`}>
                  {passwordValidations.length ? <CheckCircle2 className="h-3 w-3" /> : null} 8+ caracteres
                </div>
                <div className={`flex items-center gap-2 ${passwordValidations.number ? 'text-green-500' : ''}`}>
                   {passwordValidations.number ? <CheckCircle2 className="h-3 w-3" /> : null} Un número
                </div>
                 <div className={`flex items-center gap-2 ${passwordValidations.specialChar ? 'text-green-500' : ''}`}>
                  {passwordValidations.specialChar ? <CheckCircle2 className="h-3 w-3" /> : null} Un carácter especial
                </div>
              </div>
            )}
             <div className="space-y-2 relative">
              <div className="flex items-center justify-between">
                <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                {passwordsMatch && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </div>
              <Input 
                id="confirmPassword" 
                type={showConfirmPassword ? 'text' : 'password'} 
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
               <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-[2.25rem] text-muted-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="space-y-3">
              <Label>Tipo de cuenta</Label>
              <RadioGroup defaultValue="personal" className="grid grid-cols-3 gap-4">
                <div>
                  <RadioGroupItem value="personal" id="personal" className="peer sr-only" />
                  <Label
                    htmlFor="personal"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    Personal
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="familiar" id="familiar" className="peer sr-only" />
                  <Label
                    htmlFor="familiar"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    Familiar
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="empresa" id="empresa" className="peer sr-only" />
                  <Label
                    htmlFor="empresa"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    Empresa
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="captcha">¿Cuánto es {num1} + {num2}?</Label>
                {isCaptchaCorrect && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </div>
              <Input 
                id="captcha" 
                type="number" 
                required 
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Crear Cuenta
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="underline">
              Inicia Sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}