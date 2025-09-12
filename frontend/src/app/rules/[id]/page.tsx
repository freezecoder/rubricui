'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiService } from '@/services/api';
import { Rule } from '@/types';
import { notify } from '@/lib/notifications';
import { 
  ArrowLeft, 
  Save, 
  Edit3, 
  Copy, 
  Trash2, 
  Tag,
  Building2,
  User,
  Calendar,
  Weight,
  Code,
  FileText,
  Plus,
  X,
  Check,
  AlertCircle,
  Clock,
  Hash,
  FlaskConical,
  Eye,
  EyeOff
} from 'lucide-react';
import { parseCondition, formatConditionForStorage, validateBooleanCondition } from '@/lib/ruleUtils';

export default function RuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ruleId = params.id as string;

  const [rule, setRule] = useState<Rule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const [showConditions, setShowConditions] = useState(true);
  const [showMappings, setShowMappings] = useState(true);
  const [cloneName, setCloneName] = useState('');
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [isEditingConditions, setIsEditingConditions] = useState(false);
  const [editingConditions, setEditingConditions] = useState<Array<{condition: string, score: string}>>([]);
  const [savingConditions, setSavingConditions] = useState(false);

  useEffect(() => {
    if (ruleId) {
      loadRule();
    }
  }, [ruleId]);

  const loadRule = async () => {
    try {
      setLoading(true);
      const ruleData = await apiService.getRule(ruleId);
      setRule(ruleData);
      setCloneName(`${ruleData.name} (Copy)`);
    } catch (err) {
      setError('Failed to load rule');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!rule) return;

    try {
      setSaving(true);
      await apiService.updateRule(ruleId, {
        name: rule.name,
        description: rule.description,
        ruleset_conditions: rule.ruleset_conditions,
        column_mapping: rule.column_mapping,
        weight: rule.weight,
        owner_name: rule.owner_name,
        organization: rule.organization,
        disease_area_study: rule.disease_area_study,
        tags: rule.tags,
        is_active: rule.is_active
      });
      setIsEditing(false);
    } catch (err) {
      setError('Failed to save rule');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await notify.confirmDelete('rule', rule?.name);
    if (!confirmed) {
      return;
    }

    try {
      await apiService.deleteRule(ruleId);
      router.push('/rules');
    } catch (err) {
      setError('Failed to delete rule');
      console.error(err);
    }
  };

  const handleClone = async () => {
    if (!rule || !cloneName.trim()) return;

    try {
      setCloning(true);
      const clonedRule = await apiService.createRule({
        name: cloneName,
        description: rule.description,
        ruleset_conditions: rule.ruleset_conditions,
        column_mapping: rule.column_mapping,
        weight: rule.weight,
        owner_name: rule.owner_name,
        organization: rule.organization,
        disease_area_study: rule.disease_area_study,
        tags: rule.tags,
        is_active: rule.is_active
      });
      
      setShowCloneDialog(false);
      router.push(`/rules/${clonedRule.id}`);
    } catch (err) {
      setError('Failed to clone rule');
      console.error(err);
    } finally {
      setCloning(false);
    }
  };

  const startEditingConditions = () => {
    if (!rule) return;
    
    // Parse existing conditions into editable format
    const parsedConditions = rule.ruleset_conditions.map(condition => {
      const parsed = parseCondition(condition);
      return {
        condition: parsed.condition,
        score: parsed.score
      };
    });
    
    setEditingConditions(parsedConditions);
    setIsEditingConditions(true);
  };

  const cancelEditingConditions = () => {
    setIsEditingConditions(false);
    setEditingConditions([]);
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

  const saveConditions = async () => {
    if (!rule) return;
    
    setSavingConditions(true);
    try {
      // Convert back to storage format
      const storageFormat = editingConditions.map(ec => 
        formatConditionForStorage(ec.condition, ec.score)
      );
      
      // Update the rule
      const updatedRule = await apiService.updateRule(rule.id, {
        ...rule,
        ruleset_conditions: storageFormat
      });
      
      setRule(updatedRule);
      setIsEditingConditions(false);
      setEditingConditions([]);
    } catch (error) {
      console.error('Error saving conditions:', error);
      setError('Failed to save conditions');
    } finally {
      setSavingConditions(false);
    }
  };

  const addTag = () => {
    if (!newTag.trim() || !rule) return;
    
    const trimmedTag = newTag.trim();
    if (rule.tags?.includes(trimmedTag)) {
      setNewTag('');
      setShowAddTag(false);
      return;
    }

    setRule({
      ...rule,
      tags: [...(rule.tags || []), trimmedTag]
    });
    setNewTag('');
    setShowAddTag(false);
  };

  const removeTag = (tagToRemove: string) => {
    if (!rule) return;
    
    setRule({
      ...rule,
      tags: rule.tags?.filter(tag => tag !== tagToRemove) || []
    });
  };


  const addMapping = () => {
    if (!rule) return;
    
    setRule({
      ...rule,
      column_mapping: {
        ...rule.column_mapping,
        'new_variable': 'new_column'
      }
    });
  };

  const updateMapping = (variable: string, newVariable: string, column: string) => {
    if (!rule) return;
    
    const newMapping = { ...rule.column_mapping };
    delete newMapping[variable];
    newMapping[newVariable] = column;
    
    setRule({
      ...rule,
      column_mapping: newMapping
    });
  };

  const removeMapping = (variable: string) => {
    if (!rule) return;
    
    const newMapping = { ...rule.column_mapping };
    delete newMapping[variable];
    
    setRule({
      ...rule,
      column_mapping: newMapping
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading rule...</p>
        </div>
      </div>
    );
  }

  if (error || !rule) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-red-600">{error || 'Rule not found'}</p>
          <div className="mt-4 flex gap-2">
            <button 
              onClick={() => router.back()} 
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Go Back
            </button>
            <button 
              onClick={loadRule} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      <div className="w-full px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/rules">
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </button>
            </Link>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {rule.name}
              </h1>
              <p className="text-gray-600 mt-2">Rule details and configuration</p>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowCloneDialog(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Clone
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Rule Info */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Rule Information</h3>
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={rule.name}
                        onChange={(e) => setRule({ ...rule, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={rule.description || ''}
                        onChange={(e) => setRule({ ...rule, description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                      <input
                        type="text"
                        value={rule.organization || ''}
                        onChange={(e) => setRule({ ...rule, organization: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Disease Area Study</label>
                      <input
                        type="text"
                        value={rule.disease_area_study || ''}
                        onChange={(e) => setRule({ ...rule, disease_area_study: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                      <input
                        type="number"
                        step="0.1"
                        value={rule.weight}
                        onChange={(e) => setRule({ ...rule, weight: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">{rule.organization || 'No organization'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">{rule.owner_name || 'Unknown owner'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">Created {new Date(rule.created_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Weight className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">Weight: {rule.weight}</span>
                    </div>
                    {rule.description && (
                      <p className="text-gray-600 mt-3">{rule.description}</p>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags & Status</h3>
                <div className="space-y-4">
                  {/* Tags */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Tags</label>
                      {isEditing && (
                        <button
                          onClick={() => setShowAddTag(true)}
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Add Tag
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {rule.tags?.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                          {isEditing && (
                            <button
                              onClick={() => removeTag(tag)}
                              className="ml-1 text-purple-600 hover:text-purple-800"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      ))}
                      {(!rule.tags || rule.tags.length === 0) && (
                        <span className="text-gray-500 text-sm">No tags</span>
                      )}
                    </div>
                    
                    {/* Add Tag Input */}
                    {showAddTag && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addTag()}
                          placeholder="Enter tag name"
                          className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          autoFocus
                        />
                        <button
                          onClick={addTag}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => {
                            setShowAddTag(false);
                            setNewTag('');
                          }}
                          className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <div className="mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        rule.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rule Conditions */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Code className="h-6 w-6" />
              Rule Conditions
            </h2>
            <div className="flex gap-2">
              {!isEditingConditions ? (
                <button
                  onClick={startEditingConditions}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <Edit3 className="h-3 w-3" />
                  Edit Conditions
                </button>
              ) : (
                <>
                  <button
                    onClick={saveConditions}
                    disabled={savingConditions}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {savingConditions ? (
                      <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    {savingConditions ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEditingConditions}
                    className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </button>
                </>
              )}
              <button
                onClick={() => setShowConditions(!showConditions)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {showConditions ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {showConditions && (
            <div className="space-y-4">
              {isEditingConditions ? (
                // Editing mode
                <>
                  {editingConditions.map((condition, index) => {
                    const validation = validateBooleanCondition(condition.condition);
                    return (
                      <div key={index} className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <span className="text-sm font-medium text-gray-500 w-8 pt-2">{index + 1}.</span>
                        <div className="flex-1 space-y-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Boolean Condition
                            </label>
                            <input
                              type="text"
                              value={condition.condition}
                              onChange={(e) => updateCondition(index, 'condition', e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                                validation.isValid ? 'border-gray-300' : 'border-red-500 bg-red-50'
                              }`}
                              placeholder="e.g., x > 0.45"
                            />
                            {!validation.isValid && (
                              <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {validation.error}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Score Value
                            </label>
                            <input
                              type="text"
                              value={condition.score}
                              onChange={(e) => updateCondition(index, 'score', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              placeholder="e.g., 6"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => removeCondition(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-2"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={addCondition}
                    className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add New Condition
                  </button>
                </>
              ) : (
                // Display mode
                <div className="space-y-3">
                  {rule.ruleset_conditions.map((condition, index) => {
                    const parsed = parseCondition(condition);
                    return (
                      <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white">
                        <span className="text-sm font-medium text-gray-500 w-8">{index + 1}.</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 mb-1">
                            {parsed.condition || <span className="text-gray-400 italic">No condition</span>}
                          </div>
                          <div className="text-sm text-gray-600">
                            Score: <span className="font-medium text-blue-600">{parsed.score || 'N/A'}</span>
                          </div>
                        </div>
                        {!parsed.isValid && (
                          <div className="text-red-600 text-xs flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Invalid
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column Mappings */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Column Mappings
            </h2>
            <div className="flex gap-2">
              {isEditing && (
                <button
                  onClick={addMapping}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Mapping
                </button>
              )}
              <button
                onClick={() => setShowMappings(!showMappings)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {showMappings ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {showMappings && (
            <div className="space-y-3">
              {Object.entries(rule.column_mapping).map(([variable, column]) => (
                <div key={variable} className="flex items-center gap-3">
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={variable}
                        onChange={(e) => updateMapping(variable, e.target.value, column)}
                        className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Variable"
                      />
                      <span className="text-gray-400">→</span>
                      <input
                        type="text"
                        value={column}
                        onChange={(e) => updateMapping(variable, variable, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Column"
                      />
                      <button
                        onClick={() => removeMapping(variable)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-blue-600 w-40">{variable}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-sm font-medium text-gray-900 flex-1">{column}</span>
                    </>
                  )}
                </div>
              ))}
              {Object.keys(rule.column_mapping).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No column mappings defined</p>
                  {isEditing && (
                    <button
                      onClick={addMapping}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add First Mapping
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clone Dialog */}
        {showCloneDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Clone Rule</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Rule Name</label>
                  <input
                    type="text"
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter name for cloned rule"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowCloneDialog(false)}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClone}
                    disabled={cloning || !cloneName.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    {cloning ? 'Cloning...' : 'Clone Rule'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
