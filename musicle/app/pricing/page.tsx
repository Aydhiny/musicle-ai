"use client";
import { useState } from "react";
import {
  Check,
  Sparkles,
  Zap,
  Crown,
  Music,
  Shield,
  Star,
  ArrowRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PointerHighlight } from "@/components/ui/pointer-highlight";

interface PricingTier {
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: string[];
  highlighted: boolean;
  icon: React.ElementType;
  badge?: string;
  color: string;
  limits: {
    tracks: string;
    storage: string;
    support: string;
  };
}

interface Testimonial {
  name: string;
  role: string;
  company: string;
  content: string;
  rating: number;
  avatar: string;
}

interface Feature {
  name: string;
  free: boolean | string;
  starter: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const pricingTiers: PricingTier[] = [
    {
      name: "Free",
      description: "Perfect for trying out Musicle",
      price: {
        monthly: 0,
        yearly: 0,
      },
      features: ["5 tracks per month", "Basic audio analysis", "Genre detection", "Community support", "Standard processing speed"],
      highlighted: false,
      icon: Music,
      color: "from-gray-500 to-gray-600",
      limits: {
        tracks: "5/month",
        storage: "500 MB",
        support: "Community",
      },
    },
    {
      name: "Starter",
      description: "For serious creators",
      price: {
        monthly: 19,
        yearly: 190,
      },
      features: [
        "50 tracks per month",
        "Advanced audio analysis",
        "Detailed scoring system",
        "Export reports (PDF)",
        "Priority processing",
        "Email support",
        "API access",
      ],
      highlighted: false,
      icon: Zap,
      color: "from-[#BCAAF9] to-purple-500",
      limits: {
        tracks: "50/month",
        storage: "5 GB",
        support: "Email",
      },
    },
    {
      name: "Pro",
      description: "For professionals & studios",
      price: {
        monthly: 49,
        yearly: 490,
      },
      features: [
        "Unlimited tracks",
        "AI-powered recommendations",
        "Commercial potential scoring",
        "Viral prediction analysis",
        "Custom branding",
        "Team collaboration (5 seats)",
        "Priority support",
        "Advanced API access",
        "White-label reports",
      ],
      highlighted: true,
      icon: Crown,
      badge: "Most Popular",
      color: "from-[#BCAAF9] via-purple-500 to-pink-500",
      limits: {
        tracks: "Unlimited",
        storage: "50 GB",
        support: "Priority",
      },
    },
    {
      name: "Enterprise",
      description: "For labels & large teams",
      price: {
        monthly: 0,
        yearly: 0,
      },
      features: [
        "Everything in Pro",
        "Unlimited team seats",
        "Custom integrations",
        "Dedicated account manager",
        "SLA guarantee",
        "Custom AI model training",
        "On-premise deployment option",
        "24/7 phone support",
        "Advanced security features",
      ],
      highlighted: false,
      icon: Shield,
      color: "from-amber-500 to-orange-500",
      limits: {
        tracks: "Unlimited",
        storage: "Unlimited",
        support: "24/7 Dedicated",
      },
    },
  ];

  const testimonials: Testimonial[] = [
    {
      name: "Sarah Martinez",
      role: "Music Producer",
      company: "SoundWave Studios",
      content: "Musicle transformed how we evaluate demos. The AI insights are incredibly accurate and have saved us countless hours.",
      rating: 5,
      avatar: "SM",
    },
    {
      name: "James Chen",
      role: "Audio Engineer",
      company: "Frequency Labs",
      content: "The detailed analysis and scoring system helped us improve our mixes dramatically. Worth every penny!",
      rating: 5,
      avatar: "JC",
    },
    {
      name: "Alex Rivera",
      role: "Independent Artist",
      company: "Self-Released",
      content: "As an indie artist, Musicle's feedback is like having a professional producer in my pocket. Game changer!",
      rating: 5,
      avatar: "AR",
    },
  ];

