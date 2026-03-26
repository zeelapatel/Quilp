import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { get } from "../lib/api";

export type PostStatus = "draft" | "queued" | "approved" | "posted" | "failed" | "discarded";
export type PostPlatform =
  | "linkedin_personal"
  | "linkedin_company"
  | "x"
  | "instagram"
  | "facebook"
  | "substack"
  | "beehiiv"
  | "slack"
  | "notion";

export interface PostItem {
  id: string;
  user_id: string;
  source_email_id: string | null;
  platform: PostPlatform;
  format: string;
  content: string;
  content_original: string | null;
  category: string;
  confidence_score: number | null;
  voice_score: number | null;
  llm_model: string | null;
  generation_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  status: PostStatus;
  scheduled_at: string | null;
  posted_at: string | null;
  platform_post_id: string | null;
  is_user_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostDetail extends PostItem {
  sourceEmail: {
    sourceType: string;
    subject: string;
    confidenceScore: number;
  } | null;
}

type PostsPage = {
  data: PostItem[];
  meta: {
    nextCursor: string | null;
    hasMore: boolean;
    total: number;
  };
};

type UsePostsFilters = {
  status?: string;
  platform?: string;
  limit?: number;
};

export function usePosts(filters?: UsePostsFilters) {
  const limit = filters?.limit ?? 20;
  const query = useInfiniteQuery({
    queryKey: ["posts", filters?.status ?? "all", filters?.platform ?? "all", limit],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (filters?.status) {
        params.set("status", filters.status);
      }
      if (filters?.platform) {
        params.set("platform", filters.platform);
      }
      if (pageParam) {
        params.set("cursor", pageParam);
      }
      return get<PostsPage>(`/api/v1/posts?${params.toString()}`);
    },
    getNextPageParam: lastPage => lastPage.meta.nextCursor,
  });

  const pages = query.data?.pages ?? [];
  const posts = pages.flatMap(page => page.data);
  const total = pages[0]?.meta.total ?? 0;

  return {
    posts,
    total,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading || query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function usePost(id: string | null) {
  const query = useQuery({
    queryKey: ["post", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await get<{ data: PostDetail }>(`/api/v1/posts/${id}`);
      return response.data;
    },
  });

  return {
    post: query.data ?? null,
    isLoading: query.isLoading || query.isPending,
    isError: query.isError,
    error: query.error,
  };
}
