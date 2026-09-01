"use client";

import Link from "next/link";
import Image from "next/image";
import PageContainer from "@/components/PageContainer";
import DiscordIcon from "@/components/DiscordIcon";
import { useApp } from "@/lib/store";
import { ArrowRight, Zap, Gift, Star } from "lucide-react";

export default function HomePage() {
  const { state, session, sessionLoading, login } = useApp();

  return (
    <PageContainer>
      {/* Hero */}
      <div className="flex flex-col items-center text-center pt-12 pb-16">
        <Image
          src="/logo.jpg"
          alt="GIVEAWAY HUB"
          width={80}
          height={80}
          className="rounded-xl mb-6"
        />
        <h1
          className="text-5xl md:text-7xl font-bold uppercase font-heading leading-none tracking-tight mb-4"
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #888888 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          GIVEAWAY HUB
        </h1>
        <p className="text-[14px] font-medium tracking-[0.12em] text-text-secondary uppercase max-w-md mb-6">
          Complete tasks. Earn points. Redeem exclusive rewards for free.
        </p>

        {/* Current Points Display */}
        <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-bg-card border border-border shadow-sm mb-4">
          <span className="text-[12px] font-medium tracking-[0.14em] text-text-secondary uppercase">
            Your Points:
          </span>
          <span className="text-[15px] font-bold text-accent-green font-heading">
            {state.user.points} PTS
          </span>
        </div>

        {sessionLoading ? (
          <div className="h-[46px] w-[220px] rounded-lg bg-bg-card border border-border animate-pulse" />
        ) : session ? (
          <Link
            href="/earn"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-bg font-bold text-[13px] tracking-[0.1em] uppercase hover:bg-gray-100 transition-colors"
          >
            Continue Earning
            <ArrowRight size={16} />
          </Link>
        ) : (
          <button
            onClick={login}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#5865F2] text-white font-bold text-[13px] tracking-[0.1em] uppercase hover:bg-[#4752C4] transition-colors cursor-pointer"
          >
            <DiscordIcon size={16} />
            Link Discord to Start Earning
          </button>
        )}
      </div>

      {/* How It Works */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-[13px] font-bold tracking-[0.2em] text-text-secondary uppercase text-center mb-10">
          How It Works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl bg-bg-card border border-border">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-bg-elevated mb-4">
              <Zap size={22} className="text-accent-green" />
            </div>
            <h3 className="text-[14px] font-bold text-text-primary mb-2 uppercase tracking-wide">
              Complete Tasks
            </h3>
            <p className="text-[12px] text-text-secondary leading-relaxed">
              Complete quick free tasks such as watching advertisements, answering surveys, and more to earn points through our
              partners.
            </p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl bg-bg-card border border-border">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-bg-elevated mb-4">
              <Star size={22} className="text-rating" />
            </div>
            <h3 className="text-[14px] font-bold text-text-primary mb-2 uppercase tracking-wide">
              Earn Points
            </h3>
            <p className="text-[12px] text-text-secondary leading-relaxed">
              Each completed task rewards you with points. Accumulate points to
              unlock rewards.
            </p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl bg-bg-card border border-border">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-bg-elevated mb-4">
              <Gift size={22} className="text-accent-green" />
            </div>
            <h3 className="text-[14px] font-bold text-text-primary mb-2 uppercase tracking-wide">
              Redeem Rewards
            </h3>
            <p className="text-[12px] text-text-secondary leading-relaxed">
              Redeem your points for robux prizes, exclusive rewards, extra giveaway
              entries, and more.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center mt-16 pb-8">
        <Link
          href="/earn"
          className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-[0.12em] text-accent-green hover:text-accent-green/80 transition-colors uppercase"
        >
          Go to Offers
          <ArrowRight size={14} />
        </Link>
      </div>
    </PageContainer>
  );
}
