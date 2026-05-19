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

// ---- 测试用例类型 ----

export interface TestStep {
  step_id: number
  action: string
  expected_result: string
}

export interface TestCase {
  case_id: string
  title: string
  priority: 'High' | 'Medium' | 'Low'
  risk_assessment: {
    score: number
    reason: string
  }
  preconditions: string
  test_type: string
  steps: TestStep[]
}

export interface TestSuite {
  suite_name: string
  description: string
  test_cases: TestCase[]
}

export interface GeneratedTestSuite {
  test_suite: TestSuite
}

export function validateTestSuite(raw: unknown): ValidationResult {
  const data = raw as Record<string, unknown>

  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Response is not an object' }
  }

  const suite = data.test_suite as Record<string, unknown> | undefined
  if (!suite || typeof suite !== 'object') {
    return { valid: false, error: 'Missing "test_suite" object' }
  }
  if (typeof suite.suite_name !== 'string' || !suite.suite_name) {
    return { valid: false, error: 'Missing or invalid "test_suite.suite_name"' }
  }
  if (!Array.isArray(suite.test_cases)) {
    return { valid: false, error: '"test_suite.test_cases" must be an array' }
  }

  for (let i = 0; i < suite.test_cases.length; i++) {
    const tc = suite.test_cases[i] as Record<string, unknown>
    const label = `test_cases[${i}]`
    if (typeof tc.case_id !== 'string' || !tc.case_id) {
      return { valid: false, error: `${label}: missing or invalid "case_id"` }
    }
    if (typeof tc.title !== 'string' || !tc.title) {
      return { valid: false, error: `${label}: missing or invalid "title"` }
    }
    if (!Array.isArray(tc.steps)) {
      return { valid: false, error: `${label}: "steps" must be an array` }
    }
    for (let j = 0; j < tc.steps.length; j++) {
      const s = tc.steps[j] as Record<string, unknown>
      if (typeof s.step_id !== 'number' || typeof s.action !== 'string' || typeof s.expected_result !== 'string') {
        return { valid: false, error: `${label}: steps[${j}]: missing required fields` }
      }
    }
  }

  return { valid: true, data: undefined }
}
