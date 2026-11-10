const test = require('node:test');
const assert = require('node:assert/strict');
const Model = require('../coevolution-model.js');
const Visuals = require('../coevolution-visuals.js');

function avatar(morphology, overrides = {}) {
  return {
    id: 'visual-test',
    name: 'Visual test',
    visual: { seed: 3941, morphology, paletteHue: 168 },
    visualTraits: Object.fromEntries(Model.VISUAL_TRAITS.map((trait) => [trait, 0])),
    ...overrides
  };
}

test('all six avatar grammars render distinct, deterministic geometry', () => {
  const grammars = ['branching', 'spiral', 'radial', 'cellular', 'waveform', 'geometric'];
  const drawings = grammars.map((grammar) => Visuals.renderAvatar(avatar(grammar)));
  assert.equal(new Set(drawings).size, grammars.length);
  grammars.forEach((grammar, index) => {
    assert.equal(drawings[index], Visuals.renderAvatar(avatar(grammar)));
    assert.match(drawings[index], new RegExp(`coev-avatar-${grammar}`));
  });
});

test('transferred avatar traits alter the same grammar geometry', () => {
  const before = avatar('branching');
  const after = avatar('branching', {
    visualTraits: { ...before.visualTraits, hairiness: 100, waviness: 80, layering: 70 }
  });
  assert.notEqual(Visuals.renderAvatar(before), Visuals.renderAvatar(after));
  assert.match(Visuals.renderAvatar(after), /coev-avatar-branching/);
});

test('room maps are deterministic and include every room and avatar', () => {
  const state = Model.createInitialState([{ id: 'map-avatar', name: 'Map avatar' }]);
  state.avatars[0].locationId = state.architecture.spaces[0].id;
  const first = Visuals.renderPlan(state);
  assert.equal(first, Visuals.renderPlan(state));
  assert.equal((first.match(/data-room-id=/g) || []).length, state.architecture.spaces.length);
  assert.match(first, /Map avatar/);
  assert.match(first, /coev-avatar-/);
  assert.match(first, /coev-room-shape/);
});

test('localized wall traits change shared wall geometry and texture', () => {
  const state = Model.createInitialState([{ id: 'wall-avatar', name: 'Wall avatar' }]);
  const boundary = state.architecture.boundaries[0];
  const before = Visuals.renderPlan(state);
  boundary.segments[2].traits.waviness = 100;
  boundary.segments[2].traits.hairiness = 100;
  boundary.segments[2].sources.push({ avatarId: 'wall-avatar', trait: 'hairiness', hue: 168 });
  const after = Visuals.renderPlan(state);
  assert.notEqual(before, after);
  assert.match(after, /coev-wall-hair/);
  const walls = [...after.matchAll(/data-wall-owners="([^"]*)"/g)];
  assert.ok(walls.length > 0);
  walls.forEach(([, owners]) => assert.equal(owners ? owners.split('|').length : 1, new Set(owners ? owners.split('|') : []).size));
});
