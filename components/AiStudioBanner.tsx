import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../lib/supabase';

interface AiStudioBannerProps {
  onPress: (type: string) => void;
}

const { width } = Dimensions.get('window');

const DEFAULT_CARDS = [
  {
    id: '1', type: 'birthday', title: 'Write a Birthday\nAnthem',
    tag: 'Popular', tagColor: '#ffcc00', icon: 'gift', iconColor: '#ffcc00',
    imageUrl: 'https://images.unsplash.com/photo-1530103862676-de88b49e083c?q=80&w=500&auto=format&fit=crop',
    gradientColors: ['rgba(255,100,50,0.7)', 'rgba(150,30,10,0.95)']
  },
  {
    id: '2', type: 'roast', title: 'Roast a\nFriend',
    tag: '', tagColor: '', icon: 'flame', iconColor: '#fff',
    imageUrl: '',
    gradientColors: ['#ff4d4d', '#800000']
  },
  {
    id: '3', type: 'lofi', title: 'Lofi Study\nBeats',
    tag: 'Focus', tagColor: '#88ccff', icon: 'book', iconColor: '#88ccff',
    imageUrl: 'https://images.unsplash.com/photo-1558021212-51b6ecfa0db9?q=80&w=500&auto=format&fit=crop',
    gradientColors: ['rgba(50,50,150,0.6)', 'rgba(10,10,50,0.95)']
  },
  {
    id: '4', type: 'workout', title: 'Ultimate\nWorkout Track',
    tag: '', tagColor: '', icon: 'barbell', iconColor: '#00ff88',
    imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=500&auto=format&fit=crop',
    gradientColors: ['rgba(0,255,100,0.4)', 'rgba(0,50,20,0.9)']
  },
  {
    id: '5', type: 'lullaby', title: 'Make a\nLullaby',
    tag: 'Sleep', tagColor: '#d4aaff', icon: 'moon', iconColor: '#d4aaff',
    imageUrl: 'https://images.unsplash.com/photo-1517488629431-6427e0ee1e5f?q=80&w=500&auto=format&fit=crop',
    gradientColors: ['rgba(100,50,200,0.5)', 'rgba(30,10,80,0.9)']
  },
  {
    id: '6', type: 'poem', title: 'Sing My\nPoem',
    tag: '', tagColor: '', icon: 'document-text', iconColor: '#fff',
    imageUrl: '',
    gradientColors: ['#2a4b7c', '#15253e']
  }
];

export default function AiStudioBanner({ onPress }: AiStudioBannerProps) {
  // 3 hours, 26 mins, 7 secs in seconds = 12367
  const [timeLeft, setTimeLeft] = useState(12367);
  const [cards, setCards] = useState<any[]>(DEFAULT_CARDS);
  const totalTime = 86400; // 24 hours total duration for the progress bar
  
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollIndex = useRef(0);
  const snapInterval = 172;

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const { data } = await supabase.from('system_settings').select('value').eq('key', 'carousel_cards').single();
        if (data && data.value) {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCards(parsed);
          }
        }
      } catch (err) {}
    };
    fetchCards();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    const scrollTimer = setInterval(() => {
      if (cards.length > 0) {
        scrollIndex.current = (scrollIndex.current + 1) % cards.length;
        scrollViewRef.current?.scrollTo({ x: scrollIndex.current * snapInterval, animated: true });
      }
    }, 3500); // Auto-scroll every 3.5 seconds

    return () => {
      clearInterval(timer);
      clearInterval(scrollTimer);
    };
  }, [cards.length]);

  const progressPercent = ((totalTime - timeLeft) / totalTime) * 100;

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Get Inspired</Text>
      
      <ScrollView 
        ref={scrollViewRef}
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={snapInterval}
        decelerationRate="fast"
      >
        {cards.map((card, index) => (
          <TouchableOpacity key={card.id || index} style={[styles.card, !card.imageUrl && { backgroundColor: '#1a1a1a' }]} onPress={() => onPress(card.type)} activeOpacity={0.9}>
            {card.imageUrl ? (
              <>
                <Image source={{ uri: card.imageUrl }} style={styles.cardBg} blurRadius={index === 0 ? 10 : 0} />
                <LinearGradient colors={card.gradientColors || ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']} style={styles.cardOverlay} />
              </>
            ) : (
              <>
                <LinearGradient colors={card.gradientColors || ['#333', '#111']} style={StyleSheet.absoluteFill} />
                <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
              </>
            )}
            
            <View style={styles.cardContent}>
              <View>
                {card.tag ? <Text style={[styles.newFeatureText, { color: card.tagColor || '#fff' }]}>{card.tag}</Text> : null}
                <Text style={styles.cardTitle}>{card.title}</Text>
              </View>
              
              <View style={styles.cardFooter}>
                <View style={[styles.iconCircle, { borderColor: card.iconColor || '#fff' }]}>
                  <Ionicons name={(card.icon as any) || 'star'} size={14} color={card.iconColor || '#fff'} />
                </View>
              </View>
            </View>
            {index === 0 && <View style={[styles.topBorderHighlight, { width: `${progressPercent}%`, backgroundColor: card.iconColor || '#ffcc00' }]} />}
          </TouchableOpacity>
        ))}
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 24,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  scrollContent: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 12,
  },
  card: {
    width: 160,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  newFeatureText: {
    color: '#ff3b70',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  timeText: {
    color: '#ff3b70',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  topBorderHighlight: {
    position: 'absolute',
    top: -1,
    left: -1,
    height: 3,
    backgroundColor: '#ff3b70',
    borderTopLeftRadius: 20,
    zIndex: 10,
  },
  connectBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  connectBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  }
});
