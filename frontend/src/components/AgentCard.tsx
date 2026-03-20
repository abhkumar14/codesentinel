import { useState } from 'react'
import { AgentState } from '../types'
import {
  Shield, Bug, Zap, Eye, Code2, Package,
  FileText, User, BarChart3, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Loader2, Clock
} from 'lucide-react'

const AGENT_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  syntax_checker:    { icon: <Code2 size={14} />,    color: '#14b8a6', label: 'Syntax' },
  sast_scanner:      { icon: <Shield size={14} />,   color: '#ef4444', label: 'SAST' },
  dast_scanner:      { icon: <Zap size={14} />,      color: '#f59e0b', label: 'DAST' },
  pentest_agent:     { icon: <Bug size={14} />,       color: '#8b5cf6', label: 'Pentest' },
  style_linter:      { icon: <Eye size={14} />,       color: '#3b82f6', label: 'Style' },
  dependency_auditor:{ icon: <Package size={14} />,   color: '#22c55e', label: 'Dependencies' },
  summarizer:        { icon: <BarChart3 size={14} />, color: '#06b6d4', label: 'Summarizer' },
  human_reviewer:    { icon: <User size={14} />,      color: '#f97316', label: 'Human Review' },
  report_generator:  { icon: <FileText size={14} />,  color: '#a855f7', label: 'Report' },
}

function elapsed(start?: number, end?: number): string {
  if (!start) return ''
  const ms = (end ?? Date.now()) - start
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

interface Props { agent: AgentState }

export function AgentCard({ agent }: Props) {
  const [expanded, setExpanded] = useState(false)
  const meta = AGENT_META[agent.name] ?? { icon: <Code2 size={14} />, color: '#94a3b8', label: agent.name }

  const statusIcon = {
    idle:     <Clock size={14} className="text-slate-500" />,
    running:  <Loader2 size={14} className="animate-spin" style={{ color: meta.color }} />,
    complete: <CheckCircle size={14} className="text-green-400" />,
    error:    <XCircle size={14} className="text-red-400" />,
  }[agent.status]

  const phaseBadge = agent.phase === 'parallel'
    ? <span style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd' }} className="px-1.5 py-0.5 rounded text-[10px] font-mono">parallel</span>
    : <span style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }} className="px-1.5 py-0.5 rounded text-[10px] font-mono">sequential</span>

  const outputPreview = agent.output.slice(-400)

  return (
    <div
      className="rounded-xl border transition-all duration-200"
      style={{
        background: agent.status === 'running'
          ? `linear-gradient(135deg, #0f1629, #141c35)`
          : '#0f1629',
        borderColor: agent.status === 'running' ? meta.color + '55' : '#1e2d4a',
        boxShadow: agent.status === 'running' ? `0 0 20px ${meta.color}18` : 'none',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => agent.output && setExpanded(e => !e)}
      >
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
          style={{ background: meta.color + '22', color: meta.color }}
        >
          {meta.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">{meta.label}</span>
            {phaseBadge}
          </div>
          <div className="text-[11px] text-slate-500 font-mono truncate">{agent.name}</div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {agent.startedAt && (
            <span className="text-[11px] font-mono text-slate-500">
              {elapsed(agent.startedAt, agent.completedAt)}
            </span>
          )}
          {statusIcon}
          {agent.output && (
            expanded
              ? <ChevronUp size={14} className="text-slate-500" />
              : <ChevronDown size={14} className="text-slate-500" />
          )}
        </div>
      </div>

      {/* Live output / streaming */}
      {agent.status === 'running' && agent.output && (
        <div className="px-4 pb-3">
          <div
            className="rounded-lg p-3 font-mono text-[11px] text-slate-400 overflow-hidden"
            style={{ background: '#0a0e1a', maxHeight: '80px', lineHeight: '1.6' }}
          >
            <span className="opacity-60">…</span>
            {outputPreview}
            <span className="inline-block w-1.5 h-3 bg-blue-400 animate-pulse ml-0.5 align-middle" />
          </div>
        </div>
      )}

      {/* Expanded full output */}
      {expanded && agent.status !== 'running' && (
        <div className="px-4 pb-4">
          <div
            className="rounded-lg p-3 font-mono text-[11px] text-slate-300 overflow-auto"
            style={{ background: '#0a0e1a', maxHeight: '300px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {agent.output || <span className="text-slate-600">No output</span>}
          </div>
        </div>
      )}
    </div>
  )
}
