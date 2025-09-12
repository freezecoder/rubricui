/**
 * Heatmap utility functions for omics view visualization
 */

export interface HeatmapCell {
  row: number;
  col: number;
  value: number | string | null;
  gene: string;
  column: string;
  formattedValue: string;
  color: string;
  rank?: number;
  percentile?: number;
}

export interface HeatmapConfig {
  colorScheme: string;
  showValues: boolean;
  showGrid: boolean;
  showLegend: boolean;
  minValue?: number;
  maxValue?: number;
  cellSize: number;
  fontSize: number;
}

export interface ColorScheme {
  name: string;
  colors: string[];
  type: 'continuous' | 'categorical';
}

export const COLOR_SCHEMES: Record<string, ColorScheme> = {
  viridis: {
    name: 'Viridis',
    type: 'continuous',
    colors: [
      '#440154', '#482777', '#3f4a8a', '#31678e', '#26838f',
      '#1f9d8a', '#6cce5a', '#b6de2b', '#fee825'
    ]
  },
  plasma: {
    name: 'Plasma',
    type: 'continuous',
    colors: [
      '#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786',
      '#d8576b', '#ed7953', '#fb9f3a', '#f0f921'
    ]
  },
  inferno: {
    name: 'Inferno',
    type: 'continuous',
    colors: [
      '#000004', '#1b0c42', '#4a0e4e', '#781c6d', '#a52c60',
      '#cf4446', '#ed6925', '#fb9a06', '#fcffa4'
    ]
  },
  magma: {
    name: 'Magma',
    type: 'continuous',
    colors: [
      '#000004', '#1e0b36', '#4a0c4a', '#781c6d', '#a52c60',
      '#cf4446', '#ed6925', '#fb9a06', '#fcffa4'
    ]
  },
  coolwarm: {
    name: 'Cool Warm',
    type: 'continuous',
    colors: [
      '#3b4cc0', '#5a7fd8', '#7bb3f0', '#9dd4f8', '#c1e5ff',
      '#ffc1c1', '#ff9d9d', '#ff7a7a', '#ff5757'
    ]
  },
  RdYlBu: {
    name: 'Red Yellow Blue',
    type: 'continuous',
    colors: [
      '#d73027', '#f46d43', '#fdae61', '#fee090', '#ffffbf',
      '#e0f3f8', '#abd9e9', '#74add1', '#4575b4'
    ]
  },
  greenRed: {
    name: 'Green Red',
    type: 'continuous',
    colors: [
      '#006837', '#1a9850', '#66bd63', '#a6d96a', '#d9ef8b',
      '#fee08b', '#fdae61', '#f46d43', '#d73027'
    ]
  }
};

export const CATEGORICAL_COLORS: Record<string, string> = {
  '✓': '#10b981', // green
  '✗': '#ef4444', // red
  '?': '#f59e0b', // yellow
  'true': '#10b981',
  'false': '#ef4444',
  'yes': '#10b981',
  'no': '#ef4444'
};

/**
 * Generate color for a value based on color scheme
 */
export function getColorForValue(
  value: number | string | null,
  colorScheme: string,
  minValue?: number,
  maxValue?: number
): string {
  if (value === null || value === undefined) {
    return '#f3f4f6'; // gray for missing values
  }

  // Handle categorical values
  if (typeof value === 'string') {
    return CATEGORICAL_COLORS[value.toLowerCase()] || '#6b7280';
  }

  // Handle numeric values
  if (typeof value === 'number') {
    const scheme = COLOR_SCHEMES[colorScheme];
    if (!scheme || scheme.type !== 'continuous') {
      return '#6b7280';
    }

    // Normalize value to 0-1 range
    let normalizedValue = 0;
    if (minValue !== undefined && maxValue !== undefined && maxValue > minValue) {
      normalizedValue = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
    }

    // Interpolate color
    const colorIndex = normalizedValue * (scheme.colors.length - 1);
    const lowerIndex = Math.floor(colorIndex);
    const upperIndex = Math.ceil(colorIndex);
    const fraction = colorIndex - lowerIndex;

    if (lowerIndex === upperIndex) {
      return scheme.colors[lowerIndex];
    }

    // Linear interpolation between colors
    const lowerColor = hexToRgb(scheme.colors[lowerIndex]);
    const upperColor = hexToRgb(scheme.colors[upperIndex]);

    if (!lowerColor || !upperColor) {
      return scheme.colors[lowerIndex];
    }

    const interpolatedColor = {
      r: Math.round(lowerColor.r + (upperColor.r - lowerColor.r) * fraction),
      g: Math.round(lowerColor.g + (upperColor.g - lowerColor.g) * fraction),
      b: Math.round(lowerColor.b + (upperColor.b - lowerColor.b) * fraction)
    };

    return rgbToHex(interpolatedColor);
  }

  return '#6b7280';
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  return `#${((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1)}`;
}

