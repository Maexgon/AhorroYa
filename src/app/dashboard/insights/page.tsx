'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Sparkles, Lightbulb, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { Budget, Category, Expense, User as UserType } from '@/lib/types';
import { generateInsightsAction } from './actions';
import { type GenerateFinancialInsightsOutput } from '@/ai/flows/generate-financial-insights';

function InsightIcon({ emoji }: { emoji?: string }) {
    switch (emoji) {
        case '💡': return <Lightbulb className="h-8 w-8 text-yellow-500" />;
        case '📈': return <TrendingUp className="h-8 w-8 text-green-500" />;
        case '💸': return <TrendingDown className="h-8 w-8 text-red-500" />;
        case '⚠️': return <AlertTriangle className="h-8 w-8 text-orange-500" />;
        default: return <Sparkles className="h-8 w-8 text-accent" />;
    }
}


export default function InsightsPage() {
    const { user, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();
    const [tenantId, setTenantId] = React.useState<string | null>(null);
    const [insightsData, setInsightsData] = React.useState<GenerateFinancialInsightsOutput | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // --- Data Fetching ---
    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

    React.useEffect(() => {
        if (userData?.tenantIds && userData.tenantIds.length > 0) {
            setTenantId(userData.tenantIds[0]);
        }
    }, [userData]);

    const expensesQuery = useMemoFirebase(() => {
        if (!tenantId || !firestore) return null;
        return query(collection(firestore, 'expenses'), where('tenantId', '==', tenantId), where('deleted', '==', false));
    }, [tenantId, firestore]);
    const { data: expenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

    const budgetsQuery = useMemoFirebase(() => {
        if (!tenantId || !firestore) return null;
        return query(collection(firestore, 'budgets'), where('tenantId', '==', tenantId));
    }, [tenantId, firestore]);
    const { data: budgets, isLoading: isLoadingBudgets } = useCollection<Budget>(budgetsQuery);

    const categoriesQuery = useMemoFirebase(() => {
        if (!tenantId || !firestore) return null;
        return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId));
    }, [tenantId, firestore]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);
    
    // --- AI Insights Generation ---
    React.useEffect(() => {
        const areDataQueriesLoading = isAuthLoading || isUserDocLoading || isLoadingExpenses || isLoadingBudgets || isLoadingCategories;
        if (areDataQueriesLoading || !expenses || !budgets || !categories) {
            return;
        }

        const generateInsights = async () => {
            setIsLoading(true);
            setError(null);
            
            const result = await generateInsightsAction({
                expenses: JSON.stringify(expenses),
                budgets: JSON.stringify(budgets),
                categories: JSON.stringify(categories.map(c => ({id: c.id, name: c.name}))),
                baseCurrency: 'ARS',
            });

            if (result.success && result.data) {
                setInsightsData(result.data);
            } else {
                setError(result.error || 'No se pudieron generar los insights.');
            }
            setIsLoading(false);
        };

        generateInsights();

    }, [isAuthLoading, isUserDocLoading, isLoadingExpenses, isLoadingBudgets, isLoadingCategories, expenses, budgets, categories]);

    return (
        <div className="flex min-h-screen flex-col bg-secondary/50">
            <header className="sticky top-0 z-40 w-full border-b bg-background">
                <div className="container flex h-16 items-center">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard">
                            <ArrowLeft />
                        </Link>
                    </Button>
                    <h1 className="ml-4 font-headline text-xl font-bold">Análisis Financiero con IA</h1>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8">
                 <div className="mx-auto max-w-3xl">
                    {isLoading ? (
                        <Card className="flex flex-col items-center justify-center p-12">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <p className="mt-4 text-lg text-muted-foreground">Nuestros analistas de IA están trabajando en tu informe...</p>
                             <p className="mt-2 text-sm text-muted-foreground">(Esto podría tardar un momento)</p>
                        </Card>
                    ) : error ? (
                        <Card className="p-8 text-center bg-destructive/10 border-destructive">
                             <h2 className="text-xl font-bold text-destructive">Error al Generar Análisis</h2>
                            <p className="text-destructive/80 mt-2">{error}</p>
                            <Button variant="outline" asChild className="mt-6">
                                <Link href="/dashboard">Volver al Dashboard</Link>
                            </Button>
                        </Card>
                    ) : insightsData ? (
                        <div className="space-y-8">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Resumen General</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">{insightsData.summary}</p>
                                </CardContent>
                            </Card>
                            
                            <div>
                                <h2 className="text-2xl font-headline font-bold mb-4">Recomendaciones Clave</h2>
                                <div className="space-y-6">
                                    {insightsData.insights.map((insight, index) => (
                                        <Card key={index} className="flex flex-col md:flex-row items-start gap-6 p-6">
                                             <div className="bg-primary/10 p-3 rounded-lg">
                                                <InsightIcon emoji={insight.emoji} />
                                             </div>
                                             <div className="flex-1">
                                                <h3 className="font-bold text-lg text-foreground">{insight.title}</h3>
                                                <p className="mt-1 text-muted-foreground text-sm">{insight.description}</p>
                                                <div className="mt-4 bg-primary/5 border-l-4 border-primary p-3 rounded-r-lg">
                                                    <p className="font-semibold text-primary-dark text-sm">{insight.suggestion}</p>
                                                </div>
                                             </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </div>

                    ) : null}
                </div>
            </main>
        </div>
    );
}
