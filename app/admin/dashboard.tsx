import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { getApiCreditBalance } from '../../lib/sunoApi';
import { useThemeStore } from '../../store/themeStore';

interface DashboardStats {
  revenue_total: number;
  revenue_today: number;
  revenue_month: number;
  credits_sold: number;
  payments_completed: number;
  payments_pending: number;
  payments_failed: number;
  paying_users: number;
  revenue_last7: { day: string; amount: number }[] | null;
  accounts_total: number;
  accounts_today: number;
  accounts_month: number;
  artists_total: number;
  installs_total: number;
  installs_android: number;
  installs_ios: number;
  installs_today: number;
  installs_month: number;
  installs_active_7d: number;
}

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString();
const tzs = (n: number | null | undefined) => `TSh ${fmt(n)}`;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AdminDashboardScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [apiCredits, setApiCredits] = useState<number | null>(null);
  const [apiProvider, setApiProvider] = useState<string>('');
  const [apiError, setApiError] = useState(false);

  const loadApiCredits = async () => {
    setApiError(false);
    try {
      const [{ data: prov }, credits] = await Promise.all([
        supabase.from('system_settings').select('value').eq('key', 'ai_api_provider').single(),
        getApiCreditBalance(),
      ]);
      setApiProvider(prov?.value === 'kie' ? 'KIE AI' : 'Suno API');
      setApiCredits(Number(credits));
    } catch {
      setApiError(true);
    }
  };

  const load = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    loadApiCredits(); // independent — never blocks the stats
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_dashboard_stats');
      if (rpcError) throw rpcError;
      setStats(data as DashboardStats);
      setUpdatedAt(new Date());
    } catch (e: any) {
      setError(e?.message || 'Could not load stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  const last7 = stats?.revenue_last7 ?? [];
  const maxDay = Math.max(1, ...last7.map((d) => Number(d.amount) || 0));
  const week = last7.reduce((s, d) => s + (Number(d.amount) || 0), 0);

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.black, COLORS.darkSurface, COLORS.black]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} id="admin-dashboard-back">
          <View style={styles.iconWrapper}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => load(true)} id="admin-dashboard-refresh">
          <View style={styles.iconWrapper}>
            <Ionicons name="refresh" size={20} color={COLORS.textPrimary} />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.gold} />}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.gold} size="large" />
            <Text style={styles.mutedText}>Loading dashboard...</Text>
          </View>
        ) : error ? (
          <View style={[styles.glassCard, styles.center]}>
            <Ionicons name="alert-circle" size={36} color={COLORS.error} />
            <Text style={[styles.mutedText, { textAlign: 'center' }]}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : stats ? (
          <View style={{ gap: 20 }}>
            {/* ── AI API balance (live from provider) ─────── */}
            <View style={styles.apiCard}>
              <View style={styles.badgeIcon}>
                <Ionicons
                  name={apiCredits !== null && apiCredits <= 10 ? 'warning' : 'flash'}
                  size={20}
                  color={apiCredits !== null && apiCredits <= 10 ? COLORS.error : COLORS.gold}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>AI Credits Left{apiProvider ? ` · ${apiProvider}` : ''}</Text>
                <Text style={styles.mutedSmall}>Live from provider</Text>
              </View>
              {apiError ? (
                <Text style={[styles.apiValue, { color: COLORS.error }]}>Error</Text>
              ) : apiCredits === null ? (
                <Text style={styles.apiValue}>…</Text>
              ) : (
                <AnimatedNumber 
                  value={apiCredits} 
                  formatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 1 })} 
                  style={[styles.apiValue, apiCredits <= 10 && { color: COLORS.error }]} 
                />
              )}
            </View>
            {/* ── Revenue hero ─────────────────────────────── */}
            <LinearGradient
              colors={[`${COLORS.gold}30`, `${COLORS.card}E6`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.cardHeaderRow}>
                <View style={[styles.badgeIcon, { backgroundColor: `${COLORS.gold}25` }]}>
                  <Ionicons name="wallet" size={18} color={COLORS.gold} />
                </View>
                <Text style={styles.heroLabel}>ClickPesa Revenue</Text>
              </View>
              <AnimatedNumber value={stats.revenue_total} formatter={tzs} style={styles.heroValue} />
              <Text style={styles.mutedSmall}>All-time · completed payments only</Text>

              <View style={styles.splitRow}>
                <MiniStat styles={styles} label="Today" value={stats.revenue_today} isCurrency />
                <View style={styles.vDivider} />
                <MiniStat styles={styles} label="This month" value={stats.revenue_month} isCurrency />
                <View style={styles.vDivider} />
                <MiniStat styles={styles} label="Last 7 days" value={week} isCurrency />
              </View>

              {/* 7-day bar chart */}
              {last7.length > 0 && (
                <View style={styles.chart}>
                  {last7.map((d) => {
                    const amt = Number(d.amount) || 0;
                    const h = Math.max(4, Math.round((amt / maxDay) * 80));
                    const date = new Date(`${d.day}T00:00:00`);
                    return (
                      <View key={d.day} style={styles.barCol}>
                        <Text style={styles.barValue} numberOfLines={1}>
                          {amt > 0 ? (amt >= 1000 ? `${Math.round(amt / 1000)}k` : amt) : ''}
                        </Text>
                        <AnimatedBar
                          isVertical
                          isPercentage={false}
                          finalValue={h}
                          colors={amt > 0 ? [COLORS.goldLight, COLORS.gold] : [`${COLORS.divider}80`, `${COLORS.divider}80`]}
                          style={styles.bar}
                        />
                        <Text style={styles.barLabel}>{DAY_NAMES[date.getDay()]}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </LinearGradient>

            {/* Payment breakdown */}
            <View style={styles.grid}>
              <StatTile styles={styles} icon="checkmark-circle" color={COLORS.gold} label="Paid" value={stats.payments_completed} />
              <StatTile styles={styles} icon="time" color={COLORS.gold} label="Pending" value={stats.payments_pending} />
              <StatTile styles={styles} icon="close-circle" color={COLORS.gold} label="Failed" value={stats.payments_failed} />
              <StatTile styles={styles} icon="people" color={COLORS.gold} label="Paying users" value={stats.paying_users} />
              <StatTile styles={styles} icon="diamond" color={COLORS.gold} label="Credits sold" value={stats.credits_sold} />
              <StatTile
                styles={styles}
                icon="trending-up"
                color={COLORS.gold}
                label="Avg / payer"
                value={stats.paying_users ? Math.round(stats.revenue_total / stats.paying_users) : 0}
                isCurrency
              />
            </View>

            {/* ── Downloads ───────────────────────────────── */}
            <View style={styles.glassCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.badgeIcon}>
                  <Ionicons name="download" size={20} color={COLORS.gold} />
                </View>
                <Text style={styles.cardTitle}>App Downloads</Text>
              </View>
              <AnimatedNumber value={stats.installs_total} formatter={fmt} style={styles.bigValue} />
              <Text style={styles.mutedSmall}>Devices that opened the app</Text>

              <View style={styles.platformRow}>
                <PlatformPill styles={styles} icon="logo-android" color={COLORS.gold} label="Android" value={stats.installs_android} total={stats.installs_total} />
                <PlatformPill styles={styles} icon="logo-apple" color={COLORS.textPrimary} label="iPhone" value={stats.installs_ios} total={stats.installs_total} />
              </View>

              <View style={styles.splitRow}>
                <MiniStat styles={styles} label="New today" value={stats.installs_today} />
                <View style={styles.vDivider} />
                <MiniStat styles={styles} label="This month" value={stats.installs_month} />
                <View style={styles.vDivider} />
                <MiniStat styles={styles} label="Active 7 days" value={stats.installs_active_7d} />
              </View>
            </View>

            {/* ── Accounts ────────────────────────────────── */}
            <View style={styles.glassCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.badgeIcon}>
                  <Ionicons name="person-add" size={20} color={COLORS.gold} />
                </View>
                <Text style={styles.cardTitle}>Accounts</Text>
              </View>
              <AnimatedNumber value={stats.accounts_total} formatter={fmt} style={styles.bigValue} />
              <Text style={styles.mutedSmall}>Registered users</Text>

              <View style={styles.splitRow}>
                <MiniStat styles={styles} label="New today" value={stats.accounts_today} />
                <View style={styles.vDivider} />
                <MiniStat styles={styles} label="This month" value={stats.accounts_month} />
                <View style={styles.vDivider} />
                <MiniStat styles={styles} label="Artists" value={stats.artists_total} />
              </View>

              {stats.installs_total > 0 && (
                <View style={styles.conversionBox}>
                  <Ionicons name="git-merge-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.conversionText}>
                    {Math.min(100, Math.round((stats.accounts_total / stats.installs_total) * 100))}% of downloads created an account
                  </Text>
                </View>
              )}
            </View>

            {updatedAt && (
              <Text style={[styles.mutedSmall, { textAlign: 'center' }]}>
                Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · pull down to refresh
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const MiniStat = ({ styles, label, value, isCurrency }: { styles: any; label: string; value: number; isCurrency?: boolean }) => (
  <View style={styles.miniStat}>
    <AnimatedNumber value={value} formatter={isCurrency ? tzs : fmt} style={styles.miniValue} />
    <Text style={styles.miniLabel}>{label}</Text>
  </View>
);

const StatTile = ({ styles, icon, color, label, value, isCurrency }: { styles: any; icon: any; color: string; label: string; value: number; isCurrency?: boolean }) => (
  <View style={styles.tile}>
    <View style={styles.tileIcon}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    {value === 0 && label === 'Avg / payer' ? (
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>—</Text>
    ) : (
      <AnimatedNumber value={value} formatter={isCurrency ? tzs : fmt} style={styles.tileValue} />
    )}
    <Text style={styles.tileLabel}>{label}</Text>
  </View>
);

const PlatformPill = ({ styles, icon, color, label, value, total }: { styles: any; icon: any; color: string; label: string; value: number; total: number }) => {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.platformPill}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={styles.platformLabel}>{label}</Text>
        <AnimatedNumber value={value} formatter={fmt} style={styles.platformValue} />
      </View>
      <View style={styles.progressTrack}>
        <AnimatedBar isVertical={false} isPercentage={true} finalValue={pct} style={[styles.progressFill, { backgroundColor: color }]} />
      </View>
    </View>
  );
};

function AnimatedNumber({ value, formatter, style }: { value: number; formatter: (v: number) => string; style?: any }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) {
      setCurrent(end);
      return;
    }
    
    const duration = 1200; // 1.2s animation
    const startTime = Date.now();
    let frameId: number;

    const tick = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setCurrent(start + (end - start) * easeProgress);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return <Text style={style} numberOfLines={1} adjustsFontSizeToFit>{formatter(Math.round(current))}</Text>;
}

function AnimatedBar({ finalValue, style, isVertical = true, isPercentage = false, colors }: { finalValue: number; style: any; isVertical?: boolean; isPercentage?: boolean; colors?: string[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = finalValue;
    if (start === end) {
      setCurrent(end);
      return;
    }
    
    const duration = 1200; // 1.2s animation
    const startTime = Date.now();
    let frameId: number;

    const tick = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setCurrent(start + (end - start) * easeProgress);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [finalValue]);

  const dynamicStyle = isVertical 
    ? { height: isPercentage ? `${current}%` : current } 
    : { width: isPercentage ? `${current}%` : current } as any;

  if (colors) {
    return <LinearGradient colors={colors} style={[style, dynamicStyle]} />;
  }
  return <View style={[style, dynamicStyle]} />;
}

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.black },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 16,
      paddingHorizontal: 20,
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    iconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${COLORS.card}80`,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: `${COLORS.divider}50`,
    },
    headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
    content: { padding: 20, paddingBottom: 60 },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 14 },
    mutedText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' },
    mutedSmall: { color: COLORS.textTertiary, fontSize: 12, fontWeight: '500', marginTop: 4 },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: `${COLORS.gold}25` },
    retryText: { color: COLORS.gold, fontWeight: '700' },

    heroCard: {
      borderRadius: 24,
      padding: 22,
      backgroundColor: COLORS.card,
      overflow: 'hidden',
    },
    glassCard: {
      backgroundColor: COLORS.card,
      borderRadius: 24,
      padding: 22,
    },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    badgeIcon: { justifyContent: 'center', alignItems: 'center' },
    heroLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    heroValue: { color: COLORS.textPrimary, fontSize: 36, fontWeight: '900', letterSpacing: -0.5 },
    cardTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
    bigValue: { color: COLORS.textPrimary, fontSize: 32, fontWeight: '900' },
    apiCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: COLORS.card,
      borderRadius: 20,
      padding: 16,
    },
    apiValue: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '900' },

    splitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 18,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: `${COLORS.divider}40`,
    },
    vDivider: { width: 1, height: 30, backgroundColor: `${COLORS.divider}50` },
    miniStat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
    miniValue: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800' },
    miniLabel: { color: COLORS.textTertiary, fontSize: 11, fontWeight: '600', marginTop: 3 },

    chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, marginTop: 20 },
    barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    bar: { width: 18, borderRadius: 6 },
    barValue: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '700', marginBottom: 4 },
    barLabel: { color: COLORS.textTertiary, fontSize: 11, fontWeight: '600', marginTop: 6 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    tile: {
      width: '31%',
      flexGrow: 1,
      backgroundColor: COLORS.card,
      borderRadius: 18,
      padding: 14,
    },
    tileIcon: { marginBottom: 10 },
    tileValue: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
    tileLabel: { color: COLORS.textTertiary, fontSize: 11, fontWeight: '600', marginTop: 2 },

    platformRow: { gap: 12, marginTop: 16 },
    platformPill: {
      backgroundColor: COLORS.cardAlt,
      borderRadius: 14,
      padding: 12,
      gap: 10,
    },
    platformLabel: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600', flex: 1 },
    platformValue: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800' },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: `${COLORS.divider}50`, overflow: 'hidden' },
    progressFill: { height: 6, borderRadius: 3 },

    conversionBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 16,
      padding: 12,
      borderRadius: 12,
      backgroundColor: `${COLORS.black}40`,
    },
    conversionText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 },
  });