  const featureComparison: Feature[] = [
    {
      name: "Monthly Track Analysis",
      free: "5 tracks",
      starter: "50 tracks",
      pro: "Unlimited",
      enterprise: "Unlimited",
    },
    {
      name: "Audio Characteristics",
      free: true,
      starter: true,
      pro: true,
      enterprise: true,
    },
    {
      name: "Genre Detection",
      free: true,
      starter: true,
      pro: true,
      enterprise: true,
    },
    {
      name: "Commercial Scoring",
      free: false,
      starter: true,
      pro: true,
      enterprise: true,
    },
    {
      name: "Viral Prediction",
      free: false,
      starter: false,
      pro: true,
      enterprise: true,
    },
    {
      name: "API Access",
      free: false,
      starter: "Basic",
      pro: "Advanced",
      enterprise: "Custom",
    },
    {
      name: "Team Collaboration",
      free: false,
      starter: false,
      pro: "5 seats",
      enterprise: "Unlimited",
    },
    {
      name: "Custom AI Training",
      free: false,
      starter: false,
      pro: false,
      enterprise: true,
    },
    {
      name: "Priority Support",
      free: false,
      starter: false,
      pro: true,
      enterprise: true,
    },
  ];

  const getPrice = (tier: PricingTier) => {
    if (tier.price.monthly === 0) return tier.name === "Enterprise" ? "Custom" : "Free";
    const price = billingCycle === "monthly" ? tier.price.monthly : tier.price.yearly;
    const suffix = billingCycle === "monthly" ? "/mo" : "/yr";
    return `$${price}${suffix}`;
  };

  const getSavings = (tier: PricingTier) => {
    if (billingCycle === "yearly" && tier.price.monthly > 0) {
      const yearlySavings = tier.price.monthly * 12 - tier.price.yearly;
      return `Save $${yearlySavings}`;
    }
    return null;
  };

