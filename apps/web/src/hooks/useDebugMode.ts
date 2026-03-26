import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch } from "../lib/api";

interface DebugModeState {
  parseAll: boolean;
  generatePosts: boolean;
  warning: string;
}

type DebugModeResponse = {
  data: DebugModeState;
};

type UpdateDebugModePayload = {
  parseAll: boolean;
  generatePosts: boolean;
};

export function useDebugMode() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["debug-mode"],
    queryFn: async () => {
      const response = await get<DebugModeResponse>("/api/v1/debug/parse-mode");
      return response.data;
    },
    enabled: import.meta.env.DEV,
  });

  const mutation = useMutation({
    mutationFn: (payload: UpdateDebugModePayload) => patch("/api/v1/debug/parse-mode", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["debug-mode"] });
    },
  });

  return {
    parseAll: query.data?.parseAll ?? false,
    generatePosts: query.data?.generatePosts ?? false,
    warning: query.data?.warning ?? "",
    isLoading: query.isLoading || query.isPending,
    isPending: mutation.isPending,
    updateDebugMode: mutation.mutate,
  };
}
