import { useOutletContext } from "react-router-dom";
import { Inbox, Link as LinkIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../components/layout/AppShell";
import { EmptyState } from "../../components/ui/EmptyState";
import { PlatformBadge, ScorePill, StatusBadge } from "../../components/posts";
import { LlmUsageWidget } from "../../components/dashboard/LlmUsageWidget";
import { VoiceStatusRow } from "../../components/dashboard/VoiceStatusRow";
import { get } from "../../lib/api";
import { useLlmUsage } from "../../hooks/useLlmUsage";
import { usePosts } from "../../hooks/usePosts";
import { useVoiceProfile } from "../../hooks/useVoiceProfile";
import type { AppOutletContext } from "../types";

type EmailConnection = {
  id: string;
  provider: "gmail";
  account_email: string | null;
  account_name: string | null;
  is_active: boolean;
  last_poll_at: string | null;
  created_at: string;
};

export function DashboardPage() {
  const { authUser, user, signOut } = useOutletContext<AppOutletContext>();
  const connections = useQuery({
    queryKey: ["email-connections"],
    queryFn: () => get<EmailConnection[]>("/api/v1/email-connections")
  });

  const postsAll = usePosts({ limit: 1 });
  const pendingPosts = usePosts({ status: "queued", limit: 1 });
  const publishedPosts = usePosts({ status: "posted", limit: 1 });
  const scheduledPosts = usePosts({ status: "approved", limit: 1 });
  const recentPosts = usePosts({ limit: 3 });
  const { usage, isLoading: usageLoading } = useLlmUsage();
  const { profiles, isLoading: voiceLoading } = useVoiceProfile();

  const activeProfile = profiles.find(profile => profile.profileType === "personal") ?? profiles[0] ?? null;
  const sourceCount = (connections.data ?? []).filter(c => c.is_active).length;
  const postsGenerated = postsAll.total;
  const pendingReview = pendingPosts.total;
  const publishedCount = publishedPosts.total;
  const scheduledCount = scheduledPosts.total;
  const stats = [
    { label: "Inbox sources", value: sourceCount > 0 ? String(sourceCount) : "—", sub: "connected" },
    { label: "Posts generated", value: String(postsGenerated), sub: "all time", soon: false },
    {
      label: "Pending review",
      value: String(pendingReview),
      sub: "queued",
      soon: false,
      accent: pendingReview > 0,
      queueLink: true,
    },
    {
      label: "Published",
      value: String(publishedCount),
      sub: "all time",
      soon: false,
    },
    {
      label: "Scheduled",
      value: String(scheduledCount),
      sub: "pending",
      soon: false,
      accent: scheduledCount > 0,
    },
  ];

  return (
    <AppShell title="Dashboard" user={user} authEmail={authUser?.email ?? ""} onSignOut={signOut}>
      <section className="grid grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="stat-card relative rounded border border-border bg-bg-secondary p-5">
            <p className="text-xs text-text-secondary">{stat.label}</p>
            <p className={`font-mono text-[32px] ${stat.accent ? "text-accent" : ""}`}>{stat.value}</p>
            <p className="text-xs text-text-secondary">{stat.sub}</p>
            {"queueLink" in stat && stat.queueLink ? (
              <a href="/queue" className="mt-2 inline-flex font-mono text-[11px] text-accent hover:underline">
                Review queue →
              </a>
            ) : null}
          </div>
        ))}
      </section>
      <section className="mt-4 space-y-3">
        <LlmUsageWidget usage={usage} isLoading={usageLoading} />
        {voiceLoading ? null : <VoiceStatusRow profile={activeProfile} />}
      </section>
      <section className="mt-8 grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="rounded border border-border bg-bg-secondary p-5">
            <p className="font-mono text-[13px] text-text-secondary">Recent posts</p>
            <div className="mt-4 space-y-2">
              {recentPosts.isLoading ? (
                <>
                  <div className="h-16 animate-pulse rounded border border-border bg-bg-tertiary" />
                  <div className="h-16 animate-pulse rounded border border-border bg-bg-tertiary" />
                  <div className="h-16 animate-pulse rounded border border-border bg-bg-tertiary" />
                </>
              ) : recentPosts.posts.length === 0 ? (
                <p className="inline-flex items-center gap-2 text-sm text-text-tertiary">
                  Your first post is being generated...
                </p>
              ) : (
                recentPosts.posts.map(post => (
                  <div key={post.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded border border-border p-3">
                    <PlatformBadge platform={post.platform} />
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {post.content.slice(0, 80)}
                        {post.content.length > 80 ? "..." : ""}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {post.category} · {new Date(post.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ScorePill score={post.confidence_score} label="C" />
                      <ScorePill score={post.voice_score} label="V" />
                      <StatusBadge status={post.status} />
                      {post.status === "posted" && post.platform_post_id ? (
                        <a
                          href={`https://www.linkedin.com/feed/update/${post.platform_post_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-accent hover:underline"
                        >
                          View →
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 text-right">
              <a href="/queue" className="font-mono text-xs text-accent hover:underline">
                View all →
              </a>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded border border-border bg-bg-secondary p-5">
            <p className="mb-3 font-mono text-[13px] text-text-secondary">Inbox connections</p>
            {sourceCount === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No inbox connected"
                description="Connect Gmail to start"
                action={
                  <a href="/onboarding" className="mt-2 inline-flex rounded border border-border px-3 py-1.5 text-xs hover:border-border-hover">
                    Connect Gmail
                  </a>
                }
              />
            ) : (
              <div className="space-y-2">
                {connections.data?.map(conn => (
                  <div key={conn.id} className="group rounded border border-border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LinkIcon size={14} />
                        <p>{conn.account_email ?? "Gmail"}</p>
                      </div>
                      <p className={conn.is_active ? "text-success" : "text-danger"}>{conn.is_active ? "Active" : "Disconnected"}</p>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-text-tertiary">
                      Last polled:{" "}
                      {conn.last_poll_at
                        ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
                            Math.round((new Date(conn.last_poll_at).getTime() - Date.now()) / 60000),
                            "minute"
                          )
                        : "Never"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="relative rounded border border-border bg-bg-secondary p-5">
            <p className="font-mono text-[13px] text-text-secondary">Activity feed</p>
            <p className="mt-3 text-sm text-text-tertiary">Activity feed coming soon</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
