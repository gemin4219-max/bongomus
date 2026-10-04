// @ts-nocheck
import { supabase } from './supabase';

export const getApiConfig = async (): Promise<{ provider: 'suno' | 'kie', apiKey: string, baseUrl: string }> => {
  const [providerRes, sunoKeyRes, kieKeyRes] = await Promise.all([
    supabase.from('system_settings').select('value').eq('key', 'ai_api_provider').single(),
    supabase.from('system_settings').select('value').eq('key', 'suno_api_key').single(),
    supabase.from('system_settings').select('value').eq('key', 'kie_api_key').single()
  ]);

  const provider = (providerRes.data?.value as 'suno' | 'kie') || 'suno';
  const apiKey = provider === 'kie' ? kieKeyRes.data?.value : sunoKeyRes.data?.value;

  if (!apiKey) {
    throw new Error(`Could not retrieve API key for ${provider.toUpperCase()}`);
  }

  const baseUrl = provider === 'kie' ? 'https://api.kie.ai/api/v1' : 'https://api.sunoapi.org/api/v1';

  return { provider, apiKey, baseUrl };
};

export type SunoTaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SENSITIVE_WORD_ERROR';

export interface SunoAudioData {
  id: string;
  title: string;
  audioUrl: string;
  imageUrl: string;
  videoUrl: string;
  duration: number;
  status: string;
  streamAudioUrl?: string;
  sourceAudioUrl?: string;
  prompt?: string;
  tags?: string;
  genre?: string;
  lyrics?: string;
  is_public?: boolean;
  description?: string;
  caption?: string;
  /** Suno generation taskId that produced this track (used when extending it). */
  taskId?: string;
}

export interface SunoTaskResponse {
  taskId: string;
  status: SunoTaskStatus;
  data?: SunoAudioData[];
  /** Suno's human-readable reason when a task fails. */
  errorMessage?: string;
}

/** V6-series models (recommended). V4/V5 series kept for backward compat only. */
export type SunoModel =
  | 'V6' | 'V6_WILD' | 'V6_MINI'
  | 'V5_5' | 'V5'
  | 'V4_5PLUS' | 'V4_5ALL' | 'V4_5' | 'V4';

/**
 * generateMusic
 * POST /api/v1/generate
 * Generates music with or without lyrics.
 * Supports both custom mode (full control) and non-custom mode (simple).
 */
export const generateMusic = async (
  prompt: string,
  tags: string,
  title: string,
  uploadUrl?: string,
  vocalGender?: 'Male' | 'Female' | 'Any',
  weirdness?: number,
  styleInfluence?: number,
  personaId?: string,
  isVoicePersona?: boolean,
  // New V6 parameters
  options?: {
    lyrics?: string;
    imageUrls?: string[];
    videoUrls?: string[];
    audioUrls?: string[];
    model?: SunoModel;
    customMode?: boolean;
    instrumental?: boolean;
    negativeTags?: string;
    variety?: 0 | 1 | 2 | 3 | 4;
    audioWeight?: number;
    duration?: number;
  }
): Promise<string> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();

  const customMode = options?.customMode ?? true;
  const instrumental = options?.instrumental ?? false;

  // Build vocal-gender-appended style string
  let finalStyle = tags;
  if (customMode && vocalGender && vocalGender !== 'Any') {
    finalStyle = finalStyle
      ? `${finalStyle}, ${vocalGender.toLowerCase()} vocals`
      : `${vocalGender.toLowerCase()} vocals`;
  }

  // V6 for everything — V5/V5_5 are discontinued on KIE (personas work on V6).
  const model: SunoModel = options?.model || 'V6';

  const payload: Record<string, any> = {
    customMode,
    instrumental,
    model,
    callBackUrl: 'https://httpbin.org/post',
    ...(title && customMode && { title }),
    ...(finalStyle && { style: finalStyle }),
    ...(options?.negativeTags && customMode && { negativeTags: options.negativeTags }),
  };

  // Lyrics / prompt — lyrics takes priority in custom mode
  if (options?.lyrics) {
    payload.lyrics = options.lyrics;
  }
  if (prompt) {
    payload.prompt = prompt;
  }

  // Non-custom mode media attachments
  if (!customMode) {
    if (options?.imageUrls?.length) payload.imageUrls = options.imageUrls;
    if (options?.videoUrls?.length) payload.videoUrls = options.videoUrls;
    if (options?.audioUrls?.length) payload.audioUrls = options.audioUrls;
  }

  // Custom-mode-only controls
  if (customMode) {
    if (vocalGender && vocalGender !== 'Any') payload.vocalGender = vocalGender === 'Male' ? 'm' : 'f';
    if (typeof weirdness === 'number') payload.weirdnessConstraint = weirdness;
    if (typeof styleInfluence === 'number') payload.styleWeight = styleInfluence;
    if (typeof options?.audioWeight === 'number') payload.audioWeight = options.audioWeight;
    if (typeof options?.variety === 'number') payload.variety = options.variety;
    if (typeof options?.duration === 'number') payload.duration = options.duration;
  }

  // Persona
  if (personaId) {
    payload.personaId = personaId;
    payload.personaModel = isVoicePersona ? 'voice_persona' : 'style_persona';
  }

  // Legacy upload-cover passthrough (provider-agnostic)
  if (uploadUrl) payload.uploadUrl = uploadUrl;

  const response = await fetch(`${baseUrl}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate music: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  // KIE returns HTTP 200 with an error code in the body (e.g. code 422 "Invalid personaId")
  if (typeof json.code === 'number' && json.code !== 200) {
    throw new Error(json.msg || `Generation rejected (code ${json.code})`);
  }
  const taskId =
    (typeof json.data === 'string' ? json.data : null) ??
    json.data?.taskId ??
    json.taskId;

  if (!taskId) {
    console.warn('API full response:', json);
    throw new Error(json.msg || 'No taskId returned.');
  }
  return taskId;
};


export const separateVocals = async (taskId: string, audioId: string): Promise<string> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  
  let endpoint = `${baseUrl}/separate-vocals`;
  let payload: any = { audioId };
  
  if (provider === 'kie') {
    endpoint = `${baseUrl}/vocal-removal/generate`;
    payload = {
      taskId,
      audioId,
      type: 'separate_vocal',
      callBackUrl: 'https://bongo-stream.com/callback'
    };
  }
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to separate vocals: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  
  let resultTaskId;
  if (typeof json.data === 'string') {
    resultTaskId = json.data;
  } else if (json.data && json.data.taskId) {
    resultTaskId = json.data.taskId;
  } else {
    resultTaskId = json.taskId;
  }
  
  if (!resultTaskId) {
     console.error("Suno API full response:", json);
     throw new Error(json.msg || "No taskId returned.");
  }
  return resultTaskId;
};

export const getTaskInfo = async (taskId: string): Promise<SunoTaskResponse> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  
  const response = await fetch(`${baseUrl}/generate/record-info?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch task info: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  
  if (json.code !== 200 && !json.data) {
    throw new Error(json.msg || "Failed to fetch task info");
  }

  const taskData = json.data;
  if (!taskData) {
    return { taskId, status: 'PENDING', data: [] };
  }

  const status = (taskData.status || taskData.successFlag || 'PENDING') as SunoTaskStatus;
  
  let mappedData: SunoAudioData[] = [];
  if (taskData.response) {
    const resp = taskData.response;
    if (resp.sunoData && resp.sunoData.length > 0) {
      mappedData = resp.sunoData.map((t: any) => ({ ...t, audioUrl: t.audioUrl || t.streamAudioUrl }));
    } else if (resp.vocalUrl || resp.instrumentalUrl) {
      if (resp.vocalUrl) mappedData.push({ id: `${taskData.taskId}-vocal`, title: 'Isolated Vocals', imageUrl: 'https://via.placeholder.com/150/8A2BE2/FFFFFF?text=Vocals', audioUrl: resp.vocalUrl, videoUrl: '' } as SunoAudioData);
      if (resp.instrumentalUrl) mappedData.push({ id: `${taskData.taskId}-inst`, title: 'Isolated Instrumental', imageUrl: 'https://via.placeholder.com/150/4169E1/FFFFFF?text=Instrumental', audioUrl: resp.instrumentalUrl, videoUrl: '' } as SunoAudioData);
    }
  }

  return {
    taskId: taskData.taskId || taskId,
    status,
    data: mappedData,
    errorMessage: taskData.errorMessage || undefined,
  };
};

