'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api';
import { 
  ArrowLeft, 
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

interface TSVRow {
  name: string;
  rulesetDesc: string;
  ruleset: string;
  varList: string;
}

export default function CreateRubricPage() {
  const router = useRouter();
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
      
      // Redirect to the new rubric page after a short delay
      setTimeout(() => {
        router.push(`/rubrics/${newRubric.id}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rubric');
    } finally {
      setLoading(false);
    }
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

  const downloadExampleExcel = () => {
    // For Excel files, we'll create a simple CSV that can be opened in Excel
    // In a real implementation, you might use a library like xlsx to create actual Excel files
    const exampleData = [
      ['name', 'rulesetDesc', 'ruleset', 'varList'],
      ['magnitude_expr_median', 'Expression Magnitude (Median)', 'x > 0.5 ~ 6; x > 0.3 ~ 4; TRUE ~ 0', 'list(x=e$gene_table$tcga_expr_percentile_rank)'],
      ['ChinaChoice_LUSC_TvsN', 'China CHOICE DE: Tumor vs Normal (SQ)', 'x > 1.5 & y < 0.05 ~ 8; x > 1.0 & y < 0.1 ~ 6; TRUE ~ 0', 'list(x=e$gene_table$chinaChoice_logfc,y=e$gene_table$chinaChoice_pval)'],
      ['scrna_GSE127465_de', 'scRNA GSE127465 Differential expression', 'x > 0.5 ~ 4; x < -0.5 ~ 2; TRUE ~ 0', 'list(x=e$gene_table$scrna_GSE127465_logfc)']
    ];

    const csvContent = exampleData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'example_rubric_rules.xlsx';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-red-50">
      <div className="w-full px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg bg-white/80 backdrop-blur-sm border border-gray-200 hover:bg-white hover:shadow-md transition-all"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">
                Create New Rubric
              </h1>
              <p className="text-gray-600 mt-2">Build a custom rubric for genomic analysis</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-2 shadow-sm">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('manual')}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === 'manual'
                    ? 'bg-gradient-to-r from-blue-600 to-red-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Plus className="h-4 w-4 mr-2 inline" />
                Manual Creation
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === 'upload'
                    ? 'bg-gradient-to-r from-blue-600 to-red-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                      <Upload className="h-4 w-4 mr-2 inline" />
                      Upload Rubric Rules from File
              </button>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center">
            <Check className="h-5 w-5 text-green-600 mr-3" />
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Form Section */}
          <div className="lg:col-span-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-8 shadow-sm">
              {activeTab === 'manual' ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Plus className="h-5 w-5 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900">Manual Rubric Creation</h2>
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="Add a tag..."
                        />
                        <button
                          onClick={handleAddTag}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {rubricData.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      >
                        <option value="public">Public - Visible to everyone</option>
                        <option value="private">Private - Only visible to you</option>
                        <option value="hidden">Hidden - Admin only</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Upload className="h-5 w-5 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900">Upload File</h2>
                  </div>

                  {/* File Upload */}
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          accept=".tsv,.txt,.csv,.xlsx,.json"
          onChange={handleFileUpload}
          className="hidden"
        />
                    <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Upload TSV/CSV/Excel/JSON File
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Upload a TSV, CSV, Excel, or JSON file to create a complete rubric with all its rules. Each row/object in the file becomes a rule that will be added to the rubric.
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-gradient-to-r from-blue-600 to-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      <Upload className="h-4 w-4 mr-2 inline" />
                      Choose File
                    </button>
                    <div className="mt-4 space-y-2">
                      <button
                        onClick={downloadExampleTSV}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center justify-center gap-1 mx-auto"
                      >
                        <Download className="h-4 w-4" />
                        Download Example TSV
                      </button>
                      <button
                        onClick={downloadExampleCSV}
                        className="text-green-600 hover:text-green-800 text-sm flex items-center justify-center gap-1 mx-auto"
                      >
                        <Download className="h-4 w-4" />
                        Download Example CSV
                      </button>
                      <button
                        onClick={downloadExampleJSON}
                        className="text-purple-600 hover:text-purple-800 text-sm flex items-center justify-center gap-1 mx-auto"
                      >
                        <Download className="h-4 w-4" />
                        Download Example JSON
                      </button>
                    </div>
                  </div>

                  {/* File Info */}
                  {uploadedFile && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-green-600 mr-3" />
                          <div>
                            <p className="font-medium text-green-800">{uploadedFile.name}</p>
                            <p className="text-sm text-green-600">
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
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Data Preview ({tsvData.length} rules)
                        </h3>
                        <button
                          onClick={() => setPreviewMode(!previewMode)}
                          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          {previewMode ? 'Hide' : 'Show'} Preview
                        </button>
                      </div>

                      {previewMode && (
                        <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-700">Description</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-700">Ruleset</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-700">Variables</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {tsvData.slice(0, 10).map((row, index) => (
                                <tr key={index}>
                                  <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                                  <td className="px-3 py-2 text-gray-600">{row.rulesetDesc}</td>
                                  <td className="px-3 py-2 text-gray-600">{row.ruleset || '—'}</td>
                                  <td className="px-3 py-2 text-gray-600 font-mono text-xs">{row.varList}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {tsvData.length > 10 && (
                            <p className="text-sm text-gray-500 mt-2 text-center">
                              Showing first 10 of {tsvData.length} rules
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Basic Info for Uploaded Rubric */}
                  <div className="space-y-4 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Rubric Information</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rubric Name *
                      </label>
                      <input
                        type="text"
                        value={rubricData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-blue-600" />
                Quick Actions
              </h3>
              <div className="space-y-3">
                <button
                  onClick={handleCreateRubric}
                  disabled={loading || !rubricData.name.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-red-600 text-white px-4 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-5 w-5 mr-2" />
                  )}
                  {loading ? 'Creating...' : 'Create Rubric'}
                </button>
                
                <button
                  onClick={() => router.back()}
                  className="w-full bg-gray-100 text-gray-700 px-4 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Rubric Preview */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Eye className="h-5 w-5 mr-2 text-green-600" />
                Preview
              </h3>
              <div className="space-y-3 text-sm">
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
                        <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
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
                    <p className="text-gray-900">{tsvData.length} rules from TSV</p>
                  </div>
                )}
              </div>
            </div>

            {/* Help */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2 flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Need Help?
              </h3>
              <p className="text-blue-800 text-sm mb-3">
                {activeTab === 'manual' 
                  ? 'Create a rubric manually by filling out the form. You can add rules later from the rubric details page.'
                  : 'Upload a TSV, CSV, Excel, or JSON file to create a complete rubric with rules. Each row/object becomes a rule. Required columns/fields: name, rulesetDesc, ruleset, varList.'
                }
              </p>
              <div className="space-y-1">
                <button
                  onClick={downloadExampleTSV}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium block"
                >
                  Download Example TSV →
                </button>
                <button
                  onClick={downloadExampleCSV}
                  className="text-green-600 hover:text-green-800 text-sm font-medium block"
                >
                  Download Example CSV →
                </button>
                <button
                  onClick={downloadExampleExcel}
                  className="text-purple-600 hover:text-purple-800 text-sm font-medium block"
                >
                  Download Example Excel →
                </button>
                <button
                  onClick={downloadExampleJSON}
                  className="text-orange-600 hover:text-orange-800 text-sm font-medium block"
                >
                  Download Example JSON →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
