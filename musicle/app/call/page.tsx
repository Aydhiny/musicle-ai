"use client";
import { useState } from "react";
import { Calendar, Clock, User, Mail, Phone, MessageSquare, Loader2, CheckCircle2, Video, Briefcase, Building } from "lucide-react";
import { BackgroundCircles } from "@/components/ui/shadcn-io/background-circles";
import { GridPattern } from "@/components/ui/shadcn-io/grid-pattern";
import { cn } from "@/lib/utils";

export default function BookCallPage() {
  const [step, setStep] = useState<"form" | "success">("form");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCallType, setSelectedCallType] = useState<string>("demo");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    role: "",
    message: "",
  });

  const callTypes = [
    {
      id: "demo",
      title: "Product Demo",
      duration: "30 min",
      description: "Get a personalized walkthrough of Musicle's features",
      icon: Video,
    },
    {
      id: "consultation",
      title: "Consultation",
      duration: "45 min",
      description: "Discuss your music production needs and workflow",
      icon: Briefcase,
    },
    {
      id: "enterprise",
      title: "Enterprise",
      duration: "60 min",
      description: "Custom solutions for teams and organizations",
      icon: Building,
    },
  ];

  const availableDates = ["2026-01-22", "2026-01-23", "2026-01-24", "2026-01-27", "2026-01-28"];

  const availableTimes = ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"];

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !selectedDate || !selectedTime) {
      return;
    }

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setStep("success");
    }, 2000);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
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
                You&apos;re All Set!
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-300 mb-8">Your call has been scheduled successfully</p>

            <div className="bg-[#111111] border border-white/10 rounded-xl sm:rounded-2xl p-6 sm:p-8 mb-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Type</span>
                  <span className="font-medium">{callTypes.find((t) => t.id === selectedCallType)?.title}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Date</span>
                  <span className="font-medium">{selectedDate && formatDate(selectedDate)}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Time</span>
                  <span className="font-medium">{selectedTime}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-gray-400 text-sm">Email</span>
                  <span className="font-medium text-[#BCAAF9]">{formData.email}</span>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-8">A calendar invite and meeting link have been sent to your email</p>

            <button
              onClick={() => (window.location.href = "/")}
              className="px-8 py-3.5 rounded-lg bg-gradient-to-b from-[#BCAAF9] to-[#9f85f6] text-black font-semibold hover:opacity-90 transition-all shadow-lg shadow-[#BCAAF9]/20"
            >
              Back to Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-[#171717] text-white overflow-hidden font-sans selection:bg-[#BCAAF9] selection:text-black">
      <GridPattern className={cn("[mask-image:radial-gradient(800px_circle_at_center,white,transparent)]")} strokeDasharray="2 6" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Main Content */}
        <div className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
          <div className="max-w-6xl mx-auto">
            {/* Hero */}
            <div className="text-center mb-12 sm:mb-16">
              <div className="mb-6 inline-flex">
                <div className="relative px-4 sm:px-6 py-2.5 rounded-full border border-amber-400/10 bg-gradient-to-t from-white to-purple-300 backdrop-blur-sm hover:bg-white/10 transition-colors duration-300 cursor-default">
                  <span className="text-xs sm:text-sm font-medium text-black">Schedule a Meeting</span>
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
                <div className="flex items-center justify-center mx-auto w-fit">
                  <span className="inline-block bg-gradient-to-b from-[#300134] via-[#d8d8d8] to-[#ffffff] bg-clip-text text-transparent">
                    Book a Call
                  </span>
                </div>
              </h1>

              <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto">
                Let&apos;s discuss how Musicle can elevate your music production workflow
              </p>
            </div>

            {/* Call Type Selection */}
            <div className="mb-12">
              <h2 className="text-xl sm:text-2xl font-bold mb-6 text-center">Choose Your Meeting Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {callTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedCallType(type.id)}
                    className={cn(
                      "relative p-6 rounded-xl sm:rounded-2xl border transition-all text-left group",
                      selectedCallType === type.id
                        ? "bg-[#BCAAF9]/10 border-[#BCAAF9]/50"
                        : "bg-[#111111] border-white/10 hover:border-white/20",
                    )}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                          selectedCallType === type.id ? "bg-[#BCAAF9]/20" : "bg-white/5",
                        )}
                      >
                        <type.icon
                          className={cn("w-6 h-6 transition-colors", selectedCallType === type.id ? "text-[#BCAAF9]" : "text-gray-400")}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg mb-1">{type.title}</h3>
                        <p className="text-sm text-gray-400">{type.duration}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">{type.description}</p>
                    {selectedCallType === type.id && (
                      <div className="absolute top-4 right-4">
                        <CheckCircle2 className="w-5 h-5 text-[#BCAAF9]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Form Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              {/* Left Column - Date & Time */}
              <div className="space-y-6">
                <div className="relative">
                  <div className="relative bg-[#111111] border border-white/10 rounded-xl sm:rounded-2xl p-6 sm:p-8">
                    <div className="flex items-center gap-2 mb-6">
                      <Calendar className="w-5 h-5 text-[#BCAAF9]" />
                      <h3 className="text-lg font-bold">Select Date</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {availableDates.map((date) => (
                        <button
                          key={date}
                          onClick={() => setSelectedDate(date)}
                          className={cn(
                            "p-4 rounded-lg border transition-all text-center",
                            selectedDate === date
                              ? "bg-[#BCAAF9]/10 border-[#BCAAF9]/50"
                              : "bg-white/5 border-white/10 hover:border-white/20",
                          )}
                        >
                          <div className="text-sm font-medium">{formatDate(date)}</div>
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mt-8 mb-6">
                      <Clock className="w-5 h-5 text-[#BCAAF9]" />
                      <h3 className="text-lg font-bold">Select Time</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {availableTimes.map((time) => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          disabled={!selectedDate}
                          className={cn(
                            "p-3 rounded-lg border transition-all text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed",
                            selectedTime === time
                              ? "bg-[#BCAAF9]/10 border-[#BCAAF9]/50"
                              : "bg-white/5 border-white/10 hover:border-white/20",
                          )}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Contact Info */}
              <div className="relative">
                <div className="relative bg-[#111111] border border-white/10 rounded-xl sm:rounded-2xl p-6 sm:p-8">
                  <h3 className="text-lg font-bold mb-6">Your Information</h3>
                  <div className="space-y-5">
                    {/* Name */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300 block">Full Name *</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-[#BCAAF9] transition-colors pointer-events-none" />
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="John Doe"
                          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#BCAAF9]/50 focus:border-[#BCAAF9]/50 transition-all"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300 block">Email Address *</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-[#BCAAF9] transition-colors pointer-events-none" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="john@example.com"
                          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#BCAAF9]/50 focus:border-[#BCAAF9]/50 transition-all"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300 block">Phone Number</label>
                      <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-[#BCAAF9] transition-colors pointer-events-none" />
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+1 (555) 000-0000"
                          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#BCAAF9]/50 focus:border-[#BCAAF9]/50 transition-all"
                        />
                      </div>
                    </div>

                    {/* Company */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300 block">Company</label>
                      <div className="relative group">
                        <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-[#BCAAF9] transition-colors pointer-events-none" />
                        <input
                          type="text"
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          placeholder="Your Company"
                          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#BCAAF9]/50 focus:border-[#BCAAF9]/50 transition-all"
                        />
                      </div>
                    </div>

                    {/* Message */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300 block">Message</label>
                      <div className="relative group">
                        <MessageSquare className="absolute left-4 top-4 w-5 h-5 text-gray-500 group-focus-within:text-[#BCAAF9] transition-colors pointer-events-none" />
                        <textarea
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          placeholder="Tell us about your needs..."
                          rows={4}
                          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#BCAAF9]/50 focus:border-[#BCAAF9]/50 transition-all resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 text-center">
              <button
                onClick={handleSubmit}
                disabled={isLoading || !formData.name || !formData.email || !selectedDate || !selectedTime}
                className="px-12 py-4 rounded-lg bg-gradient-to-b from-[#BCAAF9] to-[#9f85f6] text-black font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#BCAAF9]/20 inline-flex items-center gap-3"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Scheduling...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Booking</span>
                    <Calendar className="w-5 h-5" />
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 mt-4">Free consultation • No credit card required</p>
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
