// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView as BlurView } from '@/components/GlassView';
import { useThemeStore } from '../store/themeStore';

const { width } = Dimensions.get('window');
// Padding horizontal 20 (40 total) + gap 20 = 60
const CARD_WIDTH = (width - 60) / 2;

const BONGO_FLAVA_HISTORY = {
  title: "The Genesis of Bongo Flava",
  content: `Bongo Flava is more than just a genre; it is the heartbeat of Tanzania. Emerging in the 1990s in Dar es Salaam (affectionately known as "Bongo", meaning "brains" in Swahili, referring to the street smarts needed to survive the city), the genre was initially heavily influenced by American hip-hop and R&B, mixed with traditional Tanzanian styles like Taarab, Dansi, and reggae.

**The Pioneers**
The foundation was laid by legendary rap groups and solo artists like Kwanza Unit, Mr. II (Sugu), Hard Blasters (featuring Professor Jay), and X-Plastaz. These early pioneers rapped in Swahili, addressing social issues, poverty, and political struggles, giving a voice to the marginalized youth of Tanzania. Mr. II's hit "Ndani ya Bongo" in 1995 is often cited as one of the first true Bongo Flava anthems.

**The Golden Era**
In the early 2000s, producers like P-Funk Majani (Bongo Records) and Master J (MJ Records) revolutionized the sound, blending hip-hop beats with melodic R&B and local rhythms. Artists like Juma Nature, TID, Ray C, Lady Jaydee, and Mr. Blue dominated the airwaves. This era shifted the genre from underground rap to mainstream pop, dominating East African radio.

**The Global Era (WCB Wasafi & Kings Music)**
Today, Bongo Flava is an international phenomenon. Led by megastars like Diamond Platnumz (WCB Wasafi) and AliKiba (Kings Music), the sound has evolved, incorporating Afrobeats, Amapiano, and Baibuda. Bongo Flava artists now sell out stadiums across Africa, Europe, and America, racking up billions of views on YouTube and taking the Swahili language to the global stage.`
};

