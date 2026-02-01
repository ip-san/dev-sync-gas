/**
 * GraphQL Error Handling のユニットテスト
 *
 * errorHelpers のエラー検証・ページネーション処理のテスト
 */

import { describe, it, expect } from 'bun:test';
import {
  validatePaginatedResponse,
  validateSingleResponse,
  isPaginatedResultEmpty,
  type PaginatedResult,
} from '../../src/services/github/graphql/errorHelpers';
import type { ApiResponse } from '../../src/types';

describe('GraphQL Error Handling', () => {
  describe('validatePaginatedResponse', () => {
    describe('First page (page = 0)', () => {
      it('should return error when API call fails on first page', () => {
        const result: ApiResponse<unknown> = {
          success: false,
          error: 'GraphQL rate limit exceeded',
        };

        const error = validatePaginatedResponse(result, 0, 'repository.issues');
        expect(error).not.toBeNull();
        expect(error?.error).toBe('GraphQL rate limit exceeded');
      });

      it('should return error when data path not found on first page', () => {
        const result: ApiResponse<unknown> = {
          success: true,
          data: {
            repository: {
              pullRequests: [], // Wrong path
            },
          },
        };

        const error = validatePaginatedResponse(result, 0, 'repository.issues');
        expect(error).not.toBeNull();
        expect(error?.error).toBe('No data found at path: repository.issues');
      });

      it('should return null when data exists on first page', () => {
        const result: ApiResponse<unknown> = {
          success: true,
          data: {
            repository: {
              issues: {
                nodes: [],
              },
            },
          },
        };

        const error = validatePaginatedResponse(result, 0, 'repository.issues');
        expect(error).toBeNull();
      });

      it('should handle undefined error message', () => {
        const result: ApiResponse<unknown> = {
          success: false,
          error: undefined,
        };

        const error = validatePaginatedResponse(result, 0, 'repository.issues');
        expect(error).not.toBeNull();
        expect(error?.error).toBe('Unknown error');
      });
    });

    describe('Subsequent pages (page > 0)', () => {
      it('should return null when API call fails on subsequent page', () => {
        const result: ApiResponse<unknown> = {
          success: false,
          error: 'Network timeout',
        };

        const error = validatePaginatedResponse(result, 1, 'repository.issues');
        expect(error).toBeNull(); // Signals end of pagination
      });

      it('should return null when data path not found on subsequent page', () => {
        const result: ApiResponse<unknown> = {
          success: true,
          data: {
            repository: null,
          },
        };

        const error = validatePaginatedResponse(result, 2, 'repository.issues');
        expect(error).toBeNull(); // Signals end of pagination
      });

      it('should return null when data exists on subsequent page', () => {
        const result: ApiResponse<unknown> = {
          success: true,
          data: {
            repository: {
              issues: {
                nodes: [{ number: 1 }],
              },
            },
          },
        };

        const error = validatePaginatedResponse(result, 1, 'repository.issues');
        expect(error).toBeNull();
      });
    });

    describe('Nested path resolution', () => {
      it('should handle deeply nested paths', () => {
        const result: ApiResponse<unknown> = {
          success: true,
          data: {
            repository: {
              pullRequests: {
                edges: {
                  node: {
                    reviews: [],
                  },
                },
              },
            },
          },
        };

        const error = validatePaginatedResponse(
          result,
          0,
          'repository.pullRequests.edges.node.reviews'
        );
        expect(error).toBeNull();
      });

      it('should handle null in nested path', () => {
        const result: ApiResponse<unknown> = {
          success: true,
          data: {
            repository: null,
          },
        };

        const error = validatePaginatedResponse(result, 0, 'repository.issues');
        expect(error).not.toBeNull();
        expect(error?.error).toContain('No data found');
      });

      it('should handle undefined in nested path', () => {
        const result: ApiResponse<unknown> = {
          success: true,
          data: {
            repository: {
              issues: undefined,
            },
          },
        };

        const error = validatePaginatedResponse(result, 0, 'repository.issues');
        expect(error).not.toBeNull();
      });
    });
  });

  describe('validateSingleResponse', () => {
    it('should return error when API call fails', () => {
      const result: ApiResponse<unknown> = {
        success: false,
        error: 'Authentication failed',
      };

      const error = validateSingleResponse(result, 'repository.pullRequest');
      expect(error).not.toBeNull();
      expect(error?.error).toBe('Authentication failed');
    });

    it('should return error when data path not found', () => {
      const result: ApiResponse<unknown> = {
        success: true,
        data: {
          repository: {
            issues: [], // Wrong path
          },
        },
      };

      const error = validateSingleResponse(result, 'repository.pullRequest');
      expect(error).not.toBeNull();
      expect(error?.error).toBe('No data found at path: repository.pullRequest');
    });

    it('should return null when data exists', () => {
      const result: ApiResponse<unknown> = {
        success: true,
        data: {
          repository: {
            pullRequest: {
              number: 123,
            },
          },
        },
      };

      const error = validateSingleResponse(result, 'repository.pullRequest');
      expect(error).toBeNull();
    });

    it('should handle undefined error message', () => {
      const result: ApiResponse<unknown> = {
        success: false,
        error: undefined,
      };

      const error = validateSingleResponse(result, 'repository.pullRequest');
      expect(error).not.toBeNull();
      expect(error?.error).toBe('Unknown error');
    });

    it('should handle single-level path', () => {
      const result: ApiResponse<unknown> = {
        success: true,
        data: {
          repository: {
            name: 'test-repo',
          },
        },
      };

      const error = validateSingleResponse(result, 'repository');
      expect(error).toBeNull();
    });

    it('should handle non-object data', () => {
      const result: ApiResponse<unknown> = {
        success: true,
        data: 'invalid data type',
      };

      const error = validateSingleResponse(result, 'repository.pullRequest');
      expect(error).not.toBeNull();
      expect(error?.error).toContain('No data found');
    });

    it('should handle null data', () => {
      const result: ApiResponse<unknown> = {
        success: true,
        data: null,
      };

      const error = validateSingleResponse(result, 'repository');
      expect(error).not.toBeNull();
    });
  });

  describe('isPaginatedResultEmpty', () => {
    it('should return true when nodes array is empty', () => {
      const result: PaginatedResult<unknown> = {
        nodes: [],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      };

      expect(isPaginatedResultEmpty(result)).toBe(true);
    });

    it('should return false when nodes array has items', () => {
      const result: PaginatedResult<{ id: number }> = {
        nodes: [{ id: 1 }, { id: 2 }],
        pageInfo: {
          hasNextPage: true,
          endCursor: 'cursor123',
        },
      };

      expect(isPaginatedResultEmpty(result)).toBe(false);
    });

    it('should return true when nodes is null', () => {
      const result = {
        nodes: null,
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      } as unknown as PaginatedResult<unknown>;

      expect(isPaginatedResultEmpty(result)).toBe(true);
    });

    it('should return true when nodes is undefined', () => {
      const result = {
        nodes: undefined,
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      } as unknown as PaginatedResult<unknown>;

      expect(isPaginatedResultEmpty(result)).toBe(true);
    });

    it('should return false when nodes has exactly one item', () => {
      const result: PaginatedResult<{ id: number }> = {
        nodes: [{ id: 1 }],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      };

      expect(isPaginatedResultEmpty(result)).toBe(false);
    });
  });
});
