'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from './use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const WARNING_TIME = 1 * 60 * 1000; // 1 minute before timeout

export function useSessionTimeout() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_TIME / 1000);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(() => {
    signOut(auth).then(() => {
      router.push('/login');
      toast({
        title: "Sesión cerrada",
        description: "Tu sesión ha sido cerrada por inactividad.",
      });
    });
  }, [auth, router, toast]);

  const showWarning = useCallback(() => {
    setIsWarningOpen(true);
    setCountdown(WARNING_TIME / 1000);
    
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

  }, []);

  const resetTimer = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setIsWarningOpen(false);

    // Set new timers only if a user is logged in
    if (user) {
        warningTimeoutRef.current = setTimeout(showWarning, SESSION_TIMEOUT - WARNING_TIME);
        timeoutRef.current = setTimeout(handleLogout, SESSION_TIMEOUT);
    }
  }, [handleLogout, showWarning, user]);

  const stayActive = () => {
    resetTimer();
  };

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    const handleActivity = () => resetTimer();

    // Add event listeners when the component mounts
    events.forEach(event => window.addEventListener(event, handleActivity));

    // Initial timer setup
    resetTimer();

    // Cleanup function to remove event listeners
    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [resetTimer]);
  
  const InactivityWarningDialog = () => (
     <AlertDialog open={isWarningOpen} onOpenChange={setIsWarningOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Sigues ahí?</AlertDialogTitle>
                <AlertDialogDescription>
                    Tu sesión está a punto de cerrarse por inactividad. Cerraremos tu sesión en {countdown} segundos.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={handleLogout}>Cerrar Sesión</AlertDialogCancel>
                <AlertDialogAction onClick={stayActive}>Permanecer Activo</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  );

  return { InactivityWarningDialog };
}