export const getVocalRemovalInfo = async (taskId: string): Promise<SunoTaskResponse> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  
  let endpoint = `${baseUrl}/generate/record-info?taskId=${taskId}`;
  if (provider === 'kie') {
    endpoint = `${baseUrl}/vocal-removal/record-info?taskId=${taskId}`;
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch vocal removal info: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  
  if (json.code !== 200 || !json.data) {
    throw new Error(json.msg || "Failed to fetch vocal removal info");
  }

  const taskData = json.data;
  const status = taskData.successFlag || taskData.status || 'PENDING';
  
  let mappedData: SunoAudioData[] = [];
  if (provider === 'kie' && taskData.response) {
    if (taskData.response.vocalUrl) {
      mappedData.push({
        id: `${taskData.taskId}-vocal`,
        title: 'Isolated Vocals',
        imageUrl: 'https://via.placeholder.com/150/8A2BE2/FFFFFF?text=Vocals',
        audioUrl: taskData.response.vocalUrl,
        videoUrl: ''
      } as SunoAudioData);
    }
    if (taskData.response.instrumentalUrl) {
      mappedData.push({
        id: `${taskData.taskId}-inst`,
        title: 'Isolated Instrumental',
        imageUrl: 'https://via.placeholder.com/150/4169E1/FFFFFF?text=Instrumental',
        audioUrl: taskData.response.instrumentalUrl,
        videoUrl: ''
      } as SunoAudioData);
    }
    if (mappedData.length === 0) {
      mappedData = taskData.response.sunoData || [];
    }
  } else {
    mappedData = taskData.response?.sunoData || [];
  }

  return {
    taskId: taskData.taskId,
    status: status,
    data: mappedData,
  };
};