/**
 * Format value for display
 */
export function formatValue(value: number | string | null): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value.toString();
    }
    return value.toFixed(2);
  }
  
  return String(value);
}

/**
 * Calculate percentile rank for a value in an array
 */
export function calculatePercentile(value: number, values: number[]): number {
  const sortedValues = [...values].sort((a, b) => a - b);
  const index = sortedValues.findIndex(v => v >= value);
  
  if (index === -1) return 100;
  if (index === 0) return 0;
  
  return (index / sortedValues.length) * 100;
}

/**
 * Generate heatmap data structure
 */
export function generateHeatmapData(
  geneSymbols: string[],
  columnNames: string[],
  dataMatrix: (number | string | null)[][],
  colorScheme: string,
  minValue?: number,
  maxValue?: number
): HeatmapCell[][] {
  const heatmapData: HeatmapCell[][] = [];
  
  // Calculate min/max values if not provided
  let actualMinValue = minValue;
  let actualMaxValue = maxValue;
  
  if (actualMinValue === undefined || actualMaxValue === undefined) {
    const numericValues = dataMatrix
      .flat()
      .filter((v): v is number => typeof v === 'number');
    
    if (numericValues.length > 0) {
      actualMinValue = Math.min(...numericValues);
      actualMaxValue = Math.max(...numericValues);
    }
  }
  
  // Generate heatmap cells
  for (let row = 0; row < geneSymbols.length; row++) {
    const rowData: HeatmapCell[] = [];
    
    for (let col = 0; col < columnNames.length; col++) {
      const value = dataMatrix[row]?.[col];
      const cell: HeatmapCell = {
        row,
        col,
        value,
        gene: geneSymbols[row],
        column: columnNames[col],
        formattedValue: formatValue(value),
        color: getColorForValue(value, colorScheme, actualMinValue, actualMaxValue)
      };
      
      // Calculate rank and percentile for numeric values
      if (typeof value === 'number') {
        const columnValues = dataMatrix.map(row => row[col]).filter((v): v is number => typeof v === 'number');
        if (columnValues.length > 0) {
          const sortedValues = [...columnValues].sort((a, b) => b - a);
          cell.rank = sortedValues.indexOf(value) + 1;
          cell.percentile = calculatePercentile(value, columnValues);
        }
      }
      
      rowData.push(cell);
    }
    
    heatmapData.push(rowData);
  }
  
  return heatmapData;
}

/**
 * Create color legend for heatmap
 */
export function createColorLegend(
  colorScheme: string,
  minValue?: number,
  maxValue?: number,
  steps: number = 10
): Array<{ value: number; color: string; label: string }> {
  const legend: Array<{ value: number; color: string; label: string }> = [];
  
  if (minValue === undefined || maxValue === undefined) {
    return legend;
  }
  
  const stepSize = (maxValue - minValue) / (steps - 1);
  
  for (let i = 0; i < steps; i++) {
    const value = minValue + (i * stepSize);
    const color = getColorForValue(value, colorScheme, minValue, maxValue);
    const label = formatValue(value);
    
    legend.push({ value, color, label });
  }
  
  return legend;
}

/**
 * Export heatmap data to CSV
 */
export function exportHeatmapToCSV(
  geneSymbols: string[],
  columnNames: string[],
  dataMatrix: (number | string | null)[][],
  filename: string = 'heatmap_data.csv'
): void {
  const csvContent = [
    ['Gene', ...columnNames],
    ...geneSymbols.map((gene, rowIndex) => [
      gene,
      ...columnNames.map((_, colIndex) => 
        formatValue(dataMatrix[rowIndex]?.[colIndex])
      )
    ])
  ].map(row => row.join(',')).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Export heatmap data to JSON
 */
export function exportHeatmapToJSON(
  geneSymbols: string[],
  columnNames: string[],
  dataMatrix: (number | string | null)[][],
  metadata: Record<string, any> = {},
  filename: string = 'heatmap_data.json'
): void {
  const jsonData = {
    metadata: {
      ...metadata,
      exported_at: new Date().toISOString(),
      total_genes: geneSymbols.length,
      total_columns: columnNames.length
    },
    genes: geneSymbols,
    columns: columnNames,
    data: dataMatrix
  };
  
  const jsonContent = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
