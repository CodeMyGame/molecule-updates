import { create } from 'zustand';

interface TourState {
  isOpen: boolean;
  step: number;
  openTour: (step?: number) => void;
  closeTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: number) => void;
}

export const useTourStore = create<TourState>((set) => ({
  isOpen: false,
  step: 0,
  openTour: (step = 0) => set({ isOpen: true, step }),
  closeTour: () => {
    try {
      localStorage.setItem('molecule_pos_tour_seen', 'true');
    } catch {
      /* ignore */
    }
    set({ isOpen: false });
  },
  nextStep: () => set((s) => ({ step: s.step + 1 })),
  prevStep: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
  setStep: (step: number) => set({ step }),
}));
