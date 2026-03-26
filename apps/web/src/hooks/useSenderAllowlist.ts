import { useMutation, useQuery } from "@tanstack/react-query";
import { del, get, post } from "../lib/api";
import { queryClient } from "../lib/queryClient";

export type AllowlistEntry = {
  id: string;
  email: string;
  label: string | null;
  created_at: string;
};

export function useSenderAllowlist() {
  const query = useQuery({
    queryKey: ["sender-allowlist"],
    queryFn: () => get<AllowlistEntry[]>("/api/v1/sender-allowlist"),
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useAddAllowlistEntry() {
  const mutation = useMutation({
    mutationFn: (payload: { email: string; label?: string }) =>
      post<AllowlistEntry>("/api/v1/sender-allowlist", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sender-allowlist"] });
    },
  });

  return {
    add: mutation.mutateAsync,
    isAdding: mutation.isPending,
    error: mutation.error,
  };
}

export function useRemoveAllowlistEntry() {
  const mutation = useMutation({
    mutationFn: (id: string) => del(`/api/v1/sender-allowlist/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sender-allowlist"] });
    },
  });

  return {
    remove: mutation.mutateAsync,
    isRemoving: mutation.isPending,
  };
}
