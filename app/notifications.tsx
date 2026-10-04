// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassView as BlurView } from '@/components/GlassView';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const NotificationIcon = ({ type, color }: { type: string, color: string }) => {
  switch (type) {
    case 'new_release':
      return (
        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <Path d="M9 18V5l12-2v13" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <Circle cx="6" cy="18" r="3" fill={color}/>
          <Circle cx="18" cy="16" r="3" fill={color}/>
        </Svg>
      );
    case 'like':
      return (
        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      );
    case 'follow':
      return (
        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <Circle cx="8.5" cy="7" r="4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <Path d="M20 8v6M23 11h-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      );
    case 'system':
    default:
      return (
        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
          <Path d="M12 16v-4M12 8h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      );
  }
};

const getRelativeTime = (timestamp: string) => {
  if (!timestamp) return '';
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

export default function NotificationsFeed() {
  const { COLORS } = useThemeStore();
  const router = useRouter();
  const session = useAuthStore(s => s.session);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;

    let channel: any;

    const fetchNotifications = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setNotifications(data);
      }
      setLoading(false);

      // Subscribe to real-time inserts
      channel = supabase.channel('realtime_notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
          (payload) => {
            setNotifications(prev => [payload.new as Notification, ...prev]);
          }
        )
        .subscribe();
    };

    fetchNotifications();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session?.user?.id]);

  const markAsRead = async (id: string, currentlyRead: boolean) => {
    if (currentlyRead) return;

    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
  };

  const renderItem = ({ item, index }: { item: Notification, index: number }) => {
    const isUnread = !item.read;
    const iconColor = isUnread ? COLORS.gold : 'rgba(255,255,255,0.4)';
    
    return (
      <Animated.View 
        entering={FadeInUp.delay(index * 100).springify().damping(14)}
        layout={Layout.springify()}
      >
        <TouchableOpacity 
          style={styles.notificationBox} 
          activeOpacity={0.7}
          onPress={() => markAsRead(item.id, item.read)}
        >
          <View style={styles.iconWrap}>
            <NotificationIcon type={item.type} color={iconColor} />
          </View>
          <View style={styles.contentWrap}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, isUnread && styles.unreadText]}>{item.title}</Text>
              <Text style={styles.time}>{getRelativeTime(item.created_at)}</Text>
            </View>
            <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
          </View>
          {isUnread && <View style={[styles.unreadDot, { backgroundColor: COLORS.gold }]} />}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: 'Activity',
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '800', fontSize: 20 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
          ),
          headerBackground: () => (
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
          )
        }}
      />
      
      <LinearGradient colors={['#1a1710', '#0a0a0c', '#0a0a0c']} style={StyleSheet.absoluteFill} />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="notifications-off-outline" size={64} color="rgba(255,255,255,0.1)" />
          <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 16, textAlign: 'center', fontSize: 16 }}>
            You're all caught up! No new activity right now.
          </Text>
        </View>
      ) : (
        <Animated.FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  backBtn: { padding: 8, marginLeft: Platform.OS === 'ios' ? 0 : 8 },
  listContent: { padding: 20, paddingTop: Platform.OS === 'ios' ? 120 : 100, paddingBottom: 40, gap: 16 },
  notificationBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 8,
  },
  iconWrap: { 
    width: 46, 
    height: 46, 
    borderRadius: 23, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 16, 
    backgroundColor: 'rgba(255,255,255,0.03)'
  },
  contentWrap: { flex: 1, marginRight: 12, justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  title: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: '600' },
  unreadText: { fontWeight: '800', color: '#fff' },
  time: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: '500', marginTop: 2 },
  message: { color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 22, fontWeight: '400' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: -30 }
});
