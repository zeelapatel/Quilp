import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart2, CheckCircle, CheckCircle2, ChevronLeft, Linkedin, Loader2, Mail, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ConnectButton } from "../../components/gmail/ConnectButton";
import { useSettings, useUpdateSettings, type ApprovalMode } from "../../hooks/useSettings";
import { useConnectLinkedIn, useSocialConnections } from "../../hooks/useSocialConnections";
import { useCalibrate } from "../../hooks/useVoiceProfile";
import { ApiError, get } from "../../lib/api";

const ONBOARDING_STEP_KEY = "quilp:onboarding:step";
const ONBOARDING_COMPLETE_KEY = "quilp:onboarding:complete";
const TOTAL_STEPS = 8;

type EmailConnection = {
  id: string;
  provider: "gmail";
  account_email: string | null;
  account_name: string | null;
  is_active: boolean;
};

function LinkedInMark({ connected }: { connected: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill={connected ? "#44FF88" : "#0077B5"}
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.024-3.037-1.849-3.037-1.849 0-2.132 1.445-2.132 2.939v5.667H9.358V9h3.414v1.561h.05c.476-.9 1.636-1.849 3.366-1.849 3.596 0 4.259 2.368 4.259 5.455v6.285ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.114 20.452H3.558V9h3.556v11.452Z"
      />
    </svg>
  );
}

