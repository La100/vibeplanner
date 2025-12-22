"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { OrganizationProfile } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

import { Sparkles, Zap, BarChart3, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubscriptionCard } from "@/components/ui/billing/SubscriptionCard";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GEMINI_4K_IMAGE_CREDITS } from "@/lib/aiPricing";

export default function CompanySettings() {
  const params = useParams<{ slug: string }>();
  
  // Loading actual data from backend
  const teamData = useQuery(api.teams.getTeamSettings, 
    params.slug ? { teamSlug: params.slug } : "skip"
  );
  const aiAccess = useQuery(api.stripe.checkTeamAIAccess, teamData?.teamId ? { teamId: teamData.teamId } : "skip");
  
  const updateTeamSettings = useMutation(api.teams.updateTeamSettings);
  const createCheckoutSession = useAction(api.stripeActions.createCheckoutSession);
  
  // Local state for team settings
  const [teamSettings, setTeamSettings] = useState<{
    currency: "USD" | "EUR" | "PLN" | "GBP" | "CAD" | "AUD" | "JPY" | "CHF" | "SEK" | "NOK" | "DKK" | "CZK" | "HUF" | "CNY" | "INR" | "BRL" | "MXN" | "KRW" | "SGD" | "HKD";
    isPublic: boolean;
    allowGuestAccess: boolean;
  }>({
    currency: "PLN",
    isPublic: false,
    allowGuestAccess: false,
  });
  const [upgradingPlan, setUpgradingPlan] = useState(false);

  // Synchronize data from backend
  useEffect(() => {
    if (teamData) {
      setTeamSettings({
        currency: (teamData.currency as "USD" | "EUR" | "PLN" | "GBP" | "CAD" | "AUD" | "JPY" | "CHF" | "SEK" | "NOK" | "DKK" | "CZK" | "HUF" | "CNY" | "INR" | "BRL" | "MXN" | "KRW" | "SGD" | "HKD") || "PLN",
        isPublic: teamData.settings.isPublic,
        allowGuestAccess: teamData.settings.allowGuestAccess,
      });
    }
  }, [teamData]);

  if (!teamData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const handleSaveTeamSettings = async () => {
    try {
      await updateTeamSettings({
        teamId: teamData.teamId,
        currency: teamSettings.currency,
        settings: {
          isPublic: teamSettings.isPublic,
          allowGuestAccess: teamSettings.allowGuestAccess,
        },
      });
      toast.success("Settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-background/30">
      <div className="space-y-12 p-8 max-w-6xl mx-auto">
        
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-light tracking-tight">Settings</h1>
          <p className="text-muted-foreground font-light">Manage your organization and billing.</p>
        </div>

        <Tabs defaultValue="organization" className="w-full">
          <TabsList className="bg-transparent p-0 gap-8 border-b border-border/20 w-full justify-start rounded-none h-auto mb-12">
            {["organization", "team", "subscription"].map((tab) => (
              <TabsTrigger 
                key={tab}
                value={tab} 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-foreground rounded-none px-0 py-3 text-muted-foreground/60 data-[state=active]:text-foreground transition-all hover:text-foreground/80 capitalize font-medium"
              >
                {tab === "subscription" ? "Billing & AI" : tab}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="organization" className="space-y-8 animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
            <div className="grid gap-8">
              <div className="space-y-2">
                <h2 className="text-lg font-medium tracking-tight">Organization Profile</h2>
                <p className="text-sm text-muted-foreground font-light max-w-xl">
                  Manage your organization's general information and members.
                </p>
              </div>
              
              <Card className="border-border/20 shadow-none bg-card/30">
                <CardContent className="p-0">
                  <OrganizationProfile 
                    routing="hash"
                    appearance={{
                      elements: {
                        rootBox: "w-full",
                        card: "shadow-none border-none bg-transparent w-full",
                        navbar: "hidden",
                        pageScrollBox: "p-0",
                        headerTitle: "hidden",
                        headerSubtitle: "hidden",
                        viewSectionTitle: "text-base font-medium mb-4",
                        formButtonPrimary: "bg-foreground text-background hover:opacity-90 transition-opacity",
                      }
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="team" className="space-y-12 animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
            <div className="grid gap-12 md:grid-cols-2">
              {/* Left Column: Preferences */}
              <div className="space-y-8">
                <div className="space-y-2">
                  <h2 className="text-lg font-medium tracking-tight">Preferences</h2>
                  <p className="text-sm text-muted-foreground font-light">
                    Team operation settings.
                  </p>
                </div>
                
                <Card className="border-border/20 shadow-none bg-card/30">
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="currency" className="text-sm font-normal text-muted-foreground">Default Currency</Label>
                      <Select 
                        value={teamSettings.currency}
                        onValueChange={(value) => setTeamSettings({ ...teamSettings, currency: value as typeof teamSettings.currency })}
                      >
                        <SelectTrigger className="w-full bg-transparent border-border/20 h-10">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {["USD", "EUR", "PLN", "GBP", "CAD"].map(curr => (
                            <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/20 shadow-none bg-card/30">
                   <CardHeader className="px-6 pt-6 pb-2">
                      <CardTitle className="text-sm font-medium">Visibility</CardTitle>
                    </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal text-muted-foreground">Public Team</Label>
                      <Switch 
                        checked={teamSettings.isPublic}
                        onCheckedChange={(checked) => setTeamSettings({ ...teamSettings, isPublic: checked })}
                      />
                    </div>
                    <div className="h-px bg-border/10" />
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal text-muted-foreground">Guest Access</Label>
                      <Switch 
                        checked={teamSettings.allowGuestAccess}
                        onCheckedChange={(checked) => setTeamSettings({ ...teamSettings, allowGuestAccess: checked })}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/5 border-t border-border/10 p-4">
                    <Button onClick={handleSaveTeamSettings} className="ml-auto bg-foreground text-background hover:opacity-90 h-9 px-6 font-normal">
                      Save
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              {/* Right Column: Roles */}
              <div className="space-y-8">
                <div className="space-y-2">
                  <h2 className="text-lg font-medium tracking-tight">Roles</h2>
                  <p className="text-sm text-muted-foreground font-light">
                    Access levels overview.
                  </p>
                </div>

                <div className="grid gap-3">
                  {[
                    { role: "Admin", desc: "Full access to all settings.", color: "bg-blue-500" },
                    { role: "Member", desc: "Can manage projects and content.", color: "bg-emerald-500" },
                    { role: "Customer", desc: "Limited project access.", color: "bg-orange-500" }
                  ].map((item) => (
                    <div key={item.role} className="flex items-center gap-4 rounded-lg border border-border/10 bg-card/20 p-4">
                      <div className={`h-2 w-2 rounded-full ${item.color} shrink-0`} />
                      <div>
                        <h4 className="text-sm font-medium">{item.role}</h4>
                        <p className="text-xs text-muted-foreground font-light">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="subscription" className="space-y-12 animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
            
            {/* AI Usage */}
            {aiAccess && aiAccess.subscriptionLimits?.hasAIFeatures && (
              <Card className="overflow-hidden border-border/10 shadow-sm bg-card/40">
                <CardContent className="p-0">
                  <div className="grid lg:grid-cols-2 border-border/10">
                    
                    {/* Left: Usage */}
                    <div className="p-8 lg:p-10 space-y-10 lg:border-r border-border/10">
                      {(() => {
                        const totalCredits = aiAccess.totalCredits || 0;
                        const usedCredits = aiAccess.usedCredits || 0;
                        const remainingCredits = aiAccess.remainingCredits || 0;
                        const extraCredits = aiAccess.extraCredits || 0;
                        const baseCredits = totalCredits - extraCredits;
                        const percent = totalCredits ? Math.min(100, (usedCredits / totalCredits) * 100) : 0;

                        return (
                          <>
                            <div>
                              <div className="flex items-center justify-between mb-6">
                                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Wykorzystanie kredytów</span>
                                {aiAccess.hasAccess && <Badge variant="secondary" className="bg-foreground text-background font-normal rounded-full px-3">Aktywne</Badge>}
                              </div>

                              <div className="flex items-baseline gap-2 mb-2">
                                <span className="text-6xl font-extralight tracking-tight">
                                  {usedCredits}
                                </span>
                                <span className="text-lg text-muted-foreground/50 font-light">
                                  / {totalCredits} kredytów
                                </span>
                              </div>

                              <div className="space-y-2 pt-4">
                                <Progress value={percent} className="h-1 bg-muted/20" indicatorClassName="bg-foreground" />
                                <div className="flex justify-between text-xs text-muted-foreground/60 font-light">
                                  <span>Odnawia się {aiAccess.billingWindowStart ? new Date(aiAccess.billingWindowStart).toLocaleDateString() : "N/A"}</span>
                                  <span>{remainingCredits} pozostało</span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-12 pt-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <BarChart3 className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Limit planu</span>
                                </div>
                                <div className="text-2xl font-light">{baseCredits}</div>
                                <div className="text-xs text-muted-foreground/50">Miesięcznie</div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <TrendingUp className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Dodatkowe kredyty</span>
                                </div>
                                <div className="text-2xl font-light text-violet-600 dark:text-violet-400">
                                  +{extraCredits}
                                </div>
                                <div className="text-xs text-muted-foreground/50">Doładowanie</div>
                              </div>
                            </div>

                            <div className="bg-muted/10 rounded-lg p-4 flex items-start gap-3">
                               <AlertCircle className="h-4 w-4 text-muted-foreground/50 mt-0.5" />
                               <div className="space-y-1">
                                  <p className="text-sm font-medium">Koszt generacji</p>
                                  <p className="text-xs text-muted-foreground/70 font-light leading-relaxed">
                                    ~{GEMINI_4K_IMAGE_CREDITS} kredytów za obraz 4K.
                                    Chat zależy od długości konwersacji.
                                  </p>
                               </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Right: Upgrade path */}
                    <div className="p-8 lg:p-10 bg-muted/5 flex flex-col h-full">
                       <div className="flex items-center gap-2 mb-8">
                          <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
                          <span className="text-sm font-medium">Upgrade AI Capacity</span>
                       </div>

                       <div className="space-y-4 flex-1">
                          <div className="rounded-xl border border-amber-200/50 bg-amber-50/40 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="h-4 w-4 text-amber-500" />
                              <p className="text-sm font-medium text-amber-800">AI Scale Plan</p>
                            </div>
                            <p className="text-sm text-amber-800/80">
                              Move to the AI Scale plan for $99/mo and get 5x more AI generations. No manual credit top-ups needed.
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-sm text-muted-foreground/80">
                              <span>AI budget</span>
                              <span>5x vs AI Pro</span>
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground/80">
                              <span>Price</span>
                              <span>$99 / month</span>
                            </div>
                          </div>
                       </div>

                       <div className="mt-8 pt-6">
                          <Button
                            className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-all"
                            disabled={upgradingPlan || !teamData?.teamId}
                            onClick={async () => {
                              if (!teamData?.teamId) return;
                              const priceId = process.env.NEXT_PUBLIC_STRIPE_AI_SCALE_PRICE_ID;
                              if (!priceId) {
                                toast.error("AI Scale price is not configured.");
                                return;
                              }
                              setUpgradingPlan(true);
                              try {
                                const result = await createCheckoutSession({
                                  teamId: teamData.teamId,
                                  priceId,
                                });
                                if (result?.url) {
                                  window.location.href = result.url;
                                } else {
                                  toast.error("Failed to start upgrade");
                                }
                              } catch {
                                toast.error("Failed to start upgrade");
                              } finally {
                                setUpgradingPlan(false);
                              }
                            }}
                          >
                             {upgradingPlan ? (
                               <div className="flex items-center gap-2">
                                 <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                 Processing...
                               </div>
                             ) : (
                               <div className="flex items-center gap-2">
                                 <Sparkles className="h-4 w-4 fill-white/20" />
                                 Upgrade to AI Scale for $99
                               </div>
                             )}
                          </Button>
                          <p className="text-[10px] text-center text-muted-foreground/40 mt-3 uppercase tracking-wider">
                            Secure payment via Stripe
                          </p>
                       </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
            )}
            
            <div className="space-y-6">
              <h2 className="text-xl font-medium tracking-tight">Subscription Plan</h2>
              <SubscriptionCard teamId={teamData.teamId} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
