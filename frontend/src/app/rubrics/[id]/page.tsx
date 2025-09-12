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
  Edit3, 
  Eye, 
  GripVertical,
  Search,
  Filter,
  Tag,
  Building2,
  User,
  Calendar,
  Weight,
  Hash,
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
  onUpdateOrder: (ruleId: string, orderIndex: number) => void;
  onViewRule: (rule: Rule) => void;
  isSelected: boolean;
}

function SortableRuleItem({ rubricRule, onUpdateWeight, onRemoveRule, onUpdateOrder, onViewRule, isSelected }: SortableRuleItemProps) {
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

  // Check if this is a "bad rule" (only has TRUE ~ 0 conditions)
  const isBadRule = rubricRule.rule.ruleset_conditions && 
    rubricRule.rule.ruleset_conditions.length === 1 && 
    rubricRule.rule.ruleset_conditions[0] === 'TRUE ~ 0';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-4 shadow-sm hover:shadow-md transition-all ${
        isDragging ? 'shadow-lg' : ''
      } ${
        isBadRule 
          ? 'border-red-300 bg-red-50' 
          : isSelected 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 bg-white'
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
            <h4 className={`font-semibold truncate ${isBadRule ? 'text-red-900' : 'text-gray-900'}`}>
              {rubricRule.rule.name}
            </h4>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              Order: {rubricRule.order_index}
            </span>
            {isBadRule && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                Bad Rule
              </span>
            )}
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
          <button
            onClick={() => onViewRule(rubricRule.rule)}
            className={`p-2 rounded-lg transition-colors ${
              isSelected 
                ? 'text-blue-700 bg-blue-100' 
                : 'text-blue-600 hover:bg-blue-50'
            }`}
          >
            <Eye className="h-4 w-4" />
          </button>
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

export default function RubricDetailPage() {
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
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [showRuleDetails, setShowRuleDetails] = useState(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterDAS, setFilterDAS] = useState<string>('');
  const [filterOrganization, setFilterOrganization] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'created_date' | 'organization'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showCreateRuleModal, setShowCreateRuleModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    owner_name: '',
    organization: '',
    disease_area_study: '',
    tags: [] as string[],
    ruleset_conditions: [''] as string[],
    column_mapping: {} as Record<string, string>,
    weight: 1.0,
    is_active: true
  });
  const [newRuleTag, setNewRuleTag] = useState('');
  const [newRuleCondition, setNewRuleCondition] = useState('');
  const [newRuleMappingKey, setNewRuleMappingKey] = useState('');
  const [newRuleMappingValue, setNewRuleMappingValue] = useState('');

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
      setIsEditing(false);
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
    }
  };

  const filteredRules = allRules.filter(rule => {
    const isAlreadyInRubric = rubric?.rules.some(rr => rr.rule_id === rule.id);
    if (isAlreadyInRubric) return false;

    // Text search
    const matchesSearch = searchTerm === '' || 
      rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    // Tag filter
    const matchesTags = filterTags.length === 0 || 
      filterTags.every(filterTag => rule.tags?.some(tag => tag.toLowerCase().includes(filterTag.toLowerCase())));

    // DAS filter
    const matchesDAS = filterDAS === '' || 
      rule.disease_area_study?.toLowerCase().includes(filterDAS.toLowerCase());

    // Organization filter
    const matchesOrganization = filterOrganization === '' || 
      rule.organization?.toLowerCase().includes(filterOrganization.toLowerCase());

    return matchesSearch && matchesTags && matchesDAS && matchesOrganization;
  }).sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'created_date':
        aValue = new Date(a.created_date).getTime();
        bValue = new Date(b.created_date).getTime();
        break;
      case 'organization':
        aValue = (a.organization || '').toLowerCase();
        bValue = (b.organization || '').toLowerCase();
        break;
      default:
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
    }

    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  // Get unique tags from all rules
  const allTags = Array.from(new Set(allRules.flatMap(rule => rule.tags || [])));
  const allDAS = Array.from(new Set(allRules.map(rule => rule.disease_area_study).filter(Boolean)));
  const allOrganizations = Array.from(new Set(allRules.map(rule => rule.organization).filter(Boolean)));

  const handleViewRule = (rule: Rule) => {
    setSelectedRule(rule);
    setShowRuleDetails(true);
  };

  const handleCloseRuleDetails = () => {
    setSelectedRule(null);
    setShowRuleDetails(false);
  };

  const handleCreateCustomRule = async () => {
    try {
      setSaving(true);
      
      // Validate required fields
      if (!newRule.name.trim()) {
        setError('Rule name is required');
        return;
      }
      
      if (newRule.ruleset_conditions.length === 0 || newRule.ruleset_conditions.every(c => !c.trim())) {
        setError('At least one rule condition is required');
        return;
      }

      // Create the rule
      const createdRule = await apiService.createRule(newRule);
      
      // Add the new rule to the current rubric
      await handleAddRule(createdRule.id);
      
      // Refresh the rules list
      await loadRubric();
      
      // Close modal and reset form
      setShowCreateRuleModal(false);
      setNewRule({
        name: '',
        description: '',
        owner_name: '',
        organization: '',
        disease_area_study: '',
        tags: [],
        ruleset_conditions: [''],
        column_mapping: {},
        weight: 1.0,
        is_active: true
      });
      setNewRuleTag('');
      setNewRuleCondition('');
      setNewRuleMappingKey('');
      setNewRuleMappingValue('');
      
    } catch (err) {
      setError('Failed to create custom rule');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const addNewRuleTag = () => {
    if (newRuleTag.trim() && !newRule.tags.includes(newRuleTag.trim())) {
      setNewRule(prev => ({
        ...prev,
        tags: [...prev.tags, newRuleTag.trim()]
      }));
      setNewRuleTag('');
    }
  };

  const removeNewRuleTag = (tagToRemove: string) => {
    setNewRule(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const addNewRuleCondition = () => {
    if (newRuleCondition.trim()) {
      setNewRule(prev => ({
        ...prev,
        ruleset_conditions: [...prev.ruleset_conditions, newRuleCondition.trim()]
      }));
      setNewRuleCondition('');
    }
  };

  const removeNewRuleCondition = (index: number) => {
    setNewRule(prev => ({
      ...prev,
      ruleset_conditions: prev.ruleset_conditions.filter((_, i) => i !== index)
    }));
  };

  const addNewRuleMapping = () => {
    if (newRuleMappingKey.trim() && newRuleMappingValue.trim()) {
      setNewRule(prev => ({
        ...prev,
        column_mapping: {
          ...prev.column_mapping,
          [newRuleMappingKey.trim()]: newRuleMappingValue.trim()
        }
      }));
      setNewRuleMappingKey('');
      setNewRuleMappingValue('');
    }
  };

  const removeNewRuleMapping = (key: string) => {
    setNewRule(prev => {
      const newMapping = { ...prev.column_mapping };
      delete newMapping[key];
      return {
        ...prev,
        column_mapping: newMapping
      };
    });
  };

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
      <div className="w-full px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/rubrics">
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </button>
            </Link>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {rubric.name}
              </h1>
              <p className="text-gray-600 mt-2">Manage rubric rules and parameters</p>
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
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* Rubric Info */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Rubric Information</h3>
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={rubric.name}
                        onChange={(e) => setRubric({ ...rubric, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={rubric.description || ''}
                        onChange={(e) => setRubric({ ...rubric, description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                      <input
                        type="text"
                        value={rubric.organization || ''}
                        onChange={(e) => setRubric({ ...rubric, organization: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">{rubric.organization || 'No organization'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">{rubric.owner_name || 'Unknown owner'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">Created {new Date(rubric.created_date).toLocaleDateString()}</span>
                    </div>
                    {rubric.description && (
                      <p className="text-gray-600 mt-3">{rubric.description}</p>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total Rules</span>
                    <span className="font-semibold text-gray-900">{rubric.rules.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total Weight</span>
                    <span className="font-semibold text-gray-900">
                      {rubric.rules.reduce((sum, rr) => sum + rr.weight, 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      rubric.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {rubric.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {(() => {
                    const badRulesCount = rubric.rules.filter(rr => 
                      rr.rule.ruleset_conditions && 
                      rr.rule.ruleset_conditions.length === 1 && 
                      rr.rule.ruleset_conditions[0] === 'TRUE ~ 0'
                    ).length;
                    
                    if (badRulesCount > 0) {
                      return (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Bad Rules</span>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {badRulesCount} rule{badRulesCount > 1 ? 's' : ''}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
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
              {showAddRules ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {/* Add Rules Panel */}
          {showAddRules && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="space-y-4">
                {/* Search and Basic Filters */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search rules by name, description, or tags..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'name' | 'created_date' | 'organization')}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="name">Sort by Name</option>
                      <option value="created_date">Sort by Date</option>
                      <option value="organization">Sort by Organization</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>

                {/* Advanced Filters */}
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Tag Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Tags</label>
                    <div className="flex flex-wrap gap-1">
                      {allTags.slice(0, 8).map((tag) => (
                        <button
                          key={tag}
                          onClick={() => {
                            if (filterTags.includes(tag)) {
                              setFilterTags(filterTags.filter(t => t !== tag));
                            } else {
                              setFilterTags([...filterTags, tag]);
                            }
                          }}
                          className={`px-2 py-1 text-xs rounded-full transition-colors ${
                            filterTags.includes(tag)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                      {filterTags.length > 0 && (
                        <button
                          onClick={() => setFilterTags([])}
                          className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* DAS Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Disease Area Study</label>
                    <select
                      value={filterDAS}
                      onChange={(e) => setFilterDAS(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All DAS</option>
                      {allDAS.map((das) => (
                        <option key={das} value={das}>{das}</option>
                      ))}
                    </select>
                  </div>

                  {/* Organization Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                    <select
                      value={filterOrganization}
                      onChange={(e) => setFilterOrganization(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Organizations</option>
                      {allOrganizations.map((org) => (
                        <option key={org} value={org}>{org}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Results */}
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setShowCreateRuleModal(true)}
                    className="px-4 py-2 bg-green-600 text-white text-base rounded hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Custom Rule
                  </button>
                  <div className="text-sm text-gray-600">
                    Showing {filteredRules.length} available rules
                  </div>
                </div>
              </div>

              <div className="grid gap-3 max-h-60 overflow-y-auto">
                {filteredRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{rule.name}</h4>
                      {rule.description && (
                        <p className="text-sm text-gray-600 truncate">{rule.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        {rule.organization && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {rule.organization}
                          </span>
                        )}
                        {rule.disease_area_study && (
                          <span className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {rule.disease_area_study}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(rule.created_date).toLocaleDateString()}
                        </span>
                      </div>
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
                    {searchTerm || filterTags.length > 0 || filterDAS || filterOrganization 
                      ? 'No rules found matching your filters' 
                      : 'All available rules are already in this rubric'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Rules List - Dual Panel Layout */}
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
            <div className={`grid gap-6 ${showRuleDetails ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              {/* Left Panel - Rules List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Rubric Rules</h3>
                  {showRuleDetails && (
                    <button
                      onClick={handleCloseRuleDetails}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
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
                          onUpdateOrder={() => {}} // This would be handled by drag and drop
                          onViewRule={handleViewRule}
                          isSelected={selectedRule?.id === rubricRule.rule_id}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>

              {/* Right Panel - Rule Details */}
              {showRuleDetails && selectedRule && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Rule Details</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.open(`/rules/${selectedRule.id}`, '_blank')}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit Rule
                      </button>
                      <button
                        onClick={handleCloseRuleDetails}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Rule Header */}
                    <div>
                      <h4 className="text-xl font-semibold text-gray-900 mb-2">{selectedRule.name}</h4>
                      {selectedRule.description && (
                        <p className="text-gray-600 mb-4">{selectedRule.description}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {selectedRule.tags?.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">{selectedRule.organization || 'No organization'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">{selectedRule.owner_name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">{selectedRule.disease_area_study || 'No DAS'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">{new Date(selectedRule.created_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Rule Conditions */}
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Code className="h-5 w-5" />
                        Rule Conditions
                      </h5>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="space-y-2">
                          {selectedRule.ruleset_conditions.map((condition, index) => (
                            <div key={index} className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-500 w-8">{index + 1}.</span>
                              <code className="flex-1 text-sm bg-white px-3 py-2 rounded border font-mono">
                                {condition}
                              </code>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Column Mappings */}
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Column Mappings
                      </h5>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="space-y-2">
                          {Object.entries(selectedRule.column_mapping).map(([variable, column]) => (
                            <div key={variable} className="flex items-center gap-3">
                              <span className="text-sm font-medium text-blue-600 w-20">{variable}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-sm font-medium text-gray-900">{column}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Rule Weight */}
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Weight className="h-5 w-5" />
                        Rule Weight
                      </h5>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <span className="text-2xl font-bold text-blue-600">{selectedRule.weight}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Custom Rule Creation Modal */}
      {showCreateRuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">Create Custom Rule</h2>
                <button
                  onClick={() => setShowCreateRuleModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rule Name *
                    </label>
                    <input
                      type="text"
                      value={newRule.name}
                      onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter rule name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weight
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newRule.weight}
                      onChange={(e) => setNewRule(prev => ({ ...prev, weight: parseFloat(e.target.value) || 1.0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newRule.description}
                    onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Describe what this rule does"
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Owner Name
                    </label>
                    <input
                      type="text"
                      value={newRule.owner_name}
                      onChange={(e) => setNewRule(prev => ({ ...prev, owner_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Rule owner"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Organization
                    </label>
                    <input
                      type="text"
                      value={newRule.organization}
                      onChange={(e) => setNewRule(prev => ({ ...prev, organization: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Organization"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Disease Area Study
                    </label>
                    <input
                      type="text"
                      value={newRule.disease_area_study}
                      onChange={(e) => setNewRule(prev => ({ ...prev, disease_area_study: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="DAS"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newRuleTag}
                      onChange={(e) => setNewRuleTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addNewRuleTag()}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add a tag"
                    />
                    <button
                      onClick={addNewRuleTag}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newRule.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                        <button
                          onClick={() => removeNewRuleTag(tag)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Rule Conditions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rule Conditions *
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newRuleCondition}
                      onChange={(e) => setNewRuleCondition(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addNewRuleCondition()}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter a condition (e.g., column_name > 0)"
                    />
                    <button
                      onClick={addNewRuleCondition}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {newRule.ruleset_conditions.map((condition, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500 w-6">{index + 1}.</span>
                        <code className="flex-1 text-sm bg-gray-100 px-3 py-2 rounded border font-mono">
                          {condition}
                        </code>
                        <button
                          onClick={() => removeNewRuleCondition(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column Mappings */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Column Mappings
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={newRuleMappingKey}
                      onChange={(e) => setNewRuleMappingKey(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Variable name"
                    />
                    <input
                      type="text"
                      value={newRuleMappingValue}
                      onChange={(e) => setNewRuleMappingValue(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addNewRuleMapping()}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Column name"
                    />
                  </div>
                  <button
                    onClick={addNewRuleMapping}
                    className="mb-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Mapping
                  </button>
                  <div className="space-y-2">
                    {Object.entries(newRule.column_mapping).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-600 w-20">{key}</span>
                        <span className="text-gray-400">→</span>
                        <span className="flex-1 text-sm font-medium text-gray-900">{value}</span>
                        <button
                          onClick={() => removeNewRuleMapping(key)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowCreateRuleModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCustomRule}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create & Add to Rubric
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
