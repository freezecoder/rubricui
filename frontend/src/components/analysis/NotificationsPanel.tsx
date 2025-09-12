'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Database, ChevronDown, ChevronUp } from 'lucide-react';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { RubricValidationResult } from '@/types';

interface NotificationsPanelProps {
  notifications: Notification[];
  onRemoveNotification: (id: string) => void;
  validationResult?: RubricValidationResult | null;
}

export const NotificationsPanel = ({ notifications, onRemoveNotification, validationResult }: NotificationsPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600 mt-0.5" />;
      case 'info':
        return <Database className="h-5 w-5 text-blue-600 mt-0.5" />;
    }
  };

  const getStyles = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-400 border-l-green-500';
      case 'warning':
        return 'bg-yellow-50 border-yellow-400 border-l-yellow-500';
      case 'error':
        return 'bg-red-50 border-red-400 border-l-red-500';
      case 'info':
        return 'bg-blue-50 border-blue-400 border-l-blue-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200">
      <div 
        className="flex items-center justify-between cursor-pointer mb-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Notifications & Status
        </h3>
        <button className="text-gray-500 hover:text-gray-700 transition-colors">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>
      </div>
      {isExpanded && (
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="text-gray-500 text-center py-4">
              No notifications yet. Select a rubric and dataset to get started.
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border-l-4 border-2 flex items-start justify-between ${getStyles(notification.type)}`}
              >
                <div className="flex items-start gap-3">
                  {getIcon(notification.type)}
                  <div>
                    <div className="font-medium text-gray-900">{notification.title}</div>
                    <div className="text-sm text-gray-600">{notification.message}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {notification.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveNotification(notification.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
          
          {/* Orange box for incompatible rules when more than 1 rule is not compatible */}
          {validationResult && validationResult.invalid_rules > 1 && (
            <div className="p-4 rounded-lg border-l-4 border-2 bg-orange-50 border-orange-400 border-l-orange-500">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    Incompatible Rules ({validationResult.invalid_rules} rules)
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    The following rules are not compatible with the selected dataset:
                  </div>
                  <div className="mt-3 space-y-2">
                    {validationResult.validation_details
                      .filter(detail => !detail.is_valid)
                      .map((detail) => (
                        <div key={detail.rule_id} className="bg-white p-3 rounded border border-orange-200">
                          <div className="font-medium text-sm text-gray-800">{detail.rule_name}</div>
                          {detail.missing_columns.length > 0 && (
                            <div className="text-xs text-gray-600 mt-1">
                              Missing columns: {detail.missing_columns.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
