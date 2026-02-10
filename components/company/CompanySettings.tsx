"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import { toast } from "sonner";
import {
  Settings,
  Clock3,
  Check,
  ChevronsUpDown,
  User,
  Mail
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  const { user, isLoaded: isUserLoaded } = useUser();
  const teamData = useQuery(apiAny.teams.getMyTeamSettings);
  const userProfile = useQuery(apiAny.users.getMyOnboardingProfile);
  const updateTeamTimezone = useMutation(apiAny.teams.updateTeamTimezone);
  const saveProfile = useMutation(apiAny.users.saveMyOnboardingProfile);

  const [preferredName, setPreferredName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const timezoneAutoSetRef = useRef(false);

  useEffect(() => {
    if (userProfile && userProfile.preferredName) {
      setPreferredName(userProfile.preferredName);
    } else if (user?.firstName) {
      setPreferredName(user.firstName);
    }
  }, [userProfile, user]);

  useEffect(() => {
    if (!teamData?.teamId || teamData.timezone || timezoneAutoSetRef.current) return;
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTimezone) return;
    timezoneAutoSetRef.current = true;
    updateTeamTimezone({ teamId: teamData.teamId, timezone: browserTimezone }).catch(console.error);
  }, [teamData?.teamId, teamData?.timezone, updateTeamTimezone]);

  const handleUpdateName = async () => {
    setIsUpdatingName(true);
    try {
      await saveProfile({
        preferredName: preferredName,
      });
      toast.success("Preferred name updated");
    } catch (error) {
      console.error("Failed to update name:", error);
      toast.error("Failed to update name");
    } finally {
      setIsUpdatingName(false);
    }
  };

  if (!teamData || !isUserLoaded || userProfile === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading settings...</p>
      </div>
    );
  }

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
              <p className="text-sm text-muted-foreground">Manage your personal preferences and team configuration.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium">Personalization</h2>
            <p className="text-sm text-muted-foreground">
              Manage your personal profile settings.
            </p>
          </div>

          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="preferredName">Preferred Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="preferredName"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    placeholder="Enter your name"
                  />
                  <Button
                    onClick={handleUpdateName}
                    disabled={isUpdatingName}
                    size="sm"
                  >
                    {isUpdatingName ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={user?.primaryEmailAddress?.emailAddress || ""}
                      readOnly
                      disabled
                      className="pl-9 bg-muted/50"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Email address is managed by your account provider.</p>
              </div>
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
