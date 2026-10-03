/**
 * lib/suno.ts
 *
 * High-level helpers used by the AI Studio UI.
 * All real API calls are delegated to sunoApi.ts which reads the kie.ai key
 * and base URL from Supabase system_settings (admin-integrated).
 */

import { generateMusic, getTaskInfo, generateLyricsApi } from './sunoApi';

export interface SunoGenerateOptions {
  prompt: string;
  tags?: string;
  title?: string;
  make_instrumental?: boolean;
  /** Public URL of a reference audio file (remix / cover / upload-extend) */
  audioUrl?: string;
  /** Persona/voice ID from a custom voice persona */
  personaId?: string;
  /** Advanced kie.ai options */
  vocalGender?: 'Male' | 'Female' | 'Any';
  weirdness?: number;
  styleInfluence?: number;
}

export interface SunoTrackResult {
  id: string;
  audioUrl: string;
  imageUrl: string;
  videoUrl: string;
  title: string;
  status: string;
}

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 60; // 5 min max wait

/**
 * generateSunoTrack
 *
 * Posts a generation job to kie.ai and polls until it finishes (SUCCESS).
 * Returns the first completed track from the task.
 */
export const generateSunoTrack = async (
  options: SunoGenerateOptions,
): Promise<SunoTrackResult> => {
  // 1. Submit the job — returns a taskId
  const taskId = await generateMusic(
    options.prompt,
    options.tags || '',
    options.title || '',
    options.audioUrl,
    options.vocalGender,
    options.weirdness,
    options.styleInfluence,
    options.personaId,
    !!options.personaId,
  );

  // 2. Poll until SUCCESS or FAILED
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const taskInfo = await getTaskInfo(taskId);
    const status = taskInfo.status?.toUpperCase?.() ?? '';

    if (status === 'SUCCESS' || status === 'COMPLETE') {
      const track = taskInfo.data?.[0];
      return {
        id: track?.id || taskId,
        audioUrl: track?.audioUrl || track?.audio_url || '',
        imageUrl: track?.imageUrl || track?.image_url || '',
        videoUrl: track?.videoUrl || track?.video_url || '',
        title: track?.title || options.title || 'Generated Track',
        status: 'SUCCESS',
      };
    }

    if (
      status === 'FAILED' ||
      status === 'ERROR' ||
      status === 'SENSITIVE_WORD_ERROR'
    ) {
      throw new Error(
        taskInfo.data?.[0]?.title ||
          'Track generation failed. Please try again.',
      );
    }
    // PENDING / PROCESSING → keep polling
  }

  throw new Error('Track generation timed out. Please try again later.');
};

/**
 * generateLyrics
 *
 * Calls kie.ai lyrics endpoint via sunoApi.ts (submit + poll).
 * Returns { text, title, tags }.
 */
export const generateLyrics = async (
  prompt: string,
): Promise<{ text: string; title: string; tags: string }> => {
  const result = await generateLyricsApi(prompt);
  // sunoApi returns normalised shape: { text, title, tags }
  const text: string =
    result?.text ||
    result?.data?.text ||
    result?.lyrics ||
    '';
  const title: string = result?.title || '';
  const tags: string = result?.tags || '';
  return { text, title, tags };
};
