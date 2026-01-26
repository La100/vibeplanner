"use client";

import { useClerk, useSignIn, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OnboardingStep2Page() {
    const { isLoaded: isSignInLoaded } = useSignIn();
    const { signOut } = useClerk();
    const { user, isLoaded: isUserLoaded } = useUser();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConnectCalendar = async () => {
        if (!isSignInLoaded || !isUserLoaded || !user) return;
        setIsLoading(true);
        setError(null);
        try {
            console.log("Reloading user data...");
            await user.reload();

            console.log("Checking for existing Google account...");
            const googleAccount = user.externalAccounts.find(
                (account) => account.provider === "google" || account.verification?.strategy === "oauth_google"
            );

            if (googleAccount) {
                console.log("Found Google account:", googleAccount.id);
                // Check if scope is already granted
                const scopes = googleAccount.approvedScopes || "";
                const hasCalendarScope = scopes.includes("calendar.events") || scopes.includes("https://www.googleapis.com/auth/calendar.events");

                if (hasCalendarScope) {
                    console.log("Scope already granted! Redirecting...");
                    router.push("/onboarding/step3");
                    return;
                }

                console.log("Attempting to add scope via reauthorize...");
                // Safer approach: use reauthorize to add scopes to existing connection
                const res = await googleAccount.reauthorize({
                    additionalScopes: ["https://www.googleapis.com/auth/calendar.events"],
                    redirectUrl: "/onboarding/step3",
                });

                if (res.verification?.status === 'verified') {
                    router.push("/onboarding/step3");
                }
            } else {
                console.log("No Google account found, creating external account...");
                // If not connected, we connect it
                await user.createExternalAccount({
                    strategy: "oauth_google",
                    redirectUrl: "/onboarding/step3",
                    additionalScopes: ["https://www.googleapis.com/auth/calendar.events"],
                });
            }
        } catch (err: unknown) {
            console.error("Error connecting calendar:", err);
            const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
            setError(message);
            setIsLoading(false);
        }
    };

    const handleSkip = () => {
        router.push("/onboarding/step3");
    };

    if (!isSignInLoaded || !isUserLoaded) {
        return null; // Or a loading spinner
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#f5f2ec] text-[#1b1b1b]">
            {/* Background Effects matching Step 1 */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),rgba(255,255,255,0.65)_45%,rgba(244,240,232,0.9)_70%)]" />
            <div className="pointer-events-none absolute -left-40 -top-36 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(90,122,83,0.38)_0%,rgba(90,122,83,0.05)_70%,transparent_100%)] blur-2xl animate-[onboard-float_14s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute right-[-120px] top-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(110,90,70,0.22)_0%,rgba(110,90,70,0.04)_70%,transparent_100%)] blur-3xl animate-[onboard-float_18s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(115deg,rgba(0,0,0,0.06)_0,rgba(0,0,0,0.06)_1px,transparent_1px,transparent_44px)]" />

            <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
                <div className="flex justify-between items-center">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2a2a2a]">
                        Step 2 of 2
                    </div>
                </div>

                <div className="mt-10 flex flex-1 items-center justify-center">
                    <div className="max-w-xl w-full text-center animate-[onboard-fade_900ms_ease-out]">
                        <h1 className="font-[var(--font-display)] text-4xl leading-tight md:text-5xl mb-6">
                            Connect your Calendar
                        </h1>
                        <p className="text-lg leading-relaxed text-[#4a4a4a] mb-6 max-w-lg mx-auto">
                            To help you manage your architectural projects efficiently, VibePlanner connects with your Google Calendar to sync deadlines and tasks.
                        </p>

                        {error && (
                            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm max-w-md mx-auto">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col items-center gap-4">
                            <button
                                onClick={handleConnectCalendar}
                                disabled={isLoading}
                                className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-[#1b1b1b] px-8 py-4 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100"
                            >
                                {isLoading ? (
                                    <span>Connecting...</span>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
                                        </svg>
                                        <span>Connect Google Calendar</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <p className="mt-8 text-xs text-[#888] max-w-sm mx-auto">
                            You will be asked to grant access to your Google Calendar. This permission is required for full functionality.
                        </p>
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={() => signOut(() => router.push("/"))}
                                className="text-xs text-red-500 hover:underline"
                            >
                                Sign out and try again
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
