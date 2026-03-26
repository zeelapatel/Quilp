import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { QuilpUser } from "../../hooks/useUser";

type Props = {
  title: string;
  user: QuilpUser | null;
  authEmail: string;
  onSignOut: () => void;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({ title, user, authEmail, onSignOut, actions, children }: Props) {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <Sidebar user={user} authEmail={authEmail} onSignOut={onSignOut} />
      <div className="ml-[220px] min-h-screen">
        <TopBar title={title} actions={actions} />
        <main className="page overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
