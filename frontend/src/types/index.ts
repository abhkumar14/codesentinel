export type AgentPhase = 'parallel' | 'sequential'
export type Severity = 'low' | 'medium' | 'high' | 'critical' | 'info'
export type AgentStatus = 'idle' | 'running' | 'complete' | 'error'

export interface AgentConfig {
  name: string
  phase: AgentPhase
  model: string
  builtin: boolean
  description: string
  prompt_template: string | null
  enabled: boolean
}

export interface AgentResult {
  agent: string
  model: string
  result: string
  status: 'complete' | 'error'
}

export interface PipelineEvent {
  type:
    | 'agent_start'
    | 'agent_token'
    | 'agent_complete'
    | 'agent_error'
    | 'pipeline_complete'
    | 'pipeline_status'
  agent?: string
  phase?: AgentPhase
  token?: string
  result?: AgentResult
  error?: string
  status?: string
  message?: string
  report?: FinalReport
}

export interface FinalReport {
  language: string
  selected_agents: string[]
  all_findings: AgentResult[]
  final_report: AgentResult
}

export interface AgentState {
  name: string
  phase: AgentPhase
  status: AgentStatus
  output: string
  result?: AgentResult
  startedAt?: number
  completedAt?: number
}

export interface PipelineStatus {
  running: boolean
  sessionId: string | null
  language: string | null
  selectedAgents: string[]
  statusMessage: string
  agents: Record<string, AgentState>
  finalReport: FinalReport | null
  error: string | null
}