const BONGO_LEGENDS = [
  {
    id: 'legend_1',
    name: 'Diamond Platnumz',
    aka: 'Simba',
    activeYears: '2009 - Present',
    image: require('../assets/images/diamond_platnumz.png'),
    bio: 'Nasibu Abdul Juma Issack, known globally as Diamond Platnumz or "Simba", is arguably the most successful East African artist of all time. Starting his career in absolute poverty, selling second-hand clothes in Tandale, he broke through in 2009 with the hit "Kamwambie". \n\nHe is credited with single-handedly pushing Bongo Flava to the global stage through highly strategic international collaborations with artists like Rick Ross, Ne-Yo, Omarion, and Davido. Diamond is not just a singer and dancer; he is a mogul. He founded WCB Wasafi, the most successful record label in East Africa, launching the careers of Harmonize, Rayvanny, Zuchu, and Mbosso. He also owns Wasafi TV, Wasafi FM, and Wasafi Bet. With billions of YouTube views and numerous MTV and BET nominations, Simba is the undeniable King of modern Bongo Flava.',
    hits: 'Yatapita, Jeje, African Beauty, Inama, Kamwambie'
  },
  {
    id: 'legend_2',
    name: 'AliKiba',
    aka: 'King Kiba',
    activeYears: '2004 - Present',
    image: require('../assets/images/alikiba.jpg'),
    bio: 'Ali Saleh Kiba, fondly referred to by his massive, fiercely loyal fanbase as "King Kiba", is one of the foundational pillars of modern Bongo Flava. Hailing from Kigoma, Kiba exploded onto the scene in the late 2000s with his timeless albums "Cinderella" and "Ali K 4 Real". "Cinderella" remains the biggest-selling record in East Africa.\n\nKnown for his incredibly smooth vocal range, poetic Swahili songwriting, and a more reserved, classic approach to the music business, AliKiba has maintained elite status for over 15 years without relying on controversy. He is the founder of Kings Music label. His intense, decade-long rivalry with Diamond Platnumz has shaped the modern Bongo Flava landscape, dividing fans into two passionate camps and driving the entire industry forward.',
    hits: 'Mwana, Aje, Dodo, Cinderella, Macmuga'
  },
  {
    id: 'legend_3',
    name: 'Harmonize',
    aka: 'Konde Boy / Jeshi',
    activeYears: '2015 - Present',
    image: require('../assets/images/harmonize.png'),
    bio: 'Rajab Abdul Kahali, known as Harmonize or "Konde Boy", is a testament to raw talent and resilience. He was the very first artist signed to Diamond Platnumz\'s WCB Wasafi in 2015. His debut track "Aiyola" was a hit, but it was his track "Kwangwaru" featuring Diamond that propelled him to superstardom.\n\nIn a shocking move in 2019, Harmonize left Wasafi to forge his own path, founding Konde Music Worldwide. Despite the immense pressure of leaving Africa\'s biggest label, Harmonize proved his star power, releasing massive solo albums like "Afro East" and "High School". He frequently collaborates with Nigerian heavyweights like Burna Boy and Yemi Alade. He is known for his rugged "Jeshi" persona and his deep connection to his Makonde roots in Mtwara.',
    hits: 'Kwangwaru, Uno, Single Again, Atarudi, Kainama'
  },
  {
    id: 'legend_4',
    name: 'Zuchu',
    aka: 'Queen of Bongo',
    activeYears: '2020 - Present',
    image: require('../assets/images/zuchu.png'),
    bio: 'Zuhura Othman Soud, known as Zuchu, is the reigning Queen of Bongo Flava. Music is in her blood; she is the daughter of the legendary Tanzanian Taarab musician Khadija Kopa. Signed to WCB Wasafi in 2020, her rise was meteoric. Her debut EP "I Am Zuchu" broke streaming records across East Africa.\n\nWithin just two years of her debut, Zuchu achieved what took others a lifetime, becoming the first East African female artist to reach 100,000, 1 million, and 2 million subscribers on YouTube. Her mega-hit "Sukari" became a continental anthem. She brings a unique blend of traditional Taarab melodies mixed with modern Bongo Flava and Afrobeats, and is celebrated for her exceptional songwriting skills.',
    hits: 'Sukari, Honey, Mwambieni, Cheche, Kwikwi'
  },
  {
    id: 'legend_5',
    name: 'Rayvanny',
    aka: 'Chui',
    activeYears: '2016 - Present',
    image: require('../assets/images/rayvanny.png'),
    bio: 'Raymond Shaban Mwakyusa, widely known as Rayvanny or "Chui" (The Leopard), is one of Tanzania\'s most internationally recognized acts. Discovered during a freestyle rap competition, he was groomed at WCB Wasafi where he released his breakthrough hit "Kwetu" in 2016.\n\nRayvanny is renowned for his incredibly catchy melodies and versatility, able to seamlessly switch between rap, R&B, and dance tracks. He holds the prestigious honor of being the first Tanzanian to win a BET Award (Viewer\'s Choice Best New International Act in 2017). After a wildly successful run at Wasafi, he founded his own imprint, Next Level Music (NLM). His collaboration "Tetema" with Diamond Platnumz remains one of the most successful African club anthems of all time.',
    hits: 'Tetema, Kwetu, Number One, Mama Tetema, I Love You'
  },
  {
    id: 'legend_6',
    name: 'Nandy',
    aka: 'The African Princess',
    activeYears: '2017 - Present',
    image: require('../assets/images/nandy.png'),
    bio: 'Faustina Charles Mfinanga, officially known as Nandy "The African Princess", is a powerhouse vocalist and one of the most successful independent female artists in East Africa. Her career kicked off after she emerged as a finalist in the Tecno Own The Stage singing competition in Nigeria.\n\nNandy is the undisputed queen of Tanzanian R&B and emotional ballads. Tracks like "Ninogeshe" and "Aibu" showcased her vocal prowess and ability to convey deep emotion. She is also a highly astute businesswoman, running her own label and bridal company. She has won the Best Female Artist in East Africa at the AFRIMA awards multiple times, cementing her legacy as a modern icon.',
    hits: 'Ninogeshe, Aibu, Njiwa, Hallelujah, Kunjani'
  },
  {
    id: 'legend_7',
    name: 'Professor Jay',
    aka: 'The Heavyweight',
    activeYears: '1994 - Present',
    image: require('../assets/images/professor_jay.jpg'),
    bio: 'Joseph Haule, known across the continent as Professor Jay, is a living legend and a true pioneer of Bongo Flava. He started his career in the 1990s as "Nigga J" with the legendary hip-hop group Hard Blasters, dropping the seminal album "Funga Kazi" which popularized Swahili rap across Tanzania.\n\nAs a solo artist, Professor Jay bridged the gap between underground hip-hop and mainstream pop. His storytelling ability is unmatched; songs like "Zali la Mentali" and "Ndio Mzee" are culturally historic artifacts that tackled corruption, poverty, and street life with humor and profound wisdom. He later transitioned into politics, becoming a Member of Parliament for Mikumi constituency, proving his enduring influence both in music and society.',
    hits: 'Zali la Mentali, Ndio Mzee, Nikusaidieje, Bongo Dar es Salaam, Kamili Gado'
  },
  {
    id: 'legend_8',
    name: 'Jux',
    aka: 'African Boy',
    activeYears: '2008 - Present',
    image: require('../assets/images/jux.png'),
    bio: 'Juma Mussa Mkambala, professionally known as Jux or "African Boy", is the undisputed king of Swahili R&B. Unlike many of his peers who lean heavily into Afrobeats or Amapiano, Jux has carved out a massive lane for himself through smooth, romantic, and emotionally vulnerable music.\n\nKnown for his high-end fashion sense and luxurious music videos, Jux brings a suave, international R&B aesthetic to the Bongo Flava scene. He is also a successful entrepreneur with his "African Boy" fashion brand. His collaborative albums and tours with Marioo and Vanessa Mdee are legendary in the East African music circuit. Whenever Tanzanians need a heartbreak anthem or a wedding song, Jux is the go-to artist.',
    hits: 'Nidhibiti, Enjoy, Utaniua, Sisikii, Unaniweza'
  }
];

