import { useQuery } from "@tanstack/react-query";
import { ApiError, get, post } from "../lib/api";

export type QuilpUser = {
  id: string;
  plan: "starter" | "pro" | "agency";
  timezone: string;
  data_region: "us" | "eu";
  created_at: string;
  updated_at?: string;
};

async function fetchOrRegisterUser(): Promise<QuilpUser> {
  try {
    return await get<QuilpUser>("/api/v1/users/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      return post<QuilpUser>("/api/v1/auth/register", { timezone });
    }
    throw error;
  }
}

export function useUser(enabled = true) {
  const query = useQuery({
    queryKey: ["me"],
    queryFn: fetchOrRegisterUser,
    enabled
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading || query.isPending,
    isError: query.isError,
    error: query.error
  };
}
