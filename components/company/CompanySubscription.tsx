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
    FolderOpen
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatTokens } from "@/lib/aiPricing";
import { cn } from "@/lib/utils";

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

    const isPro = subscription?.subscriptionStatus === "active" || subscription?.subscriptionStatus === "trialing";

    const handleManageSubscription = async () => {
        if (!teamData?.teamId) return;
        setActionLoading(true);
        try {
            if (isPro) {
                const result = await createBillingPortalSession({ teamId: teamData.teamId });
                if (result.url) {
                    window.location.href = result.url;
                } else {
                    toast.error("Failed to open billing portal");
                }
            } else {
                if (!subConfig?.proPriceId) {
                    toast.error("Subscription configuration missing");
                    return;
                }
                const result = await createCheckoutSession({
                    teamId: teamData.teamId,
                    priceId: subConfig.proPriceId
                });
                if (result.url) {
                    window.location.href = result.url;
                } else {
                    toast.error("Failed to start checkout");
                }
            }
        } catch (error) {
            console.error("Error managing subscription:", error);
            toast.error(isPro ? "Error opening billing portal" : "Error starting checkout");
        } finally {
            setActionLoading(false);
        }
    };

    const remainingCredits = aiAccess?.remainingTokens ?? 0;
    const totalCredits = aiAccess?.totalTokens ?? remainingCredits;
    const usedCredits = usageBreakdown?.totalTokens ?? Math.max(0, totalCredits - remainingCredits);
    const usagePercent = totalCredits > 0 ? Math.min(100, Math.round((usedCredits / totalCredits) * 100)) : 0;
    const totalInputTokens = usageBreakdown?.totalInputTokens ?? 0;
    const totalOutputTokens = usageBreakdown?.totalOutputTokens ?? 0;
    const inputCostUSD = usageBreakdown?.inputCostUSD ?? 0;
    const outputCostUSD = usageBreakdown?.outputCostUSD ?? 0;
    const totalCostUSD = usageBreakdown?.totalCostUSD ?? 0;
    const planStatus = subscription?.subscriptionStatus;
    const subscriptionLabel = planStatus === "trialing" ? "Trial" : subscription?.planDetails?.name || "Free";
    let subscriptionSubtext = "No active subscription";
    if (planStatus === "trialing") {
        subscriptionSubtext = "Active trial subscription";
    } else if (planStatus === "active") {
        subscriptionSubtext = "Active subscription";
    }
    const formatUSD = (value: number) =>
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);

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
                                <Button
                                    onClick={() => {
                                        console.log("SubConfig:", subConfig);
                                        handleManageSubscription();
                                    }}
                                    disabled={actionLoading}
                                    className={cn(
                                        "w-full relative overflow-hidden transition-all duration-300",
                                        !isPro && "bg-foreground text-background hover:bg-foreground/90 hover:ring-2 hover:ring-foreground/20 hover:ring-offset-2 ring-offset-background"
                                    )}
                                    variant={isPro ? "outline" : "default"}
                                >
                                    {actionLoading ? (
                                        "Processing..."
                                    ) : isPro ? (
                                        "Manage Subscription"
                                    ) : (
                                        <>
                                            <span className="relative z-10 font-semibold">Upgrade to Pro</span>
                                            <span className="absolute inset-0 -z-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.4)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%,100%_100%] bg-[position:-100%_0,0_0] bg-no-repeat transition-[background-position_0s] duration-0 group-hover:bg-[position:200%_0,0_0] group-hover:duration-[1200ms]" />
                                        </>
                                    )}
                                </Button>
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
                                        const formatted = amount.toFixed(2);
                                        const createdAt = new Date(payment.created * 1000).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        });
                                        return (
                                            <div key={payment.stripePaymentIntentId} className="flex flex-col gap-1 rounded-lg border border-border/40 px-4 py-3 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">{formatted}</span>
                                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{payment.status}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <span>{createdAt}</span>
                                                    <span>{payment.stripePaymentIntentId.slice(-8)}</span>
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
                        <p className="text-sm text-muted-foreground">Monitor your usage, costs, and resource consumption.</p>
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
                                    AI Token Costs
                                </CardTitle>
                                <CardDescription>Input vs output for this billing period</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">Input tokens</p>
                                        <div className="text-lg font-semibold tabular-nums">{formatTokens(totalInputTokens)}</div>
                                        <p className="text-xs text-muted-foreground">{formatUSD(inputCostUSD)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">Output tokens</p>
                                        <div className="text-lg font-semibold tabular-nums">{formatTokens(totalOutputTokens)}</div>
                                        <p className="text-xs text-muted-foreground">{formatUSD(outputCostUSD)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between border-t border-border/40 pt-3 text-sm">
                                    <span className="text-muted-foreground">Total cost</span>
                                    <span className="font-medium tabular-nums">{formatUSD(totalCostUSD)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">Rates: $1.75 / 1M input, $14 / 1M output</p>
                            </CardContent>
                        </Card>

                        <Card className="border-border/40 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-medium flex items-center gap-2">
                                    <FolderOpen className="h-4 w-4 text-purple-500" />
                                    Assistants
                                </CardTitle>
                                <CardDescription>Active projects</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="text-xl font-semibold tabular-nums">{resourceUsage?.projectsUsed ?? 0} projects</div>
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
