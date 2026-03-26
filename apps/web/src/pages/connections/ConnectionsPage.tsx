import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { Linkedin, Lock } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { StatusBadge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { del, get, post } from "../../lib/api";
import { useConnectLinkedIn, useDisconnectSocial, useSocialConnections } from "../../hooks/useSocialConnections";
import type { AppOutletContext } from "../types";

type AuthResponse = { authUrl: string };
type EmailConnection = {
  id: string;
  provider: "gmail";
  account_email: string | null;
  account_name: string | null;
  is_active: boolean;
  last_poll_at: string | null;
  created_at: string;
};

export function ConnectionsPage() {
  const { authUser, user, signOut } = useOutletContext<AppOutletContext>();
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmSocialId, setConfirmSocialId] = useState<string | null>(null);
  const connections = useQuery({
    queryKey: ["email-connections"],
    queryFn: () => get<EmailConnection[]>("/api/v1/email-connections")
  });
  const { connections: socialConnections } = useSocialConnections();
  const { connect, isConnecting } = useConnectLinkedIn();
  const { disconnect, isDisconnecting } = useDisconnectSocial();
  const linkedInConnection =
    socialConnections.find(connection => connection.platform.toLowerCase().includes("linkedin") && connection.is_active) ?? null;

  const connectMutation = useMutation({
    mutationFn: () => post<AuthResponse>("/api/v1/email-connections/gmail/auth"),
    onSuccess: data => {
      window.location.href = data.authUrl;
    }
  });
  const disconnectMutation = useMutation({
    mutationFn: (id: string) => del(`/api/v1/email-connections/${id}`),
    onSuccess: async () => {
      setConfirmId(null);
      await qc.invalidateQueries({ queryKey: ["email-connections"] });
    }
  });

  return (
    <AppShell title="Connections" user={user} authEmail={authUser?.email ?? ""} onSignOut={signOut}>
      <h2 className="font-mono text-2xl">Connections</h2>
      <p className="mt-1 text-sm text-text-secondary">Manage your inbox and social accounts</p>

      <section className="mt-6 rounded border border-border bg-bg-secondary p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-mono text-sm text-text-secondary">Email inboxes</h3>
          <button type="button" onClick={() => connectMutation.mutate()} className="active-button rounded border border-border px-3 py-1.5 text-xs hover:border-border-hover">
            + Connect Gmail
          </button>
        </div>
        {connections.data?.length ? (
          <div className="space-y-2">
            {connections.data.map(conn => (
              <div key={conn.id} className="rounded border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png" alt="" className="h-[16px] w-[16px]" />
                    <p>{conn.account_email ?? "Gmail account"}</p>
                  </div>
                  <StatusBadge active={conn.is_active} />
                </div>
                <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                  {confirmId === conn.id ? (
                    <>
                      <span className="text-text-secondary">Are you sure?</span>
                      <button type="button" className="text-danger" onClick={() => disconnectMutation.mutate(conn.id)}>
                        yes
                      </button>
                      <button type="button" className="text-text-secondary" onClick={() => setConfirmId(null)}>
                        no
                      </button>
                    </>
                  ) : (
                    <button type="button" className="text-danger" onClick={() => setConfirmId(conn.id)}>
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Lock} title="No inboxes connected" description="Connect Gmail to start pulling meeting summaries." />
        )}
      </section>

      <section className="mt-6 rounded border border-border bg-bg-secondary p-5">
        <h3 className="mb-3 font-mono text-sm text-text-secondary">Social accounts</h3>
        <p className="mb-4 text-xs text-text-tertiary">Connect platforms where Quilp will publish</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded border border-border bg-bg-primary p-3">
            {linkedInConnection ? (
              <>
                <div className="flex items-center gap-3">
                  <Linkedin size={20} className="text-[#0077B5]" />
                  <div>
                    <p className="text-sm">LinkedIn Personal</p>
                    <p className="text-xs text-text-secondary">{linkedInConnection.account_name ?? "Connected account"}</p>
                    <p className="font-mono text-[11px] text-text-tertiary">
                      {linkedInConnection.account_email ?? "No email provided"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="inline-flex items-center gap-1 text-xs text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Connected
                  </p>
                  {confirmSocialId === linkedInConnection.id ? (
                    <p className="mt-1 text-xs text-text-secondary">
                      Sure?{" "}
                      <button
                        type="button"
                        className="text-danger"
                        disabled={isDisconnecting}
                        onClick={() => {
                          setConfirmSocialId(null);
                          void disconnect(linkedInConnection.id);
                        }}
                      >
                        Disconnect
                      </button>{" "}
                      <button type="button" className="text-text-secondary" onClick={() => setConfirmSocialId(null)}>
                        Cancel
                      </button>
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="mt-1 text-xs text-text-secondary hover:text-danger"
                      onClick={() => setConfirmSocialId(linkedInConnection.id)}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Linkedin size={20} className="text-text-tertiary" />
                  <div>
                    <p className="text-sm">LinkedIn Personal</p>
                    <p className="text-xs text-text-tertiary">Not connected</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded border border-accent px-3 py-1.5 text-xs text-accent hover:bg-accent hover:text-black"
                  onClick={() => void connect()}
                  disabled={isConnecting}
                >
                  Connect →
                </button>
              </>
            )}
          </div>

          <div className="flex items-center justify-between rounded border border-border bg-bg-primary p-3">
            <div className="flex items-center gap-2 text-text-tertiary">
              <Lock size={14} />
              <p>X / Twitter — Coming in Sprint 5</p>
            </div>
            <Lock size={12} className="text-text-tertiary" />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
