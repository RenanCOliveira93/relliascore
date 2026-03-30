import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PlanType = "free" | "pro" | "premium";

export interface Subscription {
  plan: PlanType;
  analyses_used: number;
  analyses_limit: number;
  period_start: string;
}

export const PLAN_CONFIG: Record<PlanType, {
  label: string;
  analysesLimit: number; // -1 = unlimited
  canExportPdf: boolean;
  canUseTextMode: boolean;
  canUseBrandAnalysis: boolean;
  maxWorkspaces: number; // -1 = unlimited
}> = {
  free: {
    label: "Grátis",
    analysesLimit: 5,
    canExportPdf: false,
    canUseTextMode: false,
    canUseBrandAnalysis: false,
    maxWorkspaces: 1,
  },
  pro: {
    label: "PRO",
    analysesLimit: 50,
    canExportPdf: true,
    canUseTextMode: true,
    canUseBrandAnalysis: true,
    maxWorkspaces: 10,
  },
  premium: {
    label: "Premium",
    analysesLimit: -1,
    canExportPdf: true,
    canUseTextMode: true,
    canUseBrandAnalysis: true,
    maxWorkspaces: -1,
  },
};

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  planConfig: typeof PLAN_CONFIG[PlanType];
  canAnalyze: boolean;
  remainingAnalyses: number | null; // null = unlimited
  refreshSubscription: () => Promise<void>;
  incrementUsage: () => Promise<boolean>;
}

const defaultConfig = PLAN_CONFIG.free;

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  loading: true,
  planConfig: defaultConfig,
  canAnalyze: false,
  remainingAnalyses: 0,
  refreshSubscription: async () => {},
  incrementUsage: async () => false,
});

export const SubscriptionProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("user_subscriptions")
      .select("plan, analyses_used, analyses_limit, period_start")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setSubscription(data as unknown as Subscription);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const plan = (subscription?.plan ?? "free") as PlanType;
  const planConfig = PLAN_CONFIG[plan] || defaultConfig;

  const canAnalyze =
    planConfig.analysesLimit === -1 ||
    (subscription ? subscription.analyses_used < subscription.analyses_limit : false);

  const remainingAnalyses =
    planConfig.analysesLimit === -1
      ? null
      : subscription
        ? Math.max(0, subscription.analyses_limit - subscription.analyses_used)
        : 0;

  const incrementUsage = async (): Promise<boolean> => {
    if (!user) return false;
    const { data, error } = await supabase.rpc("increment_analysis_usage", {
      p_user_id: user.id,
    });
    if (error || data === false) return false;
    // Refresh local state
    await fetchSubscription();
    return true;
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        planConfig,
        canAnalyze,
        remainingAnalyses,
        refreshSubscription: fetchSubscription,
        incrementUsage,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
