"use client";

import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, AlertCircle, Github, Chrome, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (isSignUp) {
      if (!userName || !email || !password) {
        setError("Please fill in username, email, and password.");
        return;
      }

      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }

      setIsLoading(true);
      try {
        await signUp({
          userName,
          email,
          password,
          bio: bio || undefined,
        });

        router.push("/feed");
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Registration failed.");
      } finally {
        setIsLoading(false);
      }

      return;
    }

    if (!emailOrUsername || !password) {
      setError("Please enter your email/username and password.");
      return;
    }

    setIsLoading(true);
    try {
      await signIn(emailOrUsername, password);
      router.push("/feed");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = () => {
    setError("Social login is not enabled on this backend yet.");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      void handleSubmit();
    }
  };

  return (
    <main className="relative min-h-screen text-white overflow-hidden font-sans selection:bg-[#BCAAF9] selection:text-black">
      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
          <div className="w-full max-w-md">
            <div className="text-center mb-8 sm:mb-12">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-4">
                <div className="flex items-center justify-center mx-auto w-fit">
                  <span className="inline-block bg-gradient-to-b from-[#8c738e] via-[#e2e2e2] to-[#ffffff] bg-clip-text text-transparent">
                    {isSignUp ? "Join Musicle" : "Sign In"}
                  </span>
                </div>
              </h1>

              <p className="text-sm sm:text-base text-gray-400">
                {isSignUp ? "Create a real account and start analyzing tracks" : "Sign in with your Musicle credentials"}
              </p>
            </div>

            <div className="relative bg-[#111111] border border-white/10 rounded-xl sm:rounded-2xl p-6 sm:p-8">
              <div className="space-y-3 mb-6">
                <button
                  onClick={handleSocialLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <Chrome className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                  <span className="text-sm font-medium">Continue with Google</span>
                </button>

                <button
                  onClick={handleSocialLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <Github className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                  <span className="text-sm font-medium">Continue with GitHub</span>
                </button>
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 bg-[#111111] text-gray-500 uppercase tracking-wider">Or continue with email</span>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="space-y-5">
                {isSignUp && (
                  <div className="space-y-2">
                    <label htmlFor="userName" className="text-sm font-medium text-gray-300 block">
                      Username
                    </label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                      <input
                        id="userName"
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="producer_name"
                        disabled={isLoading}
                        className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#BCAAF9]/50 focus:border-[#BCAAF9]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-300 block">
                    {isSignUp ? "Email Address" : "Email or Username"}
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                    <input
                      id="email"
                      type={isSignUp ? "email" : "text"}
                      value={isSignUp ? email : emailOrUsername}
                      onChange={(e) => (isSignUp ? setEmail(e.target.value) : setEmailOrUsername(e.target.value))}
                      onKeyDown={handleKeyPress}
                      placeholder={isSignUp ? "you@example.com" : "you@example.com or username"}
                      disabled={isLoading}
                      className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#BCAAF9]/50 focus:border-[#BCAAF9]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-gray-300 block">
                    Password
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="••••••••"
                      disabled={isLoading}
                      className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#BCAAF9]/50 focus:border-[#BCAAF9]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors disabled:opacity-50"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {isSignUp && (
                  <div className="space-y-2">
                    <label htmlFor="bio" className="text-sm font-medium text-gray-300 block">
                      Bio (optional)
                    </label>
                    <textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell the community what you produce"
                      maxLength={500}
                      disabled={isLoading}
                      className="w-full min-h-20 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#BCAAF9]/50 focus:border-[#BCAAF9]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                    />
                  </div>
                )}

                <button
                  onClick={() => void handleSubmit()}
                  disabled={isLoading}
                  className="w-full mt-6 py-3.5 rounded-lg bg-gradient-to-b from-[#BCAAF9] to-[#9f85f6] text-black font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group relative overflow-hidden shadow-lg shadow-[#BCAAF9]/20"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>{isSignUp ? "Create Account" : "Sign In"}</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-400">
                  {isSignUp ? "Already have an account?" : "Don&apos;t have an account?"}{" "}
                  <button
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError(null);
                    }}
                    disabled={isLoading}
                    className="text-[#BCAAF9] hover:text-[#d9cbff] font-medium transition-colors disabled:opacity-50"
                  >
                    {isSignUp ? "Sign in" : "Sign up"}
                  </button>
                </p>
              </div>
            </div>

            <div className="mt-8 text-center space-y-2">
              <p className="text-xs text-gray-600">Protected by industry-standard encryption</p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-700">
                <span>256-bit SSL</span>
                <span>•</span>
                <span>JWT Auth</span>
                <span>•</span>
                <span>Secure Sessions</span>
              </div>
            </div>
          </div>
        </div>

        <footer className="relative z-10 px-4 py-6 border-t border-white/5">
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