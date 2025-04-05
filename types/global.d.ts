export {};

declare global {
  var ollamaProcess: any;
  function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
    setState: (state: any) => void;
    getState: () => any;
    
  };

  interface Window {
    userPlan?: 'Free' | 'LocalPro' | 'CloudPro';
    userApiKeys?: Record<string, string>;
    isAdmin?: boolean;
  }

  interface EmscriptenModule {
    onRuntimeInitialized?: () => void;
    [key: string]: any;
  }
}