export const getApiCreditBalance = async (): Promise<number> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  
  // KIE exposes the account balance at /chat/credit (/generate/credit is Suno-only → 404 on KIE)
  const endpoint = provider === 'kie' ? `${baseUrl}/chat/credit` : `${baseUrl}/generate/credit`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch credit balance: ${response.status}`);
  }

  const json = await response.json();
  
  if (json.code !== 200) {
    throw new Error(json.msg || "Failed to fetch credit balance");
  }

  return json.data;
};

export const generatePersona = async (
  taskId: string,
  audioId: string,
  name: string,
  description: string,
  vocalStart?: number,
  vocalEnd?: number,
  style?: string
): Promise<string> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  
  const payload: any = {
    taskId,
    audioId,
    name,
    description,
  };
  
  if (vocalStart !== undefined) payload.vocalStart = vocalStart;
  if (vocalEnd !== undefined) payload.vocalEnd = vocalEnd;
  if (style !== undefined) payload.style = style;

  const response = await fetch(`${baseUrl}/generate/generate-persona`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate persona: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) {
    throw new Error(json.msg || "Failed to generate persona");
  }
  
  // Only accept a real persona id — a taskId saved here would later fail with "Invalid personaId".
  const personaId = json.data?.personaId || json.personaId || (typeof json.data === 'string' ? json.data : null);
  if (!personaId) throw new Error(json.msg || 'No persona ID returned. Please try again.');
  return personaId;
};



/**
 * generateVoiceTest
 *
 * Generates a short test track using the given voice persona so the user
 * can verify their AI voice sounds correct before using it in a real song.
 * Returns a taskId to poll with getTaskInfo.
 */
export const generateVoiceTest = async (personaId: string, personaName: string): Promise<string> => {
  const { apiKey, baseUrl } = await getApiConfig();

  const payload = {
    prompt: `[Verse]\nHabari yangu ni ya furaha\nSauti yangu ni ya nguvu\nBongo Box inaimba\nMusiki wetu unasikika\n\n[Chorus]\nSauti yangu, sauti yangu\nInaimbwa kwa furaha\nBongo Box, Bongo Box\nMusiki wa Tanzania`,
    title: `Voice Test — ${personaName}`,
    style: 'Bongo Flava, Afropop',
    customMode: true,
    instrumental: false,
    model: 'V6',
    personaId,
    personaModel: 'voice_persona',
    callBackUrl: 'https://httpbin.org/post',
  };

  const response = await fetch(`${baseUrl}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voice test generation failed: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || 'Failed to start voice test');

  const taskId = json.data?.taskId || json.taskId || (typeof json.data === 'string' ? json.data : null);
  if (!taskId) throw new Error('No taskId returned for voice test');
  return taskId;
};


// ─────────────────────────────────────────────────────────────────────────────
// MUSIC EXTENSION & UPLOAD ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/** Shared optional controls for Extend / Upload-Cover / Upload-Extend. */
interface SharedGenerationControls {
  lyrics?: string;
  prompt?: string;
  style?: string;
  title?: string;
  instrumental?: boolean;
  vocalGender?: 'm' | 'f';
  negativeTags?: string;
  styleWeight?: number;         // 0–1, two decimals
  weirdnessConstraint?: number; // 0–1, two decimals
  audioWeight?: number;         // 0–1, two decimals
  variety?: 0 | 1 | 2 | 3 | 4;
  personaId?: string;
  personaModel?: 'style_persona' | 'voice_persona';
  callBackUrl?: string;
}

export interface ExtendMusicParams extends SharedGenerationControls {
  /** audioId of the track to extend. Required. */
  audioId: string;
  /** model version. Required. Default: V6. */
  model?: SunoModel;
  /** taskId of the original generation task. Optional. */
  taskId?: string;
  /** Seconds from which to start extending (0 < continueAt < source duration). */
  continueAt?: number;
}

export interface UploadCoverParams extends SharedGenerationControls {
  /** Public URL of the source audio to cover. Required. Max 8 minutes. */
  uploadUrl: string;
  /** model version. Required. Default: V6. */
  model?: SunoModel;
  /** Audio duration override in seconds (10–360). V5_5/V6/V6_WILD/V6_MINI only. */
  duration?: number;
}

export interface UploadExtendParams extends SharedGenerationControls {
  /** Public URL of the source audio to extend. Required. Max 8 minutes. */
  uploadUrl: string;
  /** model version. Required. Default: V6. */
  model?: SunoModel;
  /** Seconds from which to start extending (0 < continueAt < source duration). */
  continueAt?: number;
}

/**
 * extendMusic
 * POST /api/v1/generate/extend
 * Extends an existing Suno track using its audioId.
 * Always runs in custom mode. Lyrics, title, style are optional.
 * Returns a taskId — poll with getTaskInfo.
 */
