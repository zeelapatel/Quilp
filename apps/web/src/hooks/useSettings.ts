import { useMutation, useQuery } from "@tanstack/react-query";
import { get, patch } from "../lib/api";
import { queryClient } from "../lib/queryClient";

export type ApprovalMode = "require_approval" | "auto_post";
export type TimeoutAction = "auto_post" | "discard";

export type UserSettings = {
  approvalMode: ApprovalMode;
  approvalTimeoutHrs: number;
  timeoutAction: TimeoutAction;
  maxPostsPerDay: number;
  blackoutStart: string | null;
  blackoutEnd: string | null;
  timezone: string;
};

export type UpdateSettingsPayload = Partial<UserSettings>;

const SETTINGS_QUERY_KEY = ["user-settings"];

export function useSettings() {
  const query = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => get<UserSettings>("/api/v1/users/me/settings"),
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading || query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useUpdateSettings() {
  const mutation = useMutation({
    mutationFn: (payload: UpdateSettingsPayload) => patch<UserSettings>("/api/v1/users/me/settings", payload),
    onMutate: async payload => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_QUERY_KEY });
      const previousSettings = queryClient.getQueryData<UserSettings>(SETTINGS_QUERY_KEY);
      if (previousSettings) {
        queryClient.setQueryData<UserSettings>(SETTINGS_QUERY_KEY, {
          ...previousSettings,
          ...payload,
        });
      }
      return { previousSettings };
    },
    onError: (_error, _payload, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData<UserSettings>(SETTINGS_QUERY_KEY, context.previousSettings);
      }
    },
    onSuccess: settings => {
      queryClient.setQueryData<UserSettings>(SETTINGS_QUERY_KEY, settings);
    },
  });

  return {
    update: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}
