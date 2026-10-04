// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { AudioWaveIcon, VideoIcon, CloseIcon } from './CreateChips';

/* ────────────────────────────────────────────────────────────────────────────
 * SourcePreviewChip
 * A pill in the Create composer that lets the user LISTEN to the audio / video
 * they uploaded before generating. For videos we play the soundtrack (that's
 * exactly what Suno uses as the reference).
 *
 *   ( ▶︎ ring )  [icon] name          0:12 / 0:45   ✕
 * ──────────────────────────────────────────────────────────────────────────── */

interface Props {
  uri: string;
  label: string;
  kind: 'audio' | 'video';
  accentColor?: string;
  onClear?: () => void;
  /** Fired right before this chip starts playing (pause other players here). */
  onWillPlay?: () => void;
  testID?: string;
}

const RING = 30;
const STROKE = 2.2;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export const SourcePreviewChip = ({
  uri,
  label,
  kind,
  accentColor = '#F09819',
  onClear,
  onWillPlay,
  testID,
}: Props) => {
  const player = useAudioPlayer(uri, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  const playing = !!status.playing;
  const duration = status.duration || 0;
  const current = Math.min(status.currentTime || 0, duration || Infinity);
  const progress = duration > 0 ? current / duration : 0;
  const loading = !status.isLoaded || (playing && status.isBuffering);

  // Rewind when it ends so the next tap replays from the start
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0).catch(() => {});
    }
  }, [status.didJustFinish]);

  // Stop the preview when the chip disappears / source changes
  useEffect(() => {
    return () => {
      try { player.pause(); } catch {}
    };
  }, [uri]);

  // Soft pulse on the ring while playing
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!playing) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [playing]);

  const toggle = () => {
    Haptics.selectionAsync().catch(() => {});
    if (playing) {
      player.pause();
      return;
    }
    onWillPlay?.();
    if (duration > 0 && current >= duration - 0.25) player.seekTo(0).catch(() => {});
    player.play();
  };

  return (
    <View testID={testID} style={[styles.chip, { borderColor: `${accentColor}55` }]}>
      {/* Play / pause with circular progress */}
      <TouchableOpacity
        testID={testID ? `${testID}-play` : undefined}
        onPress={toggle}
        activeOpacity={0.75}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel={playing ? `Pause ${label}` : `Preview ${label}`}
      >
        <Animated.View style={[styles.ringWrap, { transform: [{ scale: pulse }] }]}>
          <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
            <Circle cx={RING / 2} cy={RING / 2} r={R} stroke="rgba(255,255,255,0.14)" strokeWidth={STROKE} fill="rgba(255,255,255,0.06)" />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={accentColor}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={CIRC * (1 - progress)}
              rotation={-90}
              origin={`${RING / 2}, ${RING / 2}`}
            />
          </Svg>
          <Svg width={12} height={12} viewBox="0 0 24 24">
            {playing ? (
              <>
                <Rect x={6} y={4} width={4} height={16} rx={1.5} fill="#FFF" />
                <Rect x={14} y={4} width={4} height={16} rx={1.5} fill="#FFF" />
              </>
            ) : (
              <Path d="M8 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 8 4.5z" fill="#FFF" />
            )}
          </Svg>
        </Animated.View>
      </TouchableOpacity>

      <TouchableOpacity onPress={toggle} activeOpacity={0.8} style={styles.textCol}>
        <View style={styles.titleRow}>
          {kind === 'video' ? (
            <VideoIcon size={13} color={accentColor} />
          ) : (
            <AudioWaveIcon size={13} color={accentColor} />
          )}
          <Text numberOfLines={1} style={styles.title}>
            {label}
          </Text>
        </View>
        <Text style={styles.time}>
          {loading && !duration ? 'Loading…' : `${fmt(current)} / ${fmt(duration)}`}
        </Text>
      </TouchableOpacity>

      {onClear ? (
        <TouchableOpacity
          testID={testID ? `${testID}-clear` : undefined}
          onPress={() => {
            try { player.pause(); } catch {}
            onClear();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 10 }}
          style={styles.clear}
          accessibilityLabel={`Remove ${label}`}
        >
          <CloseIcon />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    maxWidth: 230,
  },
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { marginLeft: 8, flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { color: '#FFF', fontSize: 13, fontWeight: '600', marginLeft: 5, maxWidth: 120 },
  time: { color: 'rgba(255,255,255,0.55)', fontSize: 10.5, marginTop: 1, fontVariant: ['tabular-nums'] },
  clear: { marginLeft: 10 },
});
