import { Badge } from "@/components/ui/badge";
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { MessageCircle, Sparkles, Store } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AIAssistantCore, type QuickAction } from "@/components/ai/AIAssistantCore";
import { siteDiscoveryMessagesKey } from "@/components/ai/siteDiscoveryPersistence";
import { PromptLaunchPanel } from "@/components/launch/PromptLaunchPanel";
import { GraphicHandoffCard } from "@/components/launch/GraphicHandoffCard";
import { detectGraphicRequest, type GraphicRequest } from "@/services/graphic-design/graphicIntent";
import { MarketplaceCatalog } from '@/marketplace/MarketplaceCatalog';


interface HeroSectionProps {
  user: User | null;
  onAuthRequired: () => void;
  onSiteConfirmed: (siteBrief: string) => void;
  launcherOpen: boolean;
  launchBrief: string | null;
  onLauncherOpenChange: (open: boolean) => void;
  /** Optional overrides used by the Live Demo. */
  badge?: ReactNode;
  headline?: ReactNode;
  subtitle?: ReactNode;
  chatGlow?: boolean;
  demoGeneration?: boolean;
}

const HOME_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "business-site",
    label: "Business website",
    prompt: "Help me create a professional website for my business.",
  },
  {
    id: "booking-site",
    label: "Booking site",
    prompt: "Help me create a website where customers can book my services.",
  },
  {
    id: "online-store",
    label: "Online store",
    prompt: "Help me create an online store to sell my products.",
  },
  {
    id: "restaurant-site",
    label: "Restaurant & reservations",
    prompt: "Help me create a restaurant website with our menu, opening hours and table reservations.",
  },
  {
    id: "portfolio-site",
    label: "Creative portfolio",
    prompt: "Help me create a portfolio website that shows off my best work and brings in new clients.",
  },
  {
    id: "event-site",
    label: "Event or festival",
    prompt: "Help me create a website for my event with the lineup, schedule and ticket sales.",
  },
  {
    id: "wedding-site",
    label: "Wedding website",
    prompt: "Help me create a wedding website with our story, the day's details and an RSVP form.",
  },
  {
    id: "fitness-site",
    label: "Gym or fitness studio",
    prompt: "Help me create a gym website with class schedules, trainer profiles and membership sign-ups.",
  },
  {
    id: "hotel-site",
    label: "Hotel or rental",
    prompt: "Help me create a hotel website with rooms, photos, guest reviews and booking enquiries.",
  },
  {
    id: "music-site",
    label: "Music artist",
    prompt: "Help me create a website for my music with releases, tour dates and fan sign-ups.",
  },
  {
    id: "sports-site",
    label: "Sports club",
    prompt: "Help me create a website for my sports club with fixtures, results, teams and member sign-ups.",
  },
  {
    id: "nonprofit-site",
    label: "Nonprofit & donations",
    prompt: "Help me create a website for my nonprofit that explains our mission and accepts donations.",
  },
  {
    id: "print-design",
    label: "Flyer",
    prompt: "Help me design a flyer for my business.",
  },
  {
    id: "poster-design",
    label: "Event poster",
    prompt: "Help me design a poster for my upcoming event.",
  },
  {
    id: "business-card-design",
    label: "Business card",
    prompt: "Help me design a business card for my company.",
  },
];

/** Print and graphic prompts open Design Studio, which the Live Demo does not include. */
const GRAPHIC_QUICK_ACTION_IDS = new Set(["print-design", "poster-design", "business-card-design"]);

