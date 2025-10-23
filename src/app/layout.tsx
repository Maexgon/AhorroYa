
'use client';
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase';
import Footer from '@/components/shared/footer';
import { usePathname } from 'next/navigation';


// export const metadata: Metadata = {
//   title: 'Ahorro Ya',
//   description: 'Toma el control de tus finanzas.',
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const showFooter = !pathname.startsWith('/superadmin');

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Ahorro Ya</title>
        <meta name="description" content="Toma el control de tus finanzas." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased flex flex-col min-h-screen">
        <FirebaseClientProvider>
          <main className="flex-1">
            {children}
          </main>
          {showFooter && <Footer />}
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
