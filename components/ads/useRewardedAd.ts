import { useState } from 'react';

export const useRewardedAd = () => {
  const showAd = (onEarned: () => void, onDismissed: () => void) => {
    console.log('Ads disabled for Expo Go. Mocking ad completion...');
    onEarned();
    onDismissed();
  };

  return { isLoaded: true, showAd };
};
