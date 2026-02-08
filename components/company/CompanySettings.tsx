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
  Settings,
  Coins,
  Clock3,
  HardDrive,
  FolderOpen,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatTokens } from "@/lib/aiPricing";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function CompanySettings() {
  // Loading actual data from backend
  const teamData = useQuery(apiAny.teams.getMyTeamSettings);

  const teamId = teamData?.teamId;

  const aiAccess = useQuery(apiAny.stripe.checkTeamAIAccess, teamId ? { teamId } : "skip");
  const subscription = useQuery(apiAny.stripe.getTeamSubscription, teamId ? { teamId } : "skip");
  const usageBreakdown = useQuery(apiAny.ai.usage.getTeamUsageBreakdown, teamId ? { teamId } : "skip");
  const storageUsage = useQuery(apiAny.files.getTeamStorageUsage, teamId ? { teamId } : "skip");
  const resourceUsage = useQuery(apiAny.teams.getTeamResourceUsage, teamId ? { teamId } : "skip");


  const ensureBillingWindow = useMutation(apiAny.stripe.ensureBillingWindow);
  const createBillingPortalSession = useAction(apiAny.stripeActions.createBillingPortalSession);
  const ensureSubscriptionSynced = useAction(apiAny.stripeActions.ensureSubscriptionSynced);
  const teamPayments = useQuery(apiAny.stripe.getTeamPayments, teamId ? { teamId } : "skip");
  const updateTeamTimezone = useMutation(apiAny.teams.updateTeamTimezone);

  // Local state for team settings
  const [portalLoading, setPortalLoading] = useState(false);
  const billingWindowEnsuredRef = useRef(false);
  const timezoneAutoSetRef = useRef(false);

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

  useEffect(() => {
    if (!teamData?.teamId || teamData.timezone || timezoneAutoSetRef.current) return;
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTimezone) return;
    timezoneAutoSetRef.current = true;
    updateTeamTimezone({ teamId: teamData.teamId, timezone: browserTimezone }).catch(console.error);
  }, [teamData?.teamId, teamData?.timezone, updateTeamTimezone]);

  if (!teamData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading settings...</p>
      </div>
    );
  }

  const handleManageSubscription = async () => {
    if (!teamData?.teamId) return;

    setPortalLoading(true);
    try {
      const result = await createBillingPortalSession({
        teamId: teamData.teamId,
      });

      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error("Failed to open billing portal");
      }
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      toast.error("Error opening billing portal");
    } finally {
      setPortalLoading(false);
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-border/40 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your preferences and billing.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium">Credits & Billing</h2>
            <p className="text-sm text-muted-foreground">
              Manage your credits and view transaction history.
            </p>
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
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="w-full"
                >
                  {portalLoading ? "Opening..." : "Manage Subscription"}
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
                      <div
                        key={payment.stripePaymentIntentId}
                        className="flex flex-col gap-1 rounded-lg border border-border/40 px-4 py-3 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{formatted}</span>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            {payment.status}
                          </span>
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
            <h2 className="text-lg font-medium">Localization</h2>
            <p className="text-sm text-muted-foreground">
              Configure your organization's region and time settings.
            </p>
          </div>

          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                Timezone
              </CardTitle>
              <CardDescription>
                This timezone will be used for AI scheduling and recurring tasks.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 max-w-md">
              <div className="space-y-2">
                <TimezoneSelector
                  value={teamData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                  onChange={(timezone) => {
                    updateTeamTimezone({
                      teamId: teamData.teamId,
                      timezone,
                    })
                      .then(() => toast.success("Timezone updated"))
                      .catch((e) => {
                        console.error(e);
                        toast.error("Failed to update timezone");
                      });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div className="space-y-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium">Usage</h2>
            <p className="text-sm text-muted-foreground">
              Monitor your usage, costs, and resource consumption across all services.
            </p>
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
                <CardDescription>
                  Input vs output for this billing period
                </CardDescription>
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
                <p className="text-xs text-muted-foreground">
                  Rates: $1.75 / 1M input, $14 / 1M output
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-emerald-500" />
                  Storage
                </CardTitle>
                <CardDescription>
                  All projects combined
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xl font-semibold tabular-nums">
                    {storageUsage?.usedGB.toFixed(2) ?? "0.00"} GB
                  </div>
                  <p className="text-xs text-muted-foreground">used of {storageUsage?.limitGB ?? 0} GB total</p>
                </div>
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{storageUsage?.usedGB.toFixed(2) ?? "0.00"} GB used</span>
                    <span>{storageUsage?.limitGB ?? 0} GB total</span>
                  </div>
                  <Progress
                    value={storageUsage?.percentUsed ?? 0}
                    className="h-2 bg-muted/30"
                    indicatorClassName={
                      (storageUsage?.percentUsed ?? 0) >= 90
                        ? "bg-red-500"
                        : (storageUsage?.percentUsed ?? 0) >= 75
                          ? "bg-orange-500"
                          : "bg-emerald-500"
                    }
                  />
                  <p className="text-xs text-muted-foreground">{storageUsage?.percentUsed.toFixed(1) ?? "0.0"}% used</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-purple-500" />
                  Assistants
                </CardTitle>
                <CardDescription>
                  Active projects
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xl font-semibold tabular-nums">
                    {resourceUsage?.projectsUsed ?? 0} projects
                  </div>
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
                      (resourceUsage?.projectsPercentUsed ?? 0) >= 90
                        ? "bg-red-500"
                        : (resourceUsage?.projectsPercentUsed ?? 0) >= 75
                          ? "bg-orange-500"
                          : "bg-purple-500"
                    }
                  />
                  <p className="text-xs text-muted-foreground">{resourceUsage?.projectsPercentUsed ?? 0}% used</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 shadow-sm md:col-span-2 lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  Subscription Plan
                  <span className="text-muted-foreground" title="Limits reset with each billing period.">
                    <AlertCircle className="h-3.5 w-3.5" />
                  </span>
                </CardTitle>
                <CardDescription>
                  {usageBreakdown?.periodEnd
                    ? `Next billing: ${new Date(usageBreakdown.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                    : "Billing period"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{subscriptionLabel}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Cost</span>
                  <span className="font-medium">
                    {subscription?.planDetails?.price ? `$${subscription.planDetails.price}` : "Free"}
                  </span>
                </div>
                <div className="pt-2">
                  <Button
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    variant="outline"
                    className="w-full"
                  >
                    {portalLoading ? "Opening..." : "Manage Subscription"}
                  </Button>
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
                {[
                  { key: "assistant", color: "bg-blue-500" },
                  { key: "other", color: "bg-amber-500" },
                ].map((segment) => {
                  const tokens = usageBreakdown?.byFeature?.[segment.key] || 0;
                  const percent = usedCredits > 0 ? (tokens / usedCredits) * 100 : 0;
                  if (percent <= 0) return null;
                  return (
                    <div
                      key={segment.key}
                      className={segment.color}
                      style={{ width: `${percent}%` }}
                    />
                  );
                })}
              </div>
              <div className="space-y-3">
                {[
                  { key: "assistant", label: "AI Assistant", icon: Sparkles, color: "text-blue-500" },
                  { key: "other", label: "Other", icon: AlertCircle, color: "text-amber-500" },
                ].map((item) => {
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
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  function TimezoneSelector({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) {
    const [open, setOpen] = useState(false);

    // Get all supported timezones
    const timezones = Intl.supportedValuesOf("timeZone");

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {value ? value.replace(/_/g, " ") : "Select timezone..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search timezone..." />
            <CommandList>
              <CommandEmpty>No timezone found.</CommandEmpty>
              <CommandGroup>
                {timezones.map((timezone) => (
                  <CommandItem
                    key={timezone}
                    value={timezone}
                    onSelect={(currentValue) => {
                      onChange(currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === timezone ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {timezone.replace(/_/g, " ")}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
}
