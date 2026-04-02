/**
 * Trigger Client implementation for Google Apps Script
 */

import type { Trigger, TriggerBuilder, TriggerClient } from '../../../interfaces';
import { GasTrigger } from './trigger';
import { GasTriggerBuilder } from './trigger-builder';

export class GasTriggerClient implements TriggerClient {
  getProjectTriggers(): Trigger[] {
    return ScriptApp.getProjectTriggers().map((t) => new GasTrigger(t));
  }

  deleteTrigger(trigger: Trigger): void {
    if (!GasTrigger.isGasTrigger(trigger)) {
      throw new Error('Cannot delete non-GAS trigger with GasTriggerClient');
    }
    ScriptApp.deleteTrigger(trigger.getUnderlyingTrigger());
  }

  newTrigger(functionName: string): TriggerBuilder {
    return new GasTriggerBuilder(ScriptApp.newTrigger(functionName));
  }
}
