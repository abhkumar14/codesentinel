import { useState } from 'react'
import { FinalReport, AgentResult } from '../types'
import {
  FileText, Shield, Bug, Zap, Code2, User,
  AlertTriangle, CheckCircle, XCircle, Info,
  ChevronDown, ChevronUp, Download
} from 'lucide-react'

// ── Robust JSON extractor ─────────────────────────────────────────────────────
function parseJSON(raw: string): any {
  if (!raw) return null
  try {
    let s = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const start = s.indexOf('{')
    if (start === -1) return null
    let depth = 0, end = -1
    for (let i = start; i < s.length; i++) {
      if (s[i] === '{') depth++
      else if (s[i] === '}') { depth--; if (depth === 0) { end = i; break } }
    }
    const jsonStr = end !== -1 ? s.slice(start, end + 1) : s.slice(start)
    return JSON.parse(jsonStr)
  } catch {
    try { return JSON.parse(raw) } catch { return null }
  }
}

// ── Safe findings accessor — handles both camelCase and snake_case keys ───────
function getFindings(report: FinalReport): AgentResult[] {
  const r = report as any
  const findings =
    r.allFindings ??   // Java Jackson camelCase
    r.all_findings ??   // Python snake_case
    r.findings ??   // fallback
    []
  return Array.isArray(findings) ? findings : []
}

function getFinalReportResult(report: FinalReport): AgentResult | null {
  const r = report as any
  return r.finalReport ?? r.final_report ?? null
}

