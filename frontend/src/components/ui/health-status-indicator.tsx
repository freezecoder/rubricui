'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { apiService } from '@/services/api';

interface HealthStatus {
  isHealthy: boolean;
  isLoading: boolean;
  lastChecked: Date | null;
  error?: string;
}

export function HealthStatusIndicator() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    isHealthy: false,
    isLoading: true,
    lastChecked: null,
  });

  const checkHealth = async () => {
    setHealthStatus(prev => ({ ...prev, isLoading: true, error: undefined }));
    
    try {
      const response = await apiService.checkHealth();
      setHealthStatus({
        isHealthy: response.status === 'healthy' || response.status === 'ok',
        isLoading: false,
        lastChecked: new Date(),
        error: undefined,
      });
    } catch (error) {
      setHealthStatus({
        isHealthy: false,
        isLoading: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  useEffect(() => {
    // Initial health check
    checkHealth();
    
    // Set up periodic health checks every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (healthStatus.isLoading) return 'text-yellow-500';
    return healthStatus.isHealthy ? 'text-green-500' : 'text-red-500';
  };

  const getStatusBgColor = () => {
    if (healthStatus.isLoading) return 'bg-yellow-50 border-yellow-200';
    return healthStatus.isHealthy ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  };

  const getStatusIcon = () => {
    if (healthStatus.isLoading) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (healthStatus.isHealthy) {
      return <CheckCircle className="h-4 w-4" />;
    }
    return <XCircle className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (healthStatus.isLoading) return 'Checking...';
    return healthStatus.isHealthy ? 'API Healthy' : 'API Unreachable';
  };

  const getStatusDescription = () => {
    if (healthStatus.isLoading) return 'Verifying API connection';
    if (healthStatus.isHealthy) return 'Backend services are running normally';
    return healthStatus.error || 'Unable to connect to backend services';
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${getStatusBgColor()}`}>
      <div className="flex items-center gap-2">
        {healthStatus.isHealthy ? (
          <Wifi className={`h-4 w-4 ${getStatusColor()}`} />
        ) : (
          <WifiOff className={`h-4 w-4 ${getStatusColor()}`} />
        )}
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>
      
      <div className="flex items-center gap-1">
        {getStatusIcon()}
        <span className="text-xs text-gray-500">
          {healthStatus.lastChecked ? 
            `Last checked: ${healthStatus.lastChecked.toLocaleTimeString()}` : 
            'Never checked'
          }
        </span>
      </div>
      
      {/* Tooltip with detailed status */}
      <div className="group relative">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-10">
          <div className="font-medium">{getStatusDescription()}</div>
          {healthStatus.error && (
            <div className="text-red-200 mt-1 max-w-xs break-words">
              {healthStatus.error}
            </div>
          )}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    </div>
  );
}
