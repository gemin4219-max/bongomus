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
}

export interface SunoTaskResponse {
  taskId: string;
  status: SunoTaskStatus;
  data?: SunoAudioData[];
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

  // Determine model — default to V6 for all new integrations
  const model: SunoModel = options?.model ||
    (personaId ? (isVoicePersona ? 'V6' : 'V6') : 'V6');

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
  const taskId =
    (typeof json.data === 'string' ? json.data : null) ??
    json.data?.taskId ??
    json.taskId;

  if (!taskId) {
    console.error('API full response:', json);
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
      });
    }
    if (taskData.response.instrumentalUrl) {
      mappedData.push({
        id: `${taskData.taskId}-inst`,
        title: 'Isolated Instrumental',
        imageUrl: 'https://via.placeholder.com/150/4169E1/FFFFFF?text=Instrumental',
        audioUrl: taskData.response.instrumentalUrl,
        videoUrl: ''
      });
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
  
  const response = await fetch(`${baseUrl}/generate/credit`, {
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
  
  return json.data?.personaId || json.personaId || (json.data && json.data.taskId) || json.taskId || json.data;
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
    model: 'V5_5',
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
export const extendAudio = async (
  audioId: string,
  prompt: string,
  continueAt?: string | number
): Promise<string> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  
  const payload: any = {
    audioId,
    prompt,
    customMode: true,
    model: "V4_5ALL"
  };
  if (continueAt !== undefined && continueAt !== '') {
    payload.continue_at = continueAt;
  }

  const response = await fetch(`${baseUrl}/generate/extend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to extend audio: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) {
    throw new Error(json.msg || "Failed to extend audio");
  }

  const taskId = json.data?.taskId || json.taskId || (typeof json.data === 'string' ? json.data : undefined);
  if (!taskId) throw new Error("No taskId returned for extend audio");
  return taskId;
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
 * Generates AI cover art images via kie.ai /generate/image.
 * Returns an array of image URLs (usually 2).
 */
export const generateCoverImage = async (
  prompt: string,
  count: number = 2,
): Promise<string[]> => {
  const { apiKey, baseUrl } = await getApiConfig();

  const response = await fetch(`${baseUrl}/generate/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      count,
      // Square format — ideal for album art
      width: 1024,
      height: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cover image generation failed: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || 'Failed to generate cover image');

  // kie.ai can return images in several shapes — normalise all of them
  const data = json.data;
  if (Array.isArray(data)) {
    // Array of strings or objects with url/imageUrl
    return data.map((item: any) =>
      typeof item === 'string' ? item : (item.url || item.imageUrl || item.image_url || '')
    ).filter(Boolean);
  }
  if (data?.images && Array.isArray(data.images)) {
    return data.images.map((item: any) =>
      typeof item === 'string' ? item : (item.url || item.imageUrl || '')
    ).filter(Boolean);
  }
  if (data?.url) return [data.url];
  if (data?.imageUrl) return [data.imageUrl];

  throw new Error('No images returned from cover art generation.');
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
  status: string;
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
  audioUrl?: string;
  personaId?: string;
}): Promise<SunoTrackResult> => {
  const taskId = await generateMusic(
    params.prompt,
    params.tags ?? '',
    params.title ?? 'Untitled',
    params.audioUrl,
    undefined,
    undefined,
    undefined,
    params.personaId,
    false,
    { instrumental: params.make_instrumental ?? false },
  );

  // Poll until SUCCESS or FAILED (max ~3 min)
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const info = await getTaskInfo(taskId);
    if (!info) continue;

    const status = (info.status || '').toUpperCase();

    if (status === 'SUCCESS') {
      const track = Array.isArray(info.data) ? info.data[0] : info.data;
      if (!track) throw new Error('Generation succeeded but no track data was returned.');
      return {
        id: track.id ?? taskId,
        audioUrl: track.audioUrl ?? '',
        imageUrl: track.imageUrl ?? '',
        videoUrl: track.videoUrl ?? '',
        title: track.title ?? params.title ?? 'Untitled',
        lyrics: track.lyrics,
        tags: track.tags,
        genre: track.genre,
        status: 'SUCCESS',
      };
    }

    if (status === 'FAILED' || status === 'SENSITIVE_WORD_ERROR') {
      throw new Error(`Music generation failed with status: ${status}`);
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
