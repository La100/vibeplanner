"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { OrganizationProfile } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

import { Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CompanySettings() {
  const params = useParams<{ slug: string }>();
  
  // Loading actual data from backend
  const teamData = useQuery(api.teams.getTeamSettings, 
    params.slug ? { teamSlug: params.slug } : "skip"
  );
  
  const updateTeamSettings = useMutation(api.teams.updateTeamSettings);
  
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
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
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
      toast.success("Team settings updated successfully");
    } catch (error) {
      toast.error("Failed to update team settings");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Company Settings</h1>
        <p className="text-muted-foreground">Manage your organization and team settings.</p>
      </div>

      <Tabs defaultValue="organization" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="team">Team Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Management</CardTitle>
              <CardDescription>
                Manage organization details, members, and billing through Clerk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrganizationProfile 
                routing="hash"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none border-none",
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
              <CardDescription>Configure defaults for new projects and team visibility.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Select 
                  value={teamSettings.currency} 
                  onValueChange={(value) => setTeamSettings({ ...teamSettings, currency: value as "USD" | "EUR" | "PLN" | "GBP" | "CAD" | "AUD" | "JPY" | "CHF" | "SEK" | "NOK" | "DKK" | "CZK" | "HUF" | "CNY" | "INR" | "BRL" | "MXN" | "KRW" | "SGD" | "HKD" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="PLN">PLN (zł)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="CAD">CAD (C$)</SelectItem>
                    <SelectItem value="AUD">AUD (A$)</SelectItem>
                    <SelectItem value="JPY">JPY (¥)</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="SEK">SEK</SelectItem>
                    <SelectItem value="NOK">NOK</SelectItem>
                    <SelectItem value="DKK">DKK</SelectItem>
                    <SelectItem value="CZK">CZK</SelectItem>
                    <SelectItem value="HUF">HUF</SelectItem>
                    <SelectItem value="CNY">CNY (¥)</SelectItem>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                    <SelectItem value="MXN">MXN ($)</SelectItem>
                    <SelectItem value="KRW">KRW (₩)</SelectItem>
                    <SelectItem value="SGD">SGD (S$)</SelectItem>
                    <SelectItem value="HKD">HKD (HK$)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">Default currency for new projects</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Visibility</CardTitle>
              <CardDescription>Control who can see and access your team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Public Team</Label>
                  <p className="text-sm text-muted-foreground">Make this team discoverable by others</p>
                </div>
                <Switch 
                  checked={teamSettings.isPublic}
                  onCheckedChange={(checked) => setTeamSettings({ ...teamSettings, isPublic: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Guest Access</Label>
                  <p className="text-sm text-muted-foreground">Allow non-members to view public content</p>
                </div>
                <Switch 
                  checked={teamSettings.allowGuestAccess}
                  onCheckedChange={(checked) => setTeamSettings({ ...teamSettings, allowGuestAccess: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveTeamSettings} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            Save Team Settings
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Role Permissions Overview</CardTitle>
              <CardDescription>Current role permissions in your team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium text-blue-700">Admin</h4>
                  <p className="text-sm text-muted-foreground">Full access to all team settings, projects, and members</p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-medium text-green-700">Member</h4>
                  <p className="text-sm text-muted-foreground">Can create and manage projects, view team content</p>
                </div>
                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-medium text-orange-700">Customer</h4>
                  <p className="text-sm text-muted-foreground">Limited access based on project-specific permissions</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Detailed customer permissions are configured per-project in project settings.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
