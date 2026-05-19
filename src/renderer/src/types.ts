// ---- 共享类型定义 ----

export interface RiskAssessment {
  score: number
  priority: 'Low' | 'Medium' | 'High'
  reason: string
}

export interface CoverageItem {
  id: string
  name: string
  valid_range: string
  expected_action: string
}

export interface TestStrategy {
  id: string
  target_item_id: string
  method: string
  proposed_test_points: string[]
}

export interface Requirement {
  requirement_id: string
  original_text: string
  risk_assessment: RiskAssessment
  coverage_items: CoverageItem[]
  test_strategies: TestStrategy[]
}

// ---- LLM 响应校验 ----

export interface ValidationResult {
  valid: boolean
  error?: string
  data?: Requirement[]
}

export function validateRequirements(raw: unknown): ValidationResult {
  if (!Array.isArray(raw)) {
    return {
      valid: false,
      error: `Expected an array of requirements, got ${typeof raw}`
    }
  }

  if (raw.length === 0) {
    return { valid: false, error: 'Requirements array is empty' }
  }

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i] as Record<string, unknown>
    const label = `[${i}]`

    if (!r || typeof r !== 'object') {
      return { valid: false, error: `${label}: not an object` }
    }
    if (typeof r.requirement_id !== 'string' || !r.requirement_id) {
      return { valid: false, error: `${label}: missing or invalid "requirement_id"` }
    }
    if (typeof r.original_text !== 'string' || !r.original_text) {
      return { valid: false, error: `${label}: missing or invalid "original_text"` }
    }

    const risk = r.risk_assessment as Record<string, unknown> | undefined
    if (!risk || typeof risk !== 'object') {
      return { valid: false, error: `${label}: missing "risk_assessment" object` }
    }
    if (typeof risk.score !== 'number') {
      return { valid: false, error: `${label}: risk_assessment.score must be a number` }
    }
    if (!['Low', 'Medium', 'High'].includes(risk.priority as string)) {
      return {
        valid: false,
        error: `${label}: risk_assessment.priority "${risk.priority}" is not Low/Medium/High`
      }
    }
    if (typeof risk.reason !== 'string' || !risk.reason) {
      return { valid: false, error: `${label}: missing or invalid risk_assessment.reason` }
    }

    if (!Array.isArray(r.coverage_items)) {
      return { valid: false, error: `${label}: "coverage_items" must be an array` }
    }
    for (let j = 0; j < (r.coverage_items as unknown[]).length; j++) {
      const ci = (r.coverage_items as unknown[])[j] as Record<string, unknown>
      if (typeof ci.id !== 'string' || typeof ci.name !== 'string') {
        return { valid: false, error: `${label}: coverage_items[${j}]: missing "id" or "name"` }
      }
      if (!/^C_\d{3}$/.test(ci.id as string)) {
        return {
          valid: false,
          error: `${label}: coverage_items[${j}].id "${ci.id}" must match pattern C_001, C_002, ...`
        }
      }
    }

    if (!Array.isArray(r.test_strategies)) {
      return { valid: false, error: `${label}: "test_strategies" must be an array` }
    }
    for (let j = 0; j < (r.test_strategies as unknown[]).length; j++) {
      const ts = (r.test_strategies as unknown[])[j] as Record<string, unknown>
      if (
        typeof ts.id !== 'string' ||
        typeof ts.target_item_id !== 'string' ||
        !Array.isArray(ts.proposed_test_points)
      ) {
        return {
          valid: false,
          error: `${label}: test_strategies[${j}]: missing required fields`
        }
      }
      if (!/^S_\d{3}$/.test(ts.id as string)) {
        return {
          valid: false,
          error: `${label}: test_strategies[${j}].id "${ts.id}" must match pattern S_001, S_002, ...`
        }
      }
    }
  }

  return { valid: true, data: raw as Requirement[] }
}
