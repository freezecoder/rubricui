'use client';

import { DataPreview } from '@/types';

interface DataVisualizationProps {
  preview: DataPreview;
  className?: string;
}

export function DataVisualization({ preview, className = '' }: DataVisualizationProps) {
  const getColumnCategories = () => {
    const scoreCols = preview.columns.filter((col: string) => 
      col.toUpperCase().includes('SCORE') || col.toUpperCase().includes('SCORING')
    );
    const annotationCols = preview.columns.filter((col: string) => 
      ['desc', 'name', 'id', 'hpa', 'goal', 'symbol', 'description'].some(key => 
        col.toLowerCase().includes(key)
      )
    );
    const dataCols = preview.columns.length - scoreCols.length - annotationCols.length;
    
    return { 
      score: scoreCols.length, 
      data: dataCols, 
      annotation: annotationCols.length 
    };
  };

  const categories = getColumnCategories();
  const totalColumns = preview.columns.length;

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Overview</h3>
      
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {preview.total_rows.toLocaleString()}
          </div>
          <div className="text-sm text-blue-800">Total Genes</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{totalColumns}</div>
          <div className="text-sm text-green-800">Total Columns</div>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{categories.score}</div>
          <div className="text-sm text-purple-800">Score Columns</div>
        </div>
        <div className="text-center p-4 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">{categories.data}</div>
          <div className="text-sm text-orange-800">Data Columns</div>
        </div>
      </div>

      {/* Column Distribution Chart */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Column Distribution</h4>
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(categories.score / totalColumns) * 100}%` }}
            ></div>
          </div>
          <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${(categories.data / totalColumns) * 100}%` }}
            ></div>
          </div>
          <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-purple-500 transition-all duration-500"
              style={{ width: `${(categories.annotation / totalColumns) * 100}%` }}
            ></div>
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-600 mt-2">
          <span>Score ({categories.score})</span>
          <span>Data ({categories.data})</span>
          <span>Annotation ({categories.annotation})</span>
        </div>
      </div>

      {/* Sample Columns */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Sample Columns</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {preview.columns.slice(0, 10).map((column, index) => {
            const isScore = column.toUpperCase().includes('SCORE');
            const isAnnotation = ['desc', 'name', 'id', 'hpa', 'goal', 'symbol', 'description'].some(key => 
              column.toLowerCase().includes(key)
            );
            
            return (
              <div 
                key={index}
                className={`flex items-center px-3 py-2 rounded-lg text-sm ${
                  isScore ? 'bg-blue-50 text-blue-700' :
                  isAnnotation ? 'bg-purple-50 text-purple-700' :
                  'bg-gray-50 text-gray-700'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  isScore ? 'bg-blue-500' :
                  isAnnotation ? 'bg-purple-500' :
                  'bg-gray-500'
                }`}></div>
                <span className="truncate">{column}</span>
              </div>
            );
          })}
        </div>
        {preview.columns.length > 10 && (
          <div className="text-xs text-gray-500 mt-2">
            ...and {preview.columns.length - 10} more columns
          </div>
        )}
      </div>
    </div>
  );
}

interface AnalysisProgressProps {
  progress: number;
  status: string;
  message: string;
  className?: string;
}

export function AnalysisProgress({ progress, status, message, className = '' }: AnalysisProgressProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getProgressColor = () => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'running': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Analysis Progress</h3>
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
          {status}
        </span>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>{message}</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${getProgressColor()}`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

interface ProjectStatsProps {
  datasets: number;
  rubrics: number;
  rules: number;
  analyses: number;
  className?: string;
}

export function ProjectStats({ datasets, rubrics, rules, analyses, className = '' }: ProjectStatsProps) {
  const stats = [
    {
      label: 'Datasets',
      value: datasets,
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'blue'
    },
    {
      label: 'Rubrics',
      value: rubrics,
      icon: (
        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      color: 'purple'
    },
    {
      label: 'Rules',
      value: rules,
      icon: (
        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'green'
    },
    {
      label: 'Analyses',
      value: analyses,
      icon: (
        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'orange'
    }
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-4 gap-6 ${className}`}>
      {stats.map((stat, index) => (
        <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className={`p-3 bg-${stat.color}-100 rounded-lg`}>
              {stat.icon}
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
