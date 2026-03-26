import { QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { supabase } from "./supabase";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: async error => {
      if (error instanceof ApiError && error.status === 401) {
        await supabase.auth.signOut();
        window.location.href = "/login";
      }
    }
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1
    }
  }
});

export function invalidatePosts(client: QueryClient = queryClient) {
  return client.invalidateQueries({ queryKey: ["posts"] });
}

export function invalidateVoiceProfiles(client: QueryClient = queryClient) {
  return client.invalidateQueries({ queryKey: ["voice-profiles"] });
}
