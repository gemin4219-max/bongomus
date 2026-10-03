import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Profile } from '../constants';
import { useThemeStore } from './themeStore';

type AuthStore = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isOfflineMode: boolean;
  // Actions
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, username: string, displayName: string, role: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  fetchProfile: (userId?: string) => Promise<void>;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,
  isOfflineMode: false,

  init: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.log('Session error:', error);
      }
      set({ session, isLoading: false });
      
      let currentChannel: any = null;

      if (session?.user) {
        get().fetchProfile(session.user.id);
        
        // Subscribe to real-time profile updates
        currentChannel = supabase.channel(`profile_updates_${session.user.id}_${Date.now()}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` }, (payload) => {
            set({ profile: payload.new as Profile });
          })
          .subscribe();
      }
      
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, isOfflineMode: false });
        if (currentChannel) {
          supabase.removeChannel(currentChannel);
          currentChannel = null;
        }
        
        if (session?.user) {
          get().fetchProfile(session.user.id);
          currentChannel = supabase.channel(`profile_updates_${session.user.id}_${Date.now()}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` }, (payload) => {
              set({ profile: payload.new as Profile });
            })
            .subscribe();
        } else {
          set({ profile: null });
        }
      });
    } catch (e) {
      console.log('Error initializing auth:', e);
      set({ isLoading: false });
    }
  },

  enableOfflineMode: () => {
    set({ isOfflineMode: true });
  },

  disableOfflineMode: () => {
    set({ isOfflineMode: false });
  },

  signIn: async (email, password) => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ isLoading: false });
    return error?.message ?? null;
  },

  signUp: async (email, password, username, displayName, role) => {
    set({ isLoading: true });
    
    // Pre-check if username already exists to prevent database trigger crashes (500 errors)
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle();
      
    if (existingUser) {
      set({ isLoading: false });
      return "Jina hili la mtumiaji (Username) tayari linatumika. Tafadhali chagua jingine.";
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: displayName },
      },
    });
    
    if (error) { 
      set({ isLoading: false }); 
      
      let errMsg = error.message;
      // Handle the raw 500 JSON response crash
      if (errMsg.includes('{"type":"default"') || errMsg.includes('500')) {
        errMsg = "Kuna tatizo la mtandao au barua pepe (email) hii tayari inatumika. Tafadhali jaribu tena.";
      } else if (errMsg.includes('already registered')) {
        errMsg = "Barua pepe (email) hii tayari imesajiliwa.";
      }
      
      return errMsg; 
    }
    // Update role after signup
    if (data.user) {
      await supabase.from('profiles').update({ role }).eq('id', data.user.id);
    }
    set({ isLoading: false });
    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },

  fetchProfile: async (userId) => {
    const id = userId || get().session?.user.id;
    if (!id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (data) {
      set({ profile: data as Profile });
      // Theme is no longer forced — user can pick any theme freely,
      // even when paired. The love theme is only auto-applied on first pairing.
    }
  },
}));
