import { PipelineStatus } from '../types'
import { Activity } from 'lucide-react'

const EVENT_COLORS: Record<string, string> = {
  language_detected:  '#14b8a6',
  meta_agent_deciding:'#8b5cf6',
  agents_selected:    '#3b82f6',
  parallel_start:     '#f59e0b',
  barrier_complete:   '#22c55e',
  error:              '#ef4444',
  detecting_language: '#94a3b8',
}

interface Props { pipeline: PipelineStatus }

export function StreamLog({ pipeline }: Props) {
  const agents = Object.values(pipeline.pipeline?.agents ?? pipeline.agents ?? {})

  const events: { time: string; label: string; color: string }[] = []

  if (pipeline.language) {
    events.push({ time: '', label: `Language: ${pipeline.language}`, color: '#14b8a6' })
  }
  if (pipeline.selectedAgents?.length) {
    events.push({ time: '', label: `Agents selected: ${pipeline.selectedAgents.join(', ')}`, color: '#3b82f6' })
  }

  agents.forEach(a => {
    if (a.startedAt) {
      events.push({
        time: new Date(a.startedAt).toLocaleTimeString('en', { hour12: false }),
        label: `▶ ${a.name} started (${a.phase})`,
        color: a.phase === 'parallel' ? '#3b82f6' : '#8b5cf6',
      })
    }
    if (a.completedAt) {
      events.push({
        time: new Date(a.completedAt).toLocaleTimeString('en', { hour12: false }),
        label: `${a.status === 'complete' ? '✓' : '✗'} ${a.name} ${a.status}`,
        color: a.status === 'complete' ? '#22c55e' : '#ef4444',
      })
    }
  })

  if (pipeline.finalReport) {
    events.push({ time: '', label: '🎯 Pipeline complete', color: '#a855f7' })
  }

  return (
    <div
      className="rounded-xl p-4 h-full overflow-y-auto"
      style={{ background: '#0a0e1a', border: '1px solid #1e2d4a' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Activity size={13} className="text-slate-500" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Event Stream</span>
        {pipeline.running && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            live
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-center">
          <Activity size={24} className="text-slate-800 mb-2" />
          <p className="text-xs text-slate-700">Pipeline events will stream here</p>
        </div>
      ) : (
        <div className="space-y-1.5 font-mono text-[11px]">
          {events.map((e, i) => (
            <div key={i} className="flex items-start gap-2">
              {e.time && <span className="text-slate-600 flex-shrink-0 w-16">{e.time}</span>}
              <span style={{ color: e.color }}>{e.label}</span>
            </div>
          ))}
          {pipeline.running && (
            <div className="flex items-center gap-2 mt-2">
              <span className="w-1.5 h-3 bg-blue-500 animate-pulse rounded" />
              <span className="text-slate-600">{pipeline.statusMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