export function HeroSection({ user, onAuthRequired, onSiteConfirmed, launcherOpen, launchBrief, onLauncherOpenChange, badge, headline, subtitle, chatGlow = false, demoGeneration = false }: HeroSectionProps) {
  const [discoveryActive, setDiscoveryActive] = useState(false);
  const [chatResetKey, setChatResetKey] = useState(0);
  const [activeHomeTab, setActiveHomeTab] = useState<'chat' | 'marketplace'>('chat');
  const [graphicRequest, setGraphicRequest] = useState<GraphicRequest | null>(null);

  const handleHomeTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextTab = event.key === 'Home'
      ? 'chat'
      : event.key === 'End'
        ? 'marketplace'
        : activeHomeTab === 'chat' ? 'marketplace' : 'chat';
    setActiveHomeTab(nextTab);
    document.getElementById(`home-${nextTab}-tab`)?.focus();
  };

  return (
    <section className="relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-cyan-500/8 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-fuchsia-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-lime-500/6 rounded-full blur-3xl" />
      </div>

      <div className="relative container mx-auto px-4 pt-16 pb-12 sm:pt-20 sm:pb-16 md:pt-28 md:pb-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Brand lockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="mb-6"
          >
            <div className="relative mx-auto w-64 sm:w-72 md:w-80">
              <img
                src="/unison-logo-lockup.png"
                alt="Unison — Intent-Driven AI App Builder"
                width={532}
                height={480}
                className="h-auto w-full"
              />
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 532 480"
                focusable="false"
              >
                <style>
                  {`@media (prefers-reduced-motion: reduce) { .unison-logo-orb-motion { display: none; } }`}
                </style>
                <defs>
                  <radialGradient id="unison-logo-orb-gradient">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="42%" stopColor="#bffaff" />
                    <stop offset="100%" stopColor="#21baff" />
                  </radialGradient>
                  <filter id="unison-logo-orb-glow" x="-150%" y="-150%" width="400%" height="400%">
                    <feGaussianBlur stdDeviation="6" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <circle
                  className="unison-logo-orb-motion"
                  r="14"
                  fill="url(#unison-logo-orb-gradient)"
                  filter="url(#unison-logo-orb-glow)"
                >
                  <animateMotion
                    dur="7s"
                    repeatCount="indefinite"
                    path="M 163 32 L 163 236 C 163 286 202 313 266 313 C 330 313 369 286 369 236 L 369 32 C 369 -12 163 -12 163 32"
                  />
                </circle>
              </svg>
            </div>
          </motion.div>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <Badge className={cn(
              "mb-5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 text-xs font-medium px-4 py-1.5",
              "shadow-[0_0_20px_rgba(0,255,255,0.15)]"
            )}>
              <Sparkles className="h-3 w-3 mr-1.5" />
              {badge ?? "Affinity · CRM + automation included"}
            </Badge>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-4 leading-snug tracking-normal text-white/60"
          >
            {headline ?? <>Your business,{" "}
            <span className="text-cyan-400/80">live in 60 seconds</span></>}
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-base sm:text-lg text-white/50 mb-8 max-w-2xl mx-auto leading-relaxed"
          >
            {subtitle ?? "Tell Affinity what your business needs. We’ll shape a complete site with booking, CRM, automations, and a live backend — no dev work required."}
          </motion.p>

          <div role="tablist" aria-label="Home workspace" className="mx-auto mb-4 inline-flex items-center gap-1 border border-white/10 bg-black/20 p-1">
            <button
              id="home-chat-tab"
              type="button"
              role="tab"
              aria-selected={activeHomeTab === 'chat'}
              aria-controls="home-chat-panel"
              tabIndex={activeHomeTab === 'chat' ? 0 : -1}
              onKeyDown={handleHomeTabKeyDown}
              onClick={() => setActiveHomeTab('chat')}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 px-4 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300',
                activeHomeTab === 'chat' ? 'bg-cyan-300 text-slate-950' : 'text-white/70 hover:bg-white/10 hover:text-white',
              )}
            >
              <MessageCircle aria-hidden="true" className="h-4 w-4" /> AI Chat
            </button>
            <button
              id="home-marketplace-tab"
              type="button"
              role="tab"
              aria-selected={activeHomeTab === 'marketplace'}
              aria-controls="home-marketplace-panel"
              tabIndex={activeHomeTab === 'marketplace' ? 0 : -1}
              onKeyDown={handleHomeTabKeyDown}
              onClick={() => setActiveHomeTab('marketplace')}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 px-4 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300',
                activeHomeTab === 'marketplace' ? 'bg-cyan-300 text-slate-950' : 'text-white/70 hover:bg-white/10 hover:text-white',
              )}
            >
              <Store aria-hidden="true" className="h-4 w-4" /> Marketplace
            </button>
          </div>

          <div
            id="home-chat-panel"
            role="tabpanel"
            aria-labelledby="home-chat-tab"
            hidden={activeHomeTab !== 'chat'}
          >
          {/* Keep the chat mounted while the visitor browses Marketplace. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="relative mx-auto mb-10 max-w-3xl text-left"
            id="home-ai-chat"
          >
            <div className="pointer-events-none absolute -inset-x-8 inset-y-8 -z-10 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-cyan-100/80">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              <span>What would you like to build?</span>
            </div>
            <div className={chatGlow ? "affinity-home-chat-glow" : undefined}>
            <AIAssistantCore
              key={`${user ? `site-discovery:${user.id}` : "site-discovery:anonymous"}:${chatResetKey}`}
              appearance="unison"
              className={cn("transition-[height] duration-500 motion-reduce:transition-none", launcherOpen || discoveryActive ? "h-[min(740px,85dvh)]" : "h-[480px] sm:h-[330px]")}
              placeholder="Tell Affinity about your idea..."
              quickActions={demoGeneration ? HOME_QUICK_ACTIONS.filter((action) => !GRAPHIC_QUICK_ACTION_IDS.has(action.id)) : HOME_QUICK_ACTIONS}
              aiMode="site-discovery"
              persistenceKey={user ? siteDiscoveryMessagesKey(user.id) : undefined}
              onContinueToWizard={onSiteConfirmed}
              onSiteConfirmed={onSiteConfirmed}
              onDiscoveryStarted={() => setDiscoveryActive(true)}
              selectionActive={launcherOpen}
              conversationContent={launcherOpen && launchBrief ? <PromptLaunchPanel
                brief={launchBrief}
                demoGeneration={demoGeneration}
                onClose={() => onLauncherOpenChange(false)}
                onLaunchComplete={() => setChatResetKey(key => key + 1)}
              /> : graphicRequest ? <GraphicHandoffCard
                request={graphicRequest}
                onDismiss={() => setGraphicRequest(null)}
              /> : undefined}
              onLocalReply={(message) => {
                // Live Demo stays a website-only experience.
                if (demoGeneration) return null;
                const request = detectGraphicRequest(message);
                if (!request) return null;
                setGraphicRequest(request);
                return `That sounds like a ${request.format.label.toLowerCase()}. I'll design it in Design Studio, where you can add your logo or photos and download it ${request.format.print ? 'ready to print' : 'ready to use'}.`;
              }}
              onBeforeSend={() => {
                if (user) return true;
                onAuthRequired();
                return false;
              }}
              systemType="website"
              businessName="Unison site planning"
              showFileUpload={false}
              allowClearHistory
              hideHeader
            />
            </div>
            <p className="mt-2 text-center text-xs text-white/40">
              {launcherOpen || discoveryActive ? "Reply in chat to refine your idea. Create your site when you're ready." : "Describe your idea or pick one of the floating ideas"}
            </p>
          </motion.div>
          </div>

          <div
            id="home-marketplace-panel"
            role="tabpanel"
            aria-labelledby="home-marketplace-tab"
            hidden={activeHomeTab !== 'marketplace'}
            className="mx-auto mb-10 w-full max-w-6xl text-left"
          >
            <MarketplaceCatalog embedded enabled={activeHomeTab === 'marketplace'} />
          </div>

        </div>
      </div>
    </section>
  );
}