export const extendMusic = async (params: ExtendMusicParams): Promise<string> => {
  const { apiKey, baseUrl } = await getApiConfig();

  const body: Record<string, any> = {
    audioId: params.audioId,
    model: params.model ?? 'V6',
    callBackUrl: params.callBackUrl ?? 'https://httpbin.org/post',
    instrumental: params.instrumental ?? false,
  };

  // Optional text
  if (params.lyrics) body.lyrics = params.lyrics;
  if (params.prompt) body.prompt = params.prompt;
  if (params.style) body.style = params.style;
  if (params.title) body.title = params.title;
  if (params.negativeTags) body.negativeTags = params.negativeTags;
  if (params.taskId) body.taskId = params.taskId;
  if (typeof params.continueAt === 'number') body.continueAt = params.continueAt;

  // Vocal controls (only when not instrumental)
  if (!params.instrumental) {
    if (params.vocalGender) body.vocalGender = params.vocalGender;
  }

  // Fine-grained controls
  if (typeof params.styleWeight === 'number') body.styleWeight = params.styleWeight;
  if (typeof params.weirdnessConstraint === 'number') body.weirdnessConstraint = params.weirdnessConstraint;
  if (typeof params.audioWeight === 'number') body.audioWeight = params.audioWeight;
  if (typeof params.variety === 'number') body.variety = params.variety;

  // Persona
  if (params.personaId) {
    body.personaId = params.personaId;
    body.personaModel = params.personaModel ?? 'style_persona';
  }

  const response = await fetch(`${baseUrl}/generate/extend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to extend music: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || 'Failed to extend music');
  const taskId = json.data?.taskId || json.taskId;
  if (!taskId) throw new Error('No taskId returned for music extension');
  return taskId;
};

/**
 * uploadAndCoverAudio
 * POST /api/v1/generate/upload-cover
 * Transforms an uploaded audio track into a new style while retaining its
 * core melody. Provide a public uploadUrl (max 8 minutes).
 * Returns a taskId — poll with getTaskInfo.
 */
export const uploadAndCoverAudio = async (params: UploadCoverParams): Promise<string> => {
  const { apiKey, baseUrl } = await getApiConfig();

  const body: Record<string, any> = {
    uploadUrl: params.uploadUrl,
    model: params.model ?? 'V6',
    callBackUrl: params.callBackUrl ?? 'https://httpbin.org/post',
    instrumental: params.instrumental ?? false,
  };

  if (params.lyrics) body.lyrics = params.lyrics;
  if (params.prompt) body.prompt = params.prompt;
  if (params.style) body.style = params.style;
  if (params.title) body.title = params.title;
  if (params.negativeTags) body.negativeTags = params.negativeTags;
  if (params.vocalGender && !params.instrumental) body.vocalGender = params.vocalGender;
  if (typeof params.styleWeight === 'number') body.styleWeight = params.styleWeight;
  if (typeof params.weirdnessConstraint === 'number') body.weirdnessConstraint = params.weirdnessConstraint;
  if (typeof params.audioWeight === 'number') body.audioWeight = params.audioWeight;
  if (typeof params.variety === 'number') body.variety = params.variety;
  if (typeof params.duration === 'number') body.duration = params.duration;
  if (params.personaId) {
    body.personaId = params.personaId;
    body.personaModel = params.personaModel ?? 'style_persona';
  }

  const response = await fetch(`${baseUrl}/generate/upload-cover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload-cover audio: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || 'Failed to upload-cover audio');
  const taskId = json.data?.taskId || json.taskId;
  if (!taskId) throw new Error('No taskId returned for upload-cover');
  return taskId;
};

/**
 * uploadAndExtendAudio
 * POST /api/v1/generate/upload-extend
 * Extends an uploaded audio track while preserving its original style.
 * Provide a public uploadUrl (max 8 minutes).
 * Returns a taskId — poll with getTaskInfo.
 */
export const uploadAndExtendAudio = async (params: UploadExtendParams): Promise<string> => {
  const { apiKey, baseUrl } = await getApiConfig();

  const body: Record<string, any> = {
    uploadUrl: params.uploadUrl,
    model: params.model ?? 'V6',
    callBackUrl: params.callBackUrl ?? 'https://httpbin.org/post',
    instrumental: params.instrumental ?? false,
  };

  if (params.lyrics) body.lyrics = params.lyrics;
  if (params.prompt) body.prompt = params.prompt;
  if (params.style) body.style = params.style;
  if (params.title) body.title = params.title;
  if (params.vocalGender && !params.instrumental) body.vocalGender = params.vocalGender;
  if (typeof params.continueAt === 'number') body.continueAt = params.continueAt;
  if (typeof params.styleWeight === 'number') body.styleWeight = params.styleWeight;
  if (typeof params.weirdnessConstraint === 'number') body.weirdnessConstraint = params.weirdnessConstraint;
  if (typeof params.audioWeight === 'number') body.audioWeight = params.audioWeight;
  if (typeof params.variety === 'number') body.variety = params.variety;
  if (params.personaId) {
    body.personaId = params.personaId;
    body.personaModel = params.personaModel ?? 'style_persona';
  }

  const response = await fetch(`${baseUrl}/generate/upload-extend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload-extend audio: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || 'Failed to upload-extend audio');
  const taskId = json.data?.taskId || json.taskId;
  if (!taskId) throw new Error('No taskId returned for upload-extend');
  return taskId;
};


// ─────────────────────────────────────────────────────────────────────────────

/** All status values returned by the Suno Voice API endpoints. */
export type VoiceTaskStatus =
  | 'wait_processing'
  | 'processing_validate'
  | 'processing_validate_fail'
  | 'wait_validating'
  | 'success'
  | 'fail';

export interface VoiceValidationData {
  taskId: string;
  validateInfo: string;
  status: VoiceTaskStatus;
  errorCode: number;
  errorMessage: string;
}

export interface VoiceRecordData {
  taskId: string;
  voiceId: string;
  status: VoiceTaskStatus;
  errorCode: number;
  errorMessage: string;
}

/**
 * generateVoiceValidation
 * POST /api/v1/voice/validate
 * Submits source audio and kicks off validation-phrase generation.
 * Returns the taskId to poll with getVoiceValidationInfo.
 */
export const generateVoiceValidation = async (
  voiceUrl: string,
  vocalStartS: number,
  vocalEndS: number,
  language: string = 'en',
  callBackUrl?: string,
): Promise<string> => {
  const { apiKey, baseUrl } = await getApiConfig();
  const response = await fetch(`${baseUrl}/voice/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ voiceUrl, vocalStartS, vocalEndS, language, callBackUrl }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate validation: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || 'Failed to start voice validation');
  const taskId = json.data?.taskId || json.taskId;
  if (!taskId) throw new Error('No taskId returned for voice validation');
  return taskId;
};

/**
 * getVoiceValidationInfo
 * GET /api/v1/voice/validate-info?taskId=
 * Poll this until status is 'wait_validating' (phrase ready) or a failure.
 * Returns null on transient errors so the polling loop can retry.
 */
