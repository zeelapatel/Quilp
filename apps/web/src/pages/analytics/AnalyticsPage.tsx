import { useOutletContext } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { ComingSoon } from "../../components/ui/ComingSoon";
import type { AppOutletContext } from "../types";

export function AnalyticsPage() {
  const { authUser, user, signOut } = useOutletContext<AppOutletContext>();
  return (
    <AppShell title="Analytics" user={user} authEmail={authUser?.email ?? ""} onSignOut={signOut}>
      <div className="relative rounded border border-border bg-bg-secondary p-5">
        <div className="grid grid-cols-4 gap-3">
          {["Impressions", "Likes", "Comments", "CTR"].map(metric => (
            <div key={metric} className="rounded border border-border bg-bg-primary p-4">
              <p className="text-xs text-text-secondary">{metric}</p>
              <p className="font-mono text-2xl">{metric === "CTR" ? "3.8%" : "1,284"}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded border border-border bg-bg-primary p-4">
          <svg viewBox="0 0 600 120" className="h-32 w-full">
            <path d="M0 100 C 80 90, 140 86, 200 70 C 260 55, 320 60, 400 40 C 460 30, 520 26, 600 10" stroke="#E8F94A" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <table className="mt-6 w-full text-left text-sm">
          <thead><tr className="text-text-secondary"><th>Top posts</th><th>Impressions</th><th>Engagement</th></tr></thead>
          <tbody>
            <tr className="border-t border-border"><td className="py-2">Why async meeting notes beat memory</td><td>3,812</td><td>8.4%</td></tr>
            <tr className="border-t border-border"><td className="py-2">Q3 review thread</td><td>2,944</td><td>7.1%</td></tr>
            <tr className="border-t border-border"><td className="py-2">Using confidence scores in content ops</td><td>2,107</td><td>6.3%</td></tr>
          </tbody>
        </table>
        <ComingSoon sprint="Sprint 4" message="Analytics available after first posts publish" />
      </div>
    </AppShell>
  );
}
