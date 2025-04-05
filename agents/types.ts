export interface AgentHandler {
    id: string;
    name: string;
    description?: string;
    run: (params: {
      input: any;
      userId?: string;
      filePath?: string;
    }) => Promise<{ output: string }>;
  }
  