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
      assert.equal(output[change.property], change.newValue);
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

test('a valid stable generation may record interactions without fabricated changes', () => {
  const state = model.createInitialState([
    { id: 'stable', name: 'Stable entity', mobility: 50, environmentalTolerance: 100, adaptability: 0, resourceDependence: 0, collectiveBehaviour: 0, spatialInfluence: 0, resourceRequirements: 0, environmentalPreferences: { temperature: 50, light: 50 } }
  ], { connectivity: 45, resourceAvailability: 0, adaptability: 0 });
  const result = model.runGeneration(state);
  assert.equal(result.diaryEntry.avatarChanges.length, 0);
  assert.equal(result.diaryEntry.architecturalChanges.length, 0);
  assert.match(result.diaryEntry.criticalObservation, /No transformation rule crossed/);
});

test('movement records every traveled link for visual wear and narrative summaries', () => {
  const state = model.createInitialState([{
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
  for (let index = 0; index < movement.pathSpaceIds.length - 1; index += 1) {
    const from = state.architecture.spaces.find((space) => space.id === movement.pathSpaceIds[index]);
    assert.ok(from.connections.includes(movement.pathSpaceIds[index + 1]));
  }
  const story = model.evolutionNarrative([result.diaryEntry]).join(' ');
  assert.match(story, /Threshold was the most-used space, with 1 recorded visit/);
  assert.match(story, /busiest route between Threshold and Canopy carried 1 journey/);
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
  }), /cannot change avatar field visual/i);
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
