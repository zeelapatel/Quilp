import { Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCalibrate } from "../../hooks/useVoiceProfile";

type CalibrationModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  profileType?: "personal" | "company";
};

function newPosts(count: number): string[] {
  return Array.from({ length: count }, () => "");
}

export function CalibrationModal({
  open,
  onClose,
  onSuccess,
  profileType = "personal",
}: CalibrationModalProps) {
  const [posts, setPosts] = useState<string[]>(newPosts(3));
  const [successPersona, setSuccessPersona] = useState<string | null>(null);
  const [successVersion, setSuccessVersion] = useState<number | null>(null);
  const { calibrate, isCalibrating, error } = useCalibrate();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  const isValid = useMemo(() => {
    const filled = posts.filter(post => post.trim().length >= 50 && post.trim().length <= 5000);
    return filled.length >= 3;
  }, [posts]);

  if (!open) {
    return null;
  }

  const updatePost = (index: number, value: string) => {
    setPosts(current => current.map((post, idx) => (idx === index ? value : post)));
  };

  const addPost = () => {
    setPosts(current => (current.length < 10 ? [...current, ""] : current));
  };

  const handleSubmit = async () => {
    const payload = posts.map(post => post.trim()).filter(Boolean);
    const result = await calibrate({ posts: payload, profileType });
    setSuccessPersona(result.data.patterns.writingPersona);
    setSuccessVersion(result.data.version);
    onSuccess?.();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="w-full max-w-[560px] rounded-lg border border-border bg-bg-secondary p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-lg">Calibrate voice</h3>
            <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
              <X size={16} />
            </button>
          </div>

          {successPersona ? (
            <div className="mt-6 text-center">
              <Sparkles size={24} className="mx-auto text-accent" />
              <p className="mt-2 font-mono text-lg">Your voice is calibrated</p>
              <p className="mt-2 text-sm italic text-text-secondary">{successPersona}</p>
              {successVersion !== null ? (
                <span className="mt-3 inline-flex rounded border border-border px-2 py-0.5 font-mono text-[11px] text-text-tertiary">
                  v{successVersion}
                </span>
              ) : null}
              <div className="mt-5">
                <button
                  type="button"
                  className="rounded border border-accent px-4 py-2 text-sm text-accent hover:bg-accent hover:text-black"
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {posts.map((post, index) => {
                const length = post.trim().length;
                const tooShort = length > 0 && length < 50;
                const tooLong = length > 5000;
                return (
                  <div key={index}>
                    <label className="text-xs text-text-secondary">Post {index + 1}</label>
                    <textarea
                      value={post}
                      onChange={event => updatePost(index, event.target.value)}
                      placeholder="Paste a LinkedIn post you've written..."
                      className="mt-1 h-[120px] w-full resize-y rounded border border-border bg-bg-secondary p-3 text-sm leading-relaxed text-text-primary focus:border-border-hover focus:outline-none"
                    />
                    <p className={`mt-1 font-mono text-[11px] ${tooShort || tooLong ? "text-danger" : "text-text-tertiary"}`}>
                      {length} characters
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
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded border border-accent text-sm text-accent disabled:opacity-40 hover:bg-accent hover:text-black disabled:hover:bg-transparent disabled:hover:text-accent"
                onClick={() => void handleSubmit()}
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

              {error ? (
                <p className="text-sm text-danger">
                  {(error instanceof Error ? error.message : String(error)).includes("402")
                    ? "Monthly AI limit reached. You can calibrate next month."
                    : error instanceof Error ? error.message : String(error)}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
