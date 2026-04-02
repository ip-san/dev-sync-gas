/**
 * GAS固有API実装（本番用アダプター）
 */

import type { ServiceContainer, SlackClient } from '../../interfaces';
import { GasSlackClient } from '../../services/slack/client';

// Re-export all clients
export { GasHttpClient } from './http-client';
export { GasLoggerClient } from './logger-client';
export { GasSpreadsheetClient } from './spreadsheet';
export { GasStorageClient } from './storage-client';
export { GasTriggerClient } from './trigger';

// Import for factory function
import { GasHttpClient } from './http-client';
import { GasLoggerClient } from './logger-client';
import { GasSpreadsheetClient } from './spreadsheet';
import { GasStorageClient } from './storage-client';
import { GasTriggerClient } from './trigger';

/**
 * 全てのGASアダプターを作成するファクトリ関数
 */
export function createGasAdapters(): ServiceContainer {
  const httpClient = new GasHttpClient();
  const slackClient: SlackClient = new GasSlackClient(httpClient);
  return {
    httpClient,
    spreadsheetClient: new GasSpreadsheetClient(),
    storageClient: new GasStorageClient(),
    logger: new GasLoggerClient(),
    triggerClient: new GasTriggerClient(),
    slackClient,
  };
}
