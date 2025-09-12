import React from 'react';
import { ConfirmationOptions } from '@/lib/notifications';

interface ConfirmationDialogProps {
  message: string;
  options?: ConfirmationOptions;
  onConfirm: () => void;
  onCancel: () => void;
  visible: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  message,
  options,
  onConfirm,
  onCancel,
  visible
}) => {
  if (!visible) return null;

  return (
    <div className={`${
      visible ? 'animate-enter' : 'animate-leave'
    } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-gray-900">
              {options?.title || 'Confirm Action'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {message}
            </p>
            {options?.description && (
              <p className="mt-2 text-sm text-gray-600">
                {options.description}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex space-x-3">
          <button
            type="button"
            className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              options?.confirmButtonStyle === 'danger'
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : options?.confirmButtonStyle === 'success'
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            }`}
            onClick={onConfirm}
          >
            {options?.confirmText || 'Confirm'}
          </button>
          <button
            type="button"
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={onCancel}
          >
            {options?.cancelText || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};
