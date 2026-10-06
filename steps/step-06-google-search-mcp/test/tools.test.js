import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTrumpetCallSchedule,
  getWawelTicketAvailability,
  recommendLocalDining,
  toolsByName,
  toolDefinitions
} from '../src/tools.js';

describe('Native Agent Tools Unit Tests', () => {
  it('getTrumpetCallSchedule returns accurate schedule and four directions', async () => {
    const res = await getTrumpetCallSchedule();
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.eventName, 'Hejnał Mariacki (St. Mary\'s Trumpet Call)');
    assert.ok(res.executionMechanics.fourCardinalDirectionsOrder.length === 4);
    assert.strictEqual(res.executionMechanics.fourCardinalDirectionsOrder[0].direction, 'South');
    assert.ok(res.nextOccurrenceInMinutes >= 0 && res.nextOccurrenceInMinutes <= 60);
    assert.ok(res.executionMechanics.theSuddenSilence.includes('1241'));
  });

  it('getTrumpetCallSchedule returns four distinct historical dedications', async () => {
    const res = await getTrumpetCallSchedule();
    const directions = res.executionMechanics.fourCardinalDirectionsOrder;
    assert.strictEqual(directions.length, 4);

    const south = directions.find(d => d.direction === 'South');
    const west = directions.find(d => d.direction === 'West');
    const north = directions.find(d => d.direction === 'North');
    const east = directions.find(d => d.direction === 'East');

    assert.ok(south.facing.includes('King') || south.facing.includes('Monarch') || south.facing.includes('Wawel'));
    assert.ok(west.facing.includes('Mayor') || west.facing.includes('Town Hall'));
    assert.ok(north.facing.includes('Florian') || north.facing.includes('guards') || north.facing.includes('Royal Route'));
    assert.ok(east.facing.includes('Fire') || east.facing.includes('Market'));
  });

  it('getWawelTicketAvailability returns simulated exhibition inventory', async () => {
    const res = await getWawelTicketAvailability({ date: '2026-10-15' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.queryDate, '2026-10-15');
    assert.ok(Array.isArray(res.exhibitions));
    assert.ok(res.exhibitions.length >= 4);

    const stateRooms = res.exhibitions.find(e => e.name.includes('State Rooms'));
    assert.ok(stateRooms);
    assert.strictEqual(stateRooms.priceRegularPLN, 55);
  });

  it('getWawelTicketAvailability defaults gracefully when date is omitted', async () => {
    const res = await getWawelTicketAvailability({});
    assert.strictEqual(res.success, true);
    assert.ok(res.queryDate);
    assert.ok(res.exhibitions.length > 0);
  });

  it('recommendLocalDining filters by district and budget tier', async () => {
    const milkBarRes = await recommendLocalDining({ district: 'Old Town', budget: 'milk bar' });
    assert.strictEqual(milkBarRes.success, true);
    assert.ok(milkBarRes.recommendations.length > 0);
    assert.ok(milkBarRes.recommendations.some(r => r.budgetTier === 'budget'));

    const fineDiningRes = await recommendLocalDining({ district: 'Kazimierz', budget: 'fine dining' });
    assert.strictEqual(fineDiningRes.success, true);
    assert.ok(fineDiningRes.recommendations.length > 0);
    assert.ok(fineDiningRes.recommendations.some(r => r.name.includes('Bottiglieria 1881')));
  });

  it('recommendLocalDining handles empty args by returning curated selections across districts', async () => {
    const res = await recommendLocalDining({});
    assert.strictEqual(res.success, true);
    assert.ok(res.recommendations.length >= 3);
  });

  it('registers all tools and exports valid schema definitions', () => {
    assert.ok(toolsByName.getTrumpetCallSchedule);
    assert.ok(toolsByName.getWawelTicketAvailability);
    assert.ok(toolsByName.recommendLocalDining);

    assert.strictEqual(toolDefinitions.length, 3);
    for (const def of toolDefinitions) {
      assert.strictEqual(def.type, 'function');
      assert.ok(def.function.name);
      assert.ok(def.function.description);
      assert.strictEqual(def.function.parameters.type, 'object');
      assert.ok(def.function.parameters.properties);
    }
  });
});