// ── Scorecard derived from individual agent outputs ───────────────────────────
function deriveScorecard(findings: AgentResult[]): Record<string, number | null> {
  // Guard: ensure findings is always an array
  if (!Array.isArray(findings) || findings.length === 0) {
    return { syntax: null, security: null, style: null, dependencies: null, testability: null, overall: null }
  }

  const fieldMap: Record<string, [string, string]> = {
    syntax_checker: ['syntax', 'score'],
    sast_scanner: ['security', 'secure_coding_score'],
    dast_scanner: ['security', 'runtime_score'],
    pentest_agent: ['security', 'pentest_score'],
    style_linter: ['style', 'maintainability_index'],
    dependency_auditor: ['dependencies', 'supply_chain_score'],
    summarizer: ['overall', 'overall_score'],
    human_reviewer: ['testability', 'testability_score'],
  }

  const scores: Record<string, number> = {}

  for (const f of findings) {
    if (!f?.agent) continue
    const mapping = fieldMap[f.agent]
    if (!mapping) continue
    const parsed = parseJSON(f.result ?? '')
    if (!parsed) continue
    const val = parsed[mapping[1]]
    if (val == null) continue
    let num = parseFloat(val)
    if (isNaN(num)) continue
    if (mapping[1] === 'testability_score') num = num * 10
    const clamped = Math.min(100, Math.max(0, Math.round(num)))
    // Take highest score when multiple agents map to same category
    if (scores[mapping[0]] == null || clamped > scores[mapping[0]]) {
      scores[mapping[0]] = clamped
    }
  }

  if (Object.keys(scores).length > 0 && scores.overall == null) {
    const vals = Object.values(scores)
    scores.overall = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  return {
    syntax: scores.syntax ?? null,
    security: scores.security ?? null,
    style: scores.style ?? null,
    dependencies: scores.dependencies ?? null,
    testability: scores.testability ?? null,
    overall: scores.overall ?? null,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ScoreRing({ score, label, color }: { score: number | null; label: string; color: string }) {
  const r = 24, circ = 2 * Math.PI * r
  const safeScore = score ?? 0
  const offset = circ - (safeScore / 100) * circ
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 60 60" className="w-14 h-14 -rotate-90">
          <circle cx="30" cy="30" r={r} fill="none" stroke="#1e2d4a" strokeWidth="4" />
          {score !== null && (
            <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="4"
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
              className="transition-all duration-1000" />
          )}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-semibold"
          style={{ color: score !== null ? color : '#475569' }}>
          {score !== null ? score : '—'}
        </span>
      </div>
      <span className="text-[10px] text-slate-500 text-center leading-tight">{label}</span>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-950 text-red-300 border-red-800',
    high: 'bg-orange-950 text-orange-300 border-orange-800',
    medium: 'bg-yellow-950 text-yellow-300 border-yellow-800',
    low: 'bg-blue-950 text-blue-300 border-blue-800',
    info: 'bg-slate-800 text-slate-400 border-slate-700',
  }
  const key = severity?.toLowerCase() ?? 'info'
  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${map[key] ?? map.info}`}>
      {severity}
    </span>
  )
}

function AgentSection({ finding }: { finding: AgentResult }) {
  const [open, setOpen] = useState(false)
  const parsed = parseJSON(finding?.result ?? '')

  const colors: Record<string, string> = {
    syntax_checker: '#14b8a6', sast_scanner: '#ef4444', dast_scanner: '#f59e0b',
    pentest_agent: '#8b5cf6', style_linter: '#3b82f6', dependency_auditor: '#22c55e',
    summarizer: '#06b6d4', human_reviewer: '#f97316', report_generator: '#a855f7',
  }
  const color = colors[finding?.agent ?? ''] ?? '#94a3b8'

  if (!finding?.agent) return null

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#1e2d4a', background: '#0f1629' }}>
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
        onClick={() => setOpen(o => !o)}>
        <span className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
          style={{ background: color + '22', color }}>
          <FileText size={14} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-200 capitalize">
            {finding.agent.replace(/_/g, ' ')}
          </div>
          {parsed?.severity && <SeverityBadge severity={parsed.severity} />}
        </div>
        {finding.status === 'error'
          ? <XCircle size={14} className="text-red-400 flex-shrink-0" />
          : <CheckCircle size={14} className="text-green-400 flex-shrink-0" />}
        {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-800">
          {finding.agent === 'human_reviewer' && parsed
            ? <HumanReviewSection data={parsed} />
            : parsed
              ? <pre className="mt-3 text-[11px] font-mono text-slate-300 overflow-auto rounded-lg p-3"
                style={{ background: '#0a0e1a', maxHeight: '400px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(parsed, null, 2)}
              </pre>
              : <pre className="mt-3 text-[11px] font-mono text-slate-400 overflow-auto rounded-lg p-3"
                style={{ background: '#0a0e1a', maxHeight: '300px', whiteSpace: 'pre-wrap' }}>
                {finding.result || 'No output'}
              </pre>
          }
        </div>
      )}
    </div>
  )
}

function HumanReviewSection({ data }: { data: any }) {
  const verdictColor = {
    APPROVE: '#22c55e',
    APPROVE_WITH_COMMENTS: '#f59e0b',
    REQUEST_CHANGES: '#ef4444',
  }[data.verdict] ?? '#94a3b8'

  return (
    <div className="mt-3 space-y-4">
      <div className="flex items-center gap-3 rounded-lg p-3"
        style={{ background: verdictColor + '18', border: `1px solid ${verdictColor}44` }}>
        <span className="text-lg">
          {data.verdict === 'APPROVE' ? '✅' : data.verdict === 'REQUEST_CHANGES' ? '🔴' : '💬'}
        </span>
        <div>
          <div className="text-sm font-semibold" style={{ color: verdictColor }}>
            {data.verdict?.replace(/_/g, ' ')}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{data.verdict_reason}</div>
        </div>
      </div>
      {data.first_impressions && (
        <p className="text-sm text-slate-300 leading-relaxed">{data.first_impressions}</p>
      )}
      {Array.isArray(data.critical_issues) && data.critical_issues.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <AlertTriangle size={11} /> Critical Issues
          </div>
          <div className="space-y-2">
            {data.critical_issues.map((issue: any, i: number) => (
              <div key={i} className="rounded-lg p-3 border" style={{ background: '#2d0f0f', borderColor: '#7f1d1d' }}>
                <div className="text-sm font-medium text-red-300 mb-1">{issue.title}</div>
                <p className="text-xs text-slate-400 leading-relaxed">{issue.explanation}</p>
                {issue.example_fix && (
                  <pre className="mt-2 text-[10px] font-mono text-green-400 rounded p-2"
                    style={{ background: '#0a0e1a' }}>{issue.example_fix}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {Array.isArray(data.praise) && data.praise.length > 0 && (
        <ul className="space-y-1">
          {data.praise.map((p: string, i: number) => (
            <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>{p}
            </li>
          ))}
        </ul>
      )}
      {data.mentoring_moment && (
        <div className="rounded-lg p-3"
          style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div className="text-xs font-semibold text-blue-400 mb-1">
            💡 {data.mentoring_moment.topic}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{data.mentoring_moment.explanation}</p>
        </div>
      )}
      {data.closing_comment && (
        <p className="text-xs text-slate-400 italic border-t border-slate-800 pt-3">
          {data.closing_comment}
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props { report: FinalReport }

export function ReportViewer({ report }: Props) {
  // Safely extract findings — handles both Java (camelCase) and Python (snake_case)
  const findings = getFindings(report)
  const finalReportResult = getFinalReportResult(report)
  const reportData = parseJSON(finalReportResult?.result ?? '')

  // Scorecard: from report_generator, or derived from individual agents
  let scorecard = reportData?.scorecard
  if (!scorecard || Object.values(scorecard).every((v: any) => v === 0 || v == null)) {
    scorecard = deriveScorecard(findings)
  }

  const sc = {
    syntax: null, security: null, style: null,
    dependencies: null, testability: null, overall: null,
    ...scorecard,
  }

  const downloadReport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `codesentinel-report-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const language = (report as any).language ?? '—'
  const selectedAgents: string[] = (report as any).selectedAgents ?? (report as any).selected_agents ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Analysis Report</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-500 font-mono">{language}</span>
            <span className="text-slate-700">•</span>
            <span className="text-xs text-slate-500">{selectedAgents.length} agents ran</span>
            {reportData?.report_metadata?.overall_risk && (
              <>
                <span className="text-slate-700">•</span>
                <SeverityBadge severity={reportData.report_metadata.overall_risk} />
              </>
            )}
          </div>
        </div>
        <button onClick={downloadReport}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 border border-slate-700 hover:border-slate-500 transition-colors">
          <Download size={12} /> Export JSON
        </button>
      </div>

      {/* Executive summary */}
      {reportData?.executive_summary && (
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Info size={13} className="text-blue-400" />
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Executive Summary
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{reportData.executive_summary}</p>
        </div>
      )}

      {/* Scorecard — always shown */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scorecard</span>
          {!reportData?.scorecard && findings.length > 0 && (
            <span className="text-[10px] text-slate-600 font-mono">(derived from agent outputs)</span>
          )}
        </div>
        <div className="flex flex-wrap gap-6 justify-center">
          <ScoreRing score={sc.overall} label="Overall" color="#3b82f6" />
          <ScoreRing score={sc.security} label="Security" color="#ef4444" />
          <ScoreRing score={sc.syntax} label="Syntax" color="#14b8a6" />
          <ScoreRing score={sc.style} label="Style" color="#8b5cf6" />
          <ScoreRing score={sc.dependencies} label="Deps" color="#22c55e" />
          <ScoreRing score={sc.testability} label="Testing" color="#f59e0b" />
        </div>
      </div>

      {/* Immediate action items */}
      {Array.isArray(reportData?.action_items?.immediate) &&
        reportData.action_items.immediate.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-1">
              <AlertTriangle size={11} /> Immediate Action Items
            </div>
            <div className="space-y-2">
              {reportData.action_items.immediate.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{ background: '#1a0a0a', border: '1px solid #3f1010' }}>
                  <span className="text-xs font-mono text-red-500">{item.id}</span>
                  <span className="text-xs text-slate-300 flex-1">{item.title}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{item.effort}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Per-agent results */}
      {findings.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Agent Results
          </div>
          <div className="space-y-2">
            {findings.map((f, i) => <AgentSection key={f?.agent ?? i} finding={f} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {findings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center"
          style={{ border: '1px dashed #1e2d4a', borderRadius: '12px' }}>
          <FileText size={32} className="text-slate-700 mb-3" />
          <p className="text-sm text-slate-600">No agent findings available</p>
        </div>
      )}
    </div>
  )
}
