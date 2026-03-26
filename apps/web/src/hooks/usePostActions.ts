import { useMutation } from "@tanstack/react-query";
import { ApiError, patch, post } from "../lib/api";
import { queryClient } from "../lib/queryClient";
import type { PostDetail } from "./usePosts";

type ApproveResponse = {
  data?: {
    id: string;
    scheduled_at: string | null;
  };
};

type ApprovePayload = {
  id: string;
  status?: "draft" | "queued" | "approved" | "posted" | "failed" | "discarded";
};

type PublishNowPayload = {
  id: string;
  status?: "draft" | "queued" | "approved" | "posted" | "failed" | "discarded";
};

type DiscardResponse = {
  data?: {
    id: string;
    status: "discarded";
  };
};

type EditPayload = {
  id: string;
  content: string;
};

type DeleteResponse = {
  data?: {
    id: string;
  };
};

export function useApprovePost() {
  const mutation = useMutation({
    mutationFn: ({ id, status }: ApprovePayload) => {
      if (status && status !== "queued") {
        throw new Error("This post needs to be in queue first");
      }
      return post<ApproveResponse>(`/api/v1/posts/${id}/approve`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["posts"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["posts-count"] }),
      ]);
    },
  });

  return {
    approve: mutation.mutateAsync,
    isApproving: mutation.isPending,
    error: mutation.error,
  };
}

export function useDiscardPost() {
  const mutation = useMutation({
    mutationFn: (id: string) => post<DiscardResponse>(`/api/v1/posts/${id}/discard`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["posts"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["posts-count"] }),
      ]);
    },
  });

  return {
    discard: mutation.mutateAsync,
    isDiscarding: mutation.isPending,
    error: mutation.error,
  };
}

export function useEditPost() {
  const mutation = useMutation({
    mutationFn: ({ id, content }: EditPayload) => patch<PostDetail>(`/api/v1/posts/${id}`, { content }),
    onSuccess: async (_updatedPost, payload) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["posts"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["posts", payload.id] }),
        queryClient.invalidateQueries({ queryKey: ["post", payload.id] }),
      ]);
    },
  });

  return {
    edit: mutation.mutateAsync,
    isEditing: mutation.isPending,
    error: mutation.error,
  };
}

export function useDeletePost() {
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await post<DeleteResponse>(`/api/v1/posts/${id}/delete`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 410) {
          throw new Error("Undo window expired");
        }
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["posts"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["posts-count"] }),
      ]);
    },
  });

  return {
    deletePost: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

export function usePublishNowPost() {
  const mutation = useMutation({
    mutationFn: ({ id, status }: PublishNowPayload) => {
      if (status && !["draft", "queued", "approved"].includes(status)) {
        throw new Error("This post cannot be published now");
      }
      return post<ApproveResponse>(`/api/v1/posts/${id}/publish-now`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["posts"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["posts-count"] }),
      ]);
    },
  });

  return {
    publishNow: mutation.mutateAsync,
    isPublishingNow: mutation.isPending,
    error: mutation.error,
  };
}
