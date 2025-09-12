'use client';

import { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Plus, 
  X, 
  Check, 
  AlertCircle,
  Download,
  Eye,
  Save,
  Sparkles,
  Database,
  FileSpreadsheet
} from 'lucide-react';
import { apiService } from '@/services/api';
import { notify } from '@/lib/notifications';

interface TSVRow {
  name: string;
  rulesetDesc: string;
  ruleset: string;
  varList: string;
}

interface CreateRubricModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRubricCreated: (rubric: any) => void;
}

export default function CreateRubricModal({ isOpen, onClose, onRubricCreated }: CreateRubricModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [rubricData, setRubricData] = useState({
    name: '',
    description: '',
    owner_name: '',
    organization: '',
    disease_area_study: '',
    tags: [] as string[],
    visibility: 'public' as 'public' | 'private' | 'hidden',
    enabled: true,
    is_active: true
  });
  
  // UI state
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [tsvData, setTsvData] = useState<TSVRow[]>([]);
  const [newTag, setNewTag] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  const handleInputChange = (field: string, value: string | boolean | string[]) => {
    setRubricData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !rubricData.tags.includes(newTag.trim())) {
      setRubricData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setRubricData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      parseFile(file);
    }
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      // Check if it's a JSON file
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const jsonData = JSON.parse(content);
          
          // Handle different JSON structures
          let rulesArray = [];
          if (Array.isArray(jsonData)) {
            rulesArray = jsonData;
          } else if (jsonData && Array.isArray(jsonData.rules)) {
            rulesArray = jsonData.rules;
          } else {
            setError('JSON file must contain an array of rules or an object with a "rules" array');
            return;
          }
          
          // Convert JSON rules to TSVRow format for consistency
          const data: TSVRow[] = rulesArray.map((rule: any) => ({
            name: rule.name || '',
            rulesetDesc: rule.rulesetDesc || rule.description || '',
            ruleset: Array.isArray(rule.ruleset) ? rule.ruleset.join('; ') : (rule.ruleset || ''),
            varList: rule.varList || ''
          }));
          
          setTsvData(data);
          setError('');
          
          // Auto-populate rubric name from first rule if not set
          if (!rubricData.name && data.length > 0) {
            setRubricData(prev => ({
              ...prev,
              name: data[0].name || 'Imported Rubric'
            }));
          }
        } catch (error) {
          setError('Invalid JSON format. Please check your file.');
          return;
        }
      } else {
        // Handle TSV/CSV/Excel files (existing logic)
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setError('File must have at least a header row and one data row');
          return;
        }

        // Detect delimiter
        const firstLine = lines[0];
        const delimiter = firstLine.includes(',') && firstLine.split(',').length > firstLine.split('\t').length ? ',' : '\t';
        
        const headers = firstLine.split(delimiter);
        const expectedHeaders = ['name', 'rulesetDesc', 'ruleset', 'varList'];
        
        if (!expectedHeaders.every(header => headers.includes(header))) {
          setError(`File must contain headers: ${expectedHeaders.join(', ')}`);
          return;
        }

        const data: TSVRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter);
          if (values.length >= 4) {
            data.push({
              name: values[0] || '',
              rulesetDesc: values[1] || '',
              ruleset: values[2] || '',
              varList: values[3] || ''
            });
          }
        }

        setTsvData(data);
        setError('');
        
        // Auto-populate rubric name from first row if not set
        if (!rubricData.name && data.length > 0) {
          setRubricData(prev => ({
            ...prev,
            name: data[0].name || 'Imported Rubric'
          }));
        }
      }
    };
    
    reader.readAsText(file);
  };

  const handleCreateRubric = async () => {
    if (!rubricData.name.trim()) {
      setError('Rubric name is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let newRubric;
      
      if (activeTab === 'upload' && uploadedFile) {
        // Create rubric from file (TSV/CSV/JSON)
        if (uploadedFile.name.toLowerCase().endsWith('.json')) {
          newRubric = await apiService.createRubricFromJSONWithNotification(rubricData, uploadedFile);
        } else {
          newRubric = await apiService.createRubricFromTSVWithNotification(rubricData, uploadedFile);
        }
        setSuccess(`Rubric "${rubricData.name}" created successfully with ${tsvData.length} rules!`);
      } else {
        // Create rubric manually
        newRubric = await apiService.createRubricWithNotification(rubricData);
        setSuccess(`Rubric "${rubricData.name}" created successfully!`);
      }
      
      // Notify parent component and close modal after a short delay
      setTimeout(() => {
        onRubricCreated(newRubric);
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rubric');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form state
    setRubricData({
      name: '',
      description: '',
      owner_name: '',
      organization: '',
      disease_area_study: '',
      tags: [],
      visibility: 'public',
      enabled: true,
      is_active: true
    });
    setActiveTab('manual');
    setError('');
    setSuccess('');
    setUploadedFile(null);
    setTsvData([]);
    setNewTag('');
    setPreviewMode(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const downloadExampleTSV = () => {
    const exampleData = [
      ['name', 'rulesetDesc', 'ruleset', 'varList'],
      ['magnitude_expr_median', 'Expression Magnitude (Median)', 'x > 0.5 ~ 6; x > 0.3 ~ 4; TRUE ~ 0', 'list(x=e$gene_table$tcga_expr_percentile_rank)'],
      ['ChinaChoice_LUSC_TvsN', 'China CHOICE DE: Tumor vs Normal (SQ)', 'x > 1.5 & y < 0.05 ~ 8; x > 1.0 & y < 0.1 ~ 6; TRUE ~ 0', 'list(x=e$gene_table$chinaChoice_logfc,y=e$gene_table$chinaChoice_pval)'],
      ['scrna_GSE127465_de', 'scRNA GSE127465 Differential expression', 'x > 0.5 ~ 4; x < -0.5 ~ 2; TRUE ~ 0', 'list(x=e$gene_table$scrna_GSE127465_logfc)']
    ];

    const tsvContent = exampleData.map(row => row.join('\t')).join('\n');
    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'example_rubric_rules.tsv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadExampleCSV = () => {
    const exampleData = [
      ['name', 'rulesetDesc', 'ruleset', 'varList'],
      ['magnitude_expr_median', 'Expression Magnitude (Median)', 'x > 0.5 ~ 6; x > 0.3 ~ 4; TRUE ~ 0', 'list(x=e$gene_table$tcga_expr_percentile_rank)'],
      ['ChinaChoice_LUSC_TvsN', 'China CHOICE DE: Tumor vs Normal (SQ)', 'x > 1.5 & y < 0.05 ~ 8; x > 1.0 & y < 0.1 ~ 6; TRUE ~ 0', 'list(x=e$gene_table$chinaChoice_logfc,y=e$gene_table$chinaChoice_pval)'],
      ['scrna_GSE127465_de', 'scRNA GSE127465 Differential expression', 'x > 0.5 ~ 4; x < -0.5 ~ 2; TRUE ~ 0', 'list(x=e$gene_table$scrna_GSE127465_logfc)']
    ];

    const csvContent = exampleData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'example_rubric_rules.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadExampleJSON = () => {
    const exampleData = [
      {
        name: 'magnitude_expr_median',
        rulesetDesc: 'Expression Magnitude (Median)',
        ruleset: [
          ['x > 0.5 ~ 6'],
          ['x > 0.3 ~ 4'],
          ['TRUE ~ 0']
        ],
        varList: 'list(x=e$gene_table$tcga_expr_percentile_rank)'
      },
      {
        name: 'ChinaChoice_LUSC_TvsN',
        rulesetDesc: 'China CHOICE DE: Tumor vs Normal (SQ)',
        ruleset: [
          ['x > 1.5 & y < 0.05 ~ 8'],
          ['x > 1.0 & y < 0.1 ~ 6'],
          ['TRUE ~ 0']
        ],
        varList: 'list(x=e$gene_table$chinaChoice_logfc,y=e$gene_table$chinaChoice_pval)'
      },
      {
        name: 'scrna_GSE127465_de',
        rulesetDesc: 'scRNA GSE127465 Differential expression',
        ruleset: [
          ['x > 0.5 ~ 4'],
          ['x < -0.5 ~ 2'],
          ['TRUE ~ 0']
        ],
        varList: 'list(x=e$gene_table$scrna_GSE127465_logfc)'
      }
    ];

    const jsonContent = JSON.stringify(exampleData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'example_rubric_rules.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleClose}
        />
        
        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Create New Rubric</h2>
                <p className="text-gray-600 mt-1">Build a custom rubric for genomic analysis</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="mt-4 bg-gray-100 rounded-lg p-1">
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`flex-1 px-4 py-2 rounded-md font-semibold transition-all ${
                    activeTab === 'manual'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Plus className="h-4 w-4 mr-2 inline" />
                  Manual Creation
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 px-4 py-2 rounded-md font-semibold transition-all ${
                    activeTab === 'upload'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Upload className="h-4 w-4 mr-2 inline" />
                  Upload File
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Success/Error Messages */}
            {success && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
                <Check className="h-5 w-5 text-green-600 mr-3" />
                <p className="text-green-800">{success}</p>
              </div>
            )}

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {/* Main Content */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Form Section */}
              <div className="lg:col-span-2">
                <div className="bg-gray-50 rounded-lg p-6">
                  {activeTab === 'manual' ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Plus className="h-5 w-5 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Manual Rubric Creation</h3>
                      </div>

                      {/* Basic Information */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Rubric Name *
                          </label>
                          <input
                            type="text"
                            value={rubricData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Enter rubric name..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                          </label>
                          <textarea
                            value={rubricData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Describe the purpose and scope of this rubric..."
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Owner Name
                            </label>
                            <input
                              type="text"
                              value={rubricData.owner_name}
                              onChange={(e) => handleInputChange('owner_name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                              placeholder="Your name..."
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Organization
                            </label>
                            <input
                              type="text"
                              value={rubricData.organization}
                              onChange={(e) => handleInputChange('organization', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                              placeholder="Your organization..."
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Disease Area / Study
                          </label>
                          <input
                            type="text"
                            value={rubricData.disease_area_study}
                            onChange={(e) => handleInputChange('disease_area_study', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="e.g., LUSC, Breast Cancer, etc."
                          />
                        </div>

                        {/* Tags */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tags
                          </label>
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                              placeholder="Add a tag..."
                            />
                            <button
                              onClick={handleAddTag}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {rubricData.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center gap-2 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                              >
                                {tag}
                                <button
                                  onClick={() => handleRemoveTag(tag)}
                                  className="hover:text-purple-600"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Visibility Settings */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Visibility
                          </label>
                          <select
                            value={rubricData.visibility}
                            onChange={(e) => handleInputChange('visibility', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          >
                            <option value="public">Public - Visible to everyone</option>
                            <option value="private">Private - Only visible to you</option>
                            <option value="hidden">Hidden - Admin only</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Upload className="h-5 w-5 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Upload File</h3>
                      </div>

                      {/* File Upload */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".tsv,.txt,.csv,.xlsx,.json"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <FileSpreadsheet className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">
                          Upload TSV/CSV/Excel/JSON File
                        </h4>
                        <p className="text-gray-600 mb-4 text-sm">
                          Upload a TSV, CSV, Excel, or JSON file to create a complete rubric with all its rules.
                        </p>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                        >
                          <Upload className="h-4 w-4 mr-2 inline" />
                          Choose File
                        </button>
                        <div className="mt-3 space-y-1">
                          <button
                            onClick={downloadExampleTSV}
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center justify-center gap-1 mx-auto"
                          >
                            <Download className="h-3 w-3" />
                            Example TSV
                          </button>
                          <button
                            onClick={downloadExampleCSV}
                            className="text-green-600 hover:text-green-800 text-sm flex items-center justify-center gap-1 mx-auto"
                          >
                            <Download className="h-3 w-3" />
                            Example CSV
                          </button>
                          <button
                            onClick={downloadExampleJSON}
                            className="text-purple-600 hover:text-purple-800 text-sm flex items-center justify-center gap-1 mx-auto"
                          >
                            <Download className="h-3 w-3" />
                            Example JSON
                          </button>
                        </div>
                      </div>

                      {/* File Info */}
                      {uploadedFile && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-4 w-4 text-green-600 mr-2" />
                              <div>
                                <p className="font-medium text-green-800 text-sm">{uploadedFile.name}</p>
                                <p className="text-xs text-green-600">
                                  {(uploadedFile.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setUploadedFile(null);
                                setTsvData([]);
                                if (fileInputRef.current) {
                                  fileInputRef.current.value = '';
                                }
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* TSV Data Preview */}
                      {tsvData.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-900">
                              Data Preview ({tsvData.length} rules)
                            </h4>
                            <button
                              onClick={() => setPreviewMode(!previewMode)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                            >
                              <Eye className="h-3 w-3" />
                              {previewMode ? 'Hide' : 'Show'} Preview
                            </button>
                          </div>

                          {previewMode && (
                            <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-auto">
                              <table className="min-w-full text-xs">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-2 py-1 text-left font-medium text-gray-700">Name</th>
                                    <th className="px-2 py-1 text-left font-medium text-gray-700">Description</th>
                                    <th className="px-2 py-1 text-left font-medium text-gray-700">Ruleset</th>
                                    <th className="px-2 py-1 text-left font-medium text-gray-700">Variables</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {tsvData.slice(0, 5).map((row, index) => (
                                    <tr key={index}>
                                      <td className="px-2 py-1 font-medium text-gray-900">{row.name}</td>
                                      <td className="px-2 py-1 text-gray-600">{row.rulesetDesc}</td>
                                      <td className="px-2 py-1 text-gray-600">{row.ruleset || '—'}</td>
                                      <td className="px-2 py-1 text-gray-600 font-mono">{row.varList}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {tsvData.length > 5 && (
                                <p className="text-xs text-gray-500 mt-2 text-center">
                                  Showing first 5 of {tsvData.length} rules
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Basic Info for Uploaded Rubric */}
                      <div className="space-y-3 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900">Rubric Information</h4>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Rubric Name *
                          </label>
                          <input
                            type="text"
                            value={rubricData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Enter rubric name..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <textarea
                            value={rubricData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Describe the purpose and scope of this rubric..."
                          />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Owner Name
                            </label>
                            <input
                              type="text"
                              value={rubricData.owner_name}
                              onChange={(e) => handleInputChange('owner_name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                              placeholder="Your name..."
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Organization
                            </label>
                            <input
                              type="text"
                              value={rubricData.organization}
                              onChange={(e) => handleInputChange('organization', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                              placeholder="Your organization..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* Quick Actions */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <Sparkles className="h-4 w-4 mr-2 text-blue-600" />
                    Quick Actions
                  </h4>
                  <div className="space-y-2">
                    <button
                      onClick={handleCreateRubric}
                      disabled={loading || !rubricData.name.trim()}
                      className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {loading ? 'Creating...' : 'Create Rubric'}
                    </button>
                    
                    <button
                      onClick={handleClose}
                      className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Rubric Preview */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <Eye className="h-4 w-4 mr-2 text-green-600" />
                    Preview
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-medium text-gray-700">Name:</span>
                      <p className="text-gray-900">{rubricData.name || 'Untitled Rubric'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Description:</span>
                      <p className="text-gray-900">{rubricData.description || 'No description'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Owner:</span>
                      <p className="text-gray-900">{rubricData.owner_name || 'Not specified'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Organization:</span>
                      <p className="text-gray-900">{rubricData.organization || 'Not specified'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Disease Area:</span>
                      <p className="text-gray-900">{rubricData.disease_area_study || 'Not specified'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Tags:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rubricData.tags.length > 0 ? (
                          rubricData.tags.map((tag, index) => (
                            <span key={index} className="px-1 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500">No tags</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Visibility:</span>
                      <p className="text-gray-900 capitalize">{rubricData.visibility}</p>
                    </div>
                    {activeTab === 'upload' && tsvData.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700">Rules:</span>
                        <p className="text-gray-900">{tsvData.length} rules from file</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Help */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                    <Database className="h-4 w-4 mr-2" />
                    Need Help?
                  </h4>
                  <p className="text-blue-800 text-xs mb-2">
                    {activeTab === 'manual' 
                      ? 'Create a rubric manually by filling out the form. You can add rules later from the rubric details page.'
                      : 'Upload a TSV, CSV, Excel, or JSON file to create a complete rubric with rules. Required columns/fields: name, rulesetDesc, ruleset, varList.'
                    }
                  </p>
                  <div className="space-y-1">
                    <button
                      onClick={downloadExampleTSV}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium block"
                    >
                      Example TSV →
                    </button>
                    <button
                      onClick={downloadExampleCSV}
                      className="text-green-600 hover:text-green-800 text-xs font-medium block"
                    >
                      Example CSV →
                    </button>
                    <button
                      onClick={downloadExampleJSON}
                      className="text-purple-600 hover:text-purple-800 text-xs font-medium block"
                    >
                      Example JSON →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
