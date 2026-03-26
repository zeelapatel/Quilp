import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { PostDetailDrawer } from "../../components/posts";
import { Skeleton } from "../../components/ui/Skeleton";
import { usePost, usePosts, type PostItem } from "../../hooks/usePosts";
import type { AppOutletContext } from "../types";

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getMondayIndex(day: number): number {
  return day === 0 ? 6 : day - 1;
}

function getPostDate(post: PostItem): Date | null {
  const iso = post.status === "posted" ? post.posted_at : post.scheduled_at;
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPillText(post: PostItem): string {
  if (post.status === "posted") {
    return "LI Posted";
  }
  if (!post.scheduled_at) {
    return "LI --:--";
  }
  return `LI ${new Date(post.scheduled_at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function CalendarPage() {
  const { authUser, user, signOut } = useOutletContext<AppOutletContext>();
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const scheduledQuery = usePosts({ status: "approved", limit: 100 });
  const postedQuery = usePosts({ status: "posted", limit: 100 });
  const selectedPostQuery = usePost(selectedPostId);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const todayKey = toDateKey(new Date());

  const postsByDay = useMemo(() => {
    const map = new Map<string, PostItem[]>();
    const all = [...scheduledQuery.posts, ...postedQuery.posts];
    all.forEach(post => {
      const date = getPostDate(post);
      if (!date) {
        return;
      }
      if (date < monthStart || date > monthEnd) {
        return;
      }
      const key = toDateKey(date);
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    });
    return map;
  }, [monthEnd, monthStart, postedQuery.posts, scheduledQuery.posts]);

  const gridDays = useMemo(() => {
    const daysInMonth = monthEnd.getDate();
    const offset = getMondayIndex(monthStart.getDay());
    const cells: Array<Date | null> = [];
    for (let i = 0; i < offset; i += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [monthDate, monthEnd, monthStart]);

  const isLoading = scheduledQuery.isLoading || postedQuery.isLoading;
  const isError = scheduledQuery.isError || postedQuery.isError;

  return (
    <AppShell title="Calendar" user={user} authEmail={authUser?.email ?? ""} onSignOut={signOut}>
      <div className="rounded border border-border bg-bg-secondary p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-2xl">Content calendar</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-border p-1.5 text-text-secondary hover:text-text-primary"
              onClick={() => setMonthDate(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            >
              <ChevronLeft size={14} />
            </button>
            <p className="font-mono text-sm">
              {monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              className="rounded border border-border p-1.5 text-text-secondary hover:text-text-primary"
              onClick={() => setMonthDate(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              className="ml-2 rounded-full border border-border px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
              onClick={() => setMonthDate(startOfMonth(new Date()))}
            >
              Today
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-2">
          {DAY_HEADERS.map(day => (
            <p key={day} className="font-mono text-[11px] text-text-tertiary">
              {day}
            </p>
          ))}
          {isError
            ? <p className="col-span-7 py-6 text-center text-sm text-danger">Failed to load posts. Try refreshing.</p>
            : isLoading
            ? Array.from({ length: 35 }, (_, idx) => <Skeleton key={idx} variant="card" className="h-20" />)
            : gridDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="min-h-20 rounded border border-border bg-bg-primary/30" />;
                }
                const key = toDateKey(date);
                const dayPosts = postsByDay.get(key) ?? [];
                const visiblePosts = dayPosts.slice(0, 2);
                const overflowCount = Math.max(0, dayPosts.length - 2);
                const isToday = key === todayKey;
                const isPast = date.getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime();
                return (
                  <div key={key} className="min-h-[80px] rounded border border-border bg-bg-primary p-2">
                    <p
                      className={`font-mono text-xs ${
                        isToday ? "text-accent" : isPast ? "text-text-tertiary" : "text-text-secondary"
                      }`}
                    >
                      {date.getDate()}
                    </p>
                    <div className="mt-1 space-y-1">
                      {visiblePosts.map(post => (
                        <button
                          key={post.id}
                          type="button"
                          onClick={() => setSelectedPostId(post.id)}
                          className={`block w-full truncate rounded px-1.5 py-0.5 text-left font-mono text-[10px] ${
                            post.status === "posted" ? "bg-[#1A3A1A] text-success" : "bg-[#E6F1FB] text-[#0A0A0A]"
                          }`}
                        >
                          {formatPillText(post)}
                        </button>
                      ))}
                      {overflowCount > 0 ? (
                        <p className="font-mono text-[10px] text-text-tertiary">+{overflowCount} more</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
        </div>

        {!isLoading && postsByDay.size === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-sm text-text-tertiary">No posts scheduled this month</p>
            <p className="mt-1 text-sm text-text-tertiary">Approve posts from the queue to see them here</p>
          </div>
        ) : null}
      </div>
      <PostDetailDrawer open={selectedPostId !== null} post={selectedPostQuery.post} onClose={() => setSelectedPostId(null)} />
    </AppShell>
  );
}
