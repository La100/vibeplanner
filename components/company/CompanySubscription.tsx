"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { toast } from "sonner";
import {
    Sparkles,
    AlertCircle,
    DollarSign,
    CreditCard,
    Coins,
    Clock3,
    FolderOpen,
    Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatTokens } from "@/lib/aiPricing";

export default function CompanySubscription() {
    const teamData = useQuery(apiAny.teams.getMyTeamSettings);
    const teamId = teamData?.teamId;

    const aiAccess = useQuery(apiAny.stripe.checkTeamAIAccess, teamId ? { teamId } : "skip");
    const subscription = useQuery(apiAny.stripe.getTeamSubscription, teamId ? { teamId } : "skip");
    const usageBreakdown = useQuery(apiAny.ai.usage.getTeamUsageBreakdown, teamId ? { teamId } : "skip");
    const resourceUsage = useQuery(apiAny.teams.getTeamResourceUsage, teamId ? { teamId } : "skip");
    const subConfig = useQuery(apiAny.stripe.getSubscriptionConfig);

    const ensureBillingWindow = useMutation(apiAny.stripe.ensureBillingWindow);
    const createBillingPortalSession = useAction(apiAny.stripeActions.createBillingPortalSession);
    const createCheckoutSession = useAction(apiAny.stripeActions.createCheckoutSession);
    const ensureSubscriptionSynced = useAction(apiAny.stripeActions.ensureSubscriptionSynced);
    const teamPayments = useQuery(apiAny.stripe.getTeamPayments, teamId ? { teamId } : "skip");

    const [actionLoading, setActionLoading] = useState(false);
    const billingWindowEnsuredRef = useRef(false);

    useEffect(() => {
        if (subscription && subscription.stripeCustomerId && subscription.subscriptionPlan === "free") {
            ensureSubscriptionSynced({ teamId: subscription.teamId }).catch(console.error);
        }
    }, [subscription, ensureSubscriptionSynced]);

    useEffect(() => {
        if (!subscription || !teamData?.teamId || billingWindowEnsuredRef.current) return;
        const start = subscription.currentPeriodStart;
        const end = subscription.currentPeriodEnd;
        const now = Date.now();
        const invalidWindow = !start || !end || end <= start || end < now;
        if (invalidWindow) {
            billingWindowEnsuredRef.current = true;
            ensureBillingWindow({ teamId: teamData.teamId }).catch(console.error);
        }
    }, [subscription, teamData?.teamId, ensureBillingWindow]);

    if (!teamData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground animate-pulse">Loading subscription details...</p>
            </div>
        );
    }

    const hasPaidSubscription = !!(
        subscription?.subscriptionId &&
        (subscription?.subscriptionStatus === "active" || subscription?.subscriptionStatus === "trialing")
    );

    const handleManageSubscription = async () => {
        if (!teamData?.teamId) return;
        setActionLoading(true);
        try {
            const result = await createBillingPortalSession({ teamId: teamData.teamId });
            if (result.url) {
                window.location.href = result.url;
            } else {
                toast.error("Failed to open billing portal");
            }
        } catch (error) {
            console.error("Error managing subscription:", error);
            toast.error("Error opening billing portal");
        } finally {
            setActionLoading(false);
        }
    };

    const handleStartCheckout = async (priceId: string | undefined, planLabel: string) => {
        if (!teamData?.teamId) return;
        setActionLoading(true);
        try {
            if (!priceId) {
                toast.error(`Missing Stripe price ID for ${planLabel}`);
                return;
            }
            const result = await createCheckoutSession({
                teamId: teamData.teamId,
                priceId
            });
            if (result.url) {
                window.location.href = result.url;
            } else {
                toast.error("Failed to start checkout");
            }
        } catch (error) {
            console.error("Error starting checkout:", error);
            toast.error("Error starting checkout");
        } finally {
            setActionLoading(false);
        }
    };

    const remainingCredits = aiAccess?.remainingTokens ?? 0;
    const totalCredits = aiAccess?.totalTokens ?? remainingCredits;
    const usedCredits = usageBreakdown?.totalTokens ?? Math.max(0, totalCredits - remainingCredits);
    const totalInputTokens = usageBreakdown?.totalInputTokens ?? 0;
    const totalOutputTokens = usageBreakdown?.totalOutputTokens ?? 0;
    const planStatus = subscription?.subscriptionStatus;
    const subscriptionLabel = planStatus === "trialing" ? "Trial" : subscription?.planDetails?.name || "Free";
    let subscriptionSubtext = "No active subscription";
    if (planStatus === "trialing") {
        subscriptionSubtext = "Active trial subscription";
    } else if (planStatus === "active") {
        subscriptionSubtext = "Active subscription";
    }
    const usagePercent = totalCredits > 0 ? Math.min(100, Math.round((usedCredits / totalCredits) * 100)) : 0;

    // Filter relevant usage categories (hide empty ones)
    const usageCategories = [
        { key: "assistant", label: "AI Assistant", icon: Sparkles, color: "text-blue-500", barColor: "bg-blue-500" },
        { key: "other", label: "Other", icon: AlertCircle, color: "text-amber-500", barColor: "bg-amber-500" },
    ].filter(cat => (usageBreakdown?.byFeature?.[cat.key] || 0) > 0);

    return (
        <div className="min-h-screen bg-background pb-20">
            <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
                <div className="flex flex-col gap-2 border-b border-border/40 pb-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Subscription & Billing</h1>
                            <p className="text-sm text-muted-foreground">Manage your plan, AI credits, and usage.</p>
                        </div>
                    </div>
                </div>

                {!hasPaidSubscription && (
                    <section className="rounded-3xl border border-border/40 bg-gradient-to-br from-background via-background to-muted/20 p-6 md:p-8">
                        <div className="mx-auto max-w-3xl text-center">
                            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                                Start free. Scale when you&apos;re ready.
                            </h2>
                            <p className="mt-3 text-muted-foreground">
                                Upgrade only when you need a larger monthly AI token quota.
                            </p>
                        </div>

                        <div className="mt-8 grid gap-4 lg:grid-cols-3">
                            <Card className="border-border/50 bg-card/70">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-2xl font-semibold">Free</CardTitle>
                                    <CardDescription className="text-lg">$0 forever</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {[
                                        "Starter AI token quota",
                                        "AI chat access enabled",
                                        "Free plan limits apply",
                                    ].map((feature) => (
                                        <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Check className="h-4 w-4 text-primary" />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                    <Button disabled className="mt-4 w-full" variant="outline">
                                        Current plan
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="border-border/60 bg-card shadow-sm ring-1 ring-border/40">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-2xl font-semibold">Pro</CardTitle>
                                    <CardDescription className="text-lg">${subConfig?.proMonthlyPrice ?? 29}/mo</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {[
                                        "Larger monthly AI token quota",
                                        "For frequent assistant usage",
                                        "Upgrade from Free limits",
                                    ].map((feature) => (
                                        <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Check className="h-4 w-4 text-primary" />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                    <Button
                                        className="mt-4 w-full"
                                        disabled={actionLoading}
                                        onClick={() => handleStartCheckout(subConfig?.proPriceId, "Pro")}
                                    >
                                        {actionLoading ? "Processing..." : "Start Pro"}
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="border-border/50 bg-card/70">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-2xl font-semibold">Scale</CardTitle>
                                    <CardDescription className="text-lg">${subConfig?.scaleMonthlyPrice ?? 49}/mo</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {[
                                        "Largest monthly AI token quota",
                                        "For heavy AI usage",
                                        "Maximum token headroom",
                                    ].map((feature) => (
                                        <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Check className="h-4 w-4 text-primary" />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                    <Button
                                        className="mt-4 w-full"
                                        disabled={actionLoading}
                                        variant="outline"
                                        onClick={() => handleStartCheckout(subConfig?.scalePriceId, "Scale")}
                                    >
                                        {actionLoading ? "Processing..." : "Go Scale"}
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </section>
                )}

                <div className="space-y-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-medium">Credits & Billing</h2>
                        <p className="text-sm text-muted-foreground">Manage your credits and view transaction history.</p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Card className="border-border/40 shadow-sm">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base font-medium flex items-center gap-2">
                                    <Coins className="h-4 w-4" />
                                    Available Credits
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="text-4xl font-semibold tracking-tight tabular-nums">
                                    {remainingCredits.toLocaleString()} credits
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    {aiAccess?.hasAccess ? "Active balance" : "No active credits"}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-border/40 shadow-sm">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base font-medium flex items-center gap-2">
                                    <CreditCard className="h-4 w-4" />
                                    Subscription
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-0">
                                <div className="space-y-1">
                                    <div className="text-2xl font-semibold tracking-tight">{subscriptionLabel}</div>
                                    <p className="text-sm text-muted-foreground">{subscriptionSubtext}</p>
                                </div>
                                {hasPaidSubscription ? (
                                    <Button
                                        onClick={handleManageSubscription}
                                        disabled={actionLoading}
                                        className="w-full"
                                        variant="outline"
                                    >
                                        {actionLoading ? "Processing..." : "Manage Subscription"}
                                    </Button>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        You&apos;re on Free. Choose Pro or Scale from the comparison section above.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-border/40 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base font-medium">Transaction History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {teamPayments && teamPayments.length > 0 ? (
                                <div className="space-y-4">
                                    {teamPayments.map((payment) => {
                                        const amount = payment.amount / 100;
                                        const currencyCode = (payment.currency || "usd").toUpperCase();
                                        let formatted = `$${amount.toFixed(2)}`;
                                        try {
                                            formatted = new Intl.NumberFormat("en-US", {
                                                style: "currency",
                                                currency: currencyCode,
                                            }).format(amount);
                                        } catch {
                                            formatted = `$${amount.toFixed(2)}`;
                                        }
                                        const createdAt = new Date(payment.created * 1000).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        });
                                        const sourceLabel = payment.source === "invoice" ? "Invoice" : "Payment";
                                        const planLabel = payment.planName || "Subscription";
                                        return (
                                            <div key={`${payment.source}-${payment.stripePaymentIntentId}`} className="flex flex-col gap-1 rounded-lg border border-border/40 px-4 py-3 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">{formatted}</span>
                                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{payment.status}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <span>{createdAt}</span>
                                                    <span>{planLabel} • {sourceLabel} {payment.stripePaymentIntentId.slice(-8)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                                    <Clock3 className="h-6 w-6" />
                                    <p className="text-sm">No transactions yet</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Separator />

                <div className="space-y-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-medium">Usage</h2>
                        <p className="text-sm text-muted-foreground">Monitor your token usage and resource consumption.</p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <Card className="border-border/40 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-medium flex items-center gap-2">
                                    <Coins className="h-4 w-4 text-blue-500" />
                                    AI Credits
                                </CardTitle>
                                <CardDescription>
                                    {usageBreakdown?.periodStart
                                        ? new Date(usageBreakdown.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                        : "Current period"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="text-xl font-semibold tabular-nums">{formatTokens(usedCredits)}</div>
                                    <p className="text-xs text-muted-foreground">credits used this billing period</p>
                                </div>
                                <div>
                                    <div className="text-xl font-semibold tabular-nums">{formatTokens(remainingCredits)}</div>
                                    <p className="text-xs text-muted-foreground">credits remaining</p>
                                </div>
                                <div className="space-y-2 pt-2">
                                    <Progress
                                        value={usagePercent}
                                        className="h-2 bg-muted/30"
                                        indicatorClassName={
                                            usagePercent >= 90
                                                ? "bg-red-500"
                                                : usagePercent >= 75
                                                    ? "bg-orange-500"
                                                    : "bg-blue-500"
                                        }
                                    />
                                    <p className="text-xs text-muted-foreground">{usagePercent}% used</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/40 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-medium flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-amber-500" />
                                    Token Mix
                                </CardTitle>
                                <CardDescription>Input vs output tokens for this billing period</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">Input tokens</p>
                                        <div className="text-lg font-semibold tabular-nums">{formatTokens(totalInputTokens)}</div>
                                        <p className="text-xs text-muted-foreground">
                                            {usedCredits > 0 ? `${((totalInputTokens / usedCredits) * 100).toFixed(1)}%` : "0%"}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">Output tokens</p>
                                        <div className="text-lg font-semibold tabular-nums">{formatTokens(totalOutputTokens)}</div>
                                        <p className="text-xs text-muted-foreground">
                                            {usedCredits > 0 ? `${((totalOutputTokens / usedCredits) * 100).toFixed(1)}%` : "0%"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between border-t border-border/40 pt-3 text-sm">
                                    <span className="text-muted-foreground">Total tokens</span>
                                    <span className="font-medium tabular-nums">{formatTokens(usedCredits)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">Usage shown in token units.</p>
                            </CardContent>
                        </Card>

                        <Card className="border-border/40 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-medium flex items-center gap-2">
                                    <FolderOpen className="h-4 w-4 text-purple-500" />
                                    Assistants
                                </CardTitle>
                                <CardDescription>Active assistants</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="text-xl font-semibold tabular-nums">{resourceUsage?.projectsUsed ?? 0} assistants</div>
                                    <p className="text-xs text-muted-foreground">of {resourceUsage?.projectsLimit ?? 0} total</p>
                                </div>
                                <div className="space-y-2 pt-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{resourceUsage?.projectsUsed ?? 0} used</span>
                                        <span>{resourceUsage?.projectsLimit ?? 0} total</span>
                                    </div>
                                    <Progress
                                        value={resourceUsage?.projectsPercentUsed ?? 0}
                                        className="h-2 bg-muted/30"
                                        indicatorClassName={
                                            (resourceUsage?.projectsPercentUsed ?? 0) >= 100
                                                ? "bg-red-500"
                                                : (resourceUsage?.projectsPercentUsed ?? 0) >= 90
                                                    ? "bg-orange-500"
                                                    : "bg-purple-500"
                                        }
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {(resourceUsage?.projectsPercentUsed ?? 0) >= 100 && (
                                            <span className="text-red-500 font-medium mr-1">Limit reached!</span>
                                        )}
                                        {resourceUsage?.projectsPercentUsed ?? 0}% used
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                    </div>

                    <Card className="border-border/40 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-medium">Credit Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>Credits Used</span>
                                <span>
                                    {formatTokens(usedCredits)} of {formatTokens(totalCredits)} credits
                                </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30 flex">
                                {usageCategories.map((segment) => {
                                    const tokens = usageBreakdown?.byFeature?.[segment.key] || 0;
                                    const percent = usedCredits > 0 ? (tokens / usedCredits) * 100 : 0;
                                    if (percent <= 0) return null;
                                    return <div key={segment.key} className={segment.barColor} style={{ width: `${percent}%` }} />;
                                })}
                            </div>
                            <div className="space-y-3">
                                {usageCategories.length > 0 ? (
                                    usageCategories.map((item) => {
                                        const tokens = usageBreakdown?.byFeature?.[item.key] || 0;
                                        const percent = usedCredits > 0 ? (tokens / usedCredits) * 100 : 0;
                                        const Icon = item.icon;
                                        return (
                                            <div key={item.key} className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Icon className={`h-4 w-4 ${item.color}`} />
                                                    <span>{item.label}</span>
                                                </div>
                                                <div className="text-muted-foreground">
                                                    {formatTokens(tokens)} credits ({percent.toFixed(1)}%)
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">No usage data available for this period.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
