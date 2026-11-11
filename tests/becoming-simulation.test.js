const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const geometry = require('../becoming-regions.js');

function simulation(regionLimit = 36, initialSeed = 43129) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'becoming.js'), 'utf8')
    .replace('const MAX_REGIONS=36;', `const MAX_REGIONS=${regionLimit};`)
    .replace('function draw(s){', 'function draw(s){globalThis.drawCalls=(globalThis.drawCalls||0)+1;');
  const anchor = /init\(\);\r?\nrequestAnimationFrame\(frame\);/;
  assert.ok(anchor.test(source));
  const code = source.replace(anchor, `globalThis.engine={
    step, frame, read:stateCopy, view:()=>viewState, reset:init, updateUI, averageAvatar, steerAtWall, steerTowardInterior, eraseRegionsFromBuilderEffects, growRegionsFromGrowerEffects, healEnclosedCuts, imprintPosition, imprintIndex, imprintPath, addEvent, renderEvents, columns:IX,
    setTick:value=>{tick=value},
    drawCalls:()=>globalThis.drawCalls,
    setAllWallShifts:value=>{for(const wall of walls)wall.shift=value},
    setZones:value=>{zones=value}, setAgents:value=>{agents=value},
    setBaseline:value=>{speciesBaseline=value.slice()},
    setCell:(index,value,form)=>{interior[index].imprints[1]=value;if(form!==undefined)interior[index].forms[1]=form},
    setGrowerCell:(index,value,form)=>{interior[index].imprints[0]=value;if(form!==undefined)interior[index].forms[0]=form},
    setWall:(index,values)=>{Object.assign(walls[index],values)},
    count:regionCount
  };init();\nrequestAnimationFrame(frame);`);
  const values = { bureaucracy: '35', innovation: '65', abundance: '55', solidarity: '50', adaptability: '65', impermanence: '45', rate: '2' };
  const context = new Proxy({}, {
    get(target, key) {
      if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (key === 'measureText') return () => ({ width: 40 });
      return () => {};
    }
  });
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: values[id] || '0',
      textContent: '',
      innerHTML: '',
      listeners: {},
      replaceCount: 0,
      getContext: () => context,
      addEventListener(type, callback) { this.listeners[type] = callback; },
      replaceChildren() { this.replaceCount++; },
      append() {}
    });
    return elements.get(id);
  }
  const app = { querySelector: selector => element(selector.slice(1)) };
  const document = {
    querySelector: selector => selector === '#becoming-app' ? app : element(selector.slice(1)),
    createElement: () => ({ textContent: '', append() {} })
  };
  class Path2D {
    moveTo() {}
    lineTo() {}
  }
  let now = () => 0;
  let nextSeed = initialSeed;
  const crypto = { getRandomValues(array) { array[0] = nextSeed++; return array; } };
  const sandbox = { document, Path2D, performance: { now: () => now() }, window: { BecomingRegions: geometry, crypto }, requestAnimationFrame() {} };
  vm.runInNewContext(code, sandbox);
  sandbox.engine.fire = (id, type) => element(id).listeners[type]({ currentTarget: element(id) });
  sandbox.engine.element = element;
  sandbox.engine.setClock = clock => { now = clock; };
  return sandbox.engine;
}

function region(id, x, y, kind = 'rest', established = false) {
  return {
    id, groupId: id, links: [], x, y, kind, strength: established ? .8 : .18,
    radius: 70, phase: 0, irregularity: .8, biasX: 0, biasY: 0, age: 0,
    occupantTicks: 0, established, establishedAt: 0, protection: 0
  };
}

