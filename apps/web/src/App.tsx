import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Outlet, RouterProvider, createBrowserRouter, redirect, useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { queryClient } from "./lib/queryClient";
import { supabase } from "./lib/supabase";
import { useAuth } from "./hooks/useAuth";
import { useUser } from "./hooks/useUser";
import { Skeleton } from "./components/ui/Skeleton";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { OnboardingPage } from "./pages/onboarding/OnboardingPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { QueuePage } from "./pages/queue/QueuePage";
import { CalendarPage } from "./pages/calendar/CalendarPage";
import { AnalyticsPage } from "./pages/analytics/AnalyticsPage";
import { ConnectionsPage } from "./pages/connections/ConnectionsPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { LandingPage } from "./pages/landing/LandingPage";
import { get } from "./lib/api";
import { Toast } from "./components/ui/Toast";

const ONBOARDING_COMPLETE_KEY = "quilp:onboarding:complete";

type EmailConnection = {
  id: string;
  is_active: boolean;
};

async function publicLoader() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    throw redirect("/dashboard");
  }
  return null;
}

function AppErrorBoundary() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg-primary p-6 text-center">
      <AlertTriangle className="text-danger" size={30} />
      <p className="font-mono text-xl">Something went wrong</p>
      <button type="button" onClick={() => window.location.reload()} className="rounded border border-border px-3 py-2 text-sm">
        Reload page
      </button>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg-primary">
      <p className="font-mono text-[80px] text-text-tertiary">404</p>
      <p className="text-text-primary">This page doesn't exist</p>
      <a href="/" className="text-sm text-text-secondary hover:text-text-primary">
        ← Back to home
      </a>
    </div>
  );
}

function AuthCallbackPage() {
  const hasNavigated = useRef(false);

  useEffect(() => {
    const settleSession = async () => {
      for (let i = 0; i < 10; i += 1) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          hasNavigated.current = true;
          window.location.href = "/dashboard";
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (!hasNavigated.current) {
        window.location.href = "/login";
      }
    };

    void settleSession();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <Skeleton variant="card" className="h-14 w-60" />
    </div>
  );
}

function ProtectedGate() {
  const { session, user: authUser, loading, signOut } = useAuth();
  const { user, isLoading: userLoading } = useUser(Boolean(session));
  const location = useLocation();
  const emailConnections = useQuery({
    queryKey: ["email-connections"],
    enabled: Boolean(session),
    queryFn: () => get<EmailConnection[]>("/api/v1/email-connections"),
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <Skeleton variant="card" className="h-14 w-52" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (userLoading || emailConnections.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <Skeleton variant="card" className="h-14 w-52" />
      </div>
    );
  }

  const hasEmailConnections = (emailConnections.data ?? []).some(connection => connection.is_active);
  const onboardingComplete = window.localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
  const isOnOnboardingPage = location.pathname === "/onboarding";

  if (!emailConnections.isError && (!hasEmailConnections || !onboardingComplete) && !isOnOnboardingPage) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet context={{ authUser, user, signOut }} />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
    errorElement: <AppErrorBoundary />
  },
  {
    path: "/login",
    loader: publicLoader,
    element: <LoginPage />,
    errorElement: <AppErrorBoundary />
  },
  {
    path: "/signup",
    loader: publicLoader,
    element: <SignupPage />,
    errorElement: <AppErrorBoundary />
  },
  {
    path: "/auth/callback",
    element: <AuthCallbackPage />,
    errorElement: <AppErrorBoundary />
  },
  {
    element: <ProtectedGate />,
    errorElement: <AppErrorBoundary />,
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/onboarding", element: <OnboardingPage /> },
      { path: "/queue", element: <QueuePage /> },
      { path: "/calendar", element: <CalendarPage /> },
      { path: "/analytics", element: <AnalyticsPage /> },
      { path: "/connections", element: <ConnectionsPage /> },
      { path: "/settings", element: <SettingsPage /> }
    ]
  },
  { path: "*", element: <NotFoundPage /> }
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toast />
    </QueryClientProvider>
  );
}
