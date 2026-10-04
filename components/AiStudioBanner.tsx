import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface AiStudioBannerProps {
  onPress: (type: string) => void;
}

const { width } = Dimensions.get('window');

export default function AiStudioBanner({ onPress }: AiStudioBannerProps) {
  // 3 hours, 26 mins, 7 secs in seconds = 12367
  const [timeLeft, setTimeLeft] = useState(12367);
  const totalTime = 86400; // 24 hours total duration for the progress bar
  
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollIndex = useRef(0);
  const totalCards = 6;
  const snapInterval = 172;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    const scrollTimer = setInterval(() => {
      scrollIndex.current = (scrollIndex.current + 1) % totalCards;
      scrollViewRef.current?.scrollTo({ x: scrollIndex.current * snapInterval, animated: true });
    }, 3500); // Auto-scroll every 3.5 seconds

    return () => {
      clearInterval(timer);
      clearInterval(scrollTimer);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
        {/* Card 1: Birthday Anthem */}
        <TouchableOpacity style={styles.card} onPress={() => onPress('birthday')} activeOpacity={0.9}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1530103862676-de88b49e083c?q=80&w=500&auto=format&fit=crop' }} 
            style={styles.cardBg}
            blurRadius={10}
          />
          <LinearGradient colors={['rgba(255,100,50,0.7)', 'rgba(150,30,10,0.95)']} style={styles.cardOverlay} />
          
          <View style={styles.cardContent}>
            <View>
              <Text style={[styles.newFeatureText, { color: '#ffcc00' }]}>Popular</Text>
              <Text style={styles.cardTitle}>Write a Birthday{'\n'}Anthem</Text>
            </View>
            
            <View style={styles.cardFooter}>
              <View style={[styles.iconCircle, { borderColor: '#ffcc00' }]}>
                <Ionicons name="gift" size={14} color="#ffcc00" />
              </View>
            </View>
          </View>
          <View style={[styles.topBorderHighlight, { width: `${progressPercent}%`, backgroundColor: '#ffcc00' }]} />
        </TouchableOpacity>

        {/* Card 2: Roast a Friend */}
        <TouchableOpacity style={[styles.card, { backgroundColor: '#1a1a1a' }]} onPress={() => onPress('roast')} activeOpacity={0.9}>
          <LinearGradient colors={['#ff4d4d', '#800000']} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
          
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Roast a{'\n'}Friend</Text>
            <View style={styles.cardFooter}>
              <View style={[styles.iconCircle, { borderColor: '#fff' }]}>
                <Ionicons name="flame" size={14} color="#fff" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Card 3: Lofi Study Beats */}
        <TouchableOpacity style={styles.card} onPress={() => onPress('lofi')} activeOpacity={0.9}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1558021212-51b6ecfa0db9?q=80&w=500&auto=format&fit=crop' }} 
            style={styles.cardBg}
          />
          <LinearGradient colors={['rgba(50,50,150,0.6)', 'rgba(10,10,50,0.95)']} style={styles.cardOverlay} />
          
          <View style={styles.cardContent}>
            <View>
              <Text style={[styles.newFeatureText, { color: '#88ccff' }]}>Focus</Text>
              <Text style={styles.cardTitle}>Lofi Study{'\n'}Beats</Text>
            </View>
            <View style={styles.cardFooter}>
              <View style={[styles.iconCircle, { borderColor: '#88ccff' }]}>
                <Ionicons name="book" size={14} color="#88ccff" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Card 4: Workout Track */}
        <TouchableOpacity style={styles.card} onPress={() => onPress('workout')} activeOpacity={0.9}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=500&auto=format&fit=crop' }} 
            style={styles.cardBg}
          />
          <LinearGradient colors={['rgba(0,255,100,0.4)', 'rgba(0,50,20,0.9)']} style={styles.cardOverlay} />
          
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Ultimate{'\n'}Workout Track</Text>
            <View style={styles.cardFooter}>
              <View style={[styles.iconCircle, { borderColor: '#00ff88' }]}>
                <Ionicons name="barbell" size={14} color="#00ff88" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Card 5: Make a Lullaby */}
        <TouchableOpacity style={styles.card} onPress={() => onPress('lullaby')} activeOpacity={0.9}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1517488629431-6427e0ee1e5f?q=80&w=500&auto=format&fit=crop' }} 
            style={styles.cardBg}
          />
          <LinearGradient colors={['rgba(100,50,200,0.5)', 'rgba(30,10,80,0.9)']} style={styles.cardOverlay} />
          
          <View style={styles.cardContent}>
            <View>
              <Text style={[styles.newFeatureText, { color: '#d4aaff' }]}>Sleep</Text>
              <Text style={styles.cardTitle}>Make a{'\n'}Lullaby</Text>
            </View>
            <View style={styles.cardFooter}>
              <View style={[styles.iconCircle, { borderColor: '#d4aaff' }]}>
                <Ionicons name="moon" size={14} color="#d4aaff" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Card 6: Sing My Poem */}
        <TouchableOpacity style={styles.card} onPress={() => onPress('poem')} activeOpacity={0.9}>
          <LinearGradient colors={['#2a4b7c', '#15253e']} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']} style={StyleSheet.absoluteFill} />
          
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Sing My{'\n'}Poem</Text>
            <View style={styles.cardFooter}>
              <View style={[styles.iconCircle, { borderColor: '#fff' }]}>
                <Ionicons name="document-text" size={14} color="#fff" />
              </View>
            </View>
          </View>
        </TouchableOpacity>
        
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
