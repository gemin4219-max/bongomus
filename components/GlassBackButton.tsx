import React from 'react';
import { TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassView as BlurView } from '@/components/GlassView';

interface Props {
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A frosted-glass circular back/close button.
 * Used consistently across all full-screen modals and overlays.
 */
export default function GlassBackButton({ onPress, icon = 'chevron-down', size = 22, style }: Props) {
  return (
    <TouchableOpacity onPress={onPress} style={style} activeOpacity={0.75}>
      <BlurView
        intensity={50}
        tint="dark"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.15)',
        }}
      >
        <Ionicons name={icon} size={size} color="#fff" />
      </BlurView>
    </TouchableOpacity>
  );
}
