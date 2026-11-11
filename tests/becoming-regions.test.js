const test = require('node:test');
const assert = require('node:assert/strict');
const geometry = require('../becoming-regions.js');

function region(x, y, radius = 70) {
  return { x, y, radius, phase: 0, irregularity: .8, biasX: 0, biasY: 0 };
}

test('new neighboring regions yield their overlapping area to existing regions', () => {
  const first = region(0, 0);
  const second = region(120, 0);
  assert.equal(geometry.contains(first, 65, 0), true);
  assert.equal(geometry.contains(second, 65, 0), true);
  assert.equal(geometry.at([first, second], 65, 0).region, first);
  assert.equal(geometry.at([first, second], 145, 0).region, second);
  assert.equal(geometry.canCreate([first], 65, 0), false);
  assert.equal(geometry.canCreate([first], 120, 0), true);
});

test('a region footprint follows its activity-driven size and shape', () => {
  const place = region(0, 0, 50);
  const before = geometry.polygon(place).map(point => point.slice());
  place.radius = 80;
  place.biasX = .15;
  const after = geometry.polygon(place);
  assert.ok(after[0][0] > before[0][0]);
  assert.ok(Math.abs(after[36][0]) < after[0][0]);
  assert.equal(geometry.at([place], 100, 0).region, place);
});

test('radius limits keep neighboring region centers out of each other', () => {
  const first = region(0, 0, 100);
  const second = region(80, 0, 100);
  first.radius = geometry.limitRadius(first, [first, second]);
  second.radius = geometry.limitRadius(second, [first, second]);
  assert.equal(geometry.contains(first, second.x, second.y), false);
  assert.equal(geometry.contains(second, first.x, first.y), false);
});

test('organic erosion matches region ownership and remains locally bounded', () => {
  const place = region(0, 0, 60);
  const cut = { x: 0, y: 0, radius: 12 };
  place.cuts = [cut];
  const outline = geometry.cutShape(cut);
  const area = outline.reduce((sum, point, i) => {
    const next = outline[(i + 1) % outline.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
  assert.equal(outline.length, 36);
  assert.ok(area > 0 && area < 24 * 24 * 1.48);
  assert.equal(geometry.contains(place, 0, 0), false);
  assert.equal(geometry.contains(place, 30, 0), true);
  assert.equal(geometry.isEmpty(place), false);
  assert.equal(geometry.cutPolygon(place, cut).length, 36);
});

test('the expanded erosion footprint has three times the original area', () => {
  const area = outline => Math.abs(outline.reduce((sum, point, i) => {
    const next = outline[(i + 1) % outline.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;
  const original = { x: 200, y: 200, radius: 12 };
  const expanded = { ...original, radius: 12 * Math.sqrt(3) };
  assert.ok(Math.abs(area(geometry.cutShape(expanded)) / area(geometry.cutShape(original)) - 3) < 1e-10);
});

test('an organic cut can remove a small region without removing a neighboring region', () => {
  const first = region(0, 0, 2);
  const second = region(100, 0, 20);
  first.cuts = [{ x: 0, y: 0, radius: 12 }];
  assert.equal(geometry.isEmpty(first), true);
  assert.equal(geometry.isEmpty(second), false);
  assert.equal(geometry.at([first, second], 100, 0).region, second);
});

test('erosion reaches the visible edge of a merged region, not an internal seam', () => {
  const first = { ...region(0, 0), groupId: 1 };
  const second = { ...region(120, 0), groupId: 1 };
  const regions = [first, second];
  assert.equal(geometry.reachesGroupEdge(regions, 1, { x: 50, y: 0, radius: 20 }), false);
  assert.equal(geometry.reachesGroupEdge(regions, 1, { x: -95, y: 0, radius: 20 }), true);
});

test('edge fast path matches the full ownership check across overlapping regions', () => {
  const regions = [
    { ...region(-55, 10, 30), groupId: 2 },
    { ...region(0, 0, 70), groupId: 1 },
    { ...region(110, 0, 65), groupId: 1 },
    { ...region(35, 40, 35), groupId: 3 }
  ];
  regions[0].cuts = [{ x: -60, y: 10, radius: 8 }];
  const index = geometry.spatialIndex(regions);
  for (let x = -115; x <= 190; x += 11) {
    for (let y = -80; y <= 80; y += 13) {
      for (const radius of [3, 12, 21]) {
        const cut = { x, y, radius };
        const expected = geometry.cutShape(cut).some(([px, py]) => {
          const owner = geometry.at(regions, px, py, 1);
          return !owner || owner.region.groupId !== 1;
        });
        assert.equal(geometry.reachesGroupEdge(regions, 1, cut), expected, `cut ${x},${y},${radius}`);
        assert.equal(geometry.reachesGroupEdge(regions, 1, cut, index), expected, `indexed cut ${x},${y},${radius}`);
      }
    }
  }
});

test('spatial index preserves region ownership across cells, overlaps, and cuts', () => {
  const regions = [
    { ...region(-55, 10, 30), groupId: 2, cuts: [{ x: -60, y: 10, radius: 8 }] },
    { ...region(0, 0, 70), groupId: 1 },
    { ...region(110, 0, 65), groupId: 1 },
    { ...region(35, 40, 35), groupId: 3 }
  ];
  const index = geometry.spatialIndex(regions);
  for (let x = -200; x <= 250; x += 7) for (let y = -140; y <= 140; y += 11) {
    for (const ignored of [undefined, 1, 2]) {
      const expected = geometry.at(regions, x, y, ignored);
      const actual = index.at(x, y, ignored);
      assert.equal(actual?.region, expected?.region, `point ${x},${y}, group ${ignored}`);
      if (expected) assert.equal(actual.distance, expected.distance);
    }
  }
});

