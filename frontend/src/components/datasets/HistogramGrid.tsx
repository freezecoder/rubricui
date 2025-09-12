'use client';

import { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { apiService } from '@/services/api';
import { DatasetHistogramWithColumn, DatasetColumn, DatasetHistogram } from '@/types';
import { 
  BarChart3, 
  Loader2, 
  AlertCircle, 
  RefreshCw,
  TrendingUp,
  Minus,
  Plus
} from 'lucide-react';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface HistogramGridProps {
  datasetId: string;
  numericColumns: DatasetColumn[];
}

interface HistogramData {
  [columnId: string]: DatasetHistogramWithColumn;
}

export default function HistogramGrid({ datasetId, numericColumns }: HistogramGridProps) {
  const [histograms, setHistograms] = useState<HistogramData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedHistograms, setExpandedHistograms] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const loadHistograms = async () => {
    try {
      setLoading(true);
      setError('');
      
      const histogramList = await apiService.getDatasetHistograms(datasetId);
      
      // Convert to object keyed by column_id for easy lookup
      // For each histogram, get the full data including bin_edges and bin_counts
      const histogramData: HistogramData = {};
      for (const hist of histogramList) {
        try {
          const fullHistogram = await apiService.getHistogram(datasetId, hist.id);
          histogramData[hist.column_id] = fullHistogram;
        } catch (err) {
          console.error(`Failed to load full histogram data for ${hist.id}:`, err);
          // Fallback to summary data if full data fails
          histogramData[hist.column_id] = {
            histogram: {
              id: hist.id,
              dataset_id: datasetId,
              column_id: hist.column_id,
              bin_count: hist.bin_count,
              bin_edges: [], // Empty arrays as fallback
              bin_counts: [],
              min_value: hist.min_value,
              max_value: hist.max_value,
              total_count: hist.total_count,
              null_count: hist.null_count,
              created_date: hist.created_date
            },
            column: {
              id: hist.column_id,
              dataset_id: datasetId,
              original_name: 'Unknown',
              sanitized_name: 'unknown',
              column_type: 'numeric',
              column_index: 0,
              created_date: hist.created_date
            }
          };
        }
      }
      
      setHistograms(histogramData);
    } catch (err) {
      setError('Failed to load histograms');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateHistograms = async () => {
    try {
      setGenerating(true);
      setError('');
      
      await apiService.generateHistograms(datasetId, {
        dataset_id: datasetId,
        bin_count: 30,
        force_regenerate: false
      });
      
      // Reload histograms after generation
      await loadHistograms();
    } catch (err) {
      setError('Failed to generate histograms');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (datasetId && numericColumns.length > 0) {
      loadHistograms();
    }
  }, [datasetId, numericColumns.length]);

  const toggleHistogramExpansion = (columnId: string) => {
    const newExpanded = new Set(expandedHistograms);
    if (newExpanded.has(columnId)) {
      newExpanded.delete(columnId);
    } else {
      newExpanded.add(columnId);
    }
    setExpandedHistograms(newExpanded);
  };

  const createChartData = (histogramWithColumn: DatasetHistogramWithColumn) => {
    const { histogram, column } = histogramWithColumn;
    
    // Add null checks to prevent runtime errors
    if (!histogram || !column) {
      return null;
    }
    
    if (histogram.bin_count === 0) {
      return null;
    }

    // Create labels for bins (using bin centers)
    const labels = [];
    for (let i = 0; i < histogram.bin_count; i++) {
      const binStart = histogram.bin_edges[i];
      const binEnd = histogram.bin_edges[i + 1];
      const binCenter = (binStart + binEnd) / 2;
      labels.push(binCenter.toFixed(2));
    }

    return {
      labels,
      datasets: [
        {
          label: column.original_name,
          data: histogram.bin_counts,
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
          borderRadius: 2,
        },
      ],
    };
  };

  const createChartOptions = (histogram: DatasetHistogram) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (context: { dataIndex: number }[]) => {
            const dataIndex = context[0].dataIndex;
            if (dataIndex < histogram.bin_edges.length - 1) {
              const binStart = histogram.bin_edges[dataIndex];
              const binEnd = histogram.bin_edges[dataIndex + 1];
              return `Range: ${binStart.toFixed(3)} - ${binEnd.toFixed(3)}`;
            }
            return `Bin ${dataIndex + 1}`;
          },
          label: (context: { parsed: { y: number } }) => {
            return `Count: ${context.parsed.y}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Value',
          font: {
            size: 10,
          },
        },
        ticks: {
          font: {
            size: 8,
          },
          maxTicksLimit: 5,
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Count',
          font: {
            size: 10,
          },
        },
        ticks: {
          font: {
            size: 8,
          },
        },
        beginAtZero: true,
      },
    },
  });

  const getColumnTypeColor = (type: string) => {
    switch (type) {
      case 'numeric':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'score':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading histograms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <h3 className="text-lg font-semibold text-red-800">Error Loading Histograms</h3>
        </div>
        <p className="text-red-600 mb-4">{error}</p>
        <div className="flex space-x-3">
          <button
            onClick={loadHistograms}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={generateHistograms}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 inline mr-2" />
                Generate Histograms
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const columnsWithHistograms = numericColumns.filter(col => histograms[col.id]);
  const columnsWithoutHistograms = numericColumns.filter(col => !histograms[col.id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Column Histograms</h3>
          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
            {columnsWithHistograms.length} of {numericColumns.length}
          </span>
        </div>
        
        {columnsWithoutHistograms.length > 0 && (
          <button
            onClick={generateHistograms}
            disabled={generating}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>Generate Missing Histograms</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Histogram Grid */}
      {columnsWithHistograms.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {columnsWithHistograms.map((column) => {
            const histogram = histograms[column.id];
            const chartData = createChartData({ histogram: histogram.histogram, column: histogram.column });
            const isExpanded = expandedHistograms.has(column.id);
            
            return (
              <div
                key={column.id}
                className={`bg-white rounded-lg border border-gray-200 shadow-sm transition-all duration-200 hover:shadow-md ${
                  isExpanded ? 'col-span-2 row-span-2' : ''
                }`}
              >
                {/* Header */}
                <div className="p-3 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getColumnTypeColor(column.column_type)}`}>
                        {column.column_type}
                      </span>
                      <button
                        onClick={() => toggleHistogramExpansion(column.id)}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        {isExpanded ? (
                          <Minus className="h-3 w-3" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <h4 className="font-medium text-gray-900 text-sm truncate" title={column.original_name}>
                    {column.original_name}
                  </h4>
                  <p className="text-xs text-gray-500 truncate">
                    {histogram.histogram.total_count.toLocaleString()} values
                    {histogram.histogram.null_count > 0 && (
                      <span className="text-orange-600 ml-1">
                        ({histogram.histogram.null_count} nulls)
                      </span>
                    )}
                  </p>
                </div>

                {/* Stats */}
                {chartData && (
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <div className="text-center">
                        <p className="text-gray-500 font-medium">Mean</p>
                        <p className="font-semibold text-gray-900">
                          {histogram.column.mean_value !== null && histogram.column.mean_value !== undefined 
                            ? histogram.column.mean_value.toFixed(3) 
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500 font-medium">Median</p>
                        <p className="font-semibold text-gray-900">
                          {histogram.column.median_value !== null && histogram.column.median_value !== undefined 
                            ? histogram.column.median_value.toFixed(3) 
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500 font-medium">Std Dev</p>
                        <p className="font-semibold text-gray-900">
                          {histogram.column.std_deviation !== null && histogram.column.std_deviation !== undefined 
                            ? histogram.column.std_deviation.toFixed(3) 
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs mt-1">
                      <div className="text-center">
                        <p className="text-gray-500 font-medium">Min</p>
                        <p className="font-semibold text-gray-900">
                          {histogram.histogram.min_value.toFixed(3)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500 font-medium">Max</p>
                        <p className="font-semibold text-gray-900">
                          {histogram.histogram.max_value.toFixed(3)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500 font-medium">Nulls</p>
                        <p className="font-semibold text-gray-900">
                          {histogram.histogram.null_count.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Chart */}
                <div className={`p-3 ${isExpanded ? 'h-80' : 'h-32'}`}>
                  {chartData ? (
                    <Bar data={chartData} options={createChartOptions(histogram.histogram)} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <div className="text-center">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">No data</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Histograms Available</h3>
          <p className="text-gray-600 mb-4">
            Histograms haven&apos;t been generated for the numeric columns in this dataset yet.
          </p>
          <button
            onClick={generateHistograms}
            disabled={generating}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generating Histograms...</span>
              </>
            ) : (
              <>
                <TrendingUp className="h-5 w-5" />
                <span>Generate Histograms</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Missing Histograms Notice */}
      {columnsWithoutHistograms.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <div>
              <h4 className="font-medium text-yellow-800">Missing Histograms</h4>
              <p className="text-yellow-700 text-sm">
                {columnsWithoutHistograms.length} numeric columns don&apos;t have histograms yet. 
                Click &quot;Generate Missing Histograms&quot; to create them.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
