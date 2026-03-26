import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Chrome } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-1 font-mono text-[28px] font-medium tracking-[-0.02em] text-text-primary">
      quilp
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
    </Link>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const { signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const valid = email.length > 3 && password.length > 5 && password === confirmPassword;

  return (
    <div className="grid min-h-screen grid-cols-2 bg-bg-primary">
      <section className="flex flex-col justify-center border-r border-border px-16">
        <Link to="/" className="mb-8 flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-secondary">
          <span>←</span> Back
        </Link>
        <Wordmark />
        <p className="mt-4 text-base text-text-secondary">Your meetings become content. Automatically.</p>
      </section>
      <section className="flex items-center justify-center">
        <form
          className="w-full max-w-sm rounded border border-border bg-bg-secondary p-6"
          onSubmit={async e => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            const result = await signUp(email, password);
            setLoading(false);
            if (result.error) {
              setError(result.error);
              return;
            }
            if (result.needsEmailConfirm) {
              setCheckEmail(true);
              return;
            }
            navigate("/onboarding");
          }}
        >
          <h1 className="mb-5 font-mono text-xl">Create account</h1>
          <button
            type="button"
            onClick={async () => {
              setError(null);
              const result = await signInWithGoogle();
              if (result.error) {
                setError(result.error);
              }
            }}
            className="active-button mb-4 flex h-11 w-full items-center justify-center gap-2 rounded border border-border bg-bg-tertiary text-sm text-text-primary transition hover:border-border-hover"
          >
            <Chrome size={15} />
            Continue with Google
          </button>
          <div className="mb-4 border-t border-border" />
          <div className="space-y-3">
            <input className="h-11 w-full rounded border border-border bg-bg-tertiary px-3 text-sm outline-none focus:border-border-hover" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" className="h-11 w-full rounded border border-border bg-bg-tertiary px-3 text-sm outline-none focus:border-border-hover" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <input type="password" className="h-11 w-full rounded border border-border bg-bg-tertiary px-3 text-sm outline-none focus:border-border-hover" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>
          {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
          {checkEmail ? (
            <p className="mt-3 text-xs text-success">
              Check your email to confirm your account, or use Google sign-in above.
            </p>
          ) : null}
          <button type="submit" disabled={!valid || loading} className="active-button mt-5 h-11 w-full rounded border border-border bg-bg-tertiary text-sm text-text-primary transition disabled:opacity-50 data-[valid=true]:border-accent data-[valid=true]:text-accent" data-valid={valid}>
            {loading ? "Creating account..." : "Create account"}
          </button>
          <p className="mt-4 text-xs text-text-secondary">
            Have an account?{" "}
            <Link to="/login" className="text-text-primary">
              Sign in
            </Link>
          </p>
        </form>
      </section>
    </div>
  );
}