export function OnboardingPage() {
  const [params] = useSearchParams();
  const connected = params.get("connected");
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(() => {
    const saved = window.localStorage.getItem(ONBOARDING_STEP_KEY);
    const parsed = saved ? Number(saved) : 1;
    return Number.isFinite(parsed) ? Math.max(1, Math.min(TOTAL_STEPS, parsed)) : 1;
  });

  const emailConnections = useQuery({
    queryKey: ["email-connections"],
    queryFn: () => get<EmailConnection[]>("/api/v1/email-connections"),
  });
  const { connections: socialConnections } = useSocialConnections();
  const { settings } = useSettings();
  const { update, isUpdating } = useUpdateSettings();
  const { connect, isConnecting } = useConnectLinkedIn();

  const [approvalMode, setApprovalMode] = useState<ApprovalMode>("require_approval");
  const [maxPostsPerDay, setMaxPostsPerDay] = useState(2);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [blackoutStart, setBlackoutStart] = useState("22:00");
  const [blackoutEnd, setBlackoutEnd] = useState("07:00");
  const [stepError, setStepError] = useState<string | null>(null);

  const [posts, setPosts] = useState<string[]>(["", "", ""]);
  const [showVoiceContinue, setShowVoiceContinue] = useState(false);
  const [successPersona, setSuccessPersona] = useState<string | null>(null);
  const [successVersion, setSuccessVersion] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { calibrate, isCalibrating } = useCalibrate();

  const validCount = useMemo(
    () => posts.filter(post => post.trim().length >= 50 && post.trim().length <= 5000).length,
    [posts]
  );
  const isValid = validCount >= 3;

  const linkedInConnection = socialConnections.find(
    connection => connection.platform.toLowerCase().includes("linkedin") && connection.is_active
  );
  const gmailConnection = (emailConnections.data ?? []).find(connection => connection.is_active);
  const linkedInConnected = Boolean(linkedInConnection);

  useEffect(() => {
    if (!successPersona) {
      return;
    }
    const timer = window.setTimeout(() => setShowVoiceContinue(true), 2000);
    return () => window.clearTimeout(timer);
  }, [successPersona]);

  useEffect(() => {
    if (!settings) {
      return;
    }
    setApprovalMode(settings.approvalMode);
    setMaxPostsPerDay(settings.maxPostsPerDay ?? 2);
    const hasQuietHours = Boolean(settings.blackoutStart && settings.blackoutEnd);
    setQuietHoursEnabled(hasQuietHours);
    setBlackoutStart(settings.blackoutStart ?? "22:00");
    setBlackoutEnd(settings.blackoutEnd ?? "07:00");
  }, [settings]);

  useEffect(() => {
    if (connected === "gmail" && step <= 1) {
      setStep(2);
    }
    if (connected === "linkedin" && step <= 3) {
      setStep(4);
    }
  }, [connected, step]);

  useEffect(() => {
    if (step !== 1 || !gmailConnection) {
      return;
    }
    setStep(2);
  }, [gmailConnection, step]);

  useEffect(() => {
    window.localStorage.setItem(ONBOARDING_STEP_KEY, String(step));
  }, [step]);

  const goToStep = (nextStep: number) => setStep(Math.max(1, Math.min(7, nextStep)));
  const goNext = () => goToStep(step + 1);
  const goBack = () => goToStep(step - 1);

  const updatePost = (index: number, value: string) => {
    setPosts(current => current.map((item, idx) => (idx === index ? value : item)));
  };

  const addPost = () => {
    setPosts(current => (current.length < 10 ? [...current, ""] : current));
  };

  const handleCalibrate = async () => {
    setFormError(null);
    try {
      const response = await calibrate({ posts: posts.map(post => post.trim()).filter(Boolean), profileType: "personal" });
      setSuccessPersona(response.data?.patterns?.writingPersona ?? "Custom writing style");
      setSuccessVersion(response.data.version);
    } catch (error) {
      if (error instanceof ApiError && error.status === 402) {
        setFormError("Monthly AI limit reached. You can calibrate next month.");
        return;
      }
      setFormError((error as Error).message);
    }
  };

  const saveAndContinue = async (payload: Record<string, unknown>) => {
    setStepError(null);
    try {
      await update(payload);
      goNext();
    } catch (error) {
      setStepError((error as Error).message);
    }
  };

  const completeOnboarding = () => {
    window.localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    window.localStorage.removeItem(ONBOARDING_STEP_KEY);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-bg-primary p-6">
      <div className="mx-auto w-full max-w-[520px]">
        <div className="h-1 w-full rounded bg-[#1A1A1A]">
          <div
            className="h-1 rounded bg-accent transition-all duration-300 ease-out"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary"
              onClick={goBack}
            >
              <ChevronLeft size={14} />
              Back
            </button>
          ) : (
            <span />
          )}
          <p className="font-mono text-[11px] text-text-tertiary">
            Step {step} of {TOTAL_STEPS}
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-bg-secondary p-8">
          {step === 1 ? (
            <>
              <h1 className="font-mono text-2xl">Connect your inbox</h1>
              <p className="mt-2 text-sm text-text-secondary">
                Quilp reads your meeting summaries and tool exports. Nothing else.
              </p>
              <div className="mt-6">
                <ConnectButton />
              </div>
            </>
          ) : null}

          {step === 2 ? (
            successPersona ? (
              <div className="text-center">
                <Sparkles className="mx-auto text-accent" size={24} />
                <h1 className="mt-3 font-mono text-xl">Your voice is calibrated</h1>
                <p className="mt-2 text-sm italic text-text-secondary">{successPersona}</p>
                {successVersion !== null ? (
                  <span className="mt-3 inline-flex rounded border border-border px-2 py-0.5 font-mono text-[11px] text-text-tertiary">
                    v{successVersion}
                  </span>
                ) : null}
                {showVoiceContinue ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="mt-4 inline-flex rounded border border-accent px-4 py-2 text-sm text-accent hover:bg-accent hover:text-black"
                  >
                    Continue →
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <div className="text-center">
                  <CheckCircle2 className="mx-auto text-success" size={24} />
                  <h1 className="mt-3 font-mono text-xl">Train your writing style</h1>
                  <p className="mt-2 text-sm text-text-secondary">
                    Paste 3 LinkedIn posts you&apos;ve written. Quilp will learn your voice and write like you.
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  {posts.map((post, index) => {
                    const chars = post.trim().length;
                    const tooShort = chars > 0 && chars < 50;
                    const tooLong = chars > 5000;
                    return (
                      <div key={index}>
                        <label className="text-xs text-text-secondary">Post {index + 1}</label>
                        <textarea
                          value={post}
                          onChange={event => updatePost(index, event.target.value)}
                          className="mt-1 h-[120px] w-full resize-y rounded border border-border bg-bg-secondary p-3 text-sm leading-relaxed focus:border-border-hover focus:outline-none"
                          placeholder="Paste a LinkedIn post you've written..."
                        />
                        <p className={`mt-1 font-mono text-[11px] ${tooShort || tooLong ? "text-danger" : "text-text-tertiary"}`}>
                          {chars} characters
                          {tooShort ? " · Too short (min 50)" : ""}
                          {tooLong ? " · Too long (max 5,000)" : ""}
                        </p>
                      </div>
                    );
                  })}
                  {posts.length < 10 ? (
                    <button type="button" className="text-xs text-text-secondary hover:text-text-primary" onClick={addPost}>
                      + Add another post
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={!isValid || isCalibrating}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded border border-accent text-sm text-accent disabled:cursor-not-allowed disabled:opacity-40 hover:bg-accent hover:text-black disabled:hover:bg-transparent disabled:hover:text-accent"
                    onClick={() => void handleCalibrate()}
                  >
                    {isCalibrating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Analyzing your writing style...
                      </>
                    ) : (
                      "Calibrate my voice →"
                    )}
                  </button>
                  <button type="button" className="w-full text-xs text-text-tertiary hover:text-text-secondary" onClick={goNext}>
                    Skip for now
                  </button>
                  {formError ? <p className="text-sm text-danger">{formError}</p> : null}
                </div>
              </>
            )
          ) : null}

          {step === 3 ? (
            <div>
              <h1 className="font-mono text-[20px]">Connect LinkedIn</h1>
              <p className="mt-2 text-sm text-text-secondary">
                Quilp will post on your behalf once you approve each post.
              </p>
              {!linkedInConnected ? (
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={isConnecting}
                  className="mt-6 flex h-12 w-full items-center justify-between rounded border border-border px-4 text-sm transition-colors hover:border-border-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="inline-flex items-center gap-3">
                    <LinkedInMark connected={false} />
                    Connect LinkedIn
                  </span>
                  {isConnecting ? <Loader2 size={16} className="animate-spin text-accent" /> : <ArrowRight size={16} className="text-accent" />}
                </button>
              ) : (
                <div className="mt-6 rounded border border-success bg-bg-primary p-4">
                  <p className="inline-flex items-center gap-2 font-mono text-sm text-success">
                    <CheckCircle2 size={15} />
                    LinkedIn connected
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {linkedInConnection?.account_name ?? "LinkedIn account"}
                    {linkedInConnection?.account_email ? ` · ${linkedInConnection.account_email}` : ""}
                  </p>
                  <button
                    type="button"
                    className="mt-3 rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent hover:text-black"
                    onClick={goNext}
                  >
                    Continue →
                  </button>
                </div>
              )}
              {!linkedInConnected ? (
                <button type="button" className="mt-4 text-xs text-text-tertiary hover:text-text-secondary" onClick={goNext}>
                  Skip for now — connect later in settings
                </button>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <h1 className="font-mono text-[20px]">How should Quilp post?</h1>
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => setApprovalMode("require_approval")}
                  className={`w-full rounded border p-4 text-left ${approvalMode === "require_approval" ? "border-accent" : "border-border"}`}
                >
                  <p className="font-mono text-[13px]">Require approval</p>
                  <p className="mt-1 text-[13px] text-text-secondary">
                    Every post lands in your queue. You approve before it goes live.
                  </p>
                  <span className="mt-2 inline-flex rounded border border-accent px-2 py-0.5 text-[10px] text-accent">
                    Recommended
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalMode("auto_post")}
                  className={`w-full rounded border p-4 text-left ${approvalMode === "auto_post" ? "border-accent" : "border-border"}`}
                >
                  <p className="font-mono text-[13px]">Auto-post</p>
                  <p className="mt-1 text-[13px] text-text-secondary">
                    Posts are scheduled automatically at optimal times. Review anytime.
                  </p>
                  <p className="mt-2 text-[11px] text-text-tertiary">You can always change this in settings</p>
                </button>
              </div>
              <button
                type="button"
                disabled={isUpdating}
                className="mt-5 inline-flex rounded border border-accent px-4 py-2 text-sm text-accent hover:bg-accent hover:text-black disabled:opacity-60"
                onClick={() => void saveAndContinue({ approvalMode })}
              >
                Continue →
              </button>
              {stepError ? <p className="mt-2 text-xs text-danger">{stepError}</p> : null}
            </div>
          ) : null}

          {step === 5 ? (
            <div>
              <h1 className="font-mono text-[20px]">How often should Quilp post?</h1>
              <p className="mt-4 text-sm text-text-secondary">Maximum posts per day</p>
              <p className="mt-1 font-mono text-[32px] text-accent">{maxPostsPerDay}</p>
              <p className="text-xs text-text-secondary">per day, per platform</p>
              <input
                type="range"
                min={1}
                max={5}
                value={maxPostsPerDay}
                onChange={event => setMaxPostsPerDay(Number(event.target.value))}
                className="mt-4 w-full"
              />
              <div className="mt-2 flex items-center justify-between text-[11px] text-text-tertiary">
                <span>Conservative</span>
                <span>Moderate</span>
                <span>Active</span>
                <span>Aggressive</span>
              </div>
              <button
                type="button"
                disabled={isUpdating}
                className="mt-5 inline-flex rounded border border-accent px-4 py-2 text-sm text-accent hover:bg-accent hover:text-black disabled:opacity-60"
                onClick={() => void saveAndContinue({ maxPostsPerDay })}
              >
                Continue →
              </button>
              {stepError ? <p className="mt-2 text-xs text-danger">{stepError}</p> : null}
            </div>
          ) : null}

          {step === 6 ? (
            <div>
              <h1 className="font-mono text-[20px]">When should Quilp stay quiet?</h1>
              <p className="mt-2 text-sm text-text-secondary">Quilp won&apos;t post during these hours.</p>
              <label className="mt-5 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={quietHoursEnabled}
                  onChange={event => setQuietHoursEnabled(event.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                Set quiet hours
              </label>
              {quietHoursEnabled ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-xs text-text-secondary">From</p>
                    <input
                      type="time"
                      value={blackoutStart}
                      onChange={event => setBlackoutStart(event.target.value)}
                      className="h-10 w-full rounded border border-border bg-bg-secondary px-3 font-mono text-sm focus:border-border-hover focus:outline-none"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-text-secondary">To</p>
                    <input
                      type="time"
                      value={blackoutEnd}
                      onChange={event => setBlackoutEnd(event.target.value)}
                      className="h-10 w-full rounded border border-border bg-bg-secondary px-3 font-mono text-sm focus:border-border-hover focus:outline-none"
                    />
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                disabled={isUpdating}
                className="mt-5 inline-flex rounded border border-accent px-4 py-2 text-sm text-accent hover:bg-accent hover:text-black disabled:opacity-60"
                onClick={() =>
                  void saveAndContinue({
                    blackoutStart: quietHoursEnabled ? blackoutStart : null,
                    blackoutEnd: quietHoursEnabled ? blackoutEnd : null,
                  })
                }
              >
                Continue →
              </button>
              {stepError ? <p className="mt-2 text-xs text-danger">{stepError}</p> : null}
            </div>
          ) : null}

          {step === 7 ? (
            <div>
              <h1 className="font-mono text-2xl">
                You&apos;re all set<span className="text-accent">.</span>
              </h1>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded border border-border bg-bg-primary p-3">
                  <p className="inline-flex items-center gap-2 text-sm">
                    <Mail size={16} className="text-success" />
                    Gmail connected
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">{gmailConnection?.account_email ?? "Connected inbox"}</p>
                </div>
                <div className="rounded border border-border bg-bg-primary p-3">
                  <p className="inline-flex items-center gap-2 text-sm">
                    <Linkedin size={16} className={linkedInConnected ? "text-success" : "text-text-secondary"} />
                    {linkedInConnected ? "LinkedIn connected" : "Not connected"}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {linkedInConnected ? (linkedInConnection?.account_name ?? "LinkedIn account") : "Connect in settings"}
                  </p>
                </div>
                <div className="rounded border border-border bg-bg-primary p-3">
                  <p className="inline-flex items-center gap-2 text-sm">
                    <CheckCircle size={16} className="text-accent" />
                    {approvalMode === "require_approval" ? "Require approval" : "Auto-post"}
                  </p>
                </div>
                <div className="rounded border border-border bg-bg-primary p-3">
                  <p className="inline-flex items-center gap-2 text-sm">
                    <BarChart2 size={16} className="text-accent" />
                    {maxPostsPerDay} posts/day max
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="mt-5 inline-flex w-full items-center justify-center rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-black"
                onClick={completeOnboarding}
              >
                Go to dashboard →
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