export const getVoiceValidationInfo = async (taskId: string): Promise<VoiceValidationData | null> => {
  try {
    const { apiKey, baseUrl } = await getApiConfig();
    const response = await fetch(`${baseUrl}/voice/validate-info?taskId=${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) return null; // transient — let caller retry
    const json = await response.json();
    if (json.code !== 200) return null; // not ready yet — let caller retry
    return (json.data ?? null) as VoiceValidationData | null;
  } catch {
    return null; // network blip — let polling loop retry
  }
};

/**
 * regenerateVoiceValidation
 * POST /api/v1/voice/regenerate
 * Regenerate the validation phrase for an existing Suno Voice task.
 * Use when the previous phrase failed, expired, or the user needs a new one.
 * Returns a new taskId — poll with getVoiceValidationInfo.
 *
 * NOTE: The Suno API schema uses the field name `calBackUrl` (single-l) for
 * this endpoint — different from the double-l `callBackUrl` used elsewhere.
 */
export const regenerateVoiceValidation = async (
  taskId: string,
  calBackUrl?: string,
): Promise<string> => {
  const { apiKey, baseUrl } = await getApiConfig();
  const body: Record<string, string> = { taskId };
  if (calBackUrl) body.calBackUrl = calBackUrl; // intentional single-l per API spec

  const response = await fetch(`${baseUrl}/voice/regenerate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to regenerate validation phrase: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || 'Failed to regenerate validation phrase');
  const newTaskId = json.data?.taskId || json.taskId;
  if (!newTaskId) throw new Error('No taskId returned for phrase regeneration');
  return newTaskId;
};

/**
 * createCustomVoice
 * POST /api/v1/voice/generate
 * Submit the user's verification audio to create the final custom voice.
 * The verifyUrl MUST be the user recording the exact validateInfo phrase —
 * singing is recommended for best results.
 * Returns a taskId — poll with getCustomVoiceRecord.
 */
export const createCustomVoice = async (
  taskId: string,
  verifyUrl: string,
  voiceName?: string,
  description?: string,
  style?: string,
  singerSkillLevel: 'beginner' | 'intermediate' | 'advanced' | 'professional' = 'beginner',
  callBackUrl?: string,
): Promise<string> => {
  const { apiKey, baseUrl } = await getApiConfig();
  const response = await fetch(`${baseUrl}/voice/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      taskId,
      verifyUrl,
      ...(voiceName && { voiceName }),
      ...(description && { description }),
      ...(style && { style }),
      singerSkillLevel,
      ...(callBackUrl && { callBackUrl }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create custom voice: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || 'Failed to create custom voice');
  const newTaskId = json.data?.taskId || json.taskId;
  if (!newTaskId) throw new Error('No taskId returned for custom voice creation');
  return newTaskId;
};

/**
 * getCustomVoiceRecord
 * GET /api/v1/voice/record-info?taskId=
 * Poll this until status is 'success' (voiceId ready) or a failure.
 * Returns null on transient errors so the polling loop can retry.
 */
export const getCustomVoiceRecord = async (taskId: string): Promise<VoiceRecordData | null> => {
  try {
    const { apiKey, baseUrl } = await getApiConfig();
    const response = await fetch(`${baseUrl}/voice/record-info?taskId=${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) return null; // transient — let caller retry
    const json = await response.json();
    if (json.code !== 200) return null; // not ready yet — let caller retry
    return (json.data ?? null) as VoiceRecordData | null;
  } catch {
    return null; // network blip — let polling loop retry
  }
};

/**
 * checkVoiceAvailability
 * POST /api/v1/voice/check-voice
 * Confirm whether a generated custom voice is ready for use in generation APIs.
 * Call this after getCustomVoiceRecord returns status === 'success' before
 * starting any downstream music generation tasks that depend on the voice.
 * Returns true if the voice is available, false otherwise.
 */
export const checkVoiceAvailability = async (taskId: string): Promise<boolean> => {
  const { apiKey, baseUrl } = await getApiConfig();

  const response = await fetch(`${baseUrl}/voice/check-voice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ task_id: taskId }), // NOTE: snake_case per API spec
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to check voice availability: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || 'Failed to check voice availability');
  return json.data?.isAvailable === true;
};



// SOUNDS
export const generateSounds = async (
  prompt: string,
  loop?: boolean,
  tempo?: string,
  key?: string
): Promise<string> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  const payload: any = { prompt };
  if (loop) payload.loop = loop;
  if (tempo) payload.tempo = tempo;
  if (key) payload.key = key;
  
  const response = await fetch(`${baseUrl}/generate/sounds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate sound: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || "Failed to generate sound");
  
  let taskId = json.data?.taskId || json.taskId || (typeof json.data === 'string' ? json.data : undefined);
  if (!taskId) throw new Error("No taskId returned");
  return taskId;
};

// MUSIC VIDEO
export const createMusicVideo = async (
  taskId: string,
  audioId: string,
  author?: string,
  domainName?: string
): Promise<string> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  const payload: any = { 
    taskId, 
    audioId,
    callBackUrl: 'https://bongo-stream.vercel.app/api/suno-callback' // Required by API, though we poll manually
  };
  if (author) payload.author = author;
  if (domainName) payload.domainName = domainName;
  
  const response = await fetch(`${baseUrl}/mp4/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate video: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || "Failed to generate video");
  
  let returnedTaskId = json.data?.taskId || json.taskId || (typeof json.data === 'string' ? json.data : undefined);
  if (!returnedTaskId) throw new Error("No taskId returned for video");
  return returnedTaskId;
};

export const getVideoRecordInfo = async (taskId: string): Promise<any> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  const response = await fetch(`${baseUrl}/mp4/record-info?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get video info: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || "Failed to get video info");
  
  return json.data;
};

