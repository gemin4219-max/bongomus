// @ts-nocheck
import React, { useMemo } from 'react';
import { dailyShuffle } from '../utils/dailyRandom';

interface DailyShufflerProps {
  children: React.ReactNode;
}

export default function DailyShuffler({ children }: DailyShufflerProps) {
  const childrenArray = React.Children.toArray(children);
  
  const shuffled = useMemo(() => {
    return dailyShuffle(childrenArray);
  }, [childrenArray.length]); // Re-evaluate only if the number of children changes

  return <>{shuffled}</>;
}
