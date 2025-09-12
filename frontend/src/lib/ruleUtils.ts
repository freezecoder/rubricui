/**
 * Utility functions for parsing and validating rule conditions
 */

export interface ParsedCondition {
  condition: string;
  score: string;
  isValid: boolean;
  error?: string;
}

/**
 * Parse a condition string in format "condition ~ score" into separate parts
 */
export function parseCondition(conditionStr: string): ParsedCondition {
  let trimmed = conditionStr.trim();
  
  // Remove surrounding quotes if present
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || 
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1);
  }
  
  // Handle empty condition
  if (!trimmed) {
    return {
      condition: '',
      score: '',
      isValid: false,
      error: 'Condition cannot be empty'
    };
  }

  // Split by ~ separator
  const parts = trimmed.split('~');
  
  if (parts.length !== 2) {
    return {
      condition: trimmed,
      score: '',
      isValid: false,
      error: 'Condition must contain exactly one "~" separator'
    };
  }

  const condition = parts[0].trim();
  const score = parts[1].trim();

  // Validate condition
  const conditionValidation = validateBooleanCondition(condition);
  
  return {
    condition,
    score,
    isValid: conditionValidation.isValid,
    error: conditionValidation.error
  };
}

/**
 * Validate a boolean condition string
 */
export function validateBooleanCondition(condition: string): { isValid: boolean; error?: string } {
  if (!condition.trim()) {
    return { isValid: false, error: 'Condition cannot be empty' };
  }

  // Check for incomplete comparisons
  const incompletePatterns = [
    /[<>=!]\s*$/,  // Ends with operator
    /^\s*[<>=!]/,  // Starts with operator
    /[<>=!]\s*[<>=!]/,  // Double operators
    /&\s*$/,       // Ends with &
    /^\s*&/,       // Starts with &
    /\|\s*$/,      // Ends with |
    /^\s*\|/,      // Starts with |
    /&&\s*$/,      // Ends with &&
    /^\s*&&/,      // Starts with &&
    /\|\|\s*$/,    // Ends with ||
    /^\s*\|\|/,    // Starts with ||
  ];

  for (const pattern of incompletePatterns) {
    if (pattern.test(condition)) {
      return { isValid: false, error: 'Incomplete boolean expression' };
    }
  }

  // Check for unmatched parentheses
  const openParens = (condition.match(/\(/g) || []).length;
  const closeParens = (condition.match(/\)/g) || []).length;
  
  if (openParens !== closeParens) {
    return { isValid: false, error: 'Unmatched parentheses' };
  }

  // Check for valid variable names (basic validation)
  const variablePattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
  const variables = condition.match(variablePattern) || [];
  
  // Check for invalid characters
  const invalidChars = /[^a-zA-Z0-9_<>=!&|()\s.+-]/g;
  const invalidMatches = condition.match(invalidChars);
  
  if (invalidMatches && invalidMatches.length > 0) {
    return { isValid: false, error: `Invalid characters: ${invalidMatches.join(', ')}` };
  }

  return { isValid: true };
}

/**
 * Format a condition and score back into the storage format
 */
export function formatConditionForStorage(condition: string, score: string): string {
  const trimmedCondition = condition.trim();
  const trimmedScore = score.trim();
  
  if (!trimmedCondition) {
    return '';
  }
  
  if (!trimmedScore) {
    return trimmedCondition;
  }
  
  return `${trimmedCondition} ~ ${trimmedScore}`;
}

/**
 * Parse multiple conditions from the ruleset_conditions array
 */
export function parseConditions(conditions: string[]): ParsedCondition[] {
  return conditions.map(parseCondition);
}

/**
 * Format parsed conditions back to storage format
 */
export function formatConditionsForStorage(parsedConditions: ParsedCondition[]): string[] {
  return parsedConditions.map(pc => formatConditionForStorage(pc.condition, pc.score));
}