// EXTEND AUDIO
/**
 * extendAudio — convenience wrapper around extendMusic (POST /generate/extend).
 *
 * Fixes vs. the old implementation:
 *  - model must match the source track (we generate with V6), not V4_5ALL
 *  - callBackUrl is REQUIRED by the API
 *  - the field is `continueAt` (camelCase); it must be > 0 and < source duration
 *  - instrumental is sent explicitly instead of just blanking the lyrics
 */
export const extendAudio = async (
  audioId: string,
  lyrics: string,
  continueAt?: string | number,
  options?: {
    instrumental?: boolean;
    taskId?: string;
    model?: SunoModel;
    style?: string;
    title?: string;
    sourceDuration?: number;
    personaId?: string;
    personaModel?: 'style_persona' | 'voice_persona';
  },
): Promise<string> => {
  let at: number | undefined =
    continueAt === undefined || continueAt === '' ? undefined : Number(continueAt);
  if (at !== undefined && (!Number.isFinite(at) || at <= 0)) at = undefined;
  const dur = options?.sourceDuration;
  if (at !== undefined && dur && dur > 1 && at >= dur) at = Math.floor(dur - 1);

  const instrumental = options?.instrumental ?? false;

  return extendMusic({
    audioId,
    model: options?.model ?? 'V6',
    instrumental,
    ...(lyrics && !instrumental ? { lyrics } : {}),
    ...(options?.taskId ? { taskId: options.taskId } : {}),
    ...(options?.style ? { style: options.style } : {}),
    ...(options?.title ? { title: options.title.slice(0, 100) } : {}),
    ...(at !== undefined ? { continueAt: Math.floor(at) } : {}),
    ...(options?.personaId
      ? { personaId: options.personaId, personaModel: options.personaModel ?? 'voice_persona' }
      : {}),
  });
};

/**
 * generateLyricsApi
 *
 * Calls kie.ai /generate/lyrics endpoint (async — submit then poll).
 * Returns the completed lyrics data object with a `text` field.
 */
export const generateLyricsApi = async (prompt: string): Promise<any> => {
  const { apiKey, baseUrl } = await getApiConfig();

  // Step 1: Submit the lyrics generation request
  const submitRes = await fetch(`${baseUrl}/generate/lyrics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!submitRes.ok) {
    const errorText = await submitRes.text();
    throw new Error(`Lyrics generation error: ${submitRes.status} ${errorText}`);
  }

  const submitJson = await submitRes.json();
  if (submitJson.code !== 200) throw new Error(submitJson.msg || 'Failed to start lyrics generation');

  // Extract taskId from response
  const taskId =
    submitJson.data?.taskId ||
    submitJson.taskId ||
    (typeof submitJson.data === 'string' ? submitJson.data : null);

  // If the API returned lyrics directly (no taskId), return immediately
  if (!taskId) {
    const directText =
      submitJson.data?.text ||
      submitJson.data?.lyrics ||
      submitJson.text ||
      submitJson.lyrics;
    if (directText) return { text: directText };
    throw new Error('No taskId returned from lyrics generation');
  }

  // Step 2: Poll GET /generate/lyrics?taskId= until SUCCESS
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));

    const pollRes = await fetch(`${baseUrl}/generate/lyrics?taskId=${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) continue; // transient error, keep polling

    const pollJson = await pollRes.json();
    if (pollJson.code !== 200) continue;

    const data = pollJson.data;
    const status = (data?.status || data?.successFlag || '').toUpperCase();

    if (status === 'SUCCESS' || status === 'COMPLETE') {
      // Return normalised shape that suno.ts generateLyrics can read
      return {
        text: data?.text || data?.lyrics || data?.response?.text || '',
        title: data?.title || '',
        tags: data?.tags || data?.style || '',
      };
    }

    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(data?.failReason || 'Lyrics generation failed on the server.');
    }
    // Still PROCESSING — keep polling
  }

  throw new Error('Lyrics generation timed out. Please try again.');
};


/**
 * generateCoverImage
 *
 * Prompt-based AI cover art. Suno/kie have no prompt-driven image endpoint
 * (the old `/generate/image` call 404'd), so we use Pollinations (Flux),
 * which renders a square image directly from a URL.
 *
 * The free tier allows ~1 image per 15 s per device (it answers 402/429 when
 * hit faster), so images are generated one at a time with automatic retry.
 * Each image is downloaded to a local cache file; `onImage` fires as soon as
 * each one is ready so the UI can show it immediately.
 */
export interface CoverImage {
  /** Local file:// uri (fast to display, used for uploading on save). */
  uri: string;
  /** Original remote URL (fallback if uploading fails). */
  remoteUrl: string;
}

const COVER_TIMEOUT_MS = 90_000;
const COVER_RATE_WAIT_MS = 16_000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let lastCoverRequestAt = 0;

