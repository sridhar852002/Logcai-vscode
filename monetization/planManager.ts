// src/monetization/planManager.ts
export type UserPlan = 'Free' | 'LocalPro' | 'CloudPro';
export type Feature =
| 'GhostAutocomplete'
| 'MultiFileRefactor'
| 'CustomModelInstall'
| 'CloudAI'
| 'CloudAI_BYOK'
| 'AgentMarketplace'
| 'ContextInjection'
| 'StreamingChat';

// Updated feature matrix with BYOK support for LocalPro
const featureMatrix: Record<UserPlan, Record<Feature, boolean>> = {
  Free: {
    GhostAutocomplete: false,
    MultiFileRefactor: false,
    CustomModelInstall: true,
    CloudAI: false,
    CloudAI_BYOK: false,
    AgentMarketplace: false,
    ContextInjection: false,
    StreamingChat: true,
  },
  LocalPro: {
    GhostAutocomplete: true,
    MultiFileRefactor: true,
    CustomModelInstall: true,
    CloudAI: false,
    CloudAI_BYOK: true, // Added BYOK support for LocalPro
    AgentMarketplace: true,
    ContextInjection: true,
    StreamingChat: true,
  },
  CloudPro: {
    GhostAutocomplete: true,
    MultiFileRefactor: true,
    CustomModelInstall: true,
    CloudAI: true,
    CloudAI_BYOK: true,
    AgentMarketplace: true,
    ContextInjection: true,
    StreamingChat: true,
  },
};

// Extension-wide state tracking
let currentUserPlan: UserPlan = 'Free';

// In VS Code, we need to share state between extension and webview
// Updated to include both local state and message posting
export function setUserPlan(plan: UserPlan) {
  console.log('[PlanManager] setUserPlan =', plan);
  
  // Update local state
  currentUserPlan = plan;
  
  // If we're in a webview context, store in window object
  if (typeof window !== 'undefined') {
    window.userPlan = plan;
    
    // Send message to extension host if in webview context
    try {
      const vscode = acquireVsCodeApi();
      vscode.postMessage({
        command: 'updateUserPlan',
        plan: plan
      });
    } catch (e) {
      // Ignore errors when acquireVsCodeApi is not available
      console.log('[PlanManager] Not in webview context, skipping message');
    }
  }
}

// Get the current user plan - enhanced for better state recovery
export function getUserPlan(): UserPlan {
  // Try to get from global window object first (for webview)
  if (typeof window !== 'undefined' && window.userPlan) {
    return window.userPlan as UserPlan;
  }
  
  return currentUserPlan;
}

export function isFeatureAvailable(feature: Feature): boolean {
  return featureMatrix[getUserPlan()][feature] || false;
}

export function isPlanAtLeast(required: UserPlan): boolean {
  const rank = { Free: 0, LocalPro: 1, CloudPro: 2 };
  const currentPlan = getUserPlan();
  const result = rank[currentPlan] >= rank[required];
  console.log(`[PlanManager] isPlanAtLeast(${required}) ? ${result} Current: ${currentPlan}`);
  return result;
}

/**
* Check if cloud AI is available with current plan
* Considers both built-in CloudAI and BYOK options
*/
export function isCloudAIAvailable(): boolean {
  return isFeatureAvailable('CloudAI') || isFeatureAvailable('CloudAI_BYOK');
}

/**
* Check if current plan can use BYOK (Bring Your Own Key) for cloud models
*/
export function canUseBYOK(): boolean {
  return isFeatureAvailable('CloudAI_BYOK');
}