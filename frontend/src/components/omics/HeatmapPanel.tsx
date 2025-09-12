'use client';

import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Download, Settings, Info } from 'lucide-react';
import { 
  generateHeatmapData, 
  createColorLegend, 
  exportHeatmapToCSV, 
  exportHeatmapToJSON,
  HeatmapCell,
  COLOR_SCHEMES 
} from '@/lib/heatmapUtils';

interface HeatmapData {
  heatmap_type: string;
  gene_symbols: string[];
  column_names: string[];
  data_matrix: (number | string | null)[][];
  min_value?: number;
  max_value?: number;
  missing_values: number;
}

interface HeatmapPanelProps {
  title: string;
  data: HeatmapData;
  colorScheme: string;
  isVisible: boolean;
  onToggleVisibility: () => void;
  onColorSchemeChange?: (scheme: string) => void;
  showSettings?: boolean;
  onColumnSort?: (columnName: string, sortOrder: 'asc' | 'desc') => void;
  hideGeneColumn?: boolean;
  columnLabelRotation?: number;
  onColumnVisibilityChange?: (visibleColumns: string[]) => void;
}

export default function HeatmapPanel({ 
  title, 
  data, 
  colorScheme, 
  isVisible, 
  onToggleVisibility,
  onColorSchemeChange,
  showSettings = true,
  onColumnSort,
  hideGeneColumn = false,
  columnLabelRotation = 45,
  onColumnVisibilityChange
}: HeatmapPanelProps) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [showValues, setShowValues] = useState(false);
  const [cellSize, setCellSize] = useState(38); // Increased by 30% (29 * 1.3)
  const [fontSize, setFontSize] = useState(10);
  const [showColorScaleModal, setShowColorScaleModal] = useState(false);
  const [showAdvancedSettingsModal, setShowAdvancedSettingsModal] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(data.column_names);
  
  const heatmapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Filter data to only include visible columns
  const visibleColumnIndices = visibleColumns.map(col => data.column_names.indexOf(col));
  const filteredDataMatrix = data.data_matrix.map(row => 
    visibleColumnIndices.map(idx => row[idx])
  );

  // Generate heatmap data
  const heatmapCells = generateHeatmapData(
    data.gene_symbols,
    visibleColumns,
    filteredDataMatrix,
    colorScheme,
    data.min_value,
    data.max_value
  );

  // Create color legend
  const legend = createColorLegend(
    colorScheme,
    data.min_value,
    data.max_value,
    8
  );

  // Handle mouse move for tooltip positioning
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (tooltipRef.current && hoveredCell) {
        const tooltip = tooltipRef.current;
        const rect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = e.clientX + 10;
        let top = e.clientY - 10;
        
        // Adjust if tooltip would go off screen
        if (left + rect.width > viewportWidth) {
          left = e.clientX - rect.width - 10;
        }
        if (top + rect.height > viewportHeight) {
          top = e.clientY - rect.height - 10;
        }
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [hoveredCell]);

  const handleExportCSV = () => {
    exportHeatmapToCSV(
      data.gene_symbols,
      data.column_names,
      data.data_matrix,
      `${title.toLowerCase().replace(/\s+/g, '_')}_data.csv`
    );
  };

  const handleColumnClick = (columnName: string) => {
    if (!onColumnSort) return;
    
    let newSortOrder: 'asc' | 'desc' = 'desc';
    if (sortColumn === columnName) {
      newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    }
    
    setSortColumn(columnName);
    setSortOrder(newSortOrder);
    onColumnSort(columnName, newSortOrder);
  };

  const handleColumnVisibilityToggle = (columnName: string) => {
    const newVisibleColumns = visibleColumns.includes(columnName)
      ? visibleColumns.filter(col => col !== columnName)
      : [...visibleColumns, columnName];
    
    setVisibleColumns(newVisibleColumns);
    if (onColumnVisibilityChange) {
      onColumnVisibilityChange(newVisibleColumns);
    }
  };

  const handleSelectAllColumns = () => {
    setVisibleColumns(data.column_names);
    if (onColumnVisibilityChange) {
      onColumnVisibilityChange(data.column_names);
    }
  };

  const handleDeselectAllColumns = () => {
    setVisibleColumns([]);
    if (onColumnVisibilityChange) {
      onColumnVisibilityChange([]);
    }
  };

  const handleExportJSON = () => {
    exportHeatmapToJSON(
      data.gene_symbols,
      data.column_names,
      data.data_matrix,
      {
        title,
        color_scheme: colorScheme,
        heatmap_type: data.heatmap_type,
        missing_values: data.missing_values
      },
      `${title.toLowerCase().replace(/\s+/g, '_')}_data.json`
    );
  };

  if (!data || !isVisible) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onToggleVisibility}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <EyeOff className="h-5 w-5" />
          </button>
        </div>
        <div className="text-center py-8 text-gray-500">
          <EyeOff className="h-12 w-12 mx-auto mb-2" />
          <p>Heatmap hidden</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        
        <button
          onClick={() => setShowAdvancedSettingsModal(true)}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          title="Advanced Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>


      {/* Heatmap Content */}
      <div className="overflow-x-auto" ref={heatmapRef}>
        <div className="min-w-full">
          {/* Column Headers */}
          <div className="flex mb-4">
            {!hideGeneColumn && (
              <div 
                className="px-2 py-2 text-xs font-medium text-gray-600 bg-gray-50 flex items-center justify-center"
                style={{ 
                  width: `${cellSize * 4}px`, 
                  minWidth: `${cellSize * 4}px`,
                  height: `${cellSize * 5}px`
                }}
              >
                Gene
              </div>
            )}
            {visibleColumns.map((col, idx) => (
              <div 
                key={idx} 
                className={`px-1 py-2 font-semibold bg-gray-50 text-center flex items-end justify-center cursor-pointer hover:bg-gray-100 transition-colors ${
                  sortColumn === col ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
                }`}
                style={{ 
                  width: `${cellSize}px`, 
                  minWidth: `${cellSize}px`,
                  height: `${cellSize * 5}px`
                }}
                title={`${col}${sortColumn === col ? ` (sorted ${sortOrder})` : ' - Click to sort'}`}
                onClick={() => handleColumnClick(col)}
              >
                <div className="flex flex-col items-center relative" style={{ paddingTop: '12px', paddingBottom: '8px' }}>
                  <span 
                    className="whitespace-nowrap font-bold"
                    style={{ 
                      transform: `rotate(-${columnLabelRotation}deg)`,
                      transformOrigin: 'bottom center',
                      fontSize: `${fontSize + 4}px`,
                      lineHeight: '1.2',
                      color: sortColumn === col ? '#2563eb' : '#374151',
                      marginBottom: '8px'
                    }}
                  >
                    {col.replace('_SCORE', '').replace(/_/g, ' ').substring(0, 12)}
                  </span>
                  {sortColumn === col && (
                    <span 
                      className="absolute text-xs font-bold"
                      style={{ 
                        transform: 'rotate(45deg)',
                        color: '#2563eb',
                        bottom: '4px'
                      }}
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Data Rows */}
          {heatmapCells.map((row, rowIdx) => (
            <div key={data.gene_symbols[rowIdx]} className="flex hover:bg-gray-50 pt-1">
              {!hideGeneColumn && (
                <div 
                  className="px-2 py-1 text-xs font-medium text-gray-900 bg-gray-50"
                  style={{ width: `${cellSize * 4}px`, minWidth: `${cellSize * 4}px` }}
                >
                  {data.gene_symbols[rowIdx]}
                </div>
              )}
              {row.map((cell, colIdx) => (
                <div
                  key={colIdx}
                  className="flex items-center justify-center text-xs cursor-pointer relative transition-all hover:ring-2 hover:ring-blue-300"
                  style={{ 
                    backgroundColor: cell.color,
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    minWidth: `${cellSize}px`,
                    fontSize: `${fontSize}px`,
                    color: getTextColor(cell.color),
                    margin: '1px' // Increased spacing by 10%
                  }}
                  onMouseEnter={() => setHoveredCell(cell)}
                  onMouseLeave={() => setHoveredCell(null)}
                  title={`${cell.gene} - ${cell.column}: ${cell.formattedValue}`}
                >
                  {showValues && cell.value !== null && (
                    <span className="text-center leading-none">
                      {cell.formattedValue}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Color Scale Link */}
      {showLegend && legend.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowColorScaleModal(true)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Color Scale
          </button>
        </div>
      )}

      {/* Color Scale Modal */}
      {showColorScaleModal && (
        <div className="fixed inset-0 bg-white bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Color Scale</h3>
              <button
                onClick={() => setShowColorScaleModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Value Range</span>
                <span className="text-xs text-gray-500">
                  {data.min_value !== null && data.min_value !== undefined && 
                   data.max_value !== null && data.max_value !== undefined 
                    ? `${data.min_value.toFixed(2)} to ${data.max_value.toFixed(2)}`
                    : 'Auto-scaled'
                  }
                </span>
              </div>
              <div className="flex items-center space-x-2 mb-4">
                {legend.map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <div
                      className="w-6 h-6 border border-gray-300"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-gray-600 mt-1">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-2 text-sm text-gray-600">
              <div>Missing values: {data.missing_values}</div>
              <div>Color scheme: {colorScheme}</div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowColorScaleModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Settings Modal */}
      {showAdvancedSettingsModal && (
        <div className="fixed inset-0 bg-white bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Advanced Settings</h3>
                    <p className="text-blue-100 text-sm">Customize your heatmap visualization</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAdvancedSettingsModal(false)}
                  className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
            
            <div className="space-y-8">
              {/* Visibility Toggle */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Eye className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">Heatmap Visibility</h4>
                      <p className="text-sm text-gray-600">Toggle the visibility of this heatmap panel</p>
                    </div>
                  </div>
                  <button
                    onClick={onToggleVisibility}
                    className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                      isVisible 
                        ? 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-300' 
                        : 'bg-red-100 text-red-800 hover:bg-red-200 border border-red-300'
                    }`}
                  >
                    {isVisible ? '✓ Visible' : '✗ Hidden'}
                  </button>
                </div>
              </div>
              
              {/* Export Options */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Download className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Export Data</h4>
                    <p className="text-sm text-gray-600">Download your heatmap data in various formats</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      handleExportCSV();
                      setShowAdvancedSettingsModal(false);
                    }}
                    className="flex items-center justify-center px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                  >
                    <Download className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Export CSV</div>
                      <div className="text-xs text-blue-100">Spreadsheet format</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      handleExportJSON();
                      setShowAdvancedSettingsModal(false);
                    }}
                    className="flex items-center justify-center px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg"
                  >
                    <Download className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Export JSON</div>
                      <div className="text-xs text-green-100">Structured data format</div>
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Color Scheme */}
              {onColorSchemeChange && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">Color Scheme</h4>
                      <p className="text-sm text-gray-600">Choose the color palette for your heatmap</p>
                    </div>
                  </div>
                  <select
                    value={colorScheme}
                    onChange={(e) => onColorSchemeChange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                  >
                    <option value="viridis">Viridis - Blue to Yellow</option>
                    <option value="plasma">Plasma - Purple to Pink</option>
                    <option value="inferno">Inferno - Black to Yellow</option>
                    <option value="magma">Magma - Black to White</option>
                    <option value="coolwarm">Cool Warm - Blue to Red</option>
                    <option value="greenRed">Green Red - Green to Red</option>
                    <option value="RdYlBu">Red Yellow Blue - Multi-color</option>
                    <option value="categorical">Categorical - Distinct Colors</option>
                  </select>
                </div>
              )}
              
              {/* Column Visibility */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900">Column Visibility</h4>
                    <p className="text-sm text-gray-600">Show or hide specific columns in your heatmap</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSelectAllColumns}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleDeselectAllColumns}
                      className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="max-h-64 overflow-y-auto p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {data.column_names.map((column, index) => (
                        <label key={index} className="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                          <input
                            type="checkbox"
                            checked={visibleColumns.includes(column)}
                            onChange={() => handleColumnVisibilityToggle(column)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                          />
                          <span className="text-sm text-gray-700 truncate flex-1" title={column}>
                            {column.replace(/_/g, ' ').substring(0, 40)}
                            {column.length > 40 ? '...' : ''}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-blue-600">{visibleColumns.length}</span> of <span className="font-medium">{data.column_names.length}</span> columns visible
                  </div>
                  <div className="text-xs text-gray-500">
                    {Math.round((visibleColumns.length / data.column_names.length) * 100)}% selected
                  </div>
                </div>
              </div>
              
              {/* Statistics */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Data Statistics</h4>
                    <p className="text-sm text-gray-600">Overview of your heatmap data</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="text-2xl font-bold text-blue-600">{data.gene_symbols.length}</div>
                    <div className="text-sm text-gray-600">Total Genes</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="text-2xl font-bold text-green-600">{visibleColumns.length}</div>
                    <div className="text-sm text-gray-600">Visible Columns</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="text-2xl font-bold text-orange-600">{data.missing_values}</div>
                    <div className="text-sm text-gray-600">Missing Values</div>
                  </div>
                </div>
                <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Color Scheme:</span>
                    <span className="text-sm text-gray-600">{COLOR_SCHEMES[colorScheme]?.name || colorScheme}</span>
                  </div>
                </div>
              </div>
            </div>
            </div>
            
            {/* Footer */}
            <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Changes are applied immediately to your heatmap
                </div>
                <button
                  onClick={() => setShowAdvancedSettingsModal(false)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Tooltip */}
      {hoveredCell && (
        <div
          ref={tooltipRef}
          className="absolute z-50 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none"
          style={{ fontSize: '12px' }}
        >
          <div className="font-medium">{hoveredCell.gene}</div>
          <div className="text-gray-300">{hoveredCell.column}</div>
          <div className="text-blue-300">Value: {hoveredCell.formattedValue}</div>
          {hoveredCell.rank && (
            <div className="text-green-300">Rank: {hoveredCell.rank}</div>
          )}
          {hoveredCell.percentile !== null && hoveredCell.percentile !== undefined && (
            <div className="text-yellow-300">Percentile: {hoveredCell.percentile.toFixed(1)}%</div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Determine text color based on background color
 */
function getTextColor(backgroundColor: string): string {
  // Convert hex to RGB
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white text for dark backgrounds, black for light
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
