import { useEffect, useState } from 'react'
import { AgentConfig } from '../types'
import { api } from '../lib/api'
import { Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, Cpu } from 'lucide-react'

const PHASE_COLORS = { parallel: '#3b82f6', sequential: '#8b5cf6' }

interface NewAgentForm {
  name: string
  phase: 'parallel' | 'sequential'
  model: string
  description: string
  prompt_template: string
}

const EMPTY_FORM = (): NewAgentForm => ({
  name: '',
  phase: 'parallel',
  model: 'llama3',
  description: '',
  prompt_template: 'You are a code review expert. Analyse the following {language} code:\n\n```\n{code}\n```\n\nReturn your findings as JSON.',
})

export function AgentRegistry() {
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewAgentForm>(EMPTY_FORM())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const { agents } = await api.listAgents()
      setAgents(agents)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggle = async (name: string, enabled: boolean) => {
    await api.toggleAgent(name, enabled)
    setAgents(prev => prev.map(a => a.name === name ? { ...a, enabled } : a))
  }

  const remove = async (name: string) => {
    if (!confirm(`Delete agent "${name}"?`)) return
    await api.deleteAgent(name)
    setAgents(prev => prev.filter(a => a.name !== name))
  }

  const submit = async () => {
    if (!form.name.trim() || !form.prompt_template.trim()) {
      setError('Name and prompt template are required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.registerAgent(form)
      setShowForm(false)
      setForm(EMPTY_FORM())
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const parallel = agents.filter(a => a.phase === 'parallel')
  const sequential = agents.filter(a => a.phase === 'sequential')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Agent Registry</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage and dynamically register agents at runtime</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: showForm ? '#1e3a5f' : 'rgba(59,130,246,0.15)',
              color: '#93c5fd',
              border: '1px solid rgba(59,130,246,0.3)',
            }}
          >
            <Plus size={14} /> Register Agent
          </button>
        </div>
      </div>

      {/* New agent form */}
      {showForm && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: '#0f1629', border: '1px solid #1e2d4a' }}>
          <h3 className="text-sm font-semibold text-slate-200">New Dynamic Agent</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Agent name *</label>
              <input
                className="w-full rounded-lg px-3 py-2 text-sm font-mono bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500"
                placeholder="e.g. license_checker"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Model</label>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500"
                value={form.model}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
              >
                <option value="llama3">llama3</option>
                <option value="codellama">codellama</option>
                <option value="mistral">mistral</option>
                <option value="llama3.1">llama3.1</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Phase</label>
            <div className="flex gap-2">
              {(['parallel', 'sequential'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setForm(f => ({ ...f, phase: p }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                  style={{
                    background: form.phase === p ? PHASE_COLORS[p] + '33' : 'transparent',
                    color: form.phase === p ? (p === 'parallel' ? '#93c5fd' : '#c4b5fd') : '#64748b',
                    border: `1px solid ${form.phase === p ? PHASE_COLORS[p] + '66' : '#334155'}`,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Description</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500"
              placeholder="What does this agent do?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Prompt template * <span className="text-slate-600">(use {'{code}'} and {'{language}'})</span>
            </label>
            <textarea
              rows={6}
              className="w-full rounded-lg px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 text-slate-300 focus:outline-none focus:border-blue-500 resize-none"
              value={form.prompt_template}
              onChange={e => setForm(f => ({ ...f, prompt_template: e.target.value }))}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowForm(false); setError('') }}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: '#3b82f6' }}
            >
              {submitting ? 'Registering…' : 'Register Agent'}
            </button>
          </div>
        </div>
      )}

      {/* Agent lists */}
      {[
        { label: 'Parallel Agents', items: parallel, color: '#3b82f6' },
        { label: 'Sequential Chain', items: sequential, color: '#8b5cf6' },
      ].map(({ label, items, color }) => (
        <div key={label}>
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={13} style={{ color }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</span>
            <span className="text-xs text-slate-600">({items.length})</span>
          </div>
          <div className="space-y-2">
            {items.map(agent => (
              <div
                key={agent.name}
                className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
                style={{
                  background: '#0f1629',
                  border: `1px solid ${agent.enabled ? '#1e2d4a' : '#111827'}`,
                  opacity: agent.enabled ? 1 : 0.6,
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-slate-200">{agent.name}</span>
                    {agent.builtin && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#1e3a5f', color: '#60a5fa' }}>
                        built-in
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-slate-500">{agent.model}</span>
                    {agent.description && (
                      <span className="text-[10px] text-slate-600 truncate">• {agent.description}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggle(agent.name, !agent.enabled)}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                    title={agent.enabled ? 'Disable' : 'Enable'}
                  >
                    {agent.enabled
                      ? <ToggleRight size={18} style={{ color }} />
                      : <ToggleLeft size={18} />}
                  </button>
                  {!agent.builtin && (
                    <button
                      onClick={() => remove(agent.name)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
