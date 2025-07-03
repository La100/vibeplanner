"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { Settings, Users, Shield, Bell, Globe, Save, Trash2, Edit, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export default function CompanySettings() {
  const params = useParams<{ slug: string }>();
  const { organization, isLoaded } = useOrganization();
  
  // Check if team exists first
  const team = useQuery(api.myFunctions.getTeamBySlug, 
    params.slug ? { slug: params.slug } : "skip"
  );

  const [companySettings, setCompanySettings] = useState({
    name: organization?.name || "",
    description: "",
    website: "",
    industry: "architecture",
    size: "small",
    timezone: "Europe/Warsaw",
    currency: "USD",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    projectUpdates: true,
    taskDeadlines: true,
    teamInvitations: true,
    weeklyReports: false,
    monthlyReports: true,
    taskAssignments: true,
    projectComments: false,
  });

  const [privacySettings, setPrivacySettings] = useState({
    publicProfile: false,
    allowDiscovery: false,
    shareAnalytics: true,
  });

  if (!isLoaded || !organization) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const handleSaveCompanySettings = () => {
    // TODO: Implement save functionality with Convex
    console.log("Saving company settings:", companySettings);
  };

  const handleSaveNotificationSettings = () => {
    // TODO: Implement save functionality
    console.log("Saving notification settings:", notificationSettings);
  };

  const handleSavePrivacySettings = () => {
    // TODO: Implement save functionality
    console.log("Saving privacy settings:", privacySettings);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex flex-col gap-4 p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Company Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your organization settings and preferences
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="danger">Danger Zone</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>
                    Update your company details and basic information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={companySettings.name}
                        onChange={(e) => setCompanySettings({ ...companySettings, name: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        type="url"
                        placeholder="https://example.com"
                        value={companySettings.website}
                        onChange={(e) => setCompanySettings({ ...companySettings, website: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="industry">Industry</Label>
                      <Select 
                        value={companySettings.industry} 
                        onValueChange={(value) => setCompanySettings({ ...companySettings, industry: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="architecture">Architecture</SelectItem>
                          <SelectItem value="construction">Construction</SelectItem>
                          <SelectItem value="engineering">Engineering</SelectItem>
                          <SelectItem value="technology">Technology</SelectItem>
                          <SelectItem value="finance">Finance</SelectItem>
                          <SelectItem value="healthcare">Healthcare</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="retail">Retail</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="companySize">Company Size</Label>
                      <Select 
                        value={companySettings.size} 
                        onValueChange={(value) => setCompanySettings({ ...companySettings, size: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">1-10 employees</SelectItem>
                          <SelectItem value="medium">11-50 employees</SelectItem>
                          <SelectItem value="large">51-200 employees</SelectItem>
                          <SelectItem value="enterprise">200+ employees</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Tell us about your company..."
                      value={companySettings.description}
                      onChange={(e) => setCompanySettings({ ...companySettings, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select 
                        value={companySettings.timezone} 
                        onValueChange={(value) => setCompanySettings({ ...companySettings, timezone: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="Europe/Warsaw">Warsaw (CET)</SelectItem>
                          <SelectItem value="Europe/London">London (GMT)</SelectItem>
                          <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                          <SelectItem value="America/New_York">Eastern Time</SelectItem>
                          <SelectItem value="America/Chicago">Central Time</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select 
                        value={companySettings.currency} 
                        onValueChange={(value) => setCompanySettings({ ...companySettings, currency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="PLN">PLN (zł)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="CAD">CAD (C$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button onClick={handleSaveCompanySettings}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Notifications</CardTitle>
                  <CardDescription>
                    Configure when you want to receive email notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Email Notifications</div>
                        <div className="text-sm text-muted-foreground">Receive email notifications for important updates</div>
                      </div>
                      <Switch
                        checked={notificationSettings.emailNotifications}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, emailNotifications: checked })}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Project Updates</div>
                        <div className="text-sm text-muted-foreground">Get notified when projects are updated</div>
                      </div>
                      <Switch
                        checked={notificationSettings.projectUpdates}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, projectUpdates: checked })}
                        disabled={!notificationSettings.emailNotifications}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Task Deadlines</div>
                        <div className="text-sm text-muted-foreground">Alerts for upcoming task deadlines</div>
                      </div>
                      <Switch
                        checked={notificationSettings.taskDeadlines}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, taskDeadlines: checked })}
                        disabled={!notificationSettings.emailNotifications}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Task Assignments</div>
                        <div className="text-sm text-muted-foreground">When tasks are assigned to you</div>
                      </div>
                      <Switch
                        checked={notificationSettings.taskAssignments}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, taskAssignments: checked })}
                        disabled={!notificationSettings.emailNotifications}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Team Invitations</div>
                        <div className="text-sm text-muted-foreground">When someone joins or leaves the team</div>
                      </div>
                      <Switch
                        checked={notificationSettings.teamInvitations}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, teamInvitations: checked })}
                        disabled={!notificationSettings.emailNotifications}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Project Comments</div>
                        <div className="text-sm text-muted-foreground">When someone comments on projects</div>
                      </div>
                      <Switch
                        checked={notificationSettings.projectComments}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, projectComments: checked })}
                        disabled={!notificationSettings.emailNotifications}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Weekly Reports</div>
                        <div className="text-sm text-muted-foreground">Weekly summary of project progress</div>
                      </div>
                      <Switch
                        checked={notificationSettings.weeklyReports}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, weeklyReports: checked })}
                        disabled={!notificationSettings.emailNotifications}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Monthly Reports</div>
                        <div className="text-sm text-muted-foreground">Monthly analytics and insights</div>
                      </div>
                      <Switch
                        checked={notificationSettings.monthlyReports}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, monthlyReports: checked })}
                        disabled={!notificationSettings.emailNotifications}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button onClick={handleSaveNotificationSettings}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Preferences
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="privacy" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Privacy Settings</CardTitle>
                  <CardDescription>
                    Control your company's privacy and visibility settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Public Profile</div>
                        <div className="text-sm text-muted-foreground">Make your company profile visible to everyone</div>
                      </div>
                      <Switch
                        checked={privacySettings.publicProfile}
                        onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, publicProfile: checked })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Allow Discovery</div>
                        <div className="text-sm text-muted-foreground">Let others find your company in search results</div>
                      </div>
                      <Switch
                        checked={privacySettings.allowDiscovery}
                        onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, allowDiscovery: checked })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Share Analytics</div>
                        <div className="text-sm text-muted-foreground">Help improve our service by sharing anonymous usage data</div>
                      </div>
                      <Switch
                        checked={privacySettings.shareAnalytics}
                        onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, shareAnalytics: checked })}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button onClick={handleSavePrivacySettings}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="billing" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Billing & Subscription</CardTitle>
                  <CardDescription>
                    Manage your subscription and billing information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <CreditCard className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Billing integration coming soon</h3>
                    <p className="text-muted-foreground mb-4">
                      Subscription management will be available in the next update.
                    </p>
                    <Button variant="outline" disabled>
                      <Settings className="mr-2 h-4 w-4" />
                      Configure Billing
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="danger" className="mt-6">
            <div className="space-y-6">
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                  <CardDescription>
                    Irreversible and destructive actions for your organization
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border border-destructive/50 rounded-lg">
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium">Delete Organization</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          This will permanently delete your organization, all projects, tasks, and data. This action cannot be undone.
                        </p>
                        <Button variant="destructive" className="mt-3">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Organization
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 border border-destructive/50 rounded-lg">
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium">Transfer Ownership</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Transfer ownership of this organization to another team member. You will lose admin access.
                        </p>
                        <Button variant="outline" className="mt-3">
                          <Users className="mr-2 h-4 w-4" />
                          Transfer Ownership
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
