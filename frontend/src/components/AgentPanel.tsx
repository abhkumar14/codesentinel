import { PipelineStatus } from '../types'
import { AgentCard } from './AgentCard'
import { Cpu, GitBranch } from 'lucide-react'

interface Props {
  pipeline: PipelineStatus
}

export function AgentPanel({ pipeline }: Props) {
  const agents = Object.values(pipeline.agents)
  const parallel = agents.filter(a => a.phase === 'parallel')
  const sequential = agents.filter(a => a.phase === 'sequential')

  const runningCount = agents.filter(a => a.status === 'running').length
  const doneCount = agents.filter(a => a.status === 'complete').length
  const total = agents.length

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      {/* Pipeline status bar */}
      {pipeline.running && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: '#141c35', border: '1px solid #1e2d4a' }}
        >
          <div className="flex-1">
            <div className="text-xs text-slate-400 mb-1.5 font-mono">{pipeline.statusMessage}</div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: '3px', background: '#1e2d4a' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: total > 0 ? `${(doneCount / total) * 100}%` : '0%',
                  background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                }}
              />
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs font-mono text-slate-300">{doneCount}/{total}</div>
            <div className="text-[10px] text-slate-500">{runningCount} active</div>
          </div>
        </div>
      )}

      {/* Language detected */}
      {pipeline.language && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Detected language:</span>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: 'rgba(20,184,166,0.15)', color: '#5eead4' }}
          >
            {pipeline.language}
          </span>
        </div>
      )}

      {/* Parallel agents */}
      {parallel.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={13} className="text-blue-400" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Parallel Agents
            </span>
            <span className="text-xs text-slate-600">({parallel.length})</span>
          </div>
          <div className="flex flex-col gap-2">
            {parallel.map(a => <AgentCard key={a.name} agent={a} />)}
          </div>
        </div>
      )}

      {/* Barrier */}
      {sequential.length > 0 && parallel.length > 0 && (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px" style={{ background: '#1e2d4a' }} />
          <span className="text-[10px] font-mono text-slate-600 px-2">barrier • all parallel complete</span>
          <div className="flex-1 h-px" style={{ background: '#1e2d4a' }} />
        </div>
      )}

      {/* Sequential agents */}
      {sequential.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <GitBranch size={13} className="text-purple-400" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Sequential Chain
            </span>
            <span className="text-xs text-slate-600">({sequential.length})</span>
          </div>
          <div className="flex flex-col gap-2">
            {sequential.map(a => <AgentCard key={a.name} agent={a} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {agents.length === 0 && (
        <div
          className="rounded-xl flex flex-col items-center justify-center py-16 text-center"
          style={{ border: '1px dashed #1e2d4a' }}
        >
          <Cpu size={32} className="text-slate-700 mb-3" />
          <p className="text-sm text-slate-600">Agents will appear here</p>
          <p className="text-xs text-slate-700 mt-1">Submit code to start the pipeline</p>
        </div>
      )}
    </div>
  )
}
