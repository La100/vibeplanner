import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { SUBSCRIPTION_PLANS } from "@/convex/stripe";

import { CreditCard, Crown, Zap, Users, FolderOpen, HardDrive, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { toast } from "sonner";

interface SubscriptionCardProps {
  teamId: Id<"teams">;
}

export function SubscriptionCard({ teamId }: SubscriptionCardProps) {
  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  
  const subscription = useQuery(api.stripe.getTeamSubscription, { teamId });
  const createCheckoutSession = useMutation(api.stripe.createCheckoutSession);
  const cancelSubscription = useMutation(api.stripe.cancelSubscription);

  if (!subscription) {
    return <div>Ładowanie...</div>;
  }

  const isActive = subscription.subscriptionStatus === "active" || subscription.subscriptionStatus === "trialing";
  const isTrial = subscription.subscriptionStatus === "trialing";
  const isPastDue = subscription.subscriptionStatus === "past_due";

  const handleUpgrade = async (priceId: string) => {
    setLoading(true);
    try {
      await createCheckoutSession({
        teamId,
        priceId,
      });
      
      toast.success("Przekierowywanie do płatności zostało zlecone. Sprawdź email lub odśwież stronę za chwilę.");
    } catch (error) {
      console.error("Error creating checkout session:", error);
      toast.error("Błąd podczas przekierowania do płatności");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (cancelAtPeriodEnd: boolean) => {
    setCancelLoading(true);
    try {
      await cancelSubscription({
        teamId,
        cancelAtPeriodEnd,
      });
      
      toast.success(
        cancelAtPeriodEnd 
          ? "Subskrypcja zostanie anulowana na koniec okresu rozliczeniowego"
          : "Subskrypcja została anulowana"
      );
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast.error("Błąd podczas anulowania subskrypcji");
    } finally {
      setCancelLoading(false);
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleDateString("pl-PL");
  };

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case "free": return <Users className="h-5 w-5" />;
      case "basic": return <FolderOpen className="h-5 w-5" />;
      case "pro": return <Zap className="h-5 w-5" />;
      case "enterprise": return <Crown className="h-5 w-5" />;
      default: return <Users className="h-5 w-5" />;
    }
  };

  const getStatusBadge = () => {
    if (isTrial) return <Badge variant="secondary">Okres próbny</Badge>;
    if (isActive) return <Badge variant="default">Aktywna</Badge>;
    if (isPastDue) return <Badge variant="destructive">Zaległość</Badge>;
    if (subscription.cancelAtPeriodEnd) return <Badge variant="outline">Do anulowania</Badge>;
    return <Badge variant="outline">Nieaktywna</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getPlanIcon(subscription.subscriptionPlan)}
              <div>
                <CardTitle className="text-xl">
                  Plan {subscription.planDetails.name}
                </CardTitle>
                <CardDescription>
                  {subscription.planDetails.price === 0 
                    ? "Darmowy plan" 
                    : `${subscription.planDetails.price} PLN/miesiąc`
                  }
                </CardDescription>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plan Limits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {subscription.limits.maxProjects} projektów
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {subscription.limits.maxTeamMembers} członków
              </span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {subscription.limits.maxStorageGB} GB storage
              </span>
            </div>
          </div>

          {/* Subscription Details */}
          {isActive && subscription.currentPeriodEnd && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {isTrial ? "Okres próbny kończy się" : "Odnowi się"}: {formatDate(subscription.currentPeriodEnd)}
              </p>
              {subscription.cancelAtPeriodEnd && (
                <p className="text-sm text-orange-600 mt-1">
                  Subskrypcja zostanie anulowana na koniec okresu rozliczeniowego
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            {subscription.subscriptionPlan === "free" ? (
              <Button onClick={() => handleUpgrade("price_basic_monthly")} disabled={loading}>
                <CreditCard className="h-4 w-4 mr-2" />
                Upgrade do Basic
              </Button>
            ) : (
              <>
                {!subscription.cancelAtPeriodEnd && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" disabled={cancelLoading}>
                        Anuluj subskrypcję
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Anuluj subskrypcję</DialogTitle>
                        <DialogDescription>
                          Wybierz, kiedy chcesz anulować subskrypcję.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => handleCancel(true)}
                          disabled={cancelLoading}
                        >
                          Anuluj na koniec okresu rozliczeniowego
                        </Button>
                        <Button 
                          variant="destructive" 
                          className="w-full"
                          onClick={() => handleCancel(false)}
                          disabled={cancelLoading}
                        >
                          Anuluj natychmiast
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      {subscription.subscriptionPlan !== "enterprise" && (
        <Card>
          <CardHeader>
            <CardTitle>Dostępne plany</CardTitle>
            <CardDescription>
              Wybierz plan odpowiedni dla Twojego zespołu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries({
                basic: { priceId: "price_basic_monthly", popular: false },
                pro: { priceId: "price_pro_monthly", popular: true },
                enterprise: { priceId: "price_enterprise_monthly", popular: false },
              }).map(([planKey, planData]) => {
                const plan = SUBSCRIPTION_PLANS?.[planKey as keyof typeof SUBSCRIPTION_PLANS] || {
                  name: planKey,
                  price: 0,
                  maxProjects: 0,
                  maxTeamMembers: 0,
                  hasAdvancedFeatures: false,
                };
                
                const isCurrent = subscription.subscriptionPlan === planKey;
                
                return (
                  <Card key={planKey} className={`relative ${planData.popular ? 'border-primary' : ''}`}>
                    {planData.popular && (
                      <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        Najpopularniejszy
                      </Badge>
                    )}
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <div className="text-2xl font-bold">
                        {plan.price} PLN
                        <span className="text-sm font-normal text-muted-foreground">/miesiąc</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{plan.maxProjects} projektów</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{plan.maxTeamMembers} członków zespołu</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{plan.maxStorageGB} GB storage</span>
                        </div>
                        {plan.hasAdvancedFeatures && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-sm">Zaawansowane funkcje</span>
                          </div>
                        )}
                      </div>
                      
                      <Button 
                        className="w-full mt-4"
                        variant={isCurrent ? "outline" : "default"}
                        disabled={isCurrent || loading}
                        onClick={() => !isCurrent && handleUpgrade(planData.priceId)}
                      >
                        {isCurrent ? "Aktualny plan" : "Wybierz plan"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 