function insideWall(walls, x, y) {
  const points = walls.map((wall, i) => {
    const angle = i / walls.length * Math.PI * 2;
    const radius = 1120 / 1.48 * .3 + wall.shift - 12 * wall.layer + 8 * wall.wave * Math.sin(i * .43) + 8 * wall.branch * Math.sin(i * .28);
    return [560 + Math.cos(angle) * radius * 1.48, 380 + Math.sin(angle) * radius];
  });
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

test('the starting enclosure spans about 60% of the canvas and contains the initial inhabitants', () => {
  const state = simulation().read();
  const radius = 1120 / 1.48 * .3;
  assert.ok(Math.abs(2 * radius * 1.48 - 1120 * .6) < 1e-10);
  assert.ok(Math.abs(2 * radius / 760 - .6) < .01);
  for (const agent of state.agents) assert.ok(insideWall(state.walls, agent.x, agent.y));
});

test('page loads and New seed choose new worlds while Reset repeats the current seed', () => {
  const first = simulation(36, 123);
  const anotherLoad = simulation(36, 124);
  const start = JSON.stringify(first.read().agents);
  assert.notEqual(start, JSON.stringify(anotherLoad.read().agents));
  for (let i = 0; i < 10; i++) first.step();
  const evolved = JSON.stringify(first.read().agents);
  first.fire('reset', 'click');
  assert.equal(JSON.stringify(first.read().agents), start);
  for (let i = 0; i < 10; i++) first.step();
  assert.equal(JSON.stringify(first.read().agents), evolved);
  first.fire('restart', 'click');
  const newStart = JSON.stringify(first.read().agents);
  assert.notEqual(newStart, start);
  first.fire('reset', 'click');
  assert.equal(JSON.stringify(first.read().agents), newStart);
});

test('multiple simulation ticks render only once per animation frame', () => {
  const model = simulation();
  const initialDraws = model.drawCalls();
  model.frame(100);
  assert.equal(model.drawCalls(), initialDraws);
  model.frame(185);
  assert.equal(model.read().tick, 2);
  assert.equal(model.drawCalls(), initialDraws + 1);
  model.step();
  assert.equal(model.read().tick, 3);
  assert.equal(model.drawCalls(), initialDraws + 1);
});

test('slow simulation ticks yield between frames without skipping ticks', () => {
  const model = simulation();
  model.element('rate').value = '50';
  let time = 0;
  model.setClock(() => { time += 9; return time; });
  model.frame(100);
  model.frame(200);
  assert.equal(model.read().tick, 1);
  model.frame(216);
  assert.equal(model.read().tick, 2);
});

test('single-step and history controls render the selected state', () => {
  const model = simulation();
  for (let i = 0; i < 16; i++) model.step();
  model.element('timeline').value = '1';
  model.fire('timeline', 'input');
  assert.equal(model.element('timeLabel').textContent, 'Tick 8');
  assert.equal(model.element('play').textContent, 'Play');
  const draws = model.drawCalls();
  model.fire('step', 'click');
  assert.equal(model.element('timeLabel').textContent, 'Tick 17');
  assert.equal(model.drawCalls(), draws + 1);
});

test('historical snapshots preserve all imprint values independently', () => {
  const model = simulation();
  model.setCell(40, .8, .37);
  model.setGrowerCell(41, .7, .52);
  for (let i = 0; i < 8; i++) model.step();
  const expected = JSON.stringify(model.read().interior);
  model.setCell(40, .1, .9);
  for (let i = 0; i < 8; i++) model.step();
  model.element('timeline').value = '1';
  model.fire('timeline', 'input');
  assert.equal(model.view().tick, 8);
  assert.equal(JSON.stringify(model.view().interior), expected);
});

test('the smaller initial wall can expand beyond the former shift limit', () => {
  const model = simulation();
  model.setAgents([]);
  model.setAllWallShifts(170);
  model.step();
  assert.ok(model.read().walls.every(wall => wall.shift > 105));
});

test('imprint paths are reused until their form changes', () => {
  const model = simulation();
  const original = model.imprintPath(0, 0, .3);
  assert.equal(model.imprintPath(0, 0, .3), original);
  assert.notEqual(model.imprintPath(0, 0, .4), original);
  assert.notEqual(model.imprintPath(0, 1, .3), original);
});

test('weaker imprints lose strength proportionally faster than stronger ones', () => {
  const model = simulation();
  model.setAgents([]);
  model.setCell(5, .2, .4);
  model.setCell(6, .8, .6);
  for (let i = 0; i < 100; i++) model.step();
  const cells = model.read().interior;
  const weakRetention = cells[5].imprints[1] / .2;
  const strongRetention = cells[6].imprints[1] / .8;
  assert.ok(weakRetention < strongRetention);
  assert.ok(strongRetention < Math.pow(.9991, 100));
  assert.ok(weakRetention > 0);
});

test('recent events update at 50-tick boundaries and retain up to five entries', () => {
  const model = simulation();
  model.setAgents([]);
  const list = model.element('events');
  for (let boundary = 50; boundary <= 300; boundary += 50) {
    model.setTick(boundary - 20);
    model.addEvent(`Earlier event ${boundary}`);
    model.setTick(boundary - 1);
    model.addEvent(`Latest event ${boundary}`);
    const updates = list.replaceCount;
    model.updateUI();
    assert.equal(list.replaceCount, updates);
    model.step();
    model.updateUI();
    assert.equal(list.replaceCount, updates + 1);
    assert.equal(model.read().events[0].tick, boundary - 1);
    assert.equal(model.read().events[0].message, `Latest event ${boundary}`);
  }
  const state = model.read();
  assert.deepEqual(Array.from(state.events, event => event.tick), [299, 249, 199, 149, 99]);
  const updates = list.replaceCount;
  model.setTick(349);
  model.step();
  model.updateUI();
  assert.equal(list.replaceCount, updates);
  model.addEvent('Pending before reset');
  model.reset();
  assert.equal(model.read().events.length, 0);
  model.setAgents([]);
  model.setTick(49);
  model.step();
  assert.equal(model.read().events.length, 0);
});

test('tentative and established counters partition merged region groups', () => {
  const model = simulation();
  const tentative = region(1000, 500, 380);
  const established = region(1001, 620, 380, 'rest', true);
  const mergedPart = region(1002, 650, 380);
  mergedPart.groupId = established.groupId;
  model.setZones([tentative, established, mergedPart]);
  model.updateUI();
  assert.equal(model.element('zoneCount').textContent, '1');
  assert.equal(model.element('permanentCount').textContent, '1');
  assert.equal(model.count(), 2);
});

test('region counters follow the selected historical snapshot', () => {
  const model = simulation();
  model.setAgents([]);
  model.setZones([region(1000, 400, 380), region(1001, 750, 380, 'rest', true)]);
  for (let i = 0; i < 8; i++) model.step();
  model.setZones([region(1002, 560, 380, 'exchange', true)]);
  for (let i = 0; i < 8; i++) model.step();
  model.updateUI();
  assert.equal(model.element('zoneCount').textContent, '0');
  assert.equal(model.element('permanentCount').textContent, '1');
  model.element('timeline').value = '1';
  model.fire('timeline', 'input');
  assert.equal(model.element('timeLabel').textContent, 'Tick 8');
  assert.equal(model.element('zoneCount').textContent, '1');
  assert.equal(model.element('permanentCount').textContent, '1');
});

test('high impermanence lets a small group change established use despite old memories', () => {
  function setup(impermanence, occupants) {
    const model = simulation();
    model.element('impermanence').value = String(impermanence);
    const first = region(1000, 500, 380, 'rest', true);
    const linked = region(1001, 750, 380, 'rest', true);
    linked.groupId = first.groupId;
    model.setZones([first, linked]);
    model.setAgents(model.read().agents.filter(agent => agent.type === 0).slice(0, occupants)
      .map(agent => ({ ...agent, x: 500, y: 380, restMemory: .95 })));
    return model;
  }
  function advance(model, ticks) {
    for (let i = 0; i < ticks; i++) {
      model.setAgents(model.read().agents.map(agent => ({ ...agent, x: 500, y: 380, energy: .35 })));
      model.step();
    }
  }
  const high = setup(100, 2);
  advance(high, 30);
  assert.ok(high.read().zones.every(zone => zone.kind === 'rest'));
  advance(high, 30);
  assert.ok(high.read().zones.every(zone => zone.kind === 'social'));
  const defaultSetting = setup(45, 2);
  advance(defaultSetting, 60);
  assert.ok(defaultSetting.read().zones.every(zone => zone.kind === 'rest'));
  const alone = setup(100, 1);
  advance(alone, 90);
  assert.ok(alone.read().zones.every(zone => zone.kind === 'rest'));
  const tentative = setup(100, 2);
  tentative.setZones([region(1000, 500, 380)]);
  advance(tentative, 60);
  assert.equal(tentative.read().zones[0].kind, 'rest');
  assert.equal(tentative.read().zones[0].established, false);
});

test('abundance changes how quickly resources recover', () => {
  const low = simulation();
  const high = simulation();
  low.setAgents([]);
  high.setAgents([]);
  low.element('abundance').value = '0';
  high.element('abundance').value = '100';
  for (let i = 0; i < 10; i++) {
    low.step();
    high.step();
  }
  assert.ok(high.read().resources.every((resource, index) => resource > low.read().resources[index]));
});

test('imprints use evenly spaced hexagonal centers and map positions to the nearest center', () => {
  const model = simulation();
  const a = model.imprintPosition(8, 8);
  const b = model.imprintPosition(9, 8);
  const c = model.imprintPosition(8, 9);
  const distance = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  assert.ok(Math.abs(distance(a, b) - distance(a, c)) < 1e-10);
  assert.equal(model.imprintIndex(a[0], a[1]), 8 * model.columns + 8);
  const cells = model.read().interior.length;
  assert.ok(Math.abs(cells / 616 - .5) < .025);
  for (const [x, y] of [[0, 0], [1120, 760], [250, 210], [450, 490], [1117, 270]]) {
    const index = model.imprintIndex(x, y);
    const selected = model.imprintPosition(index % model.columns, Math.floor(index / model.columns));
    const minimum = Math.min(...Array.from({ length: cells }, (_, i) =>
      distance([x, y], model.imprintPosition(i % model.columns, Math.floor(i / model.columns)))));
    assert.ok(Math.abs(distance([x, y], selected) - minimum) < 1e-10);
  }
});

test('species baselines retain exposure-driven changes until reset', () => {
  const model = simulation();
  const initial = model.read();
  const grower = { ...initial.agents.find(agent => agent.type === 0), x: 560, y: 380 };
  model.setAgents([grower]);
  model.setZones([region(1000, 560, 380, 'social', true)]);
  for (let i = 0; i < 30; i++) model.step();
  const evolved = model.read().speciesBaseline;
  assert.ok(evolved[0] > .1);
  assert.equal(evolved[1], .1);
  assert.equal(evolved[2], .1);
  model.setAgents([]);
  model.setZones([]);
  for (let i = 0; i < 30; i++) model.step();
  assert.equal(model.read().speciesBaseline[0], evolved[0]);
  assert.equal(initial.speciesBaseline[0], .1);
  model.reset();
  assert.deepEqual(Array.from(model.read().speciesBaseline), [.1, .1, .1]);
});

test('the inherited baseline changes native traits and applies to offspring', () => {
  for (let type = 0; type < 3; type++) {
    const model = simulation();
    const parent = { ...model.read().agents.find(agent => agent.type === type), x: 560, y: 380, age: 34, energy: 1.5 };
    const trait = ['branch', 'coil', 'wave'][type];
    parent[trait] = .1;
    model.setAgents([parent]);
    const baseline = [.1, .1, .1];
    baseline[type] = .4;
    model.setBaseline(baseline);
    model.step();
    const child = model.read().agents.find(agent => agent.age === 0);
    assert.ok(child, `Expected a type ${type} offspring`);
    assert.ok(child[trait] >= .4);
    for (let i = 0; i < 20; i++) model.step();
    assert.ok(model.read().agents.find(agent => agent.id === parent.id)[trait] > .35);
  }
});

test('current species previews represent the population average', () => {
  const model = simulation();
  const agents = model.read().agents.filter(agent => agent.type === 0);
  const average = model.averageAvatar(agents, 0);
  const mean = agents.reduce((sum, agent) => sum + agent.branch, 0) / agents.length;
  assert.equal(average.branch, mean);
  assert.equal(model.averageAvatar(agents, 1), null);
});

test('regions can exceed five, persist when unused, and adapt their shape', () => {
  const model = simulation();
  for (let i = 0; i < 600; i++) {
    model.step();
    if (i % 30 === 29) {
      const state = model.read();
      for (const zone of state.zones) {
        for (const [x, y] of geometry.polygon(zone)) assert.ok(insideWall(state.walls, x, y));
      }
    }
  }
  const initial = model.read().zones;
  assert.ok(initial.length > 5, `Expected more than five regions, got ${initial.length}`);
  for (let i = 0; i < 200; i++) model.step();
  const later = model.read().zones;
  assert.ok(initial.some(place => {
    const updated = later.find(candidate => candidate.id === place.id);
    return updated && (place.radius !== updated.radius || place.biasX !== updated.biasX || place.biasY !== updated.biasY);
  }));
  const empty = simulation();
  empty.setAgents([]);
  empty.setZones([region(1000, 560, 380)]);
  for (let i = 0; i < 200; i++) empty.step();
  assert.equal(empty.read().zones.length, 1);
});

test('the simulation does not create a thirty-seventh region', () => {
  const model = simulation();
  const control = simulation(37);
  const regions = Array.from({ length: 36 }, (_, i) => region(1000 + i, -10000 - i * 400, -10000, 'rest', i < 18));
  model.setZones(regions);
  control.setZones(regions.map(place => ({ ...place, links: [] })));
  for (let i = 0; i < 200; i++) {
    model.step();
    control.step();
  }
  assert.equal(model.count(), 36);
  assert.equal(control.count(), 37);
});

test('prolonged wall travel turns inhabitants inward without preventing wall encounters', () => {
  const { steerTowardInterior } = simulation();
  const agent = { x: 900, y: 380, heading: Math.PI / 2 };
  for (let i = 0; i < 40; i++) steerTowardInterior(agent, 10);
  assert.equal(agent.heading, Math.PI / 2);
  for (let i = 0; i < 60; i++) steerTowardInterior(agent, 10);
  assert.ok(agent.heading > Math.PI * .9);
  steerTowardInterior(agent, 60);
  assert.equal(agent.edgeTicks, 0);
});

test('wall responses are chosen once per encounter and reset after departure', () => {
  const { steerAtWall } = simulation();
  const agent = { heading: .3 };
  let draws = 0;
  const glide = () => { draws++; return .49; };
  steerAtWall(agent, 5, 0, glide);
  assert.equal(agent.wallMode, 'glide');
  assert.ok(agent.heading > .3 && agent.heading < Math.PI / 2);
  steerAtWall(agent, 5, 0, glide);
  assert.equal(draws, 1);
  steerAtWall(agent, 18, 0, glide);
  agent.heading = .3;
  steerAtWall(agent, 5, 0, () => .5);
  assert.equal(agent.wallMode, 'deflect');
  assert.ok(Math.abs(agent.heading - (Math.PI - .3)) < 1e-10);
});

test('touching regions of the same type merge and snapshots retain independent links', () => {
  const model = simulation();
  model.setAgents([]);
  model.setZones([region(1000, 200, 200), region(1001, 320, 200), region(1002, 440, 200, 'exchange')]);
  const before = model.read();
  for (let i = 0; i < 12; i++) model.step();
  const after = model.read();
  assert.equal(model.count(), 2);
  assert.equal(after.zones[0].groupId, after.zones[1].groupId);
  assert.notEqual(after.zones[1].groupId, after.zones[2].groupId);
  assert.deepEqual(Array.from(before.zones[0].links), []);
  assert.deepEqual(Array.from(after.zones[0].links), [1001]);
  assert.equal(geometry.at(after.zones, 260, 200).region.groupId, after.zones[0].groupId);
  for (let i = 0; i < 500; i++) model.step();
  const later = model.read().zones;
  assert.ok(geometry.touching(later[0], later[1], later));
});

test('interior Builder imprints do not make holes in regions', () => {
  const model = simulation();
  const [x,y] = model.imprintPosition(5, 5);
  model.setZones([region(1000, x, y, 'rest', true)]);
  model.setCell(model.imprintIndex(x, y), .8);
  for (let i = 0; i < 600; i++) model.eraseRegionsFromBuilderEffects();
  const zones = model.read().zones;
  assert.equal(zones[0].cuts.length, 0);
  assert.ok(geometry.at(zones, x, y));
});

test('an eroded edge fills back in if later growth encloses it', () => {
  const model = simulation();
  const place = region(1000, 560, 380);
  place.cuts = [{ x: 660, y: 380, radius: 20 }];
  model.setZones([place]);
  model.healEnclosedCuts();
  assert.equal(model.read().zones[0].cuts.length, 1);
  place.radius = 100;
  model.healEnclosedCuts();
  const zones = model.read().zones;
  assert.equal(zones[0].cuts.length, 0);
  assert.ok(geometry.at(zones, 660, 380));
});

test('strong coil imprints erode only one edge of a merged region after sustained contact', () => {
  const model = simulation();
  const [x,y] = model.imprintPosition(5, 5);
  const first = region(1000, x - 80, y, 'rest', true);
  const second = region(1001, x - 180, y);
  geometry.merge([first, second], first, second, 1);
  model.setZones([first, second]);
  const cell = model.imprintIndex(x, y);
  model.setCell(cell, .69);
  for (let i = 0; i < 500; i++) model.eraseRegionsFromBuilderEffects();
  assert.equal(model.count(), 1);
  model.setCell(cell, .70);
  for (let i = 0; i < 479; i++) model.eraseRegionsFromBuilderEffects();
  assert.equal(model.count(), 1);
  model.setCell(cell, 0);
  model.eraseRegionsFromBuilderEffects();
  model.setCell(cell, .70);
  for (let i = 0; i < 479; i++) model.eraseRegionsFromBuilderEffects();
  assert.equal(model.count(), 1);
  const before = model.read();
  assert.ok(geometry.at(before.zones, x, y));
  model.eraseRegionsFromBuilderEffects();
  const after = model.read();
  assert.equal(model.count(), 1);
  assert.equal(geometry.at(after.zones, x, y), null);
  assert.ok(geometry.at(after.zones, x - 180, y));
  assert.equal(after.zones[0].cuts.length, 1);
  assert.ok(Math.abs(after.zones[0].cuts[0].radius - 12 * Math.sqrt(3)) < 1e-10);
  assert.equal(before.zones[0].cuts.length, 0);
  assert.equal(before.zones.length, 2);
});

test('strong Builder wall layers erode a touched area, but not distant regions', () => {
  const model = simulation();
  model.setAllWallShifts(320 - 1120 / 1.48 * .3);
  const place = region(1000, 980, 380, 'rest', true);
  place.radius = 25;
  model.setZones([place, region(1001, 560, 380)]);
  model.setWall(0, { layer: .8, builderLayer: .8 });
  for (let i = 0; i < 383; i++) model.eraseRegionsFromBuilderEffects();
  assert.equal(model.read().zones[0].cuts.length, 0);
  model.eraseRegionsFromBuilderEffects();
  const zones = model.read().zones;
  assert.equal(zones.length, 2);
  assert.equal(zones[0].cuts.length, 1);
  assert.equal(zones[1].cuts.length, 0);
});

test('wall contact takes priority over an imprint elsewhere in the same region', () => {
  const model = simulation();
  model.setAllWallShifts(320 - 1120 / 1.48 * .3);
  const place = region(1000, 960, 380, 'rest', true);
  place.radius = 40;
  model.setZones([place]);
  const [x,y] = model.imprintPosition(17, 8);
  model.setCell(model.imprintIndex(x, y), .8);
  for (let i = 0; i < 10; i++) model.eraseRegionsFromBuilderEffects();
  model.setWall(0, { layer: .8, builderLayer: .8 });
  for (let i = 0; i < 384; i++) model.eraseRegionsFromBuilderEffects();
  const zones = model.read().zones;
  assert.equal(zones[0].cuts.length, 1);
  assert.ok(geometry.at(zones, x, y));
  assert.equal(geometry.cellKey(zones[0].cuts[0].x, zones[0].cuts[0].y), geometry.cellKey(1009, 380));
});

test('Builder imprints erode an established region during simulation steps', () => {
  const model = simulation();
  model.setAgents([]);
  const [x,y] = model.imprintPosition(5, 5);
  const place = region(1000, x - 20, y, 'rest', true);
  place.radius = 25;
  model.setZones([place]);
  const cell = model.imprintIndex(x, y);
  for (let i = 0; i < 479; i++) {
    model.setCell(cell, .8);
    model.step();
  }
  assert.equal(model.count(), 1);
  model.setCell(cell, .8);
  model.step();
  const zones = model.read().zones;
  assert.equal(model.count(), 1);
  assert.equal(geometry.at(zones, x, y), null);
  assert.ok(geometry.at(zones, x - 35, y));
});

test('a strong coil can touch a region even when its center is outside', () => {
  const model = simulation();
  const [x,y] = model.imprintPosition(5, 5);
  const rotation = ((5 * 17 + 5 * 31 + 7) % 29) * .15;
  const angle = (1.2 + .9 * 4.8) * Math.PI * 2 + rotation;
  const place = region(1000, x + Math.cos(angle) * 14.9, y + Math.sin(angle) * 14.9);
  place.radius = 2;
  assert.equal(geometry.contains(place, x, y), false);
  model.setZones([place]);
  model.setCell(model.imprintIndex(x, y), .8, .9);
  for (let i = 0; i < 480; i++) model.eraseRegionsFromBuilderEffects();
  assert.equal(model.count(), 0);
});

test('sustained Grower imprints create a small addition to the contacted region', () => {
  const model = simulation();
  model.setAllWallShifts(320 - 1120 / 1.48 * .3);
  const [x,y] = model.imprintPosition(5, 5);
  const place = region(1000, x - 35, y, 'rest', true);
  place.radius = 25;
  model.setZones([place]);
  const cell = model.imprintIndex(x, y);
  model.setGrowerCell(cell, .64, .5);
  for (let i = 0; i < 400; i++) model.growRegionsFromGrowerEffects();
  assert.equal(model.read().zones.length, 1);
  model.setGrowerCell(cell, .8, .5);
  for (let i = 0; i < 359; i++) model.growRegionsFromGrowerEffects();
  assert.equal(model.read().zones.length, 1);
  model.growRegionsFromGrowerEffects();
  const zones = model.read().zones;
  assert.equal(model.count(), 1);
  assert.equal(zones.length, 2);
  assert.equal(zones[1].groupId, zones[0].groupId);
  assert.equal(zones[1].established, true);
  assert.ok(zones[1].radius <= 10);
  assert.equal(geometry.at(zones, zones[1].x, zones[1].y).region.id, zones[1].id);
});

test('strong Grower wall traces can add a small area without creating another region', () => {
  const model = simulation();
  model.setAllWallShifts(320 - 1120 / 1.48 * .3);
  const place = region(1000, 1009, 384, 'exchange');
  place.radius = 19;
  model.setZones([place]);
  model.setWall(0, { branch: .8 });
  for (let i = 0; i < 287; i++) model.growRegionsFromGrowerEffects();
  assert.equal(model.read().zones.length, 1);
  model.growRegionsFromGrowerEffects();
  const zones = model.read().zones;
  assert.equal(zones.length, 2);
  assert.equal(model.count(), 1);
  assert.equal(zones[1].kind, 'exchange');
  assert.ok(zones[1].radius <= 10);
});

test('Grower contact creates a visible addition during simulation steps', () => {
  const model = simulation();
  const [x,y] = model.imprintPosition(5, 5);
  const place = region(1000, x - 35, y, 'rest', true);
  place.radius = 25;
  model.setZones([place]);
  model.setAgents([]);
  for (let i = 0; i < 360; i++) {
    model.setGrowerCell(model.imprintIndex(x, y), .8, .5);
    model.step();
  }
  const zones = model.read().zones;
  assert.equal(zones.length, 2);
  assert.equal(model.count(), 1);
  assert.equal(geometry.at(zones, zones[1].x, zones[1].y).region.id, zones[1].id);
});

test('wall stays outside tentative and established regions even under strong Builder contact', () => {
  const model = simulation();
  model.setAgents([]);
  const established = region(1000, 980, 380, 'rest', true);
  established.radius = 25;
  const tentative = region(1001, 560, 690, 'exchange');
  tentative.radius = 60;
  model.setZones([established, tentative]);
  for (let tick = 0; tick < 450; tick++) {
    model.setWall(0, { layer: .9, builderLayer: .9 });
    model.step();
    const state = model.read();
    for (const zone of state.zones) {
      for (const [x, y] of geometry.polygon(zone)) {
        assert.ok(insideWall(state.walls, x, y), `Wall crossed region ${zone.id} at tick ${tick + 1}`);
      }
    }
  }
  assert.ok(model.read().zones[0].cuts.length > 0, 'Builder traces should still reach the protected region');
});

test('Grower wall traces can grow additions without crossing the protected wall', () => {
  const model = simulation();
  model.setAgents([]);
  const place = region(1000, 980, 380, 'rest', true);
  place.radius = 25;
  model.setZones([place]);
  for (let tick = 0; tick < 400; tick++) {
    model.setWall(0, { branch: .9 });
    model.step();
  }
  const state = model.read();
  assert.ok(state.zones.length > 1, 'Grower wall traces should reach the protected region');
  for (const zone of state.zones) {
    for (const [x, y] of geometry.polygon(zone)) assert.ok(insideWall(state.walls, x, y));
  }
});