const downloadCover = async (remoteUrl: string): Promise<CoverImage> => {
  const FileSystem = require('expo-file-system/legacy');
  const target = `${FileSystem.cacheDirectory}cover_${Date.now()}_${Math.floor(Math.random() * 1e6)}.jpg`;

  for (let attempt = 0; attempt < 4; attempt++) {
    // Respect the free-tier spacing between requests.
    const since = Date.now() - lastCoverRequestAt;
    if (lastCoverRequestAt && since < COVER_RATE_WAIT_MS) await sleep(COVER_RATE_WAIT_MS - since);
    lastCoverRequestAt = Date.now();

    const result: any = await Promise.race([
      FileSystem.downloadAsync(remoteUrl, target),
      sleep(COVER_TIMEOUT_MS).then(() => { throw new Error('The image server took too long to respond.'); }),
    ]);

    const type = String(result?.headers?.['Content-Type'] || result?.headers?.['content-type'] || '');
    if (result?.status === 200 && (!type || type.startsWith('image/'))) {
      return { uri: result.uri, remoteUrl };
    }
    if (result?.status === 402 || result?.status === 429 || result?.status >= 500) {
      continue; // rate-limited / busy → wait and retry
    }
    throw new Error(`Image server returned ${result?.status}.`);
  }
  throw new Error('The image server is busy right now.');
};

export const generateCoverImage = async (
  prompt: string,
  count: number = 2,
  onImage?: (image: CoverImage, index: number) => void,
): Promise<CoverImage[]> => {
  const cleanPrompt = prompt.replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!cleanPrompt) throw new Error('Please describe the cover you want.');

  const fullPrompt = `${cleanPrompt}, square album cover artwork, highly detailed, no text, no watermark`;
  const encoded = encodeURIComponent(fullPrompt);

  const images: CoverImage[] = [];
  let lastError: any = null;

  for (let i = 0; i < count; i++) {
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;
    try {
      const img = await downloadCover(url);
      images.push(img);
      onImage?.(img, images.length - 1);
    } catch (e) {
      lastError = e;
      if (images.length > 0) break; // keep what we already have
    }
  }

  if (images.length === 0) {
    throw new Error(`Could not generate cover art. ${lastError?.message || 'Unknown error.'} Please try again.`);
  }
  return images;
};


// ─────────────────────────────────────────────────────────────────────────────
// HIGH-LEVEL WRAPPERS  (previously lived in lib/suno.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** Normalised result returned by generateSunoTrack after polling completes. */
export interface SunoTrackResult {
  id: string;
  audioUrl: string;
  imageUrl: string;
  videoUrl: string;
  title: string;
  lyrics?: string;
  tags?: string;
  genre?: string;
  duration?: number;
  status: string;
  /** All versions Suno produced (normally 2). */
  versions?: SunoTrackResult[];
  /** Suno generation task id (needed for timestamped lyrics). */
  taskId?: string;
}

/**
 * generateSunoTrack
 *
 * High-level helper used by ai-studio.tsx.
 * Submits a music generation task via generateMusic, then polls getTaskInfo
 * until the task reaches SUCCESS (or throws after ~3 minutes).
 */
export const generateSunoTrack = async (params: {
  prompt: string;
  tags?: string;
  title?: string;
  make_instrumental?: boolean;
  /** PUBLIC url of an uploaded audio file → Upload & Cover (keeps the melody). */
  audioUrl?: string;
  /** PUBLIC url of an uploaded video (mp4/mov/webm, ≤241s, ≤100MB) → Suno uses its soundtrack as reference. */
  videoUrl?: string;
  /** Lyrics attachment (used with videoUrl, where `prompt` is the song idea). */
  lyrics?: string;
  personaId?: string;
  /** true when personaId is a Suno Voice voiceId (user's cloned voice). */
  isVoicePersona?: boolean;
}): Promise<SunoTrackResult> => {
  /** Submit the job. `asVoice` decides personaModel (voice_persona vs style_persona). */
  const submit = async (asVoice: boolean): Promise<string> => {
    const personaModel: 'voice_persona' | 'style_persona' =
      asVoice ? 'voice_persona' : 'style_persona';

    if (params.videoUrl) {
      // Video reference — only supported in NON-custom mode (videoUrls).
      // `prompt` is the core idea (max 3000 chars), `lyrics` is an attachment.
      return generateMusic(
        (params.prompt || '').slice(0, 3000),
        params.tags ?? '',
        '',
        undefined,
        undefined,
        undefined,
        undefined,
        params.personaId,
        !!params.personaId && asVoice,
        {
          customMode: false,
          instrumental: params.make_instrumental ?? false,
          videoUrls: [params.videoUrl],
          ...(params.lyrics ? { lyrics: params.lyrics.slice(0, 5000) } : {}),
        },
      );
    }
    if (params.audioUrl) {
      // Uploaded audio — Upload & Cover: new style, original melody kept.
      return uploadAndCoverAudio({
        uploadUrl: params.audioUrl,
        model: 'V6',
        instrumental: params.make_instrumental ?? false,
        ...(params.prompt && !params.make_instrumental ? { lyrics: params.prompt.slice(0, 5000) } : {}),
        ...(params.tags ? { style: params.tags.slice(0, 1000) } : {}),
        ...(params.title ? { title: params.title.slice(0, 80) } : {}),
        ...(params.personaId ? { personaId: params.personaId, personaModel } : {}),
      });
    }
    return generateMusic(
      params.prompt,
      params.tags ?? '',
      params.title ?? 'Untitled',
      undefined,
      undefined,
      undefined,
      undefined,
      params.personaId,
      !!params.personaId && asVoice,
      { instrumental: params.make_instrumental ?? false },
    );
  };

  // Suno rejects (HTTP 422, no job created, no credits used) a persona whose
  // personaModel doesn't match how it was made — e.g. older saved voices with
  // no `type`. Retry once with the other model before giving up.
  const isPersonaError = (e: any) => /invalid personaid|persona does not exist/i.test(e?.message || '');
  let taskId: string;
  try {
    taskId = await submit(!!params.isVoicePersona);
  } catch (e: any) {
    if (!params.personaId || !isPersonaError(e)) throw e;
    try {
      taskId = await submit(!params.isVoicePersona);
    } catch (e2: any) {
      if (!isPersonaError(e2)) throw e2;
      console.warn('[persona] rejected by API:', params.personaId, e2?.message);
      throw new Error(
        "The voice you picked can't be used right now.\n\n" +
          "The music API doesn't recognise this voice for the current API key. " +
          "Please delete this voice and create it again.\n\n" +
          `API: ${e2?.message || 'Invalid personaId'}`,
      );
    }
  }

  // Poll until SUCCESS or FAILED (max ~5 min — covers / video references take longer)
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const info = await getTaskInfo(taskId);
    if (!info) continue;

    const status = (info.status || '').toUpperCase();

    if (status === 'SUCCESS') {
      const rawList: any[] = Array.isArray(info.data) ? info.data : info.data ? [info.data] : [];
      if (rawList.length === 0) throw new Error('Generation succeeded but no track data was returned.');
      // Suno generates TWO versions per request — keep all of them
      const versions: SunoTrackResult[] = rawList.map((track: any, idx: number) => ({
        id: track.id ?? `${taskId}-${idx}`,
        audioUrl: track.audioUrl ?? '',
        imageUrl: track.imageUrl ?? '',
        videoUrl: track.videoUrl ?? '',
        title: track.title ?? params.title ?? 'Untitled',
        lyrics: track.lyrics,
        tags: track.tags,
        genre: track.genre,
        duration: track.duration,
        status: 'SUCCESS',
        taskId,
      }));
      return { ...versions[0], versions, taskId };
    }

    if (/FAIL|ERROR|EXCEPTION/.test(status)) {
      if (status === 'SENSITIVE_WORD_ERROR') {
        throw new Error('Your lyrics or prompt contain words Suno does not allow. Please edit and try again.');
      }
      const reason = info.errorMessage ? `\n\nReason: ${info.errorMessage}` : '';
      const voiceHint = params.personaId && params.isVoicePersona
        ? '\n\nThis song used your custom voice. Try again in a minute (new voices can take a moment to become available), or re-create the voice with a longer, clearer singing sample.'
        : '';
      throw new Error(`Music generation failed (${status}).${reason}${voiceHint}`);
    }
    // Still PENDING / PROCESSING — keep polling
  }

  throw new Error('Music generation timed out. Please try again.');
};

