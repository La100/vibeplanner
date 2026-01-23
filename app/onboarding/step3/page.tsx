"use client";

import { CreateOrganization } from "@clerk/nextjs";

export default function OnboardingStep3Page() {
    return (
        <div className="relative min-h-screen overflow-hidden bg-[#f5f2ec] text-[#1b1b1b] flex items-center justify-center">
            {/* Background Effects matching previous steps */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),rgba(255,255,255,0.65)_45%,rgba(244,240,232,0.9)_70%)]" />
            <div className="pointer-events-none absolute -left-40 -top-36 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(90,122,83,0.38)_0%,rgba(90,122,83,0.05)_70%,transparent_100%)] blur-2xl animate-[onboard-float_14s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute right-[-120px] top-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(110,90,70,0.22)_0%,rgba(110,90,70,0.04)_70%,transparent_100%)] blur-3xl animate-[onboard-float_18s_ease-in-out_infinite]" />

            <div className="relative z-10 max-w-md w-full px-4">
                <div className="text-center mb-8">
                    <h1 className="font-[var(--font-display)] text-3xl mb-2">Create your Vibe</h1>
                    <p className="text-[#4a4a4a] text-sm">Set up your organization to get started.</p>
                </div>

                <div className="flex justify-center">
                    <CreateOrganization
                        afterCreateOrganizationUrl="/dashboard"
                        appearance={{
                            elements: {
                                card: "shadow-none border border-[#D8D4CC] bg-white/50 backdrop-blur-sm rounded-3xl",
                                headerTitle: "hidden",
                                headerSubtitle: "hidden",
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
