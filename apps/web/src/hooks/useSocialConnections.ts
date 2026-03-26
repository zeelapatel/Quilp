import { useMutation, useQuery } from "@tanstack/react-query";
import { del, get, post } from "../lib/api";
import { queryClient } from "../lib/queryClient";

export type SocialConnection = {
  id: string;
  platform: "linkedin" | "x" | "instagram" | string;
  account_email: string | null;
  account_name: string | null;
  account_type: string | null;
  is_active: boolean;
  created_at: string;
};

type LinkedInAuthResponse = {
  authUrl: string;
};

export function useSocialConnections() {
  const query = useQuery({
    queryKey: ["social-connections"],
    queryFn: () => get<SocialConnection[]>("/api/v1/social-connections"),
  });

  return {
    connections: query.data ?? [],
    isLoading: query.isLoading || query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useConnectLinkedIn() {
  const mutation = useMutation({
    mutationFn: () => post<LinkedInAuthResponse>("/api/v1/social-connections/linkedin/auth"),
    onSuccess: data => {
      window.location.href = data.authUrl;
    },
  });

  return {
    connect: mutation.mutateAsync,
    isConnecting: mutation.isPending,
    error: mutation.error,
  };
}

export function useDisconnectSocial() {
  const mutation = useMutation({
    mutationFn: (id: string) => del(`/api/v1/social-connections/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["social-connections"] });
    },
  });

  return {
    disconnect: mutation.mutateAsync,
    isDisconnecting: mutation.isPending,
    error: mutation.error,
  };
}
