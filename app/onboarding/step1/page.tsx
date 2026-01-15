import Link from "next/link";

export default function OnboardingStep1Page() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f2ec] text-[#1b1b1b]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),rgba(255,255,255,0.65)_45%,rgba(244,240,232,0.9)_70%)]" />
      <div className="pointer-events-none absolute -left-40 -top-36 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(90,122,83,0.38)_0%,rgba(90,122,83,0.05)_70%,transparent_100%)] blur-2xl animate-[onboard-float_14s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute right-[-120px] top-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(110,90,70,0.22)_0%,rgba(110,90,70,0.04)_70%,transparent_100%)] blur-3xl animate-[onboard-float_18s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(115deg,rgba(0,0,0,0.06)_0,rgba(0,0,0,0.06)_1px,transparent_1px,transparent_44px)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2a2a2a]">
          Log out
        </div>

        <div className="mt-10 flex flex-1 items-center">
          <div className="grid w-full items-center gap-12 md:grid-cols-[280px,1fr] md:gap-16">
            <div className="relative mx-auto h-[360px] w-[240px] overflow-hidden rounded-[26px] border border-white/70 shadow-[0_22px_65px_rgba(20,20,20,0.18)]">
              <div className="absolute inset-0 bg-[linear-gradient(150deg,rgba(84,115,74,0.95),rgba(60,96,50,0.85)_40%,rgba(27,59,24,0.92))]" />
              <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35)_0,transparent_45%),radial-gradient(circle_at_80%_0%,rgba(255,229,170,0.24)_0,transparent_40%),radial-gradient(circle_at_60%_70%,rgba(255,255,255,0.22)_0,transparent_55%)]" />
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent" />
              <div className="relative flex h-full flex-col justify-between p-4 text-white">
                <span className="text-xs font-semibold tracking-[0.2em]">karolina</span>
                <div className="space-y-2 text-[11px] leading-relaxed text-white/85">
                  <p>and the universe said i love you</p>
                  <p>and the universe said you have played the game well</p>
                </div>
              </div>
            </div>

            <div className="max-w-lg animate-[onboard-fade_900ms_ease-out]">
              <h1 className="font-[var(--font-display)] text-4xl leading-tight md:text-5xl">
                Welcome to
                <br />
                VibePlanner
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-[#4a4a4a]">
                The first AI agent that works alongside you, with state of the art memory and intelligence
              </p>
              <Link
                href="/onboarding/step2"
                className="mt-6 inline-flex items-center gap-3 text-sm font-semibold text-[#1b1b1b] transition hover:translate-x-1"
              >
                Begin
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
