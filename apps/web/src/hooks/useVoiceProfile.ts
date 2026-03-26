import { useMutation, useQuery } from "@tanstack/react-query";
import { get, post } from "../lib/api";
import { invalidatePosts, invalidateVoiceProfiles, queryClient } from "../lib/queryClient";

export interface VoiceProfileSummary {
  id: string;
  profileType: "personal" | "company";
  version: number;
  lastCalibratedAt: string;
  patterns: {
    writingPersona: string;
    emojiUsage: string;
    avgSentenceLength: number;
    sampleCount: number;
    topicSignatures: string[];
  };
}

type VoiceProfilesResponse = {
  data: VoiceProfileSummary[];
};

type CalibrateVoicePayload = {
  posts: string[];
  profileType?: "personal" | "company";
};

type CalibrateVoiceResponse = {
  data: VoiceProfileSummary & {
    message: string;
  };
};

export function useVoiceProfile() {
  const query = useQuery({
    queryKey: ["voice-profiles"],
    queryFn: async () => {
      const response = await get<VoiceProfilesResponse>("/api/v1/voice-profiles");
      return response.data;
    },
  });

  const profiles = query.data ?? [];
  return {
    profiles,
    hasProfile: profiles.length > 0,
    isLoading: query.isLoading || query.isPending,
    isError: query.isError,
    error: query.error,
  };
}

export function useCalibrate() {
  const mutation = useMutation({
    mutationFn: (payload: CalibrateVoicePayload) =>
      post<CalibrateVoiceResponse>("/api/v1/voice-profiles/calibrate", payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateVoiceProfiles(queryClient),
        invalidatePosts(queryClient),
      ]);
    },
  });

  return {
    calibrate: mutation.mutateAsync,
    isCalibrating: mutation.isPending,
    error: mutation.error,
  };
}
