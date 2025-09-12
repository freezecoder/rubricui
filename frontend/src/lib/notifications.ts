import toast from 'react-hot-toast';

export interface NotificationOptions {
  duration?: number;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

export interface ConfirmationOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonStyle?: 'danger' | 'primary' | 'success';
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

export class NotificationService {
  // Success notifications
  static success(message: string, options?: NotificationOptions) {
    return toast.success(message, {
      duration: options?.duration || 4000,
      position: options?.position || 'top-right',
    });
  }

  // Error notifications
  static error(message: string, options?: NotificationOptions) {
    return toast.error(message, {
      duration: options?.duration || 6000,
      position: options?.position || 'top-right',
    });
  }

  // Loading notifications
  static loading(message: string, options?: NotificationOptions) {
    return toast.loading(message, {
      duration: options?.duration || Infinity,
      position: options?.position || 'top-right',
    });
  }

  // Promise-based notifications (for async operations)
  static promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    },
    options?: NotificationOptions
  ) {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      {
        duration: options?.duration,
        position: options?.position || 'top-right',
      }
    );
  }

  // Dismiss notifications
  static dismiss(toastId?: string) {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  }

  // Custom notifications
  static custom(message: string, options?: NotificationOptions & { type?: 'success' | 'error' | 'loading' }) {
    const type = options?.type || 'success';
    return toast[type](message, {
      duration: options?.duration || 4000,
      position: options?.position || 'top-right',
    });
  }

  // Confirmation dialog - uses browser confirm for now, can be enhanced later
  static confirm(
    message: string, 
    options?: ConfirmationOptions
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const title = options?.title || 'Confirm Action';
      const fullMessage = `${title}\n\n${message}${options?.description ? `\n\n${options.description}` : ''}`;
      const result = window.confirm(fullMessage);
      resolve(result);
    });
  }
}

// Convenience functions for common operations
export const notify = {
  // Entity creation
  created: (entityType: string, entityName?: string) => {
    const name = entityName ? ` "${entityName}"` : '';
    return NotificationService.success(`${entityType}${name} created successfully!`);
  },

  // Entity updates
  updated: (entityType: string, entityName?: string) => {
    const name = entityName ? ` "${entityName}"` : '';
    return NotificationService.success(`${entityType}${name} updated successfully!`);
  },

  // Entity deletion
  deleted: (entityType: string, entityName?: string) => {
    const name = entityName ? ` "${entityName}"` : '';
    return NotificationService.success(`${entityType}${name} deleted successfully!`);
  },

  // File operations
  uploaded: (fileName: string) => {
    return NotificationService.success(`File "${fileName}" uploaded successfully!`);
  },

  // Analysis operations
  analysisStarted: (projectName?: string) => {
    const name = projectName ? ` for "${projectName}"` : '';
    return NotificationService.loading(`Analysis${name} started...`, {
      duration: 10000 // Auto-dismiss after 10 seconds
    });
  },

  analysisCompleted: (projectName?: string) => {
    const name = projectName ? ` for "${projectName}"` : '';
    return NotificationService.success(`Analysis${name} completed successfully!`);
  },

  analysisFailed: (projectName?: string, error?: string) => {
    const name = projectName ? ` for "${projectName}"` : '';
    const errorMsg = error ? `: ${error}` : '';
    return NotificationService.error(`Analysis${name} failed${errorMsg}`);
  },

  // Generic operations
  operationStarted: (operation: string) => {
    return NotificationService.loading(`${operation}...`, {
      duration: 8000 // Auto-dismiss after 8 seconds
    });
  },

  operationCompleted: (operation: string) => {
    return NotificationService.success(`${operation} completed successfully!`);
  },

  operationFailed: (operation: string, error?: string) => {
    const errorMsg = error ? `: ${error}` : '';
    return NotificationService.error(`${operation} failed${errorMsg}`);
  },

  // Validation errors
  validationError: (message: string) => {
    return NotificationService.error(`Validation error: ${message}`);
  },

  // Network errors
  networkError: () => {
    return NotificationService.error('Network error. Please check your connection and try again.');
  },

  // Permission errors
  permissionError: () => {
    return NotificationService.error('You do not have permission to perform this action.');
  },

  // Info messages
  info: (message: string) => {
    return NotificationService.custom(message, { type: 'success' });
  },

  // Warning messages
  warning: (message: string) => {
    return NotificationService.custom(message, { type: 'error' });
  },

  // Confirmation dialogs
  confirmDelete: (entityType: string, entityName?: string) => {
    const name = entityName ? ` "${entityName}"` : '';
    return NotificationService.confirm(
      `Are you sure you want to delete this ${entityType.toLowerCase()}${name}?`,
      {
        title: 'Delete Confirmation',
        description: 'This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmButtonStyle: 'danger'
      }
    );
  },

  confirmAction: (action: string, entityName?: string) => {
    const name = entityName ? ` "${entityName}"` : '';
    return NotificationService.confirm(
      `Are you sure you want to ${action.toLowerCase()}${name}?`,
      {
        title: 'Confirm Action',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        confirmButtonStyle: 'primary'
      }
    );
  },

  confirmDestructiveAction: (action: string, entityName?: string, description?: string) => {
    const name = entityName ? ` "${entityName}"` : '';
    return NotificationService.confirm(
      `Are you sure you want to ${action.toLowerCase()}${name}?`,
      {
        title: 'Destructive Action',
        description: description || 'This action cannot be undone.',
        confirmText: action,
        cancelText: 'Cancel',
        confirmButtonStyle: 'danger'
      }
    );
  },
};

// Hook for easy access to notifications in components
export const useNotifications = () => {
  return {
    notify,
    NotificationService,
  };
};

export default NotificationService;
