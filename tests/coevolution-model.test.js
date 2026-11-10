const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../coevolution-model.js');

const initialState = () => model.createInitialState([
  {
    id: 'moss-network',
    name: 'Moss network',
    type: 'Symbiotic collective',
    mobility: 18,
    environmentalTolerance: 25,
    resourceDependence: 70,
    adaptability: 80,
    collectiveBehaviour: 82,
    spatialInfluence: 90,
    resourceRequirements: 60,
    environmentalPreferences: { temperature: 30, light: 20 }
  },
  {
    id: 'tidal-intelligence',
    name: 'Tidal intelligence',
    type: 'Distributed water-like entity',
    mobility: 75,
    environmentalTolerance: 55,
    resourceDependence: 40,
    adaptability: 65,
    collectiveBehaviour: 70,
    spatialInfluence: 85,
    resourceRequirements: 75,
    environmentalPreferences: { temperature: 65, light: 35 }
  },
  {
    id: 'machine-pollinator',
    name: 'Machine pollinator',
    type: 'Human-machine hybrid',
    mobility: 40,
    environmentalTolerance: 20,
    resourceDependence: 90,
    adaptability: 45,
    collectiveBehaviour: 32,
    spatialInfluence: 80,
    resourceRequirements: 85,
    environmentalPreferences: { temperature: 20, light: 18 }
  }
], { connectivity: 18, resourceAvailability: 25, adaptability: 85 });
const stableHash = (text) => {
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

test('identical inputs produce identical generation results', () => {
  const state = initialState();
  assert.deepEqual(model.runGeneration(state), model.runGeneration(state));
});

test('a later generation consumes the complete prior output state', () => {
  const first = model.runGeneration(initialState());
  const second = model.runGeneration(first.nextState);
  assert.deepEqual(second.diaryEntry.inputState, first.nextState);
  assert.equal(second.diaryEntry.generation, first.diaryEntry.generation + 1);
  assert.equal(second.diaryEntry.parentEntryId, first.diaryEntry.id);
  assert.equal(second.nextState.parentEntryId, second.diaryEntry.id);
});

test('simulation preserves both avatar and architectural transformations', () => {
  const { nextState, diaryEntry } = model.runGeneration(initialState());
  assert.ok(diaryEntry.avatarChanges.length > 0);
  assert.ok(diaryEntry.architecturalChanges.length > 0);
  assert.deepEqual(diaryEntry.outputState.avatars, nextState.avatars);
  assert.deepEqual(diaryEntry.outputState.architecture, nextState.architecture);
  assert.ok(nextState.avatars.some((avatar) => diaryEntry.inputState.avatars.some((input) => input.id === avatar.id)));
});

test('generation engine does not mutate input states', () => {
  const state = initialState();
  const before = model.clone(state);
  model.runGeneration(state);
  assert.deepEqual(state, before);
});

test('diary snapshots include full states and record exact field differences', () => {
  const { diaryEntry } = model.runGeneration(initialState());
  assert.equal(diaryEntry.inputState.avatars.length, 3);
  assert.equal(diaryEntry.outputState.architecture.spaces.length, 8);
  for (const change of diaryEntry.avatarChanges) {
    assert.notDeepEqual(change.previousValue, change.newValue);
    assert.ok(diaryEntry.interactions.some((event) => change.causeEventIds.includes(event.id)));
    assert.ok(model.RULES[change.ruleId]);
    const sameFieldChanges = diaryEntry.avatarChanges.filter((candidate) => candidate.entityId === change.entityId && candidate.property === change.property);
    const latest = sameFieldChanges[sameFieldChanges.length - 1];
    if (change === latest) {
      const output = diaryEntry.outputState.avatars.find((avatar) => avatar.id === change.entityId);
      const actual = change.property.split('.').reduce((value, key) => value?.[key], output);
      assert.deepEqual(actual, change.newValue);
    }
  }
  for (const change of diaryEntry.architecturalChanges) {
    assert.notDeepEqual(change.previousValue, change.newValue);
    assert.ok(change.causeEventIds.length > 0);
    assert.ok(diaryEntry.interactions.some((event) => change.causeEventIds.includes(event.id)));
    assert.ok(model.RULES[change.ruleId]);
    const sameFieldChanges = diaryEntry.architecturalChanges.filter((candidate) => candidate.entityId === change.entityId && candidate.property === change.property);
    const latest = sameFieldChanges[sameFieldChanges.length - 1];
    if (change === latest) {
      if (change.entityId !== 'architecture') {
        const output = diaryEntry.outputState.architecture.spaces.find((space) => space.id === change.entityId);
        assert.deepEqual(change.property === 'connections' ? output[change.property].join(',') : output[change.property], change.newValue);
      } else if (change.property === 'spaces') {
        assert.deepEqual(diaryEntry.outputState.architecture.spaces.map((space) => space.id), change.newValue);
      } else if (change.property === 'boundaries') {
        assert.deepEqual(diaryEntry.outputState.architecture.boundaries, change.newValue);
      } else {
        assert.equal(diaryEntry.outputState.architecture[change.property], change.newValue);
      }
    }
  }
});

test('resources stay within space capacities and avatar values remain bounded', () => {
  let state = initialState();
  for (let generation = 0; generation < 15; generation += 1) {
    state = model.runGeneration(state).nextState;
    for (const avatar of state.avatars) {
      for (const key of Object.keys(model.ATTRIBUTES)) assert.ok(avatar[key] >= 0 && avatar[key] <= 100);
      assert.ok(avatar.resourceRequirements >= 0 && avatar.resourceRequirements <= 100);
    }
    for (const space of state.architecture.spaces) {
      assert.ok(space.availableResources >= 0);
      assert.ok(space.availableResources <= space.resourceCapacity);
    }
  }
});

test('invalid configurations are rejected with actionable validation errors', () => {
  const state = initialState();
  state.avatars[0].mobility = 101;
  assert.ok(model.validateState(state).some((error) => error.includes('invalid mobility')));
  assert.throws(() => model.runGeneration(state), /invalid mobility/);
  const invalidMorphology = initialState();
  invalidMorphology.avatars[0].visual.morphology = 'user-selected-style';
  assert.ok(model.validateState(invalidMorphology).some((error) => error.includes('invalid generated drawing morphology')));
  const invalidPreference = initialState();
  invalidPreference.avatars[0].environmentalPreferences = null;
  assert.ok(model.validateState(invalidPreference).some((error) => error.includes('environmental preference')));
  const invalidVisual = initialState();
  invalidVisual.avatars[0].visual.form = 'unbounded markup';
  assert.ok(model.validateState(invalidVisual).some((error) => error.includes('unsupported visual form')));
});

test('a valid stable generation records use without claiming a physical transformation', () => {
  const state = model.createInitialState([
    { id: 'stable', name: 'Stable entity', mobility: 50, environmentalTolerance: 100, adaptability: 0, resourceDependence: 0, collectiveBehaviour: 0, spatialInfluence: 0, resourceRequirements: 0, environmentalPreferences: { temperature: 50, light: 50 } }
  ], { connectivity: 45, resourceAvailability: 0, adaptability: 0 });
  const result = model.runGeneration(state);
  assert.equal(result.diaryEntry.avatarChanges.length, 0);
  assert.ok(result.diaryEntry.architecturalChanges.every((change) => ['useCount', 'lastUsedGeneration', 'boundaries'].includes(change.property)));
  assert.match(result.diaryEntry.criticalObservation, /No transformation rule crossed/);
});

test('movement records every traveled link for visual wear and narrative summaries', () => {
  let state = model.createInitialState([{
    id: 'traveler',
    name: 'Route traveler',
    mobility: 100,
    environmentalTolerance: 100,
    resourceDependence: 0,
    adaptability: 20,
    collectiveBehaviour: 0,
    spatialInfluence: 20,
    resourceRequirements: 0,
    locationId: 'space-03',
    environmentalPreferences: { temperature: 0, light: 0 }
  }], { connectivity: 20, resourceAvailability: 80, adaptability: 20 });
  const result = model.runGeneration(state);
  const movement = result.diaryEntry.interactions.find((event) => event.type === 'movement');
  assert.ok(movement);
  assert.deepEqual(movement.pathSpaceIds, ['space-03', 'space-02', 'space-01']);
  assert.ok(result.diaryEntry.architecturalChanges.some((change) => ['x', 'y'].includes(change.property)));
  for (let index = 0; index < movement.pathSpaceIds.length - 1; index += 1) {
    const from = state.architecture.spaces.find((space) => space.id === movement.pathSpaceIds[index]);
    assert.ok(from.connections.includes(movement.pathSpaceIds[index + 1]));
  }
  const story = model.evolutionNarrative([result.diaryEntry]).join(' ');
  assert.match(story, /Threshold was the most-used space, with 1 recorded visit/);
  assert.match(story, /busiest route between Threshold and Canopy carried 1 journey/);
});

test('shared avatar pressure can form and reshape an adjoining room', () => {
  const avatars = ['lichen', 'tide', 'moth'].map((id) => ({
    id,
    name: id,
    mobility: 0,
    environmentalTolerance: 100,
    resourceDependence: 90,
    adaptability: 0,
    collectiveBehaviour: 90,
    spatialInfluence: 100,
    resourceRequirements: 80,
    locationId: 'space-04',
    environmentalPreferences: { temperature: 49, light: 55 }
  }));
  const state = model.createInitialState(avatars, { connectivity: 100, resourceAvailability: 100, adaptability: 100 });
  const { nextState, diaryEntry } = model.runGeneration(state);
  const formed = nextState.architecture.spaces.find((space) => space.id.startsWith('space-g001-'));
  const commons = nextState.architecture.spaces.find((space) => space.id === 'space-04');
  assert.ok(formed);
  assert.equal(nextState.architecture.spaces.length, 9);
  assert.equal(commons.planForm, 'clustered');
  assert.ok(commons.height > state.architecture.spaces.find((space) => space.id === 'space-04').height);
  assert.ok(commons.serviceDensity > 0);
  assert.ok(commons.connections.includes(formed.id));
  assert.ok(formed.connections.includes(commons.id));
  assert.ok(diaryEntry.interactions.some((event) => event.type === 'spatial-formation'));
  assert.ok(diaryEntry.architecturalChanges.some((change) => change.property === 'spaces'));
  for (let left = 0; left < nextState.architecture.spaces.length; left += 1) {
    for (let right = left + 1; right < nextState.architecture.spaces.length; right += 1) {
      const first = nextState.architecture.spaces[left];
      const second = nextState.architecture.spaces[right];
      const overlapsX = (first.width + second.width) * .36 + 1 > Math.abs(first.x - second.x);
      const overlapsY = Math.max(4.5, first.height * .38) + Math.max(4.5, second.height * .38) + 1 > Math.abs(first.y - second.y);
      assert.ok(!overlapsX || !overlapsY, `${first.id} overlaps ${second.id} in the spatial plan`);
    }
  }
  assert.deepEqual(model.validateState(nextState), []);
});

test('unused peripheral rooms can recede from a plan with more than eight rooms', () => {
  const state = model.createInitialState([{
    id: 'quiet',
    name: 'Quiet presence',
    mobility: 0,
    environmentalTolerance: 100,
    resourceDependence: 0,
    adaptability: 0,
    collectiveBehaviour: 0,
    spatialInfluence: 0,
    resourceRequirements: 0,
    locationId: 'space-02',
    environmentalPreferences: { temperature: 50, light: 50 }
  }], { connectivity: 100, resourceAvailability: 100, adaptability: 100 });
  state.generation = 3;
  state.architecture.generation = 3;
  const neighbor = state.architecture.spaces.find((space) => space.id === 'space-08');
  const unused = {
    ...model.clone(state.architecture.spaces.find((space) => space.id === 'space-08')),
    id: 'space-old-niche',
    name: 'Old niche',
    x: 91,
    y: 91,
    width: 10,
    height: 9,
    useCount: 0,
    lastUsedGeneration: 0,
    connections: [neighbor.id]
  };
  neighbor.connections.push(unused.id);
  neighbor.connections.sort();
  state.architecture.spaces.push(unused);
  state.architecture.connectivity = Math.round(state.architecture.spaces.reduce((sum, space) => sum + space.connections.length, 0) / (state.architecture.spaces.length * (state.architecture.spaces.length - 1)) * 100);
  const { nextState, diaryEntry } = model.runGeneration(state);
  assert.ok(!nextState.architecture.spaces.some((space) => space.id === unused.id));
  assert.ok(diaryEntry.interactions.some((event) => event.type === 'spatial-retirement'));
  assert.ok(diaryEntry.architecturalChanges.some((change) => change.property === 'spaces' && change.previousValue.includes(unused.id)));
  assert.ok(!nextState.architecture.spaces.find((space) => space.id === neighbor.id).connections.includes(unused.id));
  assert.deepEqual(model.validateState(nextState), []);
});

test('branching from an earlier output preserves the original and marks divergence', () => {
  let state = initialState();
  const diary = [];
  for (let generation = 0; generation < 3; generation += 1) {
    const result = model.runGeneration(state);
    diary.push(result.diaryEntry);
    state = result.nextState;
  }
  const experiment = { rootState: diary[0].inputState, diary };
  const branch = model.createBranch(experiment, diary[0].id, {
    avatars: { 'moss-network': { adaptability: 100 } }
  });
  assert.equal(branch.initialState.generation, diary[0].generation);
  assert.equal(branch.initialState.avatars.find((avatar) => avatar.id === 'moss-network').adaptability, 100);
  const branched = model.runGeneration(branch.headState);
  assert.equal(branched.diaryEntry.parentEntryId, diary[0].id);
  assert.equal(diary.length, 3);
  const comparison = model.compareBranches(diary, [branched.diaryEntry]);
  assert.equal(comparison.divergenceGeneration, diary[1].generation);
  assert.ok(comparison.avatarDifferences.length || comparison.architectureDifferences.length || comparison.converged);
});

test('branch editing rejects unsupported fields and unknown identifiers', () => {
  const first = model.runGeneration(initialState());
  const experiment = { rootState: first.diaryEntry.inputState, diary: [first.diaryEntry] };
  assert.throws(() => model.createBranch(experiment, first.diaryEntry.id, { avatars: { 'moss-network': { unknown: 3 } } }), /cannot change avatar field/);
  assert.throws(() => model.createBranch(experiment, 'missing-entry'), /unknown diary entry/);
});

test('branch edits can add and remove avatars without changing the source history', () => {
  const first = model.runGeneration(initialState());
  const experiment = { rootState: first.diaryEntry.inputState, diary: [first.diaryEntry] };
  const branch = model.createBranch(experiment, first.diaryEntry.id, {
    architecture: { connectivity: 92, resourceAvailability: 40 },
    spaces: { 'space-01': { temperature: 42, resourceCapacity: 30 } },
    avatars: { 'moss-network': { environmentalPreferences: { temperature: 37, light: 23 } } },
    removeAvatarIds: ['machine-pollinator'],
    addAvatars: [{ id: 'lichen-collective', name: 'Lichen collective', environmentalTolerance: 70 }]
  });
  assert.equal(branch.initialState.generation, first.diaryEntry.outputState.generation);
  assert.equal(branch.initialState.architecture.connectivitySetting, 92);
  assert.equal(branch.initialState.architecture.infrastructure.maintenanceReserve, 60);
  assert.equal(branch.initialState.architecture.spaces[0].temperature, 42);
  assert.equal(branch.initialState.architecture.spaces[0].resourceCapacity, 30);
  assert.equal(branch.initialState.architecture.spaces[0].availableResources, 24);
  assert.equal(branch.initialState.avatars.some((avatar) => avatar.id === 'machine-pollinator'), false);
  assert.equal(branch.initialState.avatars.some((avatar) => avatar.id === 'lichen-collective'), true);
  assert.deepEqual(branch.initialState.avatars.find((avatar) => avatar.id === 'moss-network').environmentalPreferences, { temperature: 37, light: 23 });
  assert.equal(first.diaryEntry.outputState.avatars.length, 3);
  assert.ok(branch.divergence.some((item) => item.property === 'membership' && item.newValue === 'added'));
});

test('space-only edits are retained as a branch divergence', () => {
  const first = model.runGeneration(initialState());
  const experiment = { rootState: first.diaryEntry.inputState, diary: [first.diaryEntry] };
  const branch = model.createBranch(experiment, first.diaryEntry.id, { spaces: { 'space-01': { light: 88 } } });
  assert.equal(branch.initialState.architecture.spaces[0].light, 88);
  assert.deepEqual(branch.divergence, [{ entityId: 'space-01', property: 'light', previousValue: first.diaryEntry.outputState.architecture.spaces[0].light, newValue: 88 }]);
});

test('avatar drawing DNA is unique, persistent, and changes only with avatar traits', () => {
  const first = model.runGeneration(initialState());
  const experiment = { rootState: first.diaryEntry.inputState, diary: [first.diaryEntry] };
  const avatar = first.diaryEntry.outputState.avatars[0];
  const secondDNA = model.createVisualDNA(987654321);
  const firstDNA = model.createVisualDNA(123456789);
  assert.notDeepEqual(firstDNA, secondDNA);
  assert.notEqual(model.createVisualDNA(123456789, [firstDNA.morphology]).morphology, firstDNA.morphology);
  const starterMorphologies = initialState().avatars.map((item) => item.visual.morphology);
  assert.equal(new Set(starterMorphologies).size, starterMorphologies.length);
  assert.deepEqual(model.makeAvatar({ id: 'seeded', visual: firstDNA }).visual, firstDNA);
  assert.deepEqual(model.makeAvatar({ id: 'seeded', visual: firstDNA }).visual, firstDNA);
  const legacyAvatar = model.makeAvatar({ id: 'legacy', visual: { hue: 145, form: 'leaf', texture: 'veined' } });
  assert.ok(Number.isInteger(legacyAvatar.visual.seed));
  assert.equal(legacyAvatar.visual.form, undefined);

  const branch = model.createBranch(experiment, first.diaryEntry.id, {
    avatars: { [avatar.id]: { mobility: 88 } }
  });
  assert.deepEqual(branch.initialState.avatars[0].visual, avatar.visual);
  assert.equal(branch.initialState.avatars[0].mobility, 88);
  assert.throws(() => model.createBranch(experiment, first.diaryEntry.id, {
    avatars: { [avatar.id]: { visual: model.createVisualDNA(987654321) } }
  }), /branch visual grammar/i);
});

test('repeated boundary contact builds a localized shared wall trait', () => {
  let state = model.createInitialState([{
    id: 'hairy-source',
    name: 'Hairy source',
    mobility: 0,
    environmentalTolerance: 100,
    resourceDependence: 0,
    adaptability: 100,
    collectiveBehaviour: 0,
    spatialInfluence: 100,
    resourceRequirements: 0,
    locationId: 'space-04',
    environmentalPreferences: { temperature: 50, light: 50 },
    visualTraits: Object.fromEntries(model.VISUAL_TRAITS.map((trait) => [trait, trait === 'hairiness' ? 100 : 0]))
  }], { connectivity: 100, resourceAvailability: 100, adaptability: 100 });
  state.architecture.spaces.forEach((space) => {
    space.temperature = 50;
    space.light = 50;
    space.connections = space.id === 'space-04' ? ['space-05'] : space.id === 'space-05' ? ['space-04'] : [];
  });
  state.architecture.boundaries = state.architecture.boundaries.filter((boundary) => boundary.spaceIds.includes('space-04') && boundary.spaceIds.includes('space-05'));
  state.architecture.connectivity = 4;
  state.architecture.connectivitySetting = 4;
  for (let generation = 0; generation < 10; generation += 1) state = model.runGeneration(state).nextState;
  const boundary = state.architecture.boundaries[0];
  assert.deepEqual(boundary.spaceIds, ['space-04', 'space-05']);
  assert.ok(boundary.useCount >= 10);
  assert.ok(boundary.segments.some((segment) => segment.traits.hairiness > 45));
  assert.equal(boundary.segments.filter((segment) => segment.traits.hairiness > 0).length, 1);
});

test('a later avatar acquires wall traits with recorded source provenance', () => {
  const sourceId = 'hairy-source';
  const visitorSeedState = model.createInitialState([{ id: sourceId }], { connectivity: 100 });
  const boundaryId = visitorSeedState.architecture.boundaries.find((boundary) => boundary.spaceIds.includes('space-04') && boundary.spaceIds.includes('space-05')).id;
  const sourceSegment = Number.parseInt(stableHash(`${sourceId}:${boundaryId}`), 36) % 5;
  let visitorId = 'later-visitor';
  for (let index = 0; Number.parseInt(stableHash(`${visitorId}:${boundaryId}`), 36) % 5 !== sourceSegment; index += 1) visitorId = `later-visitor-${index + 1}`;
  const state = model.createInitialState([{
    id: sourceId,
    name: 'Hairy source',
    mobility: 0,
    environmentalTolerance: 100,
    resourceDependence: 0,
    adaptability: 100,
    collectiveBehaviour: 0,
    spatialInfluence: 100,
    resourceRequirements: 0,
    locationId: 'space-04',
    environmentalPreferences: { temperature: 50, light: 50 },
    visualTraits: Object.fromEntries(model.VISUAL_TRAITS.map((trait) => [trait, trait === 'hairiness' ? 100 : 0]))
  }, {
    id: visitorId,
    name: 'Later visitor',
    mobility: 0,
    environmentalTolerance: 100,
    resourceDependence: 0,
    adaptability: 100,
    collectiveBehaviour: 0,
    spatialInfluence: 100,
    resourceRequirements: 0,
    locationId: 'space-04',
    environmentalPreferences: { temperature: 50, light: 50 },
    visualTraits: Object.fromEntries(model.VISUAL_TRAITS.map((trait) => [trait, trait === 'hairiness' ? 0 : 0]))
  }], { connectivity: 100, resourceAvailability: 100, adaptability: 100 });
  state.architecture.spaces.forEach((space) => {
    space.temperature = 50;
    space.light = 50;
    space.connections = space.id === 'space-04' ? ['space-05'] : space.id === 'space-05' ? ['space-04'] : [];
  });
  state.architecture.boundaries = state.architecture.boundaries.filter((boundary) => boundary.spaceIds.includes('space-04') && boundary.spaceIds.includes('space-05'));
  state.architecture.connectivity = 4;
  state.architecture.connectivitySetting = 4;
  let result = model.runGeneration(state);
  let next = result.nextState;
  next.avatars = next.avatars.filter((avatar) => avatar.id === visitorId);
  let recordedImprint = result.diaryEntry.avatarChanges.some((change) => change.entityId === visitorId && change.property === 'visualTraits');
  for (let generation = 0; generation < 8; generation += 1) {
    result = model.runGeneration(next);
    next = result.nextState;
    recordedImprint ||= result.diaryEntry.avatarChanges.some((change) => change.entityId === visitorId && change.property === 'visualTraits');
  }
  const visitor = next.avatars[0];
  assert.ok(visitor.visualTraits.hairiness > 0);
  assert.ok(visitor.visualTraitProvenance.hairiness.some((record) => record.inheritedFrom.some((source) => source.avatarId === sourceId)));
  assert.ok(recordedImprint);
});

test('visual grammar and traits are editable when branching without rewriting earlier states', () => {
  const first = model.runGeneration(initialState());
  const experiment = { rootState: first.diaryEntry.inputState, diary: [first.diaryEntry] };
  const source = first.diaryEntry.outputState.avatars[0];
  const branch = model.createBranch(experiment, first.diaryEntry.id, {
    avatars: { [source.id]: { visual: { morphology: 'waveform' }, visualTraits: { hairiness: 90 } } }
  });
  const edited = branch.initialState.avatars.find((avatar) => avatar.id === source.id);
  assert.equal(edited.visual.morphology, 'waveform');
  assert.equal(edited.visualTraits.hairiness, 90);
  assert.equal(first.diaryEntry.outputState.avatars.find((avatar) => avatar.id === source.id).visualTraits.hairiness, source.visualTraits.hairiness);
});

test('generated drawing DNA does not affect simulation outcomes', () => {
  const first = initialState();
  const second = model.clone(first);
  second.avatars[0].visual = model.createVisualDNA(987654321);
  const firstResult = model.runGeneration(first);
  const secondResult = model.runGeneration(second);
  assert.deepEqual(secondResult.diaryEntry.outputState.avatars.map(({ visual, ...avatar }) => avatar), firstResult.diaryEntry.outputState.avatars.map(({ visual, ...avatar }) => avatar));
  assert.deepEqual(secondResult.diaryEntry.interactions, firstResult.diaryEntry.interactions);
});

test('export and validated import preserve complete experiment data', () => {
  const state = initialState();
  const { diaryEntry } = model.runGeneration(state);
  const experiment = { id: 'experiment-one', name: 'Field test', rootState: state, diary: [diaryEntry] };
  const exported = model.exportExperiment(experiment);
  const imported = model.validateExperimentImport(exported);
  assert.equal(imported.valid, true);
  assert.deepEqual(imported.experiment, experiment);
  assert.equal(model.validateExperimentImport({ schemaVersion: 999, experiment }).valid, false);
  const corrupted = model.clone(exported);
  corrupted.experiment.diary[0].avatarChanges[0].causeEventIds = ['not-an-event'];
  assert.equal(model.validateExperimentImport(corrupted).valid, false);
  assert.equal(model.validateExperimentImport({ schemaVersion: model.SCHEMA_VERSION, experiment: { id: 'bad', name: 'Bad', rootState: state, diary: [null] } }).valid, false);
  assert.equal(model.validateExperimentImport({ schemaVersion: model.SCHEMA_VERSION, experiment: { id: 'bad', name: 'Bad', rootState: state, diary: [{ inputState: state, outputState: state, interactions: {}, avatarChanges: {}, architecturalChanges: [] }] } }).valid, false);
});

test('diary text is readable and contains actual interaction and change records', () => {
  const { diaryEntry } = model.runGeneration(initialState());
  const text = model.diaryAsText([diaryEntry]);
  assert.match(text, /INPUT AVATARS/);
  assert.match(text, /INTERACTIONS/);
  assert.match(text, /ARCHITECTURAL TRANSFORMATIONS/);
  assert.match(text, /AVATAR TRANSFORMATIONS/);
  assert.match(text, /CRITICAL OBSERVATION:/);
  assert.ok(text.includes(diaryEntry.interactions[0].description));
});

test('branch timelines and evolution patterns only report recorded evidence', () => {
  let state = initialState();
  const entries = [];
  for (let generation = 0; generation < 3; generation += 1) {
    const result = model.runGeneration(state);
    entries.push(result.diaryEntry);
    state = result.nextState;
  }
  assert.deepEqual(model.branchTimeline(entries).map((entry) => entry.generation), [1, 2, 3]);
  const patterns = model.detectPatterns(entries);
  assert.ok(patterns.every((pattern) => pattern.evidence.length > 0));
});

test('evolution summary explains modeled encounters and state changes in plain language', () => {
  let state = initialState();
  const entries = [];
  for (let generation = 0; generation < 3; generation += 1) {
    const result = model.runGeneration(state);
    entries.push(result.diaryEntry);
    state = result.nextState;
  }
  const story = model.evolutionNarrative(entries).join(' ');
  assert.match(story, /More of the possible routes|Fewer of the possible routes|overall share of connected routes/);
  assert.match(story, /resource shortfall events were recorded|No resource shortfalls were recorded/);
  assert.match(story, /A shortfall means a being's space could not provide all the resource units/);
  assert.match(story, /social encounters|No social encounters were recorded/);
  assert.match(story, /Each counts one modeled value shifting/);
  assert.match(story, /not a prediction of a real habitat/);
  assert.match(model.evolutionNarrative([])[0], /Run a few generations/);
});
