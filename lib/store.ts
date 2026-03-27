/**
 * Global State Store
 * 
 * Zustand store for application state management.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Token, Pool, SavedStrategy, SimulationResult, BacktestResult, UserSettings } from '@/types';

interface StrategyParams {
  depositAmount: string;
  depositToken: 'token0' | 'token1' | 'usd';
  lowerTick: number;
  upperTick: number;
  lowerPrice: number;
  upperPrice: number;
  horizonDays: number;
  rebalanceMode: 'none' | 'periodic' | 'threshold' | 'volatility';
  rebalanceParams?: {
    periodDays?: number;
    priceThreshold?: number;
    volatilityThreshold?: number;
  };
  gasCostGwei: number;
  volumeScenario: 'low' | 'base' | 'high' | 'custom';
  customVolumeMultiplier?: number;
}

interface AppState {
  // User preferences (persisted)
  settings: UserSettings;
  
  // Current session
  selectedChain: number;
  selectedToken: Token | null;
  selectedPool: Pool | null;
  
  // Strategy builder
  strategyParams: StrategyParams;
  
  // Results
  currentSimulation: SimulationResult | null;
  currentBacktest: BacktestResult | null;
  
  // Comparison
  compareStrategies: string[];
  
  // Actions
  setSettings: (settings: Partial<UserSettings>) => void;
  selectChain: (chainId: number) => void;
  selectToken: (token: Token | null) => void;
  selectPool: (pool: Pool | null) => void;
  setStrategyParams: (params: Partial<StrategyParams>) => void;
  setSimulation: (sim: SimulationResult | null) => void;
  setBacktest: (bt: BacktestResult | null) => void;
  addToCompare: (strategyId: string) => void;
  removeFromCompare: (strategyId: string) => void;
  clearCompare: () => void;
  reset: () => void;
}

const defaultSettings: UserSettings = {
  defaultChainId: 1,
  currency: 'USD',
  chartTheme: 'dark',
  decimalPlaces: 4,
  defaultGasGwei: 20,
  defaultHorizon: 30,
};

const defaultStrategyParams: StrategyParams = {
  depositAmount: '',
  depositToken: 'usd',
  lowerTick: 0,
  upperTick: 0,
  lowerPrice: 0,
  upperPrice: 0,
  horizonDays: 30,
  rebalanceMode: 'none',
  gasCostGwei: 20,
  volumeScenario: 'base',
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: defaultSettings,
      selectedChain: 1,
      selectedToken: null,
      selectedPool: null,
      strategyParams: defaultStrategyParams,
      currentSimulation: null,
      currentBacktest: null,
      compareStrategies: [],
      
      // Actions
      setSettings: (settings) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),
      
      selectChain: (chainId) => set({ selectedChain: chainId }),
      
      selectToken: (token) => set({ selectedToken: token }),
      
      selectPool: (pool) => set({ selectedPool: pool }),
      
      setStrategyParams: (params) =>
        set((state) => ({
          strategyParams: { ...state.strategyParams, ...params },
        })),
      
      setSimulation: (sim) => set({ currentSimulation: sim }),
      
      setBacktest: (bt) => set({ currentBacktest: bt }),
      
      addToCompare: (strategyId) =>
        set((state) => ({
          compareStrategies: state.compareStrategies.includes(strategyId)
            ? state.compareStrategies
            : [...state.compareStrategies, strategyId],
        })),
      
      removeFromCompare: (strategyId) =>
        set((state) => ({
          compareStrategies: state.compareStrategies.filter(
            (id) => id !== strategyId
          ),
        })),
      
      clearCompare: () => set({ compareStrategies: [] }),
      
      reset: () =>
        set({
          selectedToken: null,
          selectedPool: null,
          currentSimulation: null,
          currentBacktest: null,
          compareStrategies: [],
        }),
    }),
    {
      name: 'univ3-strategy-lab-storage',
      partialize: (state) => ({
        settings: state.settings,
        selectedChain: state.selectedChain,
      }),
    }
  )
);

// Selector hooks for better performance
export const useSettings = () => useAppStore((state) => state.settings);
export const useSelectedChain = () => useAppStore((state) => state.selectedChain);
export const useSelectedToken = () => useAppStore((state) => state.selectedToken);
export const useSelectedPool = () => useAppStore((state) => state.selectedPool);
export const useStrategyParams = () => useAppStore((state) => state.strategyParams);
export const useCurrentSimulation = () => useAppStore((state) => state.currentSimulation);
export const useCurrentBacktest = () => useAppStore((state) => state.currentBacktest);
export const useCompareStrategies = () => useAppStore((state) => state.compareStrategies);
