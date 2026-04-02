/**
 * Trigger Builder implementations for Google Apps Script
 */

import type { TimeTriggerBuilder, Trigger, TriggerBuilder } from '../../../interfaces';
import { GasTrigger } from './trigger';

export class GasTimeTriggerBuilder implements TimeTriggerBuilder {
  constructor(private builder: GoogleAppsScript.Script.ClockTriggerBuilder) {}

  everyDays(days: number): TimeTriggerBuilder {
    this.builder.everyDays(days);
    return this;
  }

  everyWeeks(weeks: number): TimeTriggerBuilder {
    this.builder.everyWeeks(weeks);
    return this;
  }

  onWeekDay(day: GoogleAppsScript.Base.Weekday): TimeTriggerBuilder {
    this.builder.onWeekDay(day);
    return this;
  }

  atHour(hour: number): TimeTriggerBuilder {
    this.builder.atHour(hour);
    return this;
  }

  create(): Trigger {
    return new GasTrigger(this.builder.create());
  }
}

export class GasTriggerBuilder implements TriggerBuilder {
  constructor(private builder: GoogleAppsScript.Script.TriggerBuilder) {}

  timeBased(): TimeTriggerBuilder {
    return new GasTimeTriggerBuilder(this.builder.timeBased());
  }
}