export default function KnowYourArtistScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();

  const [selectedLegend, setSelectedLegend] = useState<typeof BONGO_LEGENDS[0] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Glassmorphic Header */}
      <View style={styles.header}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MEMORY LANE</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.heroSection}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1540039155732-d674d5e8ac16?w=1200&q=80' }} 
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient 
            colors={['rgba(0,0,0,0.4)', COLORS.black]} 
            locations={[0, 1]}
            style={StyleSheet.absoluteFill} 
          />
          
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }], alignItems: 'center' }}>
            <Ionicons name="images" size={36} color="#FFF" style={{ marginBottom: 12, opacity: 0.9 }} />
            <Text style={styles.heroTitle}>The Archives</Text>
            <Text style={styles.heroSubtitle}>A nostalgic journey through the pioneers and superstars who shaped our history.</Text>
            
            <TouchableOpacity 
              style={styles.historyBtn}
              activeOpacity={0.8}
              onPress={() => setShowHistory(true)}
            >
              <LinearGradient colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)']} style={StyleSheet.absoluteFill} />
              <Ionicons name="time" size={18} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.historyBtnText}>Read The History</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.grid}>
          {BONGO_LEGENDS.map((artist, index) => {
            const rotateDeg = index % 2 === 0 ? '-3deg' : '4deg';
            return (
              <Animated.View key={artist.id} style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
                <TouchableOpacity 
                  style={[styles.card, { transform: [{ rotate: rotateDeg }] }]}
                  activeOpacity={0.9}
                  onPress={() => setSelectedLegend(artist)}
                >
                  <View style={styles.polaroidImageContainer}>
                    <Image source={typeof artist.image === 'string' ? { uri: artist.image } : artist.image} style={styles.cardImage} transition={300} cachePolicy="memory-disk" />
                    <View style={styles.vintageOverlay} />
                  </View>
                  
                  <View style={styles.cardContent}>
                    <Text style={styles.polaroidName} numberOfLines={1}>{artist.name}</Text>
                    <Text style={styles.polaroidYears}>{artist.activeYears}</Text>
                  </View>
                  <View style={styles.tape} />
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

      </ScrollView>

      {/* History Modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistory(false)}
      >
        <BlurView intensity={20} tint="dark" style={styles.modalOverlay}>
          <View style={styles.historyModalContent}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1594504445831-7b003c20025d?w=800&q=80' }} 
              style={styles.paperTexture} 
              cachePolicy="memory-disk"
            />
            <LinearGradient 
              colors={['rgba(0,0,0,0.6)', 'transparent', 'transparent', 'rgba(0,0,0,0.8)']} 
              style={StyleSheet.absoluteFill} 
              pointerEvents="none" 
            />
            
            <TouchableOpacity style={styles.historyCloseBtn} onPress={() => setShowHistory(false)}>
              <Ionicons name="close" size={24} color="#F9F6F0" />
            </TouchableOpacity>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: 80 }}>
              
              <View style={styles.magazineHeaderContainer}>
                <View style={styles.mastheadBox}>
                  <Text style={styles.magazineBrand}>MAMBO LEO</Text>
                </View>
                <View style={styles.magazineThickLine} />
                <View style={styles.magazineThinLine} />
                <View style={styles.magazineDateRow}>
                  <Text style={styles.magazineDateText}>Toleo Maalum - Dar es Salaam</Text>
                  <Text style={styles.magazineDateText}>Bei: Shilingi Tano</Text>
                </View>
                <View style={styles.magazineThinLine} />
              </View>

              <Text style={styles.magazineArticleTitle}>{BONGO_FLAVA_HISTORY.title}</Text>
              
              <Text style={styles.historyText}>
                <Text style={styles.magazineDropCap}>B</Text>
                {BONGO_FLAVA_HISTORY.content.substring(1)}
              </Text>
            </ScrollView>
          </View>
        </BlurView>
      </Modal>

      {/* Legend Info Modal */}
      <Modal
        visible={!!selectedLegend}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedLegend(null)}
      >
        <BlurView intensity={20} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedLegend && (
              <>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedLegend(null)}>
                  <Ionicons name="close" size={24} color="#3e2723" />
                </TouchableOpacity>
                
                <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                  <Image source={typeof selectedLegend.image === 'string' ? { uri: selectedLegend.image } : selectedLegend.image} style={styles.modalImage} transition={200} />
                  <LinearGradient 
                    colors={['transparent', '#F9F6F0']} 
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 250 }} 
                  />

                  <View style={styles.modalTextContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Text style={styles.modalTitle}>{selectedLegend.name}</Text>
                      <Ionicons name="checkmark-circle" size={20} color="#8b4513" />
                    </View>
                    <Text style={styles.modalAka}>a.k.a {selectedLegend.aka}</Text>
                    
                    <View style={styles.modalDivider} />
                    
                    <Text style={styles.modalSectionTitle}>Biography</Text>
                    <Text style={styles.modalBio}>{selectedLegend.bio}</Text>

                    <View style={styles.modalDivider} />
                    
                    <Text style={styles.modalSectionTitle}>Top Hits</Text>
                    <Text style={styles.modalHits}>{selectedLegend.hits}</Text>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </BlurView>
      </Modal>

    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)'
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 4, opacity: 0.8 },
  scrollContent: { paddingBottom: 60 },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 120,
    paddingBottom: 40,
    alignItems: 'center',
    minHeight: 350,
    justifyContent: 'center',
    overflow: 'hidden'
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 46,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 2,
    marginBottom: 12,
    textShadowColor: 'rgba(255, 215, 0, 0.6)', // Glowing warm nostalgic gold
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0.5
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden'
  },
  historyBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 1
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    gap: 20,
    paddingTop: 10
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#F9F6F0', // Vintage paper color
    padding: 10,
    paddingBottom: 35,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  polaroidImageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#111',
    overflow: 'hidden'
  },
  cardImage: {
    width: '100%',
    height: '100%'
  },
  vintageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(139, 69, 19, 0.15)', // Sepia tint
  },
  cardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 35,
    justifyContent: 'center',
    alignItems: 'center'
  },
  polaroidName: {
    color: '#333',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    fontFamily: 'System',
    opacity: 0.8
  },
  polaroidYears: {
    color: '#777',
    fontSize: 10,
    marginTop: 2
  },
  tape: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    width: 40,
    height: 15,
    backgroundColor: 'rgba(255,255,255,0.4)',
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)', // Darker background to contrast the paper
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#F9F6F0', // Vintage Paper
    height: '80%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden'
  },
  historyModalContent: {
    backgroundColor: '#D4B886', // Much darker, aged vintage paper tone
    height: '95%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#8b4513'
  },
  paperTexture: {
    ...StyleSheet.absoluteFill,
    opacity: 0.45, // Much higher opacity to force the texture visibility
    pointerEvents: 'none',
    mixBlendMode: 'multiply' as any
  },
  historyCloseBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', // Dark pill to contrast the paper
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  historyText: {
    color: 'rgba(20, 15, 10, 0.9)', // Very dark, faded ink
    fontSize: 16,
    lineHeight: 28,
    fontFamily: 'serif',
    paddingBottom: 40,
    textAlign: 'justify',
    textShadowColor: 'rgba(0,0,0,0.15)', // Ink bleed effect
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1
  },
  magazineHeaderContainer: {
    alignItems: 'center',
    marginBottom: 24
  },
  mastheadBox: {
    backgroundColor: 'rgba(20, 15, 10, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#D4B886'
  },
  magazineBrand: {
    fontFamily: 'serif',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#D4B886', // Paper color cut out of the black ink
  },
  magazineThickLine: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(20, 15, 10, 0.9)',
    marginBottom: 2
  },
  magazineThinLine: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(20, 15, 10, 0.9)'
  },
  magazineDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: 4
  },
  magazineDateText: {
    fontFamily: 'serif',
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(20, 15, 10, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  magazineArticleTitle: {
    fontFamily: 'serif',
    fontSize: 28,
    fontWeight: 'bold',
    color: 'rgba(20, 15, 10, 0.9)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 34,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2
  },
  magazineDropCap: {
    fontFamily: 'serif',
    fontSize: 54,
    fontWeight: 'bold',
    color: '#F9F6F0',
    backgroundColor: 'rgba(20, 15, 10, 0.9)', // Woodblock print style
    paddingHorizontal: 8,
    marginRight: 6,
    lineHeight: 56,
    overflow: 'hidden'
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(249, 246, 240, 0.8)', // Paper color
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modalImage: {
    width: '100%',
    height: 250
  },
  modalTextContainer: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 40
  },
  modalTitle: {
    color: '#3e2723', // Dark brown ink
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5
  },
  modalAka: {
    color: '#8b4513', // Medium brown
    fontSize: 16,
    fontWeight: '800'
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(139, 69, 19, 0.2)', // Light brown line
    marginVertical: 20
  },
  modalSectionTitle: {
    color: '#3e2723', // Dark brown ink
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8
  },
  modalBio: {
    color: '#4e342e', // Dark brown ink
    fontSize: 15,
    lineHeight: 24
  },
  modalHits: {
    color: '#4e342e',
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic'
  }
});