  return (
    <main className="relative min-h-screen text-white overflow-hidden font-sans selection:bg-[#BCAAF9] selection:text-black">
      {/* Content Wrapper */}
      <div className="relative z-10">
        {/* Hero Section */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 text-center">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#BCAAF9]/20 bg-gradient-to-r from-[#BCAAF9]/10 to-purple-500/10 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-[#BCAAF9]" />
              <span className="text-sm font-medium">Simple, Transparent Pricing</span>
            </div>

            {/* Main Heading */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
                <span className="inline-block bg-gradient-to-b from-[#d9cbff] via-[#d9cbff] to-[#9f92ca] bg-clip-text text-transparent">
                  Choose Your
                </span>
                <br />
                <PointerHighlight containerClassName="inline-block">
                  <span className="bg-gradient-to-b from-[#300134] via-[#d8d8d8] to-[#ffffff] bg-clip-text text-transparent">
                    Perfect Plan
                  </span>
                </PointerHighlight>
              </h1>

              <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto">
                Get instant AI-powered music analysis. No hidden fees, no surprises. Start free, scale as you grow.
              </p>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <span className={cn("text-sm font-medium transition-colors", billingCycle === "monthly" ? "text-white" : "text-gray-500")}>
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
                className="relative w-14 h-7 bg-white/10 rounded-full transition-colors hover:bg-white/20"
                aria-label="Toggle billing cycle"
              >
                <div
                  className={cn(
                    "absolute top-1 w-5 h-5 bg-gradient-to-r from-[#BCAAF9] to-purple-500 rounded-full transition-transform",
                    billingCycle === "yearly" ? "translate-x-8" : "translate-x-1",
                  )}
                />
              </button>
              <span className={cn("text-sm font-medium transition-colors", billingCycle === "yearly" ? "text-white" : "text-gray-500")}>
                Yearly
              </span>
              {billingCycle === "yearly" && (
                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                  Save up to 20%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {pricingTiers.map((tier, idx) => {
              const price = getPrice(tier);
              const isCustomPrice = price === "Custom";

              return (
                <div
                  key={idx}
                  className={cn(
                    "relative rounded-3xl p-8 transition-all duration-300",
                    tier.highlighted
                      ? "bg-gradient-to-br from-[#1a1a1a] via-[#1a1a1a] to-[#2a1a2a] border-2 border-[#BCAAF9]/30 shadow-2xl shadow-[#BCAAF9]/10 lg:scale-105 hover:scale-110"
                      : "bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-white/5 hover:border-white/10 hover:scale-105",
                  )}
                >
                  {tier.badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-[#BCAAF9] via-purple-500 to-[#BCAAF9] rounded-full text-xs font-bold text-black shadow-lg">
                      {tier.badge}
                    </div>
                  )}

                  {/* Header Section */}
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                    <p className="text-sm text-gray-500">{tier.description}</p>
                  </div>

                  {/* Badge Button */}
                  <div className="mb-8">
                    <button className="px-6 py-2 bg-white/10 hover:bg-white/15 rounded-full text-sm font-medium transition-colors border border-white/10">
                      Enterprise
                    </button>
                  </div>

                  {/* Price Display */}
                  <div className="mb-8 flex items-baseline gap-2">
                    {!isCustomPrice ? (
                      <>
                        <span className="text-5xl sm:text-6xl font-bold tracking-tight">
                          ${billingCycle === "monthly" ? tier.price.monthly : tier.price.yearly}
                        </span>
                        <span className="text-gray-500 text-lg">/{billingCycle === "monthly" ? "month" : "year"}</span>
                      </>
                    ) : (
                      <span className="text-5xl sm:text-6xl font-bold tracking-tight">Custom</span>
                    )}
                  </div>

                  {getSavings(tier) && <div className="mb-6 text-sm text-green-400 font-medium">{getSavings(tier)}</div>}

                  {/* CTA Button */}
                  <button
                    className={cn(
                      "w-full py-4 px-6 rounded-2xl font-semibold transition-all duration-300 mb-8",
                      tier.highlighted
                        ? "bg-gradient-to-r from-[#BCAAF9] via-purple-500 to-[#9f85f6] text-black hover:shadow-xl hover:shadow-[#BCAAF9]/30 hover:scale-105"
                        : "bg-white text-black hover:bg-gray-100 hover:scale-105",
                    )}
                  >
                    {tier.name === "Enterprise" ? "Contact Sales" : "Get Started"}
                  </button>

                  {/* Features */}
                  <div className="space-y-4 mb-8">
                    {tier.features.map((feature, featureIdx) => (
                      <div key={featureIdx} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-[#BCAAF9]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-[#BCAAF9]" />
                        </div>
                        <span className="text-sm text-gray-300 leading-relaxed">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Limits */}
                  <div className="pt-6 border-t border-white/5 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Tracks per month</span>
                      <span className="font-semibold">{tier.limits.tracks}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Storage</span>
                      <span className="font-semibold">{tier.limits.storage}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Support</span>
                      <span className="font-semibold">{tier.limits.support}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 sm:p-8 overflow-hidden">
            <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Compare Features</h2>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 font-semibold text-gray-400">Feature</th>
                    <th className="text-center py-4 px-4 font-semibold">Free</th>
                    <th className="text-center py-4 px-4 font-semibold">Starter</th>
                    <th className="text-center py-4 px-4 font-semibold text-[#BCAAF9]">Pro</th>
                    <th className="text-center py-4 px-4 font-semibold">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {featureComparison.map((feature, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4 font-medium">{feature.name}</td>
                      <td className="py-4 px-4 text-center">
                        {typeof feature.free === "boolean" ? (
                          feature.free ? (
                            <Check className="w-5 h-5 text-green-400 mx-auto" />
                          ) : (
                            <span className="text-gray-600">-</span>
                          )
                        ) : (
                          <span className="text-sm">{feature.free}</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {typeof feature.starter === "boolean" ? (
                          feature.starter ? (
                            <Check className="w-5 h-5 text-green-400 mx-auto" />
                          ) : (
                            <span className="text-gray-600">-</span>
                          )
                        ) : (
                          <span className="text-sm">{feature.starter}</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center bg-[#BCAAF9]/5">
                        {typeof feature.pro === "boolean" ? (
                          feature.pro ? (
                            <Check className="w-5 h-5 text-[#BCAAF9] mx-auto" />
                          ) : (
                            <span className="text-gray-600">-</span>
                          )
                        ) : (
                          <span className="text-sm font-medium">{feature.pro}</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {typeof feature.enterprise === "boolean" ? (
                          feature.enterprise ? (
                            <Check className="w-5 h-5 text-green-400 mx-auto" />
                          ) : (
                            <span className="text-gray-600">-</span>
                          )
                        ) : (
                          <span className="text-sm">{feature.enterprise}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Accordion */}
            <div className="lg:hidden space-y-4">
              {featureComparison.map((feature, idx) => (
                <div key={idx} className="bg-white/5 rounded-xl p-4">
                  <div className="font-medium mb-3">{feature.name}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Free</div>
                      <div className="text-sm">
                        {typeof feature.free === "boolean" ? (
                          feature.free ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <span className="text-gray-600">-</span>
                          )
                        ) : (
                          feature.free
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Starter</div>
                      <div className="text-sm">
                        {typeof feature.starter === "boolean" ? (
                          feature.starter ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <span className="text-gray-600">-</span>
                          )
                        ) : (
                          feature.starter
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[#BCAAF9] mb-1">Pro</div>
                      <div className="text-sm font-medium">
                        {typeof feature.pro === "boolean" ? (
                          feature.pro ? (
                            <Check className="w-4 h-4 text-[#BCAAF9]" />
                          ) : (
                            <span className="text-gray-600">-</span>
                          )
                        ) : (
                          feature.pro
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Enterprise</div>
                      <div className="text-sm">
                        {typeof feature.enterprise === "boolean" ? (
                          feature.enterprise ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <span className="text-gray-600">-</span>
                          )
                        ) : (
                          feature.enterprise
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Testimonials */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Loved by Creators</h2>
            <p className="text-gray-400">See what our users have to say</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="bg-[#111] border border-white/10 rounded-2xl p-6 hover:border-[#BCAAF9]/50 transition-all">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <p className="text-gray-300 mb-6 leading-relaxed">{testimonial.content}</p>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#BCAAF9] to-purple-500 flex items-center justify-center font-bold text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{testimonial.name}</div>
                    <div className="text-xs text-gray-500">
                      {testimonial.role} at {testimonial.company}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-8 sm:p-12">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold mb-8 text-center">Frequently Asked Questions</h2>

              <div className="space-y-6">
                <div className="border-b border-white/10 pb-6">
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Info className="w-5 h-5 text-[#BCAAF9]" />
                    Can I change plans later?
                  </h3>
                  <p className="text-gray-400 pl-7">
                    Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately and we&apos;ll prorate any charges.
                  </p>
                </div>

                <div className="border-b border-white/10 pb-6">
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Info className="w-5 h-5 text-[#BCAAF9]" />
                    What payment methods do you accept?
                  </h3>
                  <p className="text-gray-400 pl-7">We accept all major credit cards, PayPal, and wire transfers for Enterprise plans.</p>
                </div>

                <div className="border-b border-white/10 pb-6">
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Info className="w-5 h-5 text-[#BCAAF9]" />
                    Is there a free trial?
                  </h3>
                  <p className="text-gray-400 pl-7">Our Free plan lets you try Musicle with 5 tracks per month. No credit card required!</p>
                </div>

                <div className="pb-6">
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Info className="w-5 h-5 text-[#BCAAF9]" />
                    What happens if I exceed my track limit?
                  </h3>
                  <p className="text-gray-400 pl-7">
                    You&apos;ll be notified when you&apos;re close to your limit. You can either upgrade your plan or wait until the next billing
                    cycle.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="bg-gradient-to-r from-[#BCAAF9] to-purple-500 rounded-3xl p-8 sm:p-12 text-center overflow-hidden relative">
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">Ready to Elevate Your Music?</h2>
              <p className="text-black/80 mb-8 text-lg">Join thousands of creators using Musicle to perfect their sound</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button className="px-8 py-4 bg-black text-white rounded-xl font-semibold hover:bg-black/90 transition-colors flex items-center justify-center gap-2">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button className="px-8 py-4 bg-white/20 text-black rounded-xl font-semibold hover:bg-white/30 transition-colors backdrop-blur-sm">
                  Contact Sales
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
