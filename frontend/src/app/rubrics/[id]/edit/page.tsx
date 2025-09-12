'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiService } from '@/services/api';
import { Rubric, Rule, RubricRule } from '@/types';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Eye, 
  GripVertical,
  Search,
  Tag,
  Building2,
  User,
  Calendar,
  Weight,
  Hash,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  FileText,
  Code
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface RubricWithRules extends Rubric {
  rules: (RubricRule & { rule: Rule })[];
}

interface SortableRuleItemProps {
  rubricRule: RubricRule & { rule: Rule };
  onUpdateWeight: (ruleId: string, weight: number) => void;
  onRemoveRule: (ruleId: string) => void;
}

function SortableRuleItem({ rubricRule, onUpdateWeight, onRemoveRule }: SortableRuleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rubricRule.rule_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>

        {/* Rule Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-gray-900 truncate">{rubricRule.rule.name}</h4>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              Order: {rubricRule.order_index}
            </span>
          </div>
          
          {rubricRule.rule.description && (
            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
              {rubricRule.rule.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mb-2">
            {rubricRule.rule.tags?.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </span>
            ))}
            {rubricRule.rule.tags && rubricRule.rule.tags.length > 3 && (
              <span className="text-xs text-gray-500">+{rubricRule.rule.tags.length - 3}</span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center">
              <Building2 className="h-3 w-3 mr-1" />
              {rubricRule.rule.organization || 'No organization'}
            </div>
            <div className="flex items-center">
              <User className="h-3 w-3 mr-1" />
              {rubricRule.rule.owner_name || 'Unknown'}
            </div>
          </div>
        </div>

        {/* Weight Input */}
        <div className="flex items-center gap-2">
          <Weight className="h-4 w-4 text-gray-400" />
          <input
            type="number"
            min="0"
            step="0.1"
            value={rubricRule.weight}
            onChange={(e) => onUpdateWeight(rubricRule.rule_id, parseFloat(e.target.value) || 0)}
            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link href={`/rules/${rubricRule.rule_id}`}>
            <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Eye className="h-4 w-4" />
            </button>
          </Link>
          <button
            onClick={() => onRemoveRule(rubricRule.rule_id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RubricEditPage() {
  const params = useParams();
  const router = useRouter();
  const rubricId = params.id as string;

  const [rubric, setRubric] = useState<RubricWithRules | null>(null);
  const [allRules, setAllRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddRules, setShowAddRules] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (rubricId) {
      loadRubric();
      loadAllRules();
    }
  }, [rubricId]);

  const loadRubric = async () => {
    try {
      setLoading(true);
      const [rubricData, rubricRules] = await Promise.all([
        apiService.getRubric(rubricId),
        apiService.getRubricRules(rubricId)
      ]);
      
      const rubricWithRules: RubricWithRules = {
        ...rubricData,
        rules: rubricRules
      };

      setRubric(rubricWithRules);
    } catch (err) {
      setError('Failed to load rubric');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllRules = async () => {
    try {
      const rules = await apiService.getRules();
      setAllRules(rules);
    } catch (err) {
      console.error('Failed to load rules:', err);
    }
  };

  const handleSave = async () => {
    if (!rubric) return;

    try {
      setSaving(true);
      await apiService.updateRubric(rubricId, {
        name: rubric.name,
        description: rubric.description,
        owner_name: rubric.owner_name,
        organization: rubric.organization,
        disease_area_study: rubric.disease_area_study,
        tags: rubric.tags,
        is_active: rubric.is_active
      });
      setHasChanges(false);
      router.push(`/rubrics/${rubricId}`);
    } catch (err) {
      setError('Failed to save rubric');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = async (ruleId: string) => {
    if (!rubric) return;

    try {
      const newOrderIndex = rubric.rules.length;
      await apiService.addRuleToRubric(rubricId, ruleId, 1.0, newOrderIndex);
      loadRubric(); // Reload to get updated rules
      setHasChanges(true);
    } catch (err) {
      setError('Failed to add rule to rubric');
      console.error(err);
    }
  };

  const handleRemoveRule = async (ruleId: string) => {
    if (!rubric) return;

    try {
      await apiService.removeRuleFromRubric(rubricId, ruleId);
      loadRubric(); // Reload to get updated rules
      setHasChanges(true);
    } catch (err) {
      setError('Failed to remove rule from rubric');
      console.error(err);
    }
  };

  const handleUpdateWeight = async (ruleId: string, weight: number) => {
    // This would need a new API endpoint to update rule weight in rubric
    // For now, we'll just update the local state
    if (rubric) {
      setRubric({
        ...rubric,
        rules: rubric.rules.map(rr => 
          rr.rule_id === ruleId ? { ...rr, weight } : rr
        )
      });
      setHasChanges(true);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!rubric || !over || active.id === over.id) {
      return;
    }

    const oldIndex = rubric.rules.findIndex(rr => rr.rule_id === active.id);
    const newIndex = rubric.rules.findIndex(rr => rr.rule_id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newRules = arrayMove(rubric.rules, oldIndex, newIndex);
      const updatedRules = newRules.map((rr, index) => ({
        ...rr,
        order_index: index
      }));

      setRubric({
        ...rubric,
        rules: updatedRules
      });
      setHasChanges(true);
    }
  };

  const handleFieldChange = (field: keyof Rubric, value: string | string[]) => {
    if (rubric) {
      setRubric({ ...rubric, [field]: value });
      setHasChanges(true);
    }
  };

  const filteredRules = allRules.filter(rule => {
    const isAlreadyInRubric = rubric?.rules.some(rr => rr.rule_id === rule.id);
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return !isAlreadyInRubric && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading rubric...</p>
        </div>
      </div>
    );
  }

  if (error || !rubric) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-red-600">{error || 'Rubric not found'}</p>
          <div className="mt-4 flex gap-2">
            <button 
              onClick={() => router.back()} 
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Go Back
            </button>
            <button 
              onClick={loadRubric} 
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
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href={`/rubrics/${rubricId}`}>
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </button>
            </Link>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Edit Rubric
              </h1>
              <p className="text-gray-600 mt-2">Modify rubric details and manage rules</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/rubrics/${rubricId}`}>
                <button className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </Link>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Unsaved Changes Warning */}
          {hasChanges && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span className="text-yellow-800">You have unsaved changes</span>
            </div>
          )}

          {/* Rubric Info */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rubric Information</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={rubric.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={rubric.description || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                  <input
                    type="text"
                    value={rubric.organization || ''}
                    onChange={(e) => handleFieldChange('organization', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={rubric.owner_name || ''}
                    onChange={(e) => handleFieldChange('owner_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Disease Area Study</label>
                  <input
                    type="text"
                    value={rubric.disease_area_study || ''}
                    onChange={(e) => handleFieldChange('disease_area_study', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={rubric.tags?.join(', ') || ''}
                    onChange={(e) => handleFieldChange('tags', e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag))}
                    placeholder="e.g., genomics, cancer, analysis"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rules Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Rules</h2>
            <button
              onClick={() => setShowAddRules(!showAddRules)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Rules
            </button>
          </div>

          {/* Add Rules Panel */}
          {showAddRules && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search rules to add..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid gap-3 max-h-60 overflow-y-auto">
                {filteredRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{rule.name}</h4>
                      {rule.description && (
                        <p className="text-sm text-gray-600 truncate">{rule.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleAddRule(rule.id)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                ))}
                {filteredRules.length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    {searchTerm ? 'No rules found matching your search' : 'All available rules are already in this rubric'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Rules List */}
          {rubric.rules.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Hash className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No rules added yet</h3>
              <p className="text-gray-600 mb-4">Add rules to this rubric to start building your analysis workflow</p>
              <button
                onClick={() => setShowAddRules(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Your First Rule
              </button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={rubric.rules.map(rr => rr.rule_id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {rubric.rules.map((rubricRule) => (
                    <SortableRuleItem
                      key={rubricRule.rule_id}
                      rubricRule={rubricRule}
                      onUpdateWeight={handleUpdateWeight}
                      onRemoveRule={handleRemoveRule}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}
