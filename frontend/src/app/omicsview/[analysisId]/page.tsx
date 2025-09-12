'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiService } from '@/services/api';
import { 
  BarChart3, 
  Filter, 
  SortAsc, 
  Upload, 
  Settings, 
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import HeatmapPanel from '@/components/omics/HeatmapPanel';
import ResizableHeatmapPanel from '@/components/omics/ResizableHeatmapPanel';

// Types for omics view data
interface HeatmapData {
  heatmap_type: string;
  gene_symbols: string[];
  column_names: string[];
  data_matrix: (number | string | null)[][];
  min_value?: number;
  max_value?: number;
  missing_values: number;
}

interface OmicsViewData {
  analysis_id: string;
  analysis_name?: string;
  gene_symbols: string[];
  total_genes: number;
  displayed_genes: number;
  rubric_scores_heatmap?: HeatmapData;
  numeric_columns_heatmap?: HeatmapData;
  annotations_heatmap?: HeatmapData;
  available_rubric_columns: string[];
  available_numeric_columns: string[];
  available_annotation_columns: string[];
  created_at: string;
  last_updated: string;
}

interface FilterPanelProps {
  onFilterChange: (filters: any) => void;
  onSortChange: (sort: any) => void;
  onGeneListUpload: (genes: string[]) => void;
  onColorSchemeChange: (scheme: any) => void;
  onGeneCountChange: (count: number) => void;
  onScalingChange: (scaling: any) => void;
  onColumnLabelRotationChange: (angle: number) => void;
  scalingMethods: {
    rubric_scores: string;
    numeric_columns: string;
    annotations: string;
  };
  columnLabelRotation: number;
  availableColumns: {
    rubric_columns: string[];
    numeric_columns: string[];
    annotation_columns: string[];
  };
}

function FilterPanel({ 
  onFilterChange, 
  onSortChange, 
  onGeneListUpload, 
  onColorSchemeChange,
  onGeneCountChange,
  onScalingChange,
  onColumnLabelRotationChange,
  scalingMethods,
  columnLabelRotation,
  availableColumns 
}: FilterPanelProps) {
  const [filters, setFilters] = useState({
    minTotalScore: '',
    maxTotalScore: '',
    selectedGenes: '',
    annotationFilter: ''
  });
  
  const [sortBy, setSortBy] = useState('total_score');
  const [sortOrder, setSortOrder] = useState('desc');
  
  const [colorSchemes, setColorSchemes] = useState({
    rubric_scores: 'viridis',
    numeric_columns: 'greenRed',
    annotations: 'greenRed'
  });
  
  const [geneCount, setGeneCount] = useState(50);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleSortChange = () => {
    onSortChange({ sortBy, sortOrder });
  };

  const handleColorSchemeChange = (heatmapType: string, scheme: string) => {
    const newSchemes = { ...colorSchemes, [heatmapType]: scheme };
    setColorSchemes(newSchemes);
    onColorSchemeChange(newSchemes);
  };

  const handleGeneCountChange = (count: number) => {
    setGeneCount(count);
    onGeneCountChange(count);
  };

  const handleScalingChange = (heatmapType: string, method: string) => {
    const newScaling = { ...scalingMethods, [heatmapType]: method };
    onScalingChange(newScaling);
  };

  const handleGeneListUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const genes = content.split('\n').map(g => g.trim()).filter(g => g);
        onGeneListUpload(genes);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter & Control Panel</h2>
      
      {/* Gene Filtering */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">1. Filter Genes</h3>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Total Score Range</label>
          <div className="flex space-x-2">
            <input
              type="number"
              placeholder="Min"
              value={filters.minTotalScore}
              onChange={(e) => handleFilterChange('minTotalScore', e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
            />
            <input
              type="number"
              placeholder="Max"
              value={filters.maxTotalScore}
              onChange={(e) => handleFilterChange('maxTotalScore', e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Gene Symbols (comma-separated)</label>
          <textarea
            placeholder="EGFR, VEGFA, TGFB1..."
            value={filters.selectedGenes}
            onChange={(e) => handleFilterChange('selectedGenes', e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded h-20"
          />
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Upload Gene List</label>
          <input
            type="file"
            accept=".txt,.csv"
            onChange={handleGeneListUpload}
            className="w-full text-xs"
          />
        </div>
      </div>
      
      {/* Gene Count */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">2. Display Options</h3>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Number of Genes to Show</label>
          <select
            value={geneCount}
            onChange={(e) => handleGeneCountChange(parseInt(e.target.value))}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          >
            <option value={50}>50 genes</option>
            <option value={100}>100 genes</option>
            <option value={150}>150 genes</option>
            <option value={200}>200 genes</option>
            <option value={500}>500 genes</option>
            <option value={1000}>1000 genes</option>
          </select>
        </div>
      </div>
      
      {/* Sorting */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">3. Sort Genes</h3>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          >
            <option value="total_score">Total Score</option>
            <option value="gene_symbol">Gene Symbol</option>
            {availableColumns.rubric_columns.map(col => (
              <option key={col} value={col}>{col.replace('_SCORE', '')}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Sort Order</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
        
        <button
          onClick={handleSortChange}
          className="w-full px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
        >
          Apply Sort
        </button>
      </div>
      
      {/* Color Schemes */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">4. Color Schemes</h3>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Rubric Scores</label>
          <select
            value={colorSchemes.rubric_scores}
            onChange={(e) => handleColorSchemeChange('rubric_scores', e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          >
            <option value="viridis">Viridis</option>
            <option value="plasma">Plasma</option>
            <option value="inferno">Inferno</option>
            <option value="magma">Magma</option>
            <option value="coolwarm">Cool Warm</option>
            <option value="greenRed">Green Red</option>
            <option value="RdYlBu">Red Yellow Blue</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Numeric Columns</label>
          <select
            value={colorSchemes.numeric_columns}
            onChange={(e) => handleColorSchemeChange('numeric_columns', e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          >
            <option value="viridis">Viridis</option>
            <option value="plasma">Plasma</option>
            <option value="inferno">Inferno</option>
            <option value="magma">Magma</option>
            <option value="coolwarm">Cool Warm</option>
            <option value="greenRed">Green Red</option>
            <option value="RdYlBu">Red Yellow Blue</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Annotations</label>
          <select
            value={colorSchemes.annotations}
            onChange={(e) => handleColorSchemeChange('annotations', e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          >
            <option value="viridis">Viridis</option>
            <option value="plasma">Plasma</option>
            <option value="inferno">Inferno</option>
            <option value="magma">Magma</option>
            <option value="coolwarm">Cool Warm</option>
            <option value="greenRed">Green Red</option>
            <option value="RdYlBu">Red Yellow Blue</option>
          </select>
        </div>
      </div>
      
      {/* Scaling Options */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">5. Data Scaling</h3>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Rubric Scores</label>
          <select
            value={scalingMethods.rubric_scores}
            onChange={(e) => handleScalingChange('rubric_scores', e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          >
            <option value="none">No Scaling</option>
            <option value="minmax">Min-Max (0-1)</option>
            <option value="standard">Standard (Z-score)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Dataset Columns</label>
          <select
            value={scalingMethods.numeric_columns}
            onChange={(e) => handleScalingChange('numeric_columns', e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          >
            <option value="none">No Scaling</option>
            <option value="minmax">Min-Max (0-1)</option>
            <option value="standard">Standard (Z-score)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Gene Annotations</label>
          <select
            value={scalingMethods.annotations}
            onChange={(e) => handleScalingChange('annotations', e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          >
            <option value="none">No Scaling</option>
            <option value="minmax">Min-Max (0-1)</option>
            <option value="standard">Standard (Z-score)</option>
          </select>
        </div>
      </div>
      
      {/* Column Label Rotation */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">6. Column Label Rotation</h3>
        
        <div>
          <label className="block text-xs text-gray-600 mb-2">
            Rotation Angle: {columnLabelRotation}°
          </label>
          <div className="px-2">
            <input
              type="range"
              min="40"
              max="90"
              value={columnLabelRotation}
              onChange={(e) => onColumnLabelRotationChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((columnLabelRotation - 40) / 50) * 100}%, #e5e7eb ${((columnLabelRotation - 40) / 50) * 100}%, #e5e7eb 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>40°</span>
              <span>90°</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Adjust the rotation angle of column labels for better readability
          </p>
        </div>
      </div>
    </div>
  );
}


export default function OmicsViewPage() {
  const params = useParams();
  const analysisId = params.analysisId as string;
  
  const [omicsData, setOmicsData] = useState<OmicsViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [heatmapVisibility, setHeatmapVisibility] = useState({
    rubric_scores: true,
    numeric_columns: true,
    annotations: true
  });
  
  const [colorSchemes, setColorSchemes] = useState({
    rubric_scores: 'viridis',
    numeric_columns: 'greenRed',
    annotations: 'greenRed'
  });
  const [geneCount, setGeneCount] = useState(50);
  const [scalingMethods, setScalingMethods] = useState({
    rubric_scores: 'none',
    numeric_columns: 'standard',
    annotations: 'standard'
  });
  const [columnLabelRotation, setColumnLabelRotation] = useState(45);
  const [filterPanelVisible, setFilterPanelVisible] = useState(true);

  useEffect(() => {
    loadOmicsData();
  }, [analysisId, geneCount, scalingMethods]);

  const loadOmicsData = async () => {
    await loadOmicsDataWithParams();
  };

  const handleFilterChange = async (filters: any) => {
    // TODO: Implement filtering
    console.log('Filter change:', filters);
  };

  const handleSortChange = async (sort: any) => {
    // Reload data with new sorting parameters
    await loadOmicsDataWithParams(sort.sortBy, sort.sortOrder);
  };

  const handleColumnSort = async (columnName: string, sortOrder: 'asc' | 'desc') => {
    // Handle column-specific sorting
    await loadOmicsDataWithParams(columnName, sortOrder);
  };

  const loadOmicsDataWithParams = async (sortBy: string = 'total_score', sortOrder: 'asc' | 'desc' = 'desc') => {
    try {
      setLoading(true);
      setError(null);
      
      const scalingParams = `rubric_scaling=${scalingMethods.rubric_scores}&numeric_scaling=${scalingMethods.numeric_columns}&annotation_scaling=${scalingMethods.annotations}`;
      const response = await fetch(`/api/omics-view/analysis/${analysisId}/data/?limit=${geneCount}&sort_by=${sortBy}&sort_order=${sortOrder}&${scalingParams}`);
      if (!response.ok) {
        throw new Error(`Failed to load omics data: ${response.statusText}`);
      }
      
      const data = await response.json();
      setOmicsData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneListUpload = async (genes: string[]) => {
    // TODO: Implement gene list upload
    console.log('Gene list upload:', genes);
  };

  const handleColorSchemeChange = (schemes: any) => {
    setColorSchemes(schemes);
  };

  const handleHeatmapColorSchemeChange = (heatmapType: string, scheme: string) => {
    setColorSchemes(prev => ({
      ...prev,
      [heatmapType]: scheme
    }));
  };

  const handleGeneCountChange = (count: number) => {
    setGeneCount(count);
    // Reload data with new gene count
    loadOmicsData();
  };

  const handleScalingChange = (scaling: any) => {
    setScalingMethods(scaling);
    // Reload data with new scaling
    loadOmicsData();
  };

  const handleColumnLabelRotationChange = (angle: number) => {
    setColumnLabelRotation(angle);
  };

  const handleColumnVisibilityChange = (heatmapType: string, visibleColumns: string[]) => {
    // For now, just log the change - could be extended to persist preferences
    console.log(`${heatmapType} visible columns:`, visibleColumns);
  };

  const toggleHeatmapVisibility = (heatmapType: string) => {
    setHeatmapVisibility(prev => ({
      ...prev,
      [heatmapType]: !prev[heatmapType]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading omics view data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadOmicsData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!omicsData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No omics data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        {/* Breadcrumb Trail */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
          <a href="/" className="hover:text-gray-700 transition-colors">Home</a>
          <ChevronRight className="h-4 w-4" />
          <a href="/analysis" className="hover:text-gray-700 transition-colors">Analysis</a>
          <ChevronRight className="h-4 w-4" />
          <a href={`/analysis/${analysisId}`} className="hover:text-gray-700 transition-colors">Analysis Details</a>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-medium">Omics View</span>
        </nav>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">Omics View</h1>
              
              {/* Sort Information Badge */}
              <div className="flex items-center space-x-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-blue-700">Sorted by:</span>
                  <span className="text-sm font-semibold text-blue-900">
                    {omicsData.sort_by?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Total Score'}
                  </span>
                  <div className="flex items-center">
                    {omicsData.sort_order === 'asc' ? (
                      <div className="flex items-center text-green-600">
                        <span className="text-xs">↑</span>
                        <span className="text-xs ml-1">Ascending</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600">
                        <span className="text-xs">↓</span>
                        <span className="text-xs ml-1">Descending</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Analysis: <span className="font-medium">{omicsData.analysis_name || analysisId}</span></span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>Genes: <span className="font-medium">{omicsData.displayed_genes} / {omicsData.total_genes}</span></span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>Display: <span className="font-medium">{geneCount} genes</span></span>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={loadOmicsData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-full">
        {/* Filter Panel Toggle Button */}
        <button
          onClick={() => setFilterPanelVisible(!filterPanelVisible)}
          className="fixed left-4 top-1/2 transform -translate-y-1/2 z-50 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-all duration-200"
          title={filterPanelVisible ? "Hide Filter Panel" : "Show Filter Panel"}
        >
          {filterPanelVisible ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </button>

        {/* Filter Panel */}
        {filterPanelVisible && (
          <div className="w-80 flex-shrink-0">
            <FilterPanel
              key="filter-panel"
              onFilterChange={handleFilterChange}
              onSortChange={handleSortChange}
              onGeneListUpload={handleGeneListUpload}
              onColorSchemeChange={handleColorSchemeChange}
              onGeneCountChange={handleGeneCountChange}
              onScalingChange={handleScalingChange}
              onColumnLabelRotationChange={handleColumnLabelRotationChange}
              scalingMethods={scalingMethods}
              columnLabelRotation={columnLabelRotation}
              availableColumns={{
                rubric_columns: omicsData.available_rubric_columns,
                numeric_columns: omicsData.available_numeric_columns,
                annotation_columns: omicsData.available_annotation_columns
              }}
            />
          </div>
        )}

        {/* Heatmap Panels - Horizontal Layout */}
        <div className="flex-1 flex overflow-x-auto">
          <div className="flex gap-2 p-2 min-w-full">
            {/* Rubric Scores Heatmap */}
            {omicsData.rubric_scores_heatmap && (
              <ResizableHeatmapPanel
                initialWidth={550}
                minWidth={400}
                maxWidth={800}
              >
                <HeatmapPanel
                  title="Rubric Scores"
                  data={omicsData.rubric_scores_heatmap}
                  colorScheme={colorSchemes.rubric_scores}
                  isVisible={heatmapVisibility.rubric_scores}
                  onToggleVisibility={() => toggleHeatmapVisibility('rubric_scores')}
                  onColorSchemeChange={(scheme) => handleHeatmapColorSchemeChange('rubric_scores', scheme)}
                  showSettings={true}
                  onColumnSort={handleColumnSort}
                  columnLabelRotation={columnLabelRotation}
                  onColumnVisibilityChange={(visibleColumns) => handleColumnVisibilityChange('rubric_scores', visibleColumns)}
                />
              </ResizableHeatmapPanel>
            )}

            {/* Dataset Columns Heatmap */}
            {omicsData.numeric_columns_heatmap && (
              <ResizableHeatmapPanel
                initialWidth={1000}
                minWidth={600}
                maxWidth={1500}
              >
                <HeatmapPanel
                  title="Dataset Columns"
                  data={omicsData.numeric_columns_heatmap}
                  colorScheme={colorSchemes.numeric_columns}
                  isVisible={heatmapVisibility.numeric_columns}
                  onToggleVisibility={() => toggleHeatmapVisibility('numeric_columns')}
                  onColorSchemeChange={(scheme) => handleHeatmapColorSchemeChange('numeric_columns', scheme)}
                  showSettings={true}
                  onColumnSort={handleColumnSort}
                  hideGeneColumn={true}
                  columnLabelRotation={columnLabelRotation}
                  onColumnVisibilityChange={(visibleColumns) => handleColumnVisibilityChange('numeric_columns', visibleColumns)}
                />
              </ResizableHeatmapPanel>
            )}

            {/* Annotations Heatmap - Last Panel */}
            {omicsData.annotations_heatmap && (
              <ResizableHeatmapPanel
                initialWidth={1200}
                minWidth={800}
                maxWidth={2500}
              >
                <HeatmapPanel
                  title="Gene Annotations"
                  data={omicsData.annotations_heatmap}
                  colorScheme={colorSchemes.annotations}
                  isVisible={heatmapVisibility.annotations}
                  onToggleVisibility={() => toggleHeatmapVisibility('annotations')}
                  onColorSchemeChange={(scheme) => handleHeatmapColorSchemeChange('annotations', scheme)}
                  showSettings={true}
                  onColumnSort={handleColumnSort}
                  hideGeneColumn={true}
                  columnLabelRotation={columnLabelRotation}
                  onColumnVisibilityChange={(visibleColumns) => handleColumnVisibilityChange('annotations', visibleColumns)}
                />
              </ResizableHeatmapPanel>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