/**
 * generateLyrics
 *
 * Alias for generateLyricsApi kept for backward compatibility with
 * ai-studio.tsx which imported from the now-removed lib/suno module.
 */
export const generateLyrics = generateLyricsApi;

// ─────────────────────────────────────────────────────────────────────────────
// SYNCED (TIMESTAMPED) LYRICS
// ─────────────────────────────────────────────────────────────────────────────

export interface SunoAlignedWord {
  word: string;
  success: boolean;
  startS: number;
  endS: number;
  palign?: number;
}

/**
 * getTimestampedLyrics
 * POST /api/v1/generate/get-timestamped-lyrics
 * Returns word-level timings (seconds) for a generated song.
 * Instrumental tracks return no words.
 */
export const getTimestampedLyrics = async (
  taskId: string,
  audioId: string,
): Promise<SunoAlignedWord[]> => {
  const { apiKey, baseUrl } = await getApiConfig();
  const response = await fetch(`${baseUrl}/generate/get-timestamped-lyrics`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ taskId, audioId }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json || json.code !== 200) {
    throw new Error(json?.msg || `Timestamped lyrics failed (HTTP ${response.status})`);
  }
  return Array.isArray(json.data?.alignedWords) ? json.data.alignedWords : [];
};

const formatLrcTime = (sec: number): string => {
  const safe = Math.max(0, sec || 0);
  const m = Math.floor(safe / 60);
  const s = safe - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
};

/**
 * Converts Suno aligned words into LRC text: "[mm:ss.xx] line".
 * Suno embeds line breaks and section tags ("[Verse]", "[Chorus]") inside the words.
 */
export const alignedWordsToLrc = (words: SunoAlignedWord[]): string => {
  const lines: { time: number; text: string }[] = [];
  let current = '';
  let currentStart: number | null = null;

  const flush = () => {
    const text = current.replace(/\s+/g, ' ').trim();
    if (text && currentStart !== null) lines.push({ time: currentStart, text });
    current = '';
    currentStart = null;
  };

  for (const w of words) {
    const parts = (w.word || '').split('\n');
    parts.forEach((rawPart, idx) => {
      if (idx > 0) flush(); // a newline inside the word ends the previous line
      const part = rawPart.replace(/\[[^\]]*\]/g, ''); // drop [Verse]/[Chorus] tags
      if (part.trim()) {
        if (currentStart === null) currentStart = w.startS;
        current += part;
      }
    });
  }
  flush();

  return lines.map((l) => `[${formatLrcTime(l.time)}]${l.text}`).join('\n');
};

/**
 * Fetches synced lyrics as LRC, retrying briefly because alignment can lag
 * a few seconds behind generation SUCCESS. Returns null if unavailable.
 */
export const fetchSyncedLyricsLrc = async (
  taskId: string,
  audioId: string,
  attempts = 4,
): Promise<string | null> => {
  for (let i = 0; i < attempts; i++) {
    try {
      const words = await getTimestampedLyrics(taskId, audioId);
      if (words.length > 0) {
        const lrc = alignedWordsToLrc(words);
        if (lrc) return lrc;
      }
    } catch (e) {
      console.log('Timestamped lyrics attempt failed:', e);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  return null;
};
