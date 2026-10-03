import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';

/* ────────────────────────────────────────────────────────────────────────────
 * Outlined (stroke-only) SVG icons for the Create composer chips.
 * Thin 1.6px strokes with round caps — matches the reference composer style.
 * ──────────────────────────────────────────────────────────────────────────── */

type IconProps = { size?: number; color?: string; strokeWidth?: number };

export const PlusIcon = ({ size = 18, color = '#FFF', strokeWidth = 1.8 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

/** Audio — vertical waveform bars */
export const AudioWaveIcon = ({ size = 18, color = '#FFF', strokeWidth = 1.6 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {[
      [3, 10, 14],
      [6.5, 7, 17],
      [10, 4, 20],
      [13.5, 8, 16],
      [17, 6, 18],
      [20.5, 10, 14],
    ].map(([x, y1, y2]) => (
      <Line key={x} x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    ))}
  </Svg>
);

/** Lyrics — text lines with a music note */
export const LyricsIcon = ({ size = 18, color = '#FFF', strokeWidth = 1.6 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 6h10M3 11h10M3 16h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M17 17V5l4-1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={15} cy={17.5} r={2.2} stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

/** Styles — music note inside a disc */
export const StylesIcon = ({ size = 18, color = '#FFF', strokeWidth = 1.6 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M13 15.5V8l3 1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={11.2} cy={15.6} r={1.8} stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

/** Voice — smiling face with a sparkle (your own voice) */
export const VoiceFaceIcon = ({ size = 18, color = '#FFF', strokeWidth = 1.6 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* face outline, opened at the top-right for the sparkle */}
    <Path
      d="M17.5 4.6A9 9 0 1 0 20.4 9"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Circle cx={9} cy={10.5} r={0.9} fill={color} />
    <Circle cx={14} cy={10.5} r={0.9} fill={color} />
    <Path d="M8.5 14.5c1.8 2 4.7 2 6.5 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    {/* sparkle */}
    <Path d="M20 1.8v4.4M17.8 4h4.4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

export const CloseIcon = ({ size = 14, color = 'rgba(255,255,255,0.55)', strokeWidth = 1.8 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

/** Video — rounded camera body with a lens triangle */
export const VideoIcon = ({ size = 18, color = '#FFF', strokeWidth = 1.6 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={2.5} y={6} width={13} height={12} rx={3} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M15.5 10.2l5-2.7v9l-5-2.7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/* ────────────────────────────────────────────────────────────────────────────
 * DashedChip
 *  - empty   → transparent, dashed outline ("lined boundary")
 *  - active  → soft filled pill, no dashes, optional ✕ to clear
 * The dashes are drawn with SVG so they look identical on iOS and Android
 * (RN's borderStyle:'dashed' renders unevenly on rounded Android views).
 * ──────────────────────────────────────────────────────────────────────────── */

interface DashedChipProps {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
  onClear?: () => void;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  maxLabelWidth?: number;
}

export const DashedChip = ({
  label,
  icon,
  active = false,
  onPress,
  onClear,
  accentColor,
  style,
  testID,
  maxLabelWidth = 120,
}: DashedChipProps) => {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - box.w) > 0.5 || Math.abs(height - box.h) > 0.5) setBox({ w: width, h: height });
  };

  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.7}
      onPress={onPress}
      onLayout={onLayout}
      style={[
        chipStyles.chip,
        active && chipStyles.chipActive,
        active && accentColor ? { borderColor: `${accentColor}55` } : null,
        style,
      ]}
    >
      {!active && box.w > 0 && (
        <Svg
          pointerEvents="none"
          width={box.w}
          height={box.h}
          style={StyleSheet.absoluteFill}
        >
          <Rect
            x={0.75}
            y={0.75}
            width={box.w - 1.5}
            height={box.h - 1.5}
            rx={(box.h - 1.5) / 2}
            ry={(box.h - 1.5) / 2}
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={1.2}
            strokeDasharray="4 4"
          />
        </Svg>
      )}
      {icon ? <View style={chipStyles.iconWrap}>{icon}</View> : null}
      <Text
        numberOfLines={1}
        style={[chipStyles.label, active && chipStyles.labelActive, { maxWidth: maxLabelWidth }]}
      >
        {label}
      </Text>
      {active && onClear ? (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            onClear();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 10 }}
          style={chipStyles.clearBtn}
        >
          <CloseIcon />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
};

/** Round solid "+" button that sits at the start of the chip row. */
export const PlusChip = ({ onPress, active }: { onPress?: () => void; active?: boolean }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={onPress}
    style={[chipStyles.plus, active && { backgroundColor: 'rgba(255,255,255,0.18)' }]}
  >
    <PlusIcon />
  </TouchableOpacity>
);

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  iconWrap: { marginRight: 8 },
  label: { color: 'rgba(255,255,255,0.88)', fontSize: 15, fontWeight: '500' },
  labelActive: { color: '#FFF' },
  clearBtn: { marginLeft: 10 },
  plus: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
