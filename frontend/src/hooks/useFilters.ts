import { useState, useMemo } from 'react';
import { Rubric, ProjectDataset, DatasetColumn, Rule, Dataset } from '@/types';

// Type for rules within a rubric context
type RubricRule = {
  id: string;
  name: string;
  description?: string;
  ruleset_conditions: string[];
  column_mapping: Record<string, string>;
  weight: number;
  rubric_weight: number;
  order_index: number;
  owner_name?: string;
  organization?: string;
  disease_area_study?: string;
  tags: string[];
  created_date?: string;
  modified_date?: string;
};

export const useRubricFilters = (rubrics: Rubric[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState('');
  const [filterDAS, setFilterDAS] = useState('');

  const filteredRubrics = useMemo(() => {
    return rubrics.filter(rubric => {
      const matchesSearch = rubric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           rubric.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesOrg = !filterOrg || rubric.organization === filterOrg;
      const matchesDAS = !filterDAS || rubric.disease_area_study === filterDAS;
      
      return matchesSearch && matchesOrg && matchesDAS;
    });
  }, [rubrics, searchTerm, filterOrg, filterDAS]);

  const organizations = useMemo(() => 
    [...new Set(rubrics.map(r => r.organization).filter(Boolean))], 
    [rubrics]
  );

  const diseaseAreas = useMemo(() => 
    [...new Set(rubrics.map(r => r.disease_area_study).filter(Boolean))], 
    [rubrics]
  );

  return {
    searchTerm,
    setSearchTerm,
    filterOrg,
    setFilterOrg,
    filterDAS,
    setFilterDAS,
    filteredRubrics,
    organizations,
    diseaseAreas
  };
};

export const useDatasetFilters = (datasets: Dataset[]) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDatasets = useMemo(() => {
    return datasets.filter(dataset => 
      dataset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (dataset.description && dataset.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (dataset.organization && dataset.organization.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (dataset.disease_area_study && dataset.disease_area_study.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [datasets, searchTerm]);

  return {
    searchTerm,
    setSearchTerm,
    filteredDatasets
  };
};

export const useColumnFilters = (columns: DatasetColumn[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'mean' | 'median' | 'std_dev' | 'null_count'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredAndSortedColumns = useMemo(() => {
    return columns
      .filter(column => 
        column.original_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        column.sanitized_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        let aValue: string | number, bValue: string | number;
        
        switch (sortBy) {
          case 'name':
            aValue = a.original_name.toLowerCase();
            bValue = b.original_name.toLowerCase();
            break;
          case 'mean':
            aValue = a.mean_value ?? 0;
            bValue = b.mean_value ?? 0;
            break;
          case 'median':
            aValue = a.median_value ?? 0;
            bValue = b.median_value ?? 0;
            break;
          case 'std_dev':
            aValue = a.std_deviation ?? 0;
            bValue = b.std_deviation ?? 0;
            break;
          case 'null_count':
            aValue = a.null_count ?? 0;
            bValue = b.null_count ?? 0;
            break;
          default:
            aValue = a.original_name.toLowerCase();
            bValue = b.original_name.toLowerCase();
        }
        
        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
  }, [columns, searchTerm, sortBy, sortOrder]);

  return {
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    filteredAndSortedColumns
  };
};

export const useRuleFilters = (rules: RubricRule[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState('');
  const [filterDAS, setFilterDAS] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created_date' | 'modified_date' | 'weight' | 'organization' | 'order_index'>('order_index');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredAndSortedRules = useMemo(() => {
    return rules
      .filter(rule => {
        const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             rule.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             rule.organization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             rule.disease_area_study?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             rule.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesOrg = !filterOrg || rule.organization === filterOrg;
        const matchesDAS = !filterDAS || rule.disease_area_study === filterDAS;
        
        return matchesSearch && matchesOrg && matchesDAS;
      })
      .sort((a, b) => {
        let aValue: string | number, bValue: string | number;
        
        switch (sortBy) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'created_date':
            aValue = new Date(a.created_date || '').getTime();
            bValue = new Date(b.created_date || '').getTime();
            break;
          case 'modified_date':
            aValue = new Date(a.modified_date || '').getTime();
            bValue = new Date(b.modified_date || '').getTime();
            break;
          case 'weight':
            aValue = a.weight;
            bValue = b.weight;
            break;
          case 'organization':
            aValue = (a.organization || '').toLowerCase();
            bValue = (b.organization || '').toLowerCase();
            break;
          case 'order_index':
            aValue = a.order_index;
            bValue = b.order_index;
            break;
          default:
            aValue = a.order_index;
            bValue = b.order_index;
        }
        
        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
  }, [rules, searchTerm, filterOrg, filterDAS, sortBy, sortOrder]);

  const organizations = useMemo(() => 
    [...new Set(rules.map(r => r.organization).filter(Boolean))], 
    [rules]
  );

  const diseaseAreas = useMemo(() => 
    [...new Set(rules.map(r => r.disease_area_study).filter(Boolean))], 
    [rules]
  );

  return {
    searchTerm,
    setSearchTerm,
    filterOrg,
    setFilterOrg,
    filterDAS,
    setFilterDAS,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    filteredAndSortedRules,
    organizations,
    diseaseAreas
  };
};
