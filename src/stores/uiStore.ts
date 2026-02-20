import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}

export type ReactionType = 'eagle_or_better' | 'birdie' | 'par' | 'bogey' | 'double_plus';

export type GameMode = 'nassau' | 'skins' | 'match_play' | 'wolf';

export interface HoleReactionState {
  type: ReactionType;
  gameMode: GameMode;
  playerName: string;
  opponentNames?: string[];
  hole: number;
  score: number;
  par: number;
}

interface UIState {
  toast: ToastState;
  holeReaction: HoleReactionState | null;

  // Actions
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
  showHoleReaction: (reaction: HoleReactionState) => void;
  dismissHoleReaction: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  toast: {
    message: '',
    type: 'info',
    visible: false,
  },

  holeReaction: null,

  showToast: (message, type = 'info') => {
    set({
      toast: { message, type, visible: true },
    });
  },

  hideToast: () => {
    set((state) => ({
      toast: { ...state.toast, visible: false },
    }));
  },

  showHoleReaction: (reaction) => {
    set({ holeReaction: reaction });
  },

  dismissHoleReaction: () => {
    set({ holeReaction: null });
  },
}));
