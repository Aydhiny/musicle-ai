"use client";
import { useState } from "react";
import {
  Mail,
  MessageSquare,
  Send,
  Loader2,
  MapPin,
  Phone,
  Clock,
  CheckCircle2,
  Twitter,
  Github,
  Linkedin,
  Instagram,
  HelpCircle,
  Bug,
  Lightbulb,
  Users,
} from "lucide-react";
import { BackgroundCircles } from "@/components/ui/shadcn-io/background-circles";
import { GridPattern } from "@/components/ui/shadcn-io/grid-pattern";
import { cn } from "@/lib/utils";

export default function ContactPage() {
  const [step, setStep] = useState<"form" | "success">("form");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string>("general");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const topics = [
    {
      id: "general",
      title: "General Inquiry",
      icon: HelpCircle,
      description: "Questions about Musicle",
    },
    {
      id: "support",
      title: "Technical Support",
      icon: Bug,
      description: "Need help with an issue",
    },
    {
      id: "feature",
      title: "Feature Request",
      icon: Lightbulb,
      description: "Suggest improvements",
    },
    {
      id: "partnership",
      title: "Partnership",
      icon: Users,
      description: "Business opportunities",
    },
  ];

  const contactMethods = [
    {
      icon: Mail,
      title: "Email Us",
      value: "hello@musicle.ai",
      description: "We'll respond within 24 hours",
      link: "mailto:hello@musicle.ai",
    },
    {
      icon: MapPin,
      title: "Visit Us",
      value: "San Francisco, CA",
      description: "123 Music Street, Suite 400",
      link: "#",
    },
    {
      icon: Phone,
      title: "Call Us",
      value: "+1 (555) 123-4567",
      description: "Mon-Fri, 9am-6pm PST",
      link: "tel:+15551234567",
    },
    {
      icon: Clock,
      title: "Support Hours",
      value: "24/7 Available",
      description: "Round-the-clock assistance",
      link: "#",
    },
  ];

  const socialLinks = [
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Github, href: "#", label: "GitHub" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Instagram, href: "#", label: "Instagram" },
  ];

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.message) {
      return;
    }

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setStep("success");
    }, 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey && !isLoading) {
      handleSubmit();
    }
  };

  if (step === "success") {
    return (
      <main className="relative min-h-screen bg-[#171717] text-white overflow-hidden font-sans selection:bg-[#BCAAF9] selection:text-black">
        <GridPattern className={cn("[mask-image:radial-gradient(800px_circle_at_center,white,transparent)]")} strokeDasharray="2 6" />

        <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-0 pointer-events-none w-full h-1/2 overflow-hidden">
          <div className="absolute inset-0 opacity-60 scale-150">
            <BackgroundCircles variant="quaternary" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#171717]" />
        </div>

        <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-0 pointer-events-none w-full h-1/2 overflow-hidden">
          <div className="absolute inset-0 opacity-25 scale-250">
            <BackgroundCircles variant="septenary" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#171717]" />
        </div>

        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-12">
          <div className="max-w-2xl w-full text-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-green-400/20 to-green-600/20 border border-green-500/30 flex items-center justify-center mx-auto mb-8 animate-in zoom-in duration-500">
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-green-400" />
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-b from-[#d9cbff] via-[#d9cbff] to-[#9f92ca] bg-clip-text text-transparent">
                Message Sent!
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-300 mb-8">We&apos;ve received your message and will get back to you soon</p>

            <div className="bg-[#111111] border border-white/10 rounded-xl sm:rounded-2xl p-6 sm:p-8 mb-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Topic</span>
                  <span className="font-medium">{topics.find((t) => t.id === selectedTopic)?.title}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Email</span>
                  <span className="font-medium text-[#BCAAF9]">{formData.email}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-gray-400 text-sm">Expected Response</span>
                  <span className="font-medium">Within 24 hours</span>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-8">Check your email for a confirmation and our team&apos;s response</p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  setStep("form");
                  setFormData({ name: "", email: "", subject: "", message: "" });
                }}
                className="px-8 py-3.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold transition-all"
              >
                Send Another Message
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="px-8 py-3.5 rounded-lg bg-gradient-to-b from-[#BCAAF9] to-[#9f85f6] text-black font-semibold hover:opacity-90 transition-all shadow-lg shadow-[#BCAAF9]/20"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen text-white overflow-hidden font-sans selection:bg-[#BCAAF9] selection:text-black">
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Main Content */}
        <div className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
          <div className="max-w-6xl mx-auto">
            {/* Hero */}
            <div className="text-center mb-12 sm:mb-16">
              <div className="mb-6 inline-flex">
                <div className="relative px-4 sm:px-6 py-2.5 rounded-full border border-amber-400/10 bg-gradient-to-t from-white to-purple-300 backdrop-blur-sm hover:bg-white/10 transition-colors duration-300 cursor-default">
                  <span className="text-xs sm:text-sm font-medium text-black">We&apos;re Here to Help</span>
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
                <div className="flex items-center justify-center mx-auto w-fit">
                  <span className="inline-block bg-gradient-to-b from-[#300134] via-[#d8d8d8] to-[#ffffff] bg-clip-text text-transparent">
                    Get in Touch
                  </span>
                </div>
              </h1>

              <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto">
                Have questions? We&apos;d love to hear from you. Send us a message and we&apos;ll respond as soon as possible.
              </p>
            </div>

            {/* Contact Methods Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
              {contactMethods.map((method) => (
                <a
                  key={method.title}
                  href={method.link}
                  className="bg-[#111111] border border-white/10 rounded-xl p-6 hover:border-[#BCAAF9]/30 hover:bg-white/5 transition-all group"
                >
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-4 group-hover:bg-[#BCAAF9]/10 transition-colors">
                    <method.icon className="w-6 h-6 text-gray-400 group-hover:text-[#BCAAF9] transition-colors" />
                  </div>
                  <h3 className="font-bold mb-1">{method.title}</h3>
                  <p className="text-sm text-[#BCAAF9] mb-2">{method.value}</p>
                  <p className="text-xs text-gray-500">{method.description}</p>
                </a>
              ))}
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Left Column - Form */}
              <div className="lg:col-span-2">
                <div className="relative">
                  <div className="relative bg-[#111111] border border-white/10 rounded-xl sm:rounded-2xl p-6 sm:p-8">
                    <h2 className="text-2xl font-bold mb-6">Send us a Message</h2>

                    {/* Topic Selection */}
                    <div className="mb-6">
                      <label className="text-sm font-medium text-gray-300 block mb-3">What can we help you with?</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {topics.map((topic) => (
                          <button
                            key={topic.id}
                            onClick={() => setSelectedTopic(topic.id)}
                            className={cn(
                              "relative p-4 rounded-lg border transition-all text-left group",
                              selectedTopic === topic.id
                                ? "bg-[#BCAAF9]/10 border-[#BCAAF9]/50"
                                : "bg-white/5 border-white/10 hover:border-white/20",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <topic.icon
                                className={cn(
                                  "w-5 h-5 flex-shrink-0 mt-0.5 transition-colors",
                                  selectedTopic === topic.id ? "text-[#BCAAF9]" : "text-gray-400",
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm mb-0.5">{topic.title}</div>
                                <div className="text-xs text-gray-500">{topic.description}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-5">
                      {/* Name & Email Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-300 block">Your Name *</label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="John Doe"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#BCAAF9]/50 focus:border-[#BCAAF9]/50 transition-all"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-300 block">Email Address *</label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="john@example.com"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#BCAAF9]/50 focus:border-[#BCAAF9]/50 transition-all"
                          />
                        </div>
                      </div>

                      {/* Subject */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 block">Subject</label>
                        <input
                          type="text"
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          placeholder="How can we help?"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#BCAAF9]/50 focus:border-[#BCAAF9]/50 transition-all"
                        />
                      </div>

                      {/* Message */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 block">Message *</label>
                        <textarea
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          onKeyPress={handleKeyPress}
                          placeholder="Tell us more about your inquiry..."
                          rows={6}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#BCAAF9]/50 focus:border-[#BCAAF9]/50 transition-all resize-none"
                        />
                        <p className="text-xs text-gray-600">Ctrl + Enter to send</p>
                      </div>

                      {/* Submit Button */}
                      <button
                        onClick={handleSubmit}
                        disabled={isLoading || !formData.name || !formData.email || !formData.message}
                        className="w-full py-3.5 rounded-lg bg-gradient-to-b from-[#BCAAF9] to-[#9f85f6] text-black font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#BCAAF9]/20 flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <span>Send Message</span>
                            <Send className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Info & Social */}
              <div className="space-y-6">
                {/* Quick Info */}
                <div className="bg-[#111111] border border-white/10 rounded-xl sm:rounded-2xl p-6">
                  <h3 className="font-bold mb-4">Quick Links</h3>
                  <div className="space-y-3">
                    <a href="#" className="flex items-center gap-3 text-sm text-gray-400 hover:text-white transition-colors group">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[#BCAAF9]/10 transition-colors">
                        <HelpCircle className="w-4 h-4" />
                      </div>
                      <span>Help Center</span>
                    </a>
                    <a href="#" className="flex items-center gap-3 text-sm text-gray-400 hover:text-white transition-colors group">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[#BCAAF9]/10 transition-colors">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <span>Community Forum</span>
                    </a>
                    <a href="#" className="flex items-center gap-3 text-sm text-gray-400 hover:text-white transition-colors group">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[#BCAAF9]/10 transition-colors">
                        <Bug className="w-4 h-4" />
                      </div>
                      <span>Report a Bug</span>
                    </a>
                  </div>
                </div>

                {/* Social Links */}
                <div className="bg-[#111111] border border-white/10 rounded-xl sm:rounded-2xl p-6">
                  <h3 className="font-bold mb-4">Follow Us</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {socialLinks.map((social) => (
                      <a
                        key={social.label}
                        href={social.href}
                        className="flex items-center justify-center gap-2 p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-[#BCAAF9]/10 hover:border-[#BCAAF9]/30 transition-all group"
                        aria-label={social.label}
                      >
                        <social.icon className="w-5 h-5 text-gray-400 group-hover:text-[#BCAAF9] transition-colors" />
                        <span className="text-sm font-medium">{social.label}</span>
                      </a>
                    ))}
                  </div>
                </div>

                {/* Response Time */}
                <div className="bg-gradient-to-b from-[#BCAAF9]/10 to-[#9f85f6]/10 border border-[#BCAAF9]/20 rounded-xl sm:rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#BCAAF9]/20 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-[#BCAAF9]" />
                    </div>
                    <div>
                      <div className="font-bold">Fast Response</div>
                      <div className="text-xs text-gray-400">Average: 3 hours</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">Our team typically responds within 24 hours during business days.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative z-10 px-4 py-6 border-t border-white/5 mt-12">
          <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <p>© 2026 Musicle. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-white transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Terms
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Support
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
