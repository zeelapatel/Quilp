import { ArrowRight, LoaderCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { post } from "../../lib/api";

type AuthResponse = { authUrl: string };

export function ConnectButton() {
  const mutation = useMutation({
    mutationFn: () => post<AuthResponse>("/api/v1/email-connections/gmail/auth"),
    onSuccess: data => {
      window.location.href = data.authUrl;
    }
  });

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="active-button flex h-12 w-full items-center justify-between rounded border border-border bg-bg-secondary px-4 text-sm text-text-primary transition-colors hover:border-border-hover disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span className="flex items-center gap-3">
        <img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png" alt="" className="h-[18px] w-[18px]" />
        Connect Gmail
      </span>
      {mutation.isPending ? <LoaderCircle size={16} className="animate-spin text-accent" /> : <ArrowRight size={16} className="text-accent" />}
    </button>
  );
}
