import type { Bubble, BubbleColor } from './bubbleTypes.ts';
import { findColorGroup, findFloating } from './bubbleMatching.ts';

export interface BubbleRemoval {
  id: number;
  x: number;
  y: number;
  color: BubbleColor;
  kind: 'match' | 'drop';
}

export interface BubblePlacementResolution {
  bubbles: Bubble[];
  scoreGained: number;
  removals: BubbleRemoval[];
}

export function resolveBubblePlacement(
  bubbles: readonly Bubble[],
  placedBubble: Bubble,
): BubblePlacementResolution {
  const withPlaced = [...bubbles, placedBubble];
  const group = findColorGroup(withPlaced, placedBubble.row, placedBubble.col);

  if (group.length < 3) {
    return { bubbles: withPlaced, scoreGained: 0, removals: [] };
  }

  const groupIds = new Set(group.map(bubble => bubble.id));
  const afterMatch = withPlaced.filter(bubble => !groupIds.has(bubble.id));
  const floating = findFloating(afterMatch);
  const floatingIds = new Set(floating.map(bubble => bubble.id));

  return {
    bubbles: afterMatch.filter(bubble => !floatingIds.has(bubble.id)),
    scoreGained: group.length * 10 + floating.length * 15,
    removals: [
      ...group.map(bubble => ({ ...bubble, kind: 'match' as const })),
      ...floating.map(bubble => ({ ...bubble, kind: 'drop' as const })),
    ],
  };
}
