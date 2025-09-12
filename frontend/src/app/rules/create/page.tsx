'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiService } from '@/services/api';
import { Rule } from '@/types';
import { notify } from '@/lib/notifications';
import { 
  ArrowLeft, 
  Save, 
  Tag,
  Building2,
  User,
  Weight,
  Code,
  FileText,
  Plus,
  X,
  Check,
  AlertCircle,
  Hash,
  FlaskConical,
  Eye,
  EyeOff
} from 'lucide-react';
import { parseCondition, formatConditionForStorage, validateBooleanCondition } from '@/lib/ruleUtils';

export default function CreateRulePage() {
  const router = useRouter();

  const [rule, setRule] = useState<Omit<Rule, 'id' | 'created_date' | 'modified_date'>>({
    name: '',
    description: '',
    ruleset_conditions: [''],
    column_mapping: {},
    weight: 1.0,
    owner_name: '',
    organization: '',
    disease_area_study: '',
    tags: [],
    is_active: true
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newTag, setNewTag] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const [showConditions, setShowConditions] = useState(true);
  const [showMappings, setShowMappings] = useState(true);
  const [isEditingConditions, setIsEditingConditions] = useState(true);
  const [editingConditions, setEditingConditions] = useState<Array<{condition: string, score: string}>>([{ condition: '', score: '' }]);
  const [savingConditions, setSavingConditions] = useState(false);
  const [newMappingKey, setNewMappingKey] = useState('');
  const [newMappingValue, setNewMappingValue] = useState('');

  const handleSave = async () => {
    if (!rule.name.trim()) {
      setError('Rule name is required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      
      // Format conditions for storage
      const formattedConditions = editingConditions
        .filter(ec => ec.condition.trim())
        .map(ec => formatConditionForStorage(ec.condition, ec.score));

      const ruleToCreate = {
        ...rule,
        ruleset_conditions: formattedConditions.length > 0 ? formattedConditions : ['']
      };

      const createdRule = await apiService.createRuleWithNotification(ruleToCreate);
      router.push(`/rules/${createdRule.id}`);
    } catch (err) {
      setError('Failed to create rule');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/rules');
  };

  const addTag = () => {
    if (newTag.trim() && !rule.tags?.includes(newTag.trim())) {
      setRule({
        ...rule,
        tags: [...(rule.tags || []), newTag.trim()]
      });
      setNewTag('');
      setShowAddTag(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setRule({
      ...rule,
      tags: rule.tags?.filter(tag => tag !== tagToRemove) || []
    });
  };

  const updateCondition = (index: number, field: 'condition' | 'score', value: string) => {
    const updated = [...editingConditions];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setEditingConditions(updated);
  };

  const addCondition = () => {
    setEditingConditions([...editingConditions, { condition: '', score: '' }]);
  };

  const removeCondition = (index: number) => {
    const updated = editingConditions.filter((_, i) => i !== index);
    setEditingConditions(updated);
  };

  const addMapping = () => {
    if (newMappingKey.trim() && newMappingValue.trim()) {
      setRule({
        ...rule,
        column_mapping: {
          ...rule.column_mapping,
          [newMappingKey.trim()]: newMappingValue.trim()
        }
      });
      setNewMappingKey('');
      setNewMappingValue('');
    }
  };

  const removeMapping = (key: string) => {
    const updated = { ...rule.column_mapping };
    delete updated[key];
    setRule({
      ...rule,
      column_mapping: updated
    });
  };

  const validateCondition = (condition: string) => {
    return validateBooleanCondition(condition);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/rules"
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Rules
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !rule.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Rule
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="mt-6">
            <h1 className="text-3xl font-bold text-gray-900">Create New Rule</h1>
            <p className="mt-2 text-gray-600">Define a new scoring rule for your analysis</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Basic Information, Tags, Status */}
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Basic Information
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    value={rule.name}
                    onChange={(e) => setRule({ ...rule, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter rule name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={rule.description || ''}
                    onChange={(e) => setRule({ ...rule, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Describe what this rule does"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Owner Name
                    </label>
                    <input
                      type="text"
                      value={rule.owner_name || ''}
                      onChange={(e) => setRule({ ...rule, owner_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter owner name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization
                    </label>
                    <input
                      type="text"
                      value={rule.organization || ''}
                      onChange={(e) => setRule({ ...rule, organization: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter organization"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Disease Area / Study
                  </label>
                  <input
                    type="text"
                    value={rule.disease_area_study || ''}
                    onChange={(e) => setRule({ ...rule, disease_area_study: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter disease area or study"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={rule.weight}
                    onChange={(e) => setRule({ ...rule, weight: parseFloat(e.target.value) || 1.0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Tag className="h-5 w-5 mr-2" />
                Tags
              </h3>
              
              <div className="space-y-3">
                {rule.tags && rule.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {rule.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1.5 text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No tags added yet</p>
                )}
                
                {showAddTag ? (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter tag"
                      autoFocus
                    />
                    <button
                      onClick={addTag}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setShowAddTag(false);
                        setNewTag('');
                      }}
                      className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddTag(true)}
                    className="w-full py-2 border border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tag
                  </button>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FlaskConical className="h-5 w-5 mr-2" />
                Status
              </h3>
              
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rule.is_active}
                    onChange={(e) => setRule({ ...rule, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active</span>
                </label>
                <p className="text-xs text-gray-500">
                  Active rules will be available for use in analyses
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel - Conditions and Column Mapping */}
          <div className="space-y-6">
            {/* Conditions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Code className="h-5 w-5 mr-2" />
                  Rule Conditions
                </h2>
                <button
                  onClick={() => setShowConditions(!showConditions)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {showConditions ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {showConditions && (
                <div className="space-y-4">
                  {editingConditions.map((condition, index) => {
                    const validation = validateCondition(condition.condition);
                    return (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">Condition {index + 1}</span>
                          {editingConditions.length > 1 && (
                            <button
                              onClick={() => removeCondition(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Boolean Expression
                            </label>
                            <input
                              type="text"
                              value={condition.condition}
                              onChange={(e) => updateCondition(index, 'condition', e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                condition.condition && !validation.isValid 
                                  ? 'border-red-300 bg-red-50' 
                                  : 'border-gray-300'
                              }`}
                              placeholder="e.g., expression > 0.5"
                            />
                            {condition.condition && !validation.isValid && (
                              <p className="mt-1 text-sm text-red-600">{validation.error}</p>
                            )}
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Score
                            </label>
                            <input
                              type="text"
                              value={condition.score}
                              onChange={(e) => updateCondition(index, 'score', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="e.g., 1.0"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  <button
                    onClick={addCondition}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Condition
                  </button>
                </div>
              )}
            </div>

            {/* Column Mapping */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Hash className="h-5 w-5 mr-2" />
                  Column Mapping
                </h2>
                <button
                  onClick={() => setShowMappings(!showMappings)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {showMappings ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {showMappings && (
                <div className="space-y-4">
                  {Object.entries(rule.column_mapping).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700 min-w-0 flex-1">{key}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-sm text-gray-600 min-w-0 flex-1">{value}</span>
                      <button
                        onClick={() => removeMapping(key)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newMappingKey}
                      onChange={(e) => setNewMappingKey(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Variable name"
                    />
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newMappingValue}
                        onChange={(e) => setNewMappingValue(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Column name"
                      />
                      <button
                        onClick={addMapping}
                        disabled={!newMappingKey.trim() || !newMappingValue.trim()}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
