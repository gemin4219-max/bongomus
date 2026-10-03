import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SunoAudioData, SunoTaskStatus } from '../lib/sunoApi';

export interface AISongTask {
  taskId: string;
  title: string;
  status: SunoTaskStatus;
  createdAt: number;
  tracks?: SunoAudioData[];
  taskType?: 'GENERATE' | 'VOCAL_REMOVAL';
  failReason?: string;
}

export interface Persona {
  id: string; // Suno Persona ID, or Suno Voice voiceId when type === 'voice'
  name: string;
  description: string;
  createdAt: number;
  isFavorite?: boolean;
  /** 'voice' = user's cloned singing voice (Suno Voice); 'style' = persona extracted from a song. */
  type?: 'voice' | 'style';
}

export interface RemixData {
  audioUrl: string;
  title: string;
  prompt: string;
  tags: string;
}

interface AIStore {
  tasks: AISongTask[];
  personas: Persona[];
  remixData: RemixData | null;
  setRemixData: (data: RemixData | null) => void;
  addTask: (taskId: string, title: string, taskType?: 'GENERATE' | 'VOCAL_REMOVAL') => void;
  updateTask: (taskId: string, status: SunoTaskStatus, tracks?: SunoAudioData[], failReason?: string) => void;
  updateTrack: (taskId: string, trackId: string, updates: Partial<SunoAudioData>) => void;
  removeTask: (taskId: string) => void;
  addPersona: (persona: Persona) => void;
  removePersona: (id: string) => void;
  togglePersonaFavorite: (id: string) => void;
  setTasks: (tasks: AISongTask[]) => void;
}

export const useAIStore = create<AIStore>()(
  persist(
    (set) => ({
      tasks: [],
      personas: [],
      remixData: null,
      setRemixData: (data) => set({ remixData: data }),
      addTask: (taskId, title, taskType) => set((state) => ({
        tasks: [{ taskId, title, status: 'PENDING', createdAt: Date.now(), taskType: taskType || 'GENERATE' }, ...state.tasks]
      })),
      updateTask: (taskId, status, tracks, failReason) => set((state) => ({
        tasks: state.tasks.map(t => t.taskId === taskId ? { ...t, status, tracks: tracks || t.tracks, failReason: failReason || t.failReason } : t)
      })),
      updateTrack: (taskId, trackId, updates) => set((state) => ({
        tasks: state.tasks.map(t => {
          if (t.taskId !== taskId || !t.tracks) return t;
          return {
            ...t,
            tracks: t.tracks.map(trk => trk.id === trackId ? { ...trk, ...updates } : trk)
          };
        })
      })),
      removeTask: (taskId) => set((state) => ({
        tasks: state.tasks.filter(t => t.taskId !== taskId)
      })),
      addPersona: (persona) => set((state) => ({
        personas: [persona, ...state.personas]
      })),
      removePersona: (id) => set((state) => ({
        personas: state.personas.filter(p => p.id !== id)
      })),
      togglePersonaFavorite: (id) => set((state) => ({
        personas: state.personas.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p)
      })),
      setTasks: (newTasks) => set((state) => {
        // Keep pending/generating tasks, merge with new tasks (prefer new ones for completed)
        const pendingTasks = state.tasks.filter(t => t.status !== 'SUCCESS' && t.status !== 'FAILED' && (t.status as string) !== 'ERROR');
        const pendingIds = new Set(pendingTasks.map(t => t.taskId));
        const filteredNewTasks = newTasks.filter(t => !pendingIds.has(t.taskId));
        return { tasks: [...pendingTasks, ...filteredNewTasks] };
      }),
    }),
    {
      name: 'ai-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
