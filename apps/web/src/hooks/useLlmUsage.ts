import { useQuery } from "@tanstack/react-query";
import { get } from "../lib/api";

export interface LlmUsage {
  month: string;
  spendUsd: number;
  capUsd: number;
  remainingUsd: number;
  callCount: number;
  percentUsed: number;
}

type LlmUsageResponse = {
  data: LlmUsage;
};

export function useLlmUsage() {
  const query = useQuery({
    queryKey: ["llm-usage"],
    queryFn: async () => {
      const response = await get<LlmUsageResponse>("/api/v1/analytics/llm-usage");
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    usage: query.data ?? null,
    isLoading: query.isLoading || query.isPending,
    isError: query.isError,
    error: query.error,
  };
}
