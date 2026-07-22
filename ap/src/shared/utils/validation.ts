// Types
import { apiClient } from '@/shared/api/apiClient.ts';
import { EXPORT_CONFIG_ERROR_MESSAGES } from '@/shared/utils/errors.ts';

interface FolderValidationRequest {
    folder_path: string;
}

interface FolderValidationResponse {
    is_valid: boolean;
    message?: string;
}

export interface ValidationResult {
    isValid: boolean;
    message?: string;
}

export interface ValidateExportConfig<ValidationResult> {
    title: ValidationResult;
    folder_path: ValidationResult;
    filename_format: ValidationResult;
    interval_value: ValidationResult;
    main_process: ValidationResult;
    filename_preview: ValidationResult;
}

// Constants
const VALIDATION_ENDPOINTS = {
    CHECK_FOLDER: '/setting/check_folder_path',
} as const;

/**
 * Validates a folder path by checking with the backend API.
 *
 * @param folderPath - The folder path to validate
 * @returns Promise resolving to validation result with status and error message
 *
 * @example
 * ```typescript
 * const result = await validateFolderPath('/exports/sales');
 * if (!result.isValid) {
 *   console.error(result.errorMessage);
 * }
 * ```
 */
export const validateFolderPath = async (folderPath: string): Promise<ValidationResult> => {
    // Early validation
    if (!folderPath?.trim()) {
        return {
            isValid: false,
            message: EXPORT_CONFIG_ERROR_MESSAGES.REQUIRED_FIELD,
        };
    }

    try {
        const requestBody: FolderValidationRequest = {
            folder_path: folderPath.trim(),
        };

        const response = await apiClient.post<FolderValidationResponse>(VALIDATION_ENDPOINTS.CHECK_FOLDER, requestBody);

        // Validate response structure
        if (!response || typeof response.is_valid !== 'boolean') {
            console.error('Invalid response structure from folder validation API');
            return {
                isValid: false,
                message: EXPORT_CONFIG_ERROR_MESSAGES.UNKNOWN,
            };
        }

        return {
            isValid: response.is_valid,
            message: response.message || undefined,
        };
    } catch (error) {
        // Log error for debugging
        console.error('Folder validation error:', error);

        // Handle specific error types
        if (error instanceof TypeError || error?.message?.includes('network')) {
            return {
                isValid: false,
                message: EXPORT_CONFIG_ERROR_MESSAGES.NETWORK_ERROR,
            };
        }

        return {
            isValid: false,
            message: EXPORT_CONFIG_ERROR_MESSAGES.UNKNOWN,
        };
    }
};

export const validateRequiredField = (value: string): ValidationResult => {
    if (!value || !value.trim()) {
        return {
            isValid: false,
            message: EXPORT_CONFIG_ERROR_MESSAGES.REQUIRED_FIELD,
        };
    }
    return {
        isValid: true,
        message: undefined,
    };
};
