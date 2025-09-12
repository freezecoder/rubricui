'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, AlertCircle, Check } from 'lucide-react';
import { parseCondition, formatConditionForStorage, ParsedCondition, validateBooleanCondition } from '@/lib/ruleUtils';

interface RuleConditionEditorProps {
  conditions: string[];
  onConditionsChange: (conditions: string[]) => void;
  isEditing: boolean;
  className?: string;
}

interface ConditionRowProps {
  condition: ParsedCondition;
  index: number;
  onUpdate: (index: number, condition: string, score: string) => void;
  onRemove: (index: number) => void;
  isEditing: boolean;
}

function ConditionRow({ condition, index, onUpdate, onRemove, isEditing }: ConditionRowProps) {
  const [conditionText, setConditionText] = useState(condition.condition);
  const [scoreText, setScoreText] = useState(condition.score);
  const [validation, setValidation] = useState(validateBooleanCondition(condition.condition));
  const lastUpdateRef = useRef({ condition: conditionText, score: scoreText });

  useEffect(() => {
    const newValidation = validateBooleanCondition(conditionText);
    setValidation(newValidation);
  }, [conditionText]);

  // Only update parent when values actually change
  useEffect(() => {
    if (lastUpdateRef.current.condition !== conditionText || lastUpdateRef.current.score !== scoreText) {
      lastUpdateRef.current = { condition: conditionText, score: scoreText };
      onUpdate(index, conditionText, scoreText);
    }
  }, [conditionText, scoreText, index, onUpdate]);

  if (!isEditing) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
        <span className="text-sm font-medium text-gray-500 w-8 flex-shrink-0">
          {index + 1}.
        </span>
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Condition
            </label>
            <code className="block text-sm bg-white px-3 py-2 rounded border font-mono">
              {condition.condition || 'No condition'}
            </code>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Score
            </label>
            <code className="block text-sm bg-white px-3 py-2 rounded border font-mono">
              {condition.score || 'No score'}
            </code>
          </div>
        </div>
        {!condition.isValid && (
          <div className="flex items-center text-red-600 text-xs">
            <AlertCircle className="h-4 w-4 mr-1" />
            Invalid
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
      <span className="text-sm font-medium text-gray-500 w-8 flex-shrink-0 mt-2">
        {index + 1}.
      </span>
      <div className="flex-1 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Boolean Condition
          </label>
          <div className="relative">
            <input
              type="text"
              value={conditionText}
              onChange={(e) => setConditionText(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                validation.isValid 
                  ? 'border-gray-300' 
                  : 'border-red-300 bg-red-50'
              }`}
              placeholder="e.g., x > 0.45"
            />
            {validation.isValid ? (
              <Check className="absolute right-2 top-2.5 h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="absolute right-2 top-2.5 h-4 w-4 text-red-600" />
            )}
          </div>
          {!validation.isValid && validation.error && (
            <p className="text-xs text-red-600 mt-1 flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" />
              {validation.error}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Score Value
          </label>
          <input
            type="text"
            value={scoreText}
            onChange={(e) => setScoreText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="e.g., 6, 4, 2, NA"
          />
        </div>
      </div>
      <button
        onClick={() => onRemove(index)}
        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-2"
        title="Remove condition"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function RuleConditionEditor({ 
  conditions, 
  onConditionsChange, 
  isEditing, 
  className = '' 
}: RuleConditionEditorProps) {
  const [parsedConditions, setParsedConditions] = useState<ParsedCondition[]>([]);

  useEffect(() => {
    const parsed = conditions.map(parseCondition);
    setParsedConditions(parsed);
  }, [conditions]);

  const handleConditionUpdate = useCallback((index: number, condition: string, score: string) => {
    const updated = [...parsedConditions];
    updated[index] = {
      condition,
      score,
      isValid: validateBooleanCondition(condition).isValid,
      error: validateBooleanCondition(condition).error
    };
    setParsedConditions(updated);
    
    // Convert back to storage format and notify parent
    const storageFormat = updated.map(pc => formatConditionForStorage(pc.condition, pc.score));
    onConditionsChange(storageFormat);
  }, [parsedConditions, onConditionsChange]);

  const handleRemoveCondition = useCallback((index: number) => {
    const updated = parsedConditions.filter((_, i) => i !== index);
    setParsedConditions(updated);
    
    const storageFormat = updated.map(pc => formatConditionForStorage(pc.condition, pc.score));
    onConditionsChange(storageFormat);
  }, [parsedConditions, onConditionsChange]);

  const handleAddCondition = useCallback(() => {
    const newCondition: ParsedCondition = {
      condition: '',
      score: '',
      isValid: false,
      error: 'Condition cannot be empty'
    };
    
    const updated = [...parsedConditions, newCondition];
    setParsedConditions(updated);
    
    const storageFormat = updated.map(pc => formatConditionForStorage(pc.condition, pc.score));
    onConditionsChange(storageFormat);
  }, [parsedConditions, onConditionsChange]);

  const hasInvalidConditions = parsedConditions.some(pc => !pc.isValid);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Rule Conditions</h3>
          {hasInvalidConditions && (
            <div className="flex items-center text-red-600 text-sm">
              <AlertCircle className="h-4 w-4 mr-1" />
              Some conditions have errors
            </div>
          )}
        </div>
        {isEditing && (
          <button
            onClick={handleAddCondition}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Condition
          </button>
        )}
      </div>

      {parsedConditions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-400 mb-4">
            <AlertCircle className="h-12 w-12 mx-auto" />
          </div>
          <p className="text-lg font-medium mb-2">No conditions defined</p>
          <p className="text-sm mb-4">Add conditions to define when this rule applies and what score to assign.</p>
          {isEditing && (
            <button
              onClick={handleAddCondition}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Your First Condition
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {parsedConditions.map((condition, index) => (
            <ConditionRow
              key={index}
              condition={condition}
              index={index}
              onUpdate={handleConditionUpdate}
              onRemove={handleRemoveCondition}
              isEditing={isEditing}
            />
          ))}
        </div>
      )}

      {parsedConditions.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>Summary:</strong> {parsedConditions.length} condition{parsedConditions.length !== 1 ? 's' : ''} defined
            {hasInvalidConditions && (
              <span className="text-red-600 ml-2">
                • {parsedConditions.filter(pc => !pc.isValid).length} need{parsedConditions.filter(pc => !pc.isValid).length !== 1 ? '' : 's'} fixing
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
