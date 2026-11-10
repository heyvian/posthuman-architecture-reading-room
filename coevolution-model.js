(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  root.CoevolutionModel = model;
}(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  const SCHEMA_VERSION = 1;
  const VISUAL_FORMS = ['webbed', 'spiral', 'segmented', 'amoeboid', 'geometric', 'atom', 'leaf', 'radial'];
  const VISUAL_TEXTURES = ['hairy', 'slimy', 'matte', 'spiky', 'bumpy', 'veined'];
  const VISUAL_MORPHOLOGIES = ['branching', 'spiral', 'radial', 'cellular', 'waveform', 'geometric', 'coiled', 'segmented', 'reticular', 'lobed'];
  const PRIMARY_MORPHOLOGIES = ['branching', 'spiral', 'radial', 'cellular', 'waveform', 'geometric'];
  const VISUAL_TRAITS = ['hairiness', 'bumpiness', 'waviness', 'angularity', 'layering', 'porosity', 'branching', 'connectivity', 'density', 'reach'];
  const ATTRIBUTES = {
    mobility: { label: 'Mobility', description: 'Capacity to move between spaces.' },
    environmentalTolerance: { label: 'Environmental tolerance', description: 'Capacity to withstand temperature and light conditions.' },
    resourceDependence: { label: 'Resource dependence', description: 'Reliance on architectural resources and infrastructure.' },
    adaptability: { label: 'Adaptability', description: 'Rate at which characteristics respond to experience.' },
    collectiveBehaviour: { label: 'Collective behaviour', description: 'Tendency to coordinate with other avatars.' },
    spatialInfluence: { label: 'Spatial influence', description: 'Capacity to alter occupied spaces and their connections.' }
  };
  const RULES = {
    'movement.reachable-spaces': 'Reachable spaces depend on network paths and mobility.',
    'movement.space-choice': 'Space choice balances environmental fit, resources, and travel cost.',
    'resources.capacity-distribution': 'The architectural system allocates its finite supply across space capacities.',
    'resources.consumption': 'Occupants consume resources in deterministic avatar order.',
    'environment.compatibility': 'Environmental mismatch is measured against each avatar’s preferences and tolerance.',
    'social.co-location': 'Avatars in the same or directly connected spaces can form a social encounter.',
    'architecture.connectivity-response': 'Spatial influence and blocked movement can fund a new connection.',
    'architecture.resource-redistribution': 'Resource pressure shifts a bounded amount toward occupied spaces.',
    'architecture.environmental-response': 'Repeated mismatch can shift local light toward occupant preferences.',
    'architecture.capacity-response': 'Sustained occupancy pressure can expand a space within its physical limit.',
    'architecture.spatial-reconfiguration': 'Movement, resource use, and environmental fit reshape rooms and their positions.',
    'architecture.space-formation': 'Shared use can generate a new space connected to the places that sustain it.',
    'architecture.space-retirement': 'Persistently unused, peripheral spaces may be absorbed back into the plan.',
    'architecture.boundary-adaptation': 'Repeated contact gradually inscribes avatar traits into a localized shared boundary; neighboring spaces inherit the same physical wall.',
    'avatar.environmental-acclimation': 'Environmental exposure changes tolerance, with an adaptability-scaled cap.',
    'avatar.infrastructure-dependence': 'Resource shortfall can increase dependence; sustained abundance can reduce it.',
    'avatar.social-isolation': 'Repeated isolation can reduce collective behaviour; contact can increase it.',
    'avatar.mobility-barrier': 'Repeated blocked movement can change mobility, bounded by adaptability.',
    'avatar.specialization-tradeoff': 'Acclimation may reduce compatibility with conditions far from the experienced range.',
    'avatar.architectural-imprint': 'Repeated contact with a modified boundary gradually transfers its traits into an avatar.'
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const round = (value, places = 2) => Number(value.toFixed(places));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const stableCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  const idPart = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 40);

  function hashText(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function createVisualDNA(seed = 0, existingMorphologies = []) {
    let value = Number(seed) >>> 0;
    const random = () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
    const stableSeed = Number(seed) >>> 0;
    const firstMorphology = ((stableSeed ^ (stableSeed >>> 16)) >>> 0) % PRIMARY_MORPHOLOGIES.length;
    const usedMorphologies = new Set(existingMorphologies);
    const morphologyOffset = Array.from({ length: PRIMARY_MORPHOLOGIES.length }, (_, offset) => offset)
      .find((offset) => !usedMorphologies.has(PRIMARY_MORPHOLOGIES[(firstMorphology + offset) % PRIMARY_MORPHOLOGIES.length]));
    return {
      seed: stableSeed,
      morphology: PRIMARY_MORPHOLOGIES[(firstMorphology + (morphologyOffset ?? 0)) % PRIMARY_MORPHOLOGIES.length],
      paletteHue: round(random() * 360, 1),
      spiralBias: round(random(), 3),
      branchBias: round(random(), 3),
      veinBias: round(random(), 3),
      contourBias: round(random(), 3),
      hatchBias: round(random(), 3),
      dashScale: round(.35 + random() * 1.8, 3),
      paletteDiversity: round(random(), 3),
      reachBias: round(random(), 3),
      spreadBias: round(random(), 3),
      rotationBias: round(random(), 3),
      lineWeightBias: round(random(), 3)
    };
  }

  function normalizeState(state) {
    if (!state || typeof state !== 'object') return state;
    state.avatars?.forEach((avatar) => {
      const normalized = makeAvatar(avatar, state.avatars.indexOf(avatar) + 1);
      avatar.visualTraits = normalizeVisualTraits(avatar.visualTraits, Number.parseInt(hashText(`${avatar.id}:visual-traits`), 36) >>> 0);
      avatar.visualTraitProvenance = avatar.visualTraitProvenance || {};
      avatar.visual = normalized.visual;
    });
    if (state.architecture) state.architecture.boundaries = syncBoundaries(state.architecture);
    return state;
  }

  function initialVisualTraits(seed) {
    let value = Number(seed) >>> 0;
    const random = () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
    return Object.fromEntries(VISUAL_TRAITS.map((trait) => [
      trait,
      Math.round(25 + random() * 52)
    ]));
  }

  function normalizeVisualTraits(traits, seed) {
    const defaults = initialVisualTraits(seed);
    return Object.fromEntries(VISUAL_TRAITS.map((trait) => [
      trait,
      clamp(Number.isFinite(Number(traits?.[trait])) ? Number(traits[trait]) : defaults[trait], 0, 100)
    ]));
  }

  function createBoundary(firstSpaceId, secondSpaceId) {
    const spaceIds = [firstSpaceId, secondSpaceId].sort(stableCompare);
    const id = `boundary-${hashText(spaceIds.join('|'))}`;
    return {
      id,
      spaceIds,
      useCount: 0,
      lastContactGeneration: 0,
      segments: Array.from({ length: 5 }, (_, index) => ({
        index,
        contactCount: 0,
        traits: Object.fromEntries(VISUAL_TRAITS.map((trait) => [trait, 0])),
        sources: []
      }))
    };
  }

  function syncBoundaries(architecture) {
    const existing = new Map((architecture.boundaries || []).map((boundary) => [boundary.id, boundary]));
    const next = new Map();
    architecture.spaces.forEach((space) => {
      space.connections.forEach((peerId) => {
        if (stableCompare(space.id, peerId) >= 0) return;
        const boundary = createBoundary(space.id, peerId);
        next.set(boundary.id, existing.get(boundary.id) || boundary);
      });
    });
    return [...next.values()].sort((left, right) => stableCompare(left.id, right.id));
  }

  function makeAvatar(input = {}, index = 1) {
    const id = input.id || `avatar-${String(index).padStart(3, '0')}`;
    const seed = input.visual && Number.isInteger(input.visual.seed)
      ? input.visual.seed
      : Number.parseInt(hashText(`${id}:${index}`), 36) >>> 0;
    const generatedVisual = createVisualDNA(seed);
    const visual = Object.fromEntries(Object.keys(generatedVisual).map((key) => [
      key,
      input.visual && key === 'morphology' && VISUAL_MORPHOLOGIES.includes(input.visual[key])
        ? input.visual[key]
        : input.visual && key !== 'morphology' && Number.isFinite(Number(input.visual[key]))
        ? key === 'seed' ? Number(input.visual[key]) >>> 0 : Number(input.visual[key])
        : generatedVisual[key]
    ]));
    const avatar = {
      id,
      name: String(input.name || `Entity ${index}`).trim().slice(0, 80),
      type: String(input.type || 'Speculative entity').trim().slice(0, 80),
      description: String(input.description || '').trim().slice(0, 280),
      mobility: clamp(Number(input.mobility ?? 55), 0, 100),
      environmentalTolerance: clamp(Number(input.environmentalTolerance ?? 55), 0, 100),
      resourceDependence: clamp(Number(input.resourceDependence ?? 50), 0, 100),
      adaptability: clamp(Number(input.adaptability ?? 50), 0, 100),
      collectiveBehaviour: clamp(Number(input.collectiveBehaviour ?? 50), 0, 100),
      spatialInfluence: clamp(Number(input.spatialInfluence ?? 50), 0, 100),
      locationId: input.locationId ?? null,
      resourceRequirements: clamp(Number(input.resourceRequirements ?? 20), 0, 100),
      environmentalPreferences: {
        temperature: clamp(Number(input.environmentalPreferences?.temperature ?? 50), 0, 100),
        light: clamp(Number(input.environmentalPreferences?.light ?? 55), 0, 100)
      },
      interactionHistory: clone(input.interactionHistory || []),
      generationHistory: clone(input.generationHistory || []),
      visualTraits: normalizeVisualTraits(input.visualTraits, Number.parseInt(hashText(`${id}:visual-traits`), 36) >>> 0),
      visualTraitProvenance: clone(input.visualTraitProvenance || {}),
      visual
    };
    return avatar;
  }

  function createInitialArchitecture(options = {}) {
    const connectivity = clamp(Number(options.connectivity ?? 45), 0, 100);
    const resourceAvailability = clamp(Number(options.resourceAvailability ?? 55), 0, 100);
    const adaptability = clamp(Number(options.adaptability ?? 45), 0, 100);
    const positions = [
      [32, 30], [48, 30], [64, 30], [40, 46],
      [56, 46], [32, 62], [48, 62], [64, 62]
    ];
    const spaces = positions.map(([x, y], index) => {
      const variation = ((index * 17) % 21) - 10;
      const resourceCapacity = 60 + ((index * 13) % 31);
      return {
        id: `space-${String(index + 1).padStart(2, '0')}`,
        name: ['Threshold', 'Canopy', 'Thermal chamber', 'Commons', 'Reservoir', 'Quiet zone', 'Exchange', 'Edge habitat'][index],
        x,
        y,
        width: index === 3 || index === 6 ? 18 : 15,
        height: index === 3 || index === 6 ? 15 : 13,
        planForm: 'rectilinear',
        serviceDensity: 0,
        useCount: 0,
        lastUsedGeneration: 0,
        temperature: clamp(50 + variation + (index === 2 ? 18 : 0), 0, 100),
        light: clamp(56 + variation + (index === 5 ? -24 : 0), 0, 100),
        resourceCapacity,
        availableResources: round(resourceCapacity * resourceAvailability / 100),
        occupancyCapacity: index === 3 || index === 6 ? 4 : 3,
        adaptability,
        modificationCost: 10 + (index % 3) * 5,
        connections: [],
        specialisation: 'mixed',
        transformationHistory: []
      };
    });

    const edges = [[0, 1], [1, 2], [0, 3], [1, 3], [1, 4], [2, 4], [3, 4], [3, 5], [3, 6], [4, 6], [4, 7], [5, 6], [6, 7]];
    const selectedEdges = edges.filter((_, index) => {
      const threshold = connectivity < 25 ? 0.35 : connectivity < 55 ? 0.65 : connectivity < 80 ? 0.84 : 1;
      return index < 4 || ((index * 37 + 11) % 100) / 100 < threshold;
    });
    selectedEdges.forEach(([from, to]) => {
      spaces[from].connections.push(spaces[to].id);
      spaces[to].connections.push(spaces[from].id);
    });
    spaces.forEach((space) => space.connections.sort(stableCompare));
    const architecture = {
      spaces,
      connectivity: round(selectedEdges.length / (spaces.length * (spaces.length - 1) / 2) * 100),
      connectivitySetting: connectivity,
      resourceAvailability,
      adaptability,
      infrastructure: { distributionMode: 'shared network', controlCapacity: Math.round(adaptability / 10), maintenanceReserve: 100 - resourceAvailability },
      transformationHistory: [],
      generation: 0
    };
    architecture.boundaries = syncBoundaries(architecture);
    return architecture;
  }

  function createInitialState(avatars = [], architectureOptions = {}) {
    const usedMorphologies = new Set();
    const normalizedAvatars = avatars.map((avatar, index) => {
      const normalized = makeAvatar(avatar, index + 1);
      if (!avatar.visual?.morphology && usedMorphologies.has(normalized.visual.morphology)) {
        normalized.visual.morphology = createVisualDNA(normalized.visual.seed, [...usedMorphologies]).morphology;
      }
      usedMorphologies.add(normalized.visual.morphology);
      return normalized;
    });
    normalizedAvatars.forEach((avatar, index) => {
      if (!avatar.locationId) avatar.locationId = `space-${String((index % 8) + 1).padStart(2, '0')}`;
    });
    return {
      generation: 0,
      avatars: normalizedAvatars,
      architecture: createInitialArchitecture(architectureOptions),
      branchId: 'root',
      parentEntryId: null
    };
  }

  function validateState(state) {
    const errors = [];
    if (!state || typeof state !== 'object') return ['Simulation state must be an object.'];
    if (!Number.isInteger(state.generation) || state.generation < 0) errors.push('Generation must be a non-negative integer.');
    if (!Array.isArray(state.avatars) || state.avatars.length < 1 || state.avatars.length > 24) errors.push('Provide between 1 and 24 avatars.');
    if (!state.architecture || !Array.isArray(state.architecture.spaces) || state.architecture.spaces.length < 6 || state.architecture.spaces.length > 12) errors.push('Architecture must contain 6–12 spaces.');
    const avatars = Array.isArray(state.avatars) ? state.avatars : [];
    const spaces = Array.isArray(state.architecture?.spaces) ? state.architecture.spaces : [];
    const avatarIds = new Set();
    const spaceIds = new Set();
    avatars.forEach((avatar) => {
      if (!avatar || typeof avatar !== 'object') {
        errors.push('Avatar record must be an object.');
        return;
      }
      if (!avatar.id || avatarIds.has(avatar.id)) errors.push(`Avatar ID is missing or duplicated: ${avatar.id || '(missing)'}.`);
      avatarIds.add(avatar.id);
      for (const key of Object.keys(ATTRIBUTES)) {
        if (!Number.isFinite(avatar[key]) || avatar[key] < 0 || avatar[key] > 100) errors.push(`${avatar.id} has invalid ${key}; expected 0–100.`);
      }
      if (!Number.isFinite(avatar.resourceRequirements) || avatar.resourceRequirements < 0 || avatar.resourceRequirements > 100) errors.push(`${avatar.id} has invalid resource requirements.`);
      if (!avatar.visual || typeof avatar.visual !== 'object') errors.push(`${avatar.id} has invalid generated drawing profile.`);
      else {
        if (avatar.visual.seed !== undefined && (!Number.isInteger(avatar.visual.seed) || avatar.visual.seed < 0 || avatar.visual.seed > 4294967295)) errors.push(`${avatar.id} has invalid generated drawing seed.`);
        if (avatar.visual.morphology !== undefined && !VISUAL_MORPHOLOGIES.includes(avatar.visual.morphology)) errors.push(`${avatar.id} has invalid generated drawing morphology.`);
        for (const key of ['paletteHue', 'spiralBias', 'branchBias', 'veinBias', 'contourBias', 'hatchBias', 'dashScale', 'paletteDiversity', 'reachBias', 'spreadBias', 'rotationBias', 'lineWeightBias']) {
          const maximum = key === 'paletteHue' ? 360 : key === 'dashScale' ? 2.15 : 1;
          if (avatar.visual[key] !== undefined && (!Number.isFinite(avatar.visual[key]) || avatar.visual[key] < 0 || avatar.visual[key] > maximum)) errors.push(`${avatar.id} has invalid generated drawing parameter ${key}.`);
        }
        if (avatar.visual.hue !== undefined && (!Number.isFinite(avatar.visual.hue) || avatar.visual.hue < 0 || avatar.visual.hue > 360)) errors.push(`${avatar.id} has invalid visual hue; expected 0–360.`);
        if (avatar.visual.form !== undefined && !VISUAL_FORMS.includes(avatar.visual.form)) errors.push(`${avatar.id} has unsupported visual form.`);
        if (avatar.visual.texture !== undefined && !VISUAL_TEXTURES.includes(avatar.visual.texture)) errors.push(`${avatar.id} has unsupported visual surface.`);
        if (avatar.visual.segments !== undefined && (!Number.isInteger(avatar.visual.segments) || avatar.visual.segments < 3 || avatar.visual.segments > 10)) errors.push(`${avatar.id} has invalid visual segment count; expected 3–10.`);
        if (avatar.visual.limbCount !== undefined && (!Number.isInteger(avatar.visual.limbCount) || avatar.visual.limbCount < 4 || avatar.visual.limbCount > 12)) errors.push(`${avatar.id} has invalid visual limb count; expected 4–12.`);
        if (avatar.visual.irregularity !== undefined && (!Number.isFinite(avatar.visual.irregularity) || avatar.visual.irregularity < 0 || avatar.visual.irregularity > 100)) errors.push(`${avatar.id} has invalid visual irregularity; expected 0–100.`);
      }
      if (avatar.visualTraits !== undefined && (!avatar.visualTraits || typeof avatar.visualTraits !== 'object')) errors.push(`${avatar.id} has invalid visual traits.`);
      else if (avatar.visualTraits) VISUAL_TRAITS.forEach((trait) => {
        if (!Number.isFinite(avatar.visualTraits[trait]) || avatar.visualTraits[trait] < 0 || avatar.visualTraits[trait] > 100) errors.push(`${avatar.id} has invalid visual trait ${trait}; expected 0–100.`);
      });
      for (const key of ['temperature', 'light']) {
        const preference = avatar.environmentalPreferences?.[key];
        if (!Number.isFinite(preference) || preference < 0 || preference > 100) errors.push(`${avatar.id} has invalid environmental preference ${key}; expected 0–100.`);
      }
    });
    for (const key of ['connectivity', 'connectivitySetting', 'resourceAvailability', 'adaptability']) {
      if (!Number.isFinite(state.architecture?.[key]) || state.architecture[key] < 0 || state.architecture[key] > 100) errors.push(`Architecture has invalid ${key}; expected 0–100.`);
    }
    spaces.forEach((space) => {
      if (!space || typeof space !== 'object') {
        errors.push('Architectural space record must be an object.');
        return;
      }
      if (!space.id || spaceIds.has(space.id)) errors.push(`Space ID is missing or duplicated: ${space.id || '(missing)'}.`);
      spaceIds.add(space.id);
      if (!Number.isFinite(space.availableResources) || !Number.isFinite(space.resourceCapacity) || space.availableResources < 0 || space.availableResources > space.resourceCapacity) errors.push(`${space.id} has resources outside its capacity.`);
      if (!Number.isFinite(space.occupancyCapacity) || space.occupancyCapacity < 1) errors.push(`${space.id} has invalid occupancy capacity.`);
      if (!Number.isFinite(space.x) || space.x < 0 || space.x > 100 || !Number.isFinite(space.y) || space.y < 0 || space.y > 100) errors.push(`${space.id} has invalid plan position.`);
      if (!Number.isFinite(space.width) || space.width < 8 || space.width > 28 || !Number.isFinite(space.height) || space.height < 8 || space.height > 24) errors.push(`${space.id} has invalid plan dimensions.`);
      if (space.planForm !== undefined && !['rectilinear', 'elongated', 'clustered', 'serviced', 'sheltered'].includes(space.planForm)) errors.push(`${space.id} has invalid plan form.`);
      if (space.serviceDensity !== undefined && (!Number.isInteger(space.serviceDensity) || space.serviceDensity < 0 || space.serviceDensity > 6)) errors.push(`${space.id} has invalid service density.`);
      if (space.useCount !== undefined && (!Number.isInteger(space.useCount) || space.useCount < 0)) errors.push(`${space.id} has invalid recorded use count.`);
      if (space.lastUsedGeneration !== undefined && (!Number.isInteger(space.lastUsedGeneration) || space.lastUsedGeneration < 0 || space.lastUsedGeneration > state.generation)) errors.push(`${space.id} has invalid last-used generation.`);
      for (const key of ['temperature', 'light', 'adaptability']) {
        if (!Number.isFinite(space[key]) || space[key] < 0 || space[key] > 100) errors.push(`${space.id} has invalid ${key}; expected 0–100.`);
      }
      if (!Array.isArray(space.connections)) errors.push(`${space.id} must have a connection list.`);
    });
    for (const avatar of avatars) {
      if (avatar.locationId && !spaceIds.has(avatar.locationId)) errors.push(`${avatar.id} refers to missing space ${avatar.locationId}.`);
    }
    for (const space of spaces) {
      for (const connectionId of Array.isArray(space.connections) ? space.connections : []) {
        const peer = spaces.find((candidate) => candidate.id === connectionId);
        if (!peer) errors.push(`${space.id} refers to missing connection ${connectionId}.`);
        else if (!peer.connections.includes(space.id)) errors.push(`${space.id} ↔ ${connectionId} connection is not reciprocal.`);
      }
    }
    if (state.architecture?.boundaries !== undefined) {
      if (!Array.isArray(state.architecture.boundaries)) errors.push('Architecture boundaries must be a list.');
      else {
        const boundaryIds = new Set();
        state.architecture.boundaries.forEach((boundary) => {
          if (!boundary || typeof boundary !== 'object' || !Array.isArray(boundary.spaceIds) || boundary.spaceIds.length !== 2) {
            errors.push('Architectural boundary must connect exactly two spaces.');
            return;
          }
          if (!boundary.id || boundaryIds.has(boundary.id)) errors.push(`Architectural boundary ID is missing or duplicated: ${boundary.id || '(missing)'}.`);
          boundaryIds.add(boundary.id);
          const [first, second] = boundary.spaceIds;
          const firstSpace = spaces.find((space) => space.id === first);
          const secondSpace = spaces.find((space) => space.id === second);
          if (!firstSpace || !secondSpace || !firstSpace.connections.includes(second) || !secondSpace.connections.includes(first)) {
            errors.push(`${boundary.id} does not match a reciprocal architectural connection.`);
          }
          if (!Array.isArray(boundary.segments) || boundary.segments.length !== 5) errors.push(`${boundary.id} must contain five localized wall segments.`);
          (boundary.segments || []).forEach((segment, index) => {
            if (segment.index !== index) errors.push(`${boundary.id} has an invalid wall-segment index.`);
            VISUAL_TRAITS.forEach((trait) => {
              const value = segment.traits?.[trait];
              if (!Number.isFinite(value) || value < 0 || value > 100) errors.push(`${boundary.id} has invalid ${trait} on segment ${index}; expected 0–100.`);
            });
            if (!Array.isArray(segment.sources)) errors.push(`${boundary.id} segment ${index} has invalid provenance.`);
          });
        });
      }
    }
    return [...new Set(errors)];
  }

  function assertValidState(state) {
    const errors = validateState(state);
    if (errors.length) throw new TypeError(errors.join(' '));
  }

  function shortestDistances(architecture, startId) {
    const distances = new Map([[startId, 0]]);
    const queue = [startId];
    while (queue.length) {
      const currentId = queue.shift();
      const current = architecture.spaces.find((space) => space.id === currentId);
      for (const nextId of current.connections.slice().sort(stableCompare)) {
        if (distances.has(nextId)) continue;
        distances.set(nextId, distances.get(currentId) + 1);
        queue.push(nextId);
      }
    }
    return distances;
  }

  function shortestPath(architecture, startId, targetId) {
    if (startId === targetId) return [startId];
    const parents = new Map([[startId, null]]);
    const queue = [startId];
    while (queue.length) {
      const currentId = queue.shift();
      const current = architecture.spaces.find((space) => space.id === currentId);
      for (const nextId of current.connections.slice().sort(stableCompare)) {
        if (parents.has(nextId)) continue;
        parents.set(nextId, currentId);
        if (nextId === targetId) {
          const path = [targetId];
          let previousId = currentId;
          while (previousId) {
            path.unshift(previousId);
            previousId = parents.get(previousId);
          }
          return path;
        }
        queue.push(nextId);
      }
    }
    return [];
  }

  function eventId(generation, index, type) {
    return `g${String(generation).padStart(3, '0')}-event-${String(index).padStart(3, '0')}-${idPart(type)}`;
  }

  function addEvent(events, generation, type, avatarIds, spaceIds, description, ruleId, detail = {}) {
    const event = {
      id: eventId(generation, events.length + 1, type),
      avatarIds: [...new Set(avatarIds)].sort(stableCompare),
      spaceIds: [...new Set(spaceIds)].sort(stableCompare),
      type,
      description,
      ruleId,
      ...clone(detail)
    };
    events.push(event);
    return event;
  }

  function addChange(changes, entityId, property, previousValue, newValue, causeEventIds, ruleId) {
    if (previousValue === newValue) return null;
    const change = {
      entityId,
      property,
      previousValue,
      newValue,
      causeEventIds: [...new Set(causeEventIds)].sort(stableCompare),
      ruleId
    };
    changes.push(change);
    return change;
  }

  function avatarCompatibility(avatar, space) {
    const temperatureGap = Math.abs(space.temperature - avatar.environmentalPreferences.temperature);
    const lightGap = Math.abs(space.light - avatar.environmentalPreferences.light);
    const mismatch = (temperatureGap + lightGap) / 2;
    const toleratedMismatch = avatar.environmentalTolerance * 0.55;
    return {
      mismatch: round(mismatch),
      score: round(clamp(100 - Math.max(0, mismatch - toleratedMismatch) * 1.7, 0, 100)),
      temperatureGap,
      lightGap
    };
  }

  function chooseDestinations(state, events) {
    const architecture = state.architecture;
    const occupancy = Object.fromEntries(architecture.spaces.map((space) => [space.id, 0]));
    const distancesByAvatar = new Map();
    const assignments = [];
    const avatarEvents = new Map();

    for (const avatar of state.avatars.slice().sort((left, right) => stableCompare(left.id, right.id))) {
      const startId = architecture.spaces.some((space) => space.id === avatar.locationId)
        ? avatar.locationId
        : architecture.spaces.slice().sort((left, right) => stableCompare(left.id, right.id))[0].id;
      const distances = shortestDistances(architecture, startId);
      distancesByAvatar.set(avatar.id, distances);
      const mobilityRange = Math.max(1, Math.floor(avatar.mobility / 22));
      const candidates = architecture.spaces
        .filter((space) => distances.has(space.id) && distances.get(space.id) <= mobilityRange && occupancy[space.id] < space.occupancyCapacity)
        .map((space) => {
          const compatibility = avatarCompatibility(avatar, space);
          const resourceRatio = space.resourceCapacity ? space.availableResources / space.resourceCapacity : 0;
          const resourceFit = 100 - Math.max(0, avatar.resourceRequirements * (0.45 + avatar.resourceDependence / 125) - resourceRatio * 100);
          const travelCost = (distances.get(space.id) || 0) * (1.1 - avatar.mobility / 125);
          const score = compatibility.score * 0.58 + resourceFit * 0.42 - travelCost;
          return { space, score, compatibility, distance: distances.get(space.id) || 0 };
        })
        .sort((left, right) => right.score - left.score || stableCompare(left.space.id, right.space.id));
      const chosen = candidates[0];
      const interactions = [];
      if (!chosen) {
        const event = addEvent(events, state.generation + 1, 'capacity-exclusion', [avatar.id], [startId], `${avatar.name} could not occupy a reachable space because all reachable spaces were at capacity.`, 'movement.reachable-spaces', { fromSpaceId: startId });
        interactions.push(event.id);
        assignments.push({ avatarId: avatar.id, locationId: startId, reached: false, compatibility: avatarCompatibility(avatar, architecture.spaces.find((space) => space.id === startId)), resourceUse: 0, deficit: avatar.resourceRequirements });
      } else {
        occupancy[chosen.space.id] += 1;
        const moved = chosen.space.id !== startId;
        const pathSpaceIds = shortestPath(architecture, startId, chosen.space.id);
        const event = addEvent(events, state.generation + 1, moved ? 'movement' : 'occupation', [avatar.id], [startId, chosen.space.id], moved
          ? `${avatar.name} moved from ${startId} to ${chosen.space.id}; the route is ${chosen.distance} connection(s) and the selected space scored highest for environmental fit and available resources.`
          : `${avatar.name} remained in ${chosen.space.id}, the highest-scoring reachable space for environmental fit and available resources.`, 'movement.space-choice', {
          fromSpaceId: startId,
          toSpaceId: chosen.space.id,
          pathDistance: chosen.distance,
          pathSpaceIds,
          compatibility: chosen.compatibility
        });
        interactions.push(event.id);
        assignments.push({
          avatarId: avatar.id,
          locationId: chosen.space.id,
          reached: true,
          compatibility: chosen.compatibility,
          resourceUse: 0,
          deficit: 0
        });
      }
      avatarEvents.set(avatar.id, interactions);
    }

    return { assignments, occupancy, distancesByAvatar, avatarEvents };
  }

  function evaluateSocialInteractions(state, placements, events) {
    const encountersByAvatar = new Map(state.avatars.map((avatar) => [avatar.id, []]));
    const avatars = state.avatars.slice().sort((left, right) => stableCompare(left.id, right.id));
    for (let leftIndex = 0; leftIndex < avatars.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < avatars.length; rightIndex += 1) {
        const left = avatars[leftIndex];
        const right = avatars[rightIndex];
        const leftPlacement = placements.assignments.find((entry) => entry.avatarId === left.id);
        const rightPlacement = placements.assignments.find((entry) => entry.avatarId === right.id);
        if (!leftPlacement || !rightPlacement) continue;
        const sameSpace = leftPlacement.locationId === rightPlacement.locationId;
        const adjacent = state.architecture.spaces.find((space) => space.id === leftPlacement.locationId)?.connections.includes(rightPlacement.locationId);
        if (!sameSpace && !adjacent) continue;
        const event = addEvent(events, state.generation + 1, 'social-encounter', [left.id, right.id], [leftPlacement.locationId, rightPlacement.locationId],
          `${left.name} and ${right.name} encountered one another ${sameSpace ? 'in the same space' : 'across connected spaces'}; their collective behaviour contributed to shared spatial pressure.`,
          'social.co-location', { sameSpace: Boolean(sameSpace), coordination: round((left.collectiveBehaviour + right.collectiveBehaviour) / 2) });
        encountersByAvatar.get(left.id).push(event.id);
        encountersByAvatar.get(right.id).push(event.id);
      }
    }
    return encountersByAvatar;
  }

  function allocateResources(state, placements, events) {
    const architecture = clone(state.architecture);
    const usageByAvatar = new Map();
    const pressureBySpace = Object.fromEntries(architecture.spaces.map((space) => [space.id, { demand: 0, used: 0, eventIds: [] }]));

    for (const assignment of placements.assignments.slice().sort((left, right) => stableCompare(left.avatarId, right.avatarId))) {
      const avatar = state.avatars.find((item) => item.id === assignment.avatarId);
      const space = architecture.spaces.find((item) => item.id === assignment.locationId);
      const demand = round(avatar.resourceRequirements * (0.45 + avatar.resourceDependence / 125));
      const used = Math.min(space.availableResources, demand);
      const deficit = round(demand - used);
      space.availableResources = round(clamp(space.availableResources - used, 0, space.resourceCapacity));
      assignment.resourceUse = used;
      assignment.deficit = deficit;
      pressureBySpace[space.id].demand = round(pressureBySpace[space.id].demand + demand);
      pressureBySpace[space.id].used = round(pressureBySpace[space.id].used + used);

      const event = addEvent(events, state.generation + 1, deficit > 0 ? 'resource-shortage' : 'resource-consumption', [avatar.id], [space.id],
        deficit > 0
          ? `${avatar.name} required ${demand} resource units in ${space.id}, received ${used}, and experienced a shortfall of ${deficit}.`
          : `${avatar.name} consumed ${used} of ${demand} resource units in ${space.id}.`,
        'resources.consumption', { demand, used, deficit });
      pressureBySpace[space.id].eventIds.push(event.id);
      usageByAvatar.set(avatar.id, { demand, used, deficit, spaceId: space.id, eventId: event.id });
    }

    architecture.spaces.forEach((space) => {
      const refill = round(space.resourceCapacity * architecture.resourceAvailability / 100 * 0.16);
      space.availableResources = round(clamp(space.availableResources + refill, 0, space.resourceCapacity));
      if (refill > 0) {
        const event = addEvent(events, state.generation + 1, 'resource-replenishment', [], [space.id],
          `${space.id} received ${refill} resource units through the shared distribution infrastructure, subject to its capacity.`,
          'resources.capacity-distribution', { amount: refill, capacity: space.resourceCapacity });
        pressureBySpace[space.id].eventIds.push(event.id);
      }
    });
    return { architecture, usageByAvatar, pressureBySpace };
  }

  function calculateEnvironmentalEvents(state, placements, events) {
    const exposureByAvatar = new Map();
    for (const assignment of placements.assignments) {
      const avatar = state.avatars.find((item) => item.id === assignment.avatarId);
      const space = state.architecture.spaces.find((item) => item.id === assignment.locationId);
      const compatibility = avatarCompatibility(avatar, space);
      assignment.compatibility = compatibility;
      const event = addEvent(events, state.generation + 1, compatibility.mismatch > avatar.environmentalTolerance
        ? 'environmental-stress' : 'environmental-fit', [avatar.id], [space.id],
      `${avatar.name} experienced ${compatibility.mismatch > avatar.environmentalTolerance ? 'mismatch' : 'compatible conditions'} in ${space.id}: temperature ${space.temperature}, light ${space.light}, preference mismatch ${compatibility.mismatch}.`,
      'environment.compatibility', { mismatch: compatibility.mismatch, tolerance: avatar.environmentalTolerance, temperature: space.temperature, light: space.light, compatibilityScore: compatibility.score });
      exposureByAvatar.set(avatar.id, { spaceId: space.id, mismatch: compatibility.mismatch, temperature: space.temperature, light: space.light, eventId: event.id });
    }
    return exposureByAvatar;
  }

  function recordBoundaryContacts(state, placements, events) {
    const architecture = state.architecture;
    const boundaries = syncBoundaries(architecture);
    const boundaryIds = new Set(boundaries.map((boundary) => boundary.id));
    for (const assignment of placements.assignments.slice().sort((left, right) => stableCompare(left.avatarId, right.avatarId))) {
      const avatar = state.avatars.find((item) => item.id === assignment.avatarId);
      if (!avatar) continue;
      const movement = events.find((event) => event.type === 'movement' && event.avatarIds.includes(avatar.id));
      const path = movement?.pathSpaceIds || [];
      const pairs = [];
      for (let index = 0; index < path.length - 1; index += 1) pairs.push([path[index], path[index + 1]]);
      if (!pairs.length) {
        const space = architecture.spaces.find((item) => item.id === assignment.locationId);
        const neighbors = (space?.connections || []).slice().sort(stableCompare);
        if (neighbors.length) {
          const index = Number.parseInt(hashText(`${avatar.visual.seed}:${state.generation + 1}:${space.id}`), 36) % neighbors.length;
          pairs.push([space.id, neighbors[index]]);
        }
      }
      const uniquePairs = new Map(pairs.map((pair) => {
        const ids = pair.slice().sort(stableCompare);
        const boundary = createBoundary(ids[0], ids[1]);
        return [boundary.id, { boundary, ids }];
      }));
      uniquePairs.forEach(({ boundary, ids }) => {
        if (!boundaryIds.has(boundary.id)) return;
        const segmentIndex = Number.parseInt(hashText(`${avatar.id}:${boundary.id}`), 36) % 5;
        const location = round((segmentIndex + .5) / 5, 2);
        addEvent(events, state.generation + 1, 'boundary-contact', [avatar.id], ids,
          `${avatar.name} contacted a localized point on the shared boundary between ${ids.join(' and ')}.`,
          'architecture.boundary-adaptation', {
            boundaryId: boundary.id,
            segmentIndex,
            contactLocation: location,
            traitChanges: []
          });
      });
    }
    return boundaries;
  }

  function transformArchitecture(state, interactions, placements, social, resources, exposures, events) {
    const output = clone(resources.architecture);
    const changes = [];
    const modifications = [];
    const architecture = state.architecture;
    output.boundaries = syncBoundaries(output);
    const previousBoundaries = clone(output.boundaries);
    output.spaces.forEach((space) => {
      const previous = architecture.spaces.find((item) => item.id === space.id).availableResources;
      const relatedEvents = resources.pressureBySpace[space.id].eventIds;
      addChange(changes, space.id, 'availableResources', previous, space.availableResources, relatedEvents, 'resources.consumption');
    });
    const budget = round(architecture.adaptability * architecture.resourceAvailability / 100);
    let remainingBudget = budget;
    const allAvatarEvents = (ids) => ids.flatMap((id) => interactions.avatarEvents.get(id) || []);

    const blockedEvents = events.filter((event) => event.type === 'capacity-exclusion');
    const influenceBySpace = new Map(output.spaces.map((space) => [space.id, 0]));
    placements.assignments.forEach((assignment) => {
      const avatar = state.avatars.find((item) => item.id === assignment.avatarId);
      influenceBySpace.set(assignment.locationId, influenceBySpace.get(assignment.locationId) + avatar.spatialInfluence * (0.5 + avatar.collectiveBehaviour / 200));
    });

    if (remainingBudget >= 12 && (blockedEvents.length || architecture.connectivity < architecture.connectivitySetting)) {
      const pairs = [];
      for (let leftIndex = 0; leftIndex < output.spaces.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < output.spaces.length; rightIndex += 1) {
          const left = output.spaces[leftIndex];
          const right = output.spaces[rightIndex];
          if (left.connections.includes(right.id)) continue;
          const distance = Math.hypot(left.x - right.x, left.y - right.y);
          const pressure = influenceBySpace.get(left.id) + influenceBySpace.get(right.id);
          const blockedPressure = blockedEvents.some((event) => event.spaceIds.includes(left.id) || event.spaceIds.includes(right.id)) ? 100 : 0;
          pairs.push({ left, right, score: pressure + blockedPressure - distance * 0.3 });
        }
      }
      pairs.sort((left, right) => right.score - left.score || stableCompare(left.left.id, right.left.id) || stableCompare(left.right.id, right.right.id));
      const pair = pairs[0];
      if (pair && pair.score > 65) {
        const causeEvents = events.filter((event) => event.spaceIds.includes(pair.left.id) || event.spaceIds.includes(pair.right.id));
        const event = addEvent(events, state.generation + 1, 'architectural-pressure', causeEvents.flatMap((item) => item.avatarIds), [pair.left.id, pair.right.id],
          `Spatial pressure between ${pair.left.id} and ${pair.right.id} exceeded the connection threshold; available architectural capacity was considered for a new route.`,
          'architecture.connectivity-response', { pressure: round(pair.score), cost: 12, triggeredBy: causeEvents.map((item) => item.id) });
        if (remainingBudget >= 12) {
          const leftOutput = output.spaces.find((space) => space.id === pair.left.id);
          const rightOutput = output.spaces.find((space) => space.id === pair.right.id);
          const previousLeftConnections = leftOutput.connections.join(',');
          const previousRightConnections = rightOutput.connections.join(',');
          leftOutput.connections.push(rightOutput.id);
          rightOutput.connections.push(leftOutput.id);
          leftOutput.connections.sort(stableCompare);
          rightOutput.connections.sort(stableCompare);
          remainingBudget -= 12;
          addChange(changes, leftOutput.id, 'connections', previousLeftConnections, leftOutput.connections.join(','), [event.id], 'architecture.connectivity-response');
          addChange(changes, rightOutput.id, 'connections', previousRightConnections, rightOutput.connections.join(','), [event.id], 'architecture.connectivity-response');
          modifications.push({ eventId: event.id, ruleId: event.ruleId, cost: 12, description: `Added a reciprocal connection between ${leftOutput.id} and ${rightOutput.id}.` });
        }
      }
    }

    const occupied = output.spaces
      .map((space) => ({ space, pressure: resources.pressureBySpace[space.id] }))
      .filter(({ pressure }) => pressure.demand > 0)
      .sort((left, right) => right.pressure.demand - left.pressure.demand || stableCompare(left.space.id, right.space.id));
    const unoccupied = output.spaces
      .filter((space) => !resources.pressureBySpace[space.id].demand)
      .sort((left, right) => right.availableResources - left.availableResources || stableCompare(left.id, right.id));

    if (remainingBudget >= 6 && occupied.length && unoccupied.length) {
      const receiver = occupied[0];
      const donor = unoccupied[0];
      const transferable = Math.min(8, donor.availableResources, Math.max(0, receiver.space.resourceCapacity - receiver.space.availableResources));
      if (transferable >= 1) {
        const event = addEvent(events, state.generation + 1, 'resource-pressure', events.filter((item) => item.spaceIds.includes(receiver.space.id)).flatMap((item) => item.avatarIds), [receiver.space.id, donor.id],
          `Demand in ${receiver.space.id} exceeded local use while ${donor.id} remained unoccupied; the distribution network considered a bounded transfer.`,
          'architecture.resource-redistribution', { amount: transferable, fromSpaceId: donor.id, toSpaceId: receiver.space.id, triggeredBy: resources.pressureBySpace[receiver.space.id].eventIds });
        receiver.space.availableResources = round(receiver.space.availableResources + transferable);
        donor.availableResources = round(donor.availableResources - transferable);
        remainingBudget -= 6;
        addChange(changes, receiver.space.id, 'availableResources', resources.architecture.spaces.find((space) => space.id === receiver.space.id).availableResources, receiver.space.availableResources, [event.id], event.ruleId);
        addChange(changes, donor.id, 'availableResources', resources.architecture.spaces.find((space) => space.id === donor.id).availableResources, donor.availableResources, [event.id], event.ruleId);
        modifications.push({ eventId: event.id, ruleId: event.ruleId, cost: 6, description: `Transferred ${transferable} resource units from ${donor.id} to ${receiver.space.id}.` });
      }
    }

    if (remainingBudget >= 8) {
      const exposureList = [...exposures.values()];
      const candidates = output.spaces.map((space) => ({
        space,
        inputSpace: architecture.spaces.find((item) => item.id === space.id),
        pressure: exposureList.filter((exposure) => exposure.spaceId === space.id).reduce((sum, exposure) => sum + exposure.mismatch, 0)
      })).filter((item) => item.pressure > 35)
        .sort((left, right) => right.pressure - left.pressure || stableCompare(left.space.id, right.space.id));
      const candidate = candidates[0];
      if (candidate) {
        const avatarIds = placements.assignments.filter((entry) => entry.locationId === candidate.space.id).map((entry) => entry.avatarId);
        const causeEvents = events.filter((event) => event.spaceIds.includes(candidate.space.id) && event.type === 'environmental-stress');
        const lightAverage = avatarIds.length
          ? avatarIds.reduce((sum, id) => sum + state.avatars.find((avatar) => avatar.id === id).environmentalPreferences.light, 0) / avatarIds.length
          : candidate.space.light;
        const target = round(candidate.space.light + clamp((lightAverage - candidate.space.light) * candidate.space.adaptability / 250, -8, 8));
        const event = addEvent(events, state.generation + 1, 'environmental-pressure', avatarIds, [candidate.space.id],
          `Repeated environmental mismatch in ${candidate.space.id} created pressure to alter light toward the occupants’ average preference.`,
          'architecture.environmental-response', { previousLight: candidate.space.light, targetLight: target, mismatch: round(candidate.pressure), triggeredBy: causeEvents.map((item) => item.id) });
        if (target !== candidate.space.light) {
          const previous = candidate.space.light;
          candidate.space.light = target;
          remainingBudget -= 8;
          addChange(changes, candidate.space.id, 'light', previous, target, [event.id], event.ruleId);
          modifications.push({ eventId: event.id, ruleId: event.ruleId, cost: 8, description: `Adjusted light in ${candidate.space.id} from ${previous} to ${target}.` });
        }
      }
    }

    const pressureSpace = occupied.find(({ space }) => space.occupancyCapacity < 6 && influenceBySpace.get(space.id) >= 70);
    if (remainingBudget >= 10 && pressureSpace && pressureSpace.pressure.demand > pressureSpace.space.resourceCapacity * 0.25) {
      const outputSpace = output.spaces.find((space) => space.id === pressureSpace.space.id);
      const previous = outputSpace.occupancyCapacity;
      const event = addEvent(events, state.generation + 1, 'occupancy-pressure', events.filter((item) => item.spaceIds.includes(outputSpace.id)).flatMap((item) => item.avatarIds), [outputSpace.id],
        `Collective spatial influence in ${outputSpace.id} pressed against its capacity and resource thresholds.`,
        'architecture.capacity-response', { previousCapacity: previous, newCapacity: previous + 1, triggeredBy: pressureSpace.pressure.eventIds });
      outputSpace.occupancyCapacity = previous + 1;
      outputSpace.width = round(outputSpace.width + 1);
      remainingBudget -= 10;
      addChange(changes, outputSpace.id, 'occupancyCapacity', previous, outputSpace.occupancyCapacity, [event.id], event.ruleId);
      addChange(changes, outputSpace.id, 'width', pressureSpace.space.width, outputSpace.width, [event.id], event.ruleId);
      modifications.push({ eventId: event.id, ruleId: event.ruleId, cost: 10, description: `Expanded ${outputSpace.id} and added one occupancy place.` });
    }

    const occupantsBySpace = new Map(output.spaces.map((space) => [space.id, []]));
    placements.assignments.forEach((assignment) => occupantsBySpace.get(assignment.locationId)?.push(state.avatars.find((avatar) => avatar.id === assignment.avatarId)));
    const movementBySpace = new Map(output.spaces.map((space) => [space.id, { x: 0, y: 0, eventIds: [] }]));
    events.filter((event) => event.type === 'movement' && event.pathSpaceIds?.length > 1).forEach((event) => {
      const avatar = state.avatars.find((item) => item.id === event.avatarIds[0]);
      if (!avatar) return;
      for (let index = 0; index < event.pathSpaceIds.length - 1; index += 1) {
        const from = output.spaces.find((space) => space.id === event.pathSpaceIds[index]);
        const to = output.spaces.find((space) => space.id === event.pathSpaceIds[index + 1]);
        if (!from || !to) continue;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.hypot(dx, dy) || 1;
        const pull = 0.45 + avatar.spatialInfluence / 100 * 0.8 + avatar.mobility / 100 * 0.5;
        const fromShift = movementBySpace.get(from.id);
        const toShift = movementBySpace.get(to.id);
        fromShift.x += dx / distance * pull;
        fromShift.y += dy / distance * pull;
        toShift.x -= dx / distance * pull;
        toShift.y -= dy / distance * pull;
        fromShift.eventIds.push(event.id);
        toShift.eventIds.push(event.id);
      }
    });

    output.spaces.forEach((space) => {
      const occupantsHere = occupantsBySpace.get(space.id).filter(Boolean);
      const previousSpace = architecture.spaces.find((item) => item.id === space.id);
      const causeEventIds = events.filter((event) => event.spaceIds.includes(space.id) && event.avatarIds.length).map((event) => event.id);
      if (occupantsHere.length) {
        const previousUseCount = previousSpace.useCount || 0;
        const previousLastUsed = previousSpace.lastUsedGeneration || 0;
        space.useCount = previousUseCount + occupantsHere.length;
        space.lastUsedGeneration = state.generation + 1;
        addChange(changes, space.id, 'useCount', previousUseCount, space.useCount, causeEventIds, 'architecture.spatial-reconfiguration');
        addChange(changes, space.id, 'lastUsedGeneration', previousLastUsed, space.lastUsedGeneration, causeEventIds, 'architecture.spatial-reconfiguration');

        const average = (key) => occupantsHere.reduce((sum, avatar) => sum + avatar[key], 0) / occupantsHere.length;
        const form = average('collectiveBehaviour') >= 62 && occupantsHere.length > 1
          ? 'clustered'
          : average('mobility') >= 65
            ? 'elongated'
            : average('resourceDependence') >= 68 || average('resourceRequirements') >= 72
              ? 'serviced'
              : average('environmentalTolerance') < 35
                ? 'sheltered'
                : 'rectilinear';
        addChange(changes, space.id, 'planForm', previousSpace.planForm || 'rectilinear', form, causeEventIds, 'architecture.spatial-reconfiguration');
        space.planForm = form;

        const pressure = resources.pressureBySpace[space.id];
        const influence = occupantsHere.reduce((sum, avatar) => sum + avatar.spatialInfluence, 0) / occupantsHere.length;
        const resourcePressure = pressure.demand >= space.resourceCapacity * 0.3;
        if (remainingBudget >= 6 && influence >= 55 && (resourcePressure || space.useCount >= 4)) {
          const dimension = average('mobility') + average('collectiveBehaviour') >= average('resourceDependence') + average('resourceRequirements')
            ? 'width'
            : 'height';
          const maximum = dimension === 'width' ? 26 : 20;
          if (space[dimension] < maximum) {
            const previous = space[dimension];
            space[dimension] = Math.min(maximum, previous + (resourcePressure ? 2 : 1));
            remainingBudget -= 6;
            addChange(changes, space.id, dimension, previous, space[dimension], causeEventIds, 'architecture.spatial-reconfiguration');
            modifications.push({ eventId: causeEventIds[0], ruleId: 'architecture.spatial-reconfiguration', cost: 6, description: `Expanded the ${dimension} of ${space.name} in response to shared use and demand.` });
          }
        }

        const averageDependence = average('resourceDependence');
        if (averageDependence >= 65 && resourcePressure && (space.serviceDensity || 0) < 6) {
          const previous = space.serviceDensity || 0;
          space.serviceDensity = previous + 1;
          addChange(changes, space.id, 'serviceDensity', previous, space.serviceDensity, causeEventIds, 'architecture.spatial-reconfiguration');
        }
      }

      const shift = movementBySpace.get(space.id);
      if (remainingBudget >= 4 && shift.eventIds.length) {
        const nextX = round(clamp(space.x + shift.x, Math.max(8, space.width / 2 + 3), Math.min(92, 97 - space.width / 2)));
        const nextY = round(clamp(space.y + shift.y, Math.max(8, space.height / 2 + 5), Math.min(92, 95 - space.height / 2)));
        if (nextX !== space.x || nextY !== space.y) {
          space.x = nextX;
          space.y = nextY;
          remainingBudget -= 4;
        }
      }
    });

    if (remainingBudget >= 6) {
      const dormant = output.spaces
        .filter((space) => !occupantsBySpace.get(space.id).length && state.generation + 1 - (space.lastUsedGeneration || 0) >= 2)
        .filter((space) => space.width > 10 || space.height > 9)
        .sort((left, right) => (left.lastUsedGeneration || 0) - (right.lastUsedGeneration || 0) || stableCompare(left.id, right.id))[0];
      if (dormant) {
        const causeEvents = events.filter((event) => event.spaceIds.includes(dormant.id));
        const event = addEvent(events, state.generation + 1, 'spatial-erosion', [], [dormant.id],
          `${dormant.name} had no occupants this generation and its unused edge began to recede.`,
          'architecture.spatial-reconfiguration', { lastUsedGeneration: dormant.lastUsedGeneration || 0 });
        const dimension = dormant.width > 10 ? 'width' : 'height';
        const previous = dormant[dimension];
        dormant[dimension] = Math.max(8, dormant[dimension] - 2);
        remainingBudget -= 6;
        addChange(changes, dormant.id, dimension, previous, dormant[dimension], [event.id, ...causeEvents.map((item) => item.id)], 'architecture.spatial-reconfiguration');
        if ((dormant.serviceDensity || 0) > 0) {
          const previousServices = dormant.serviceDensity;
          dormant.serviceDensity -= 1;
          addChange(changes, dormant.id, 'serviceDensity', previousServices, dormant.serviceDensity, [event.id], 'architecture.spatial-reconfiguration');
        }
        modifications.push({ eventId: event.id, ruleId: event.ruleId, cost: 6, description: `Reduced the ${dimension} of unused room ${dormant.name}.` });
      }
    }

    let formedSpace = false;
    if (remainingBudget >= 8 && output.spaces.length < 12) {
      const formationCandidate = output.spaces
        .map((space) => ({
          space,
          occupants: occupantsBySpace.get(space.id).filter(Boolean),
          demand: resources.pressureBySpace[space.id].demand
        }))
        .filter((candidate) => candidate.occupants.length > 1
          && candidate.demand >= candidate.space.resourceCapacity * 0.3
          && candidate.occupants.reduce((sum, avatar) => sum + avatar.spatialInfluence, 0) / candidate.occupants.length >= 60)
        .sort((left, right) => right.demand - left.demand || stableCompare(left.space.id, right.space.id))[0];
      if (formationCandidate) {
        const host = formationCandidate.space;
        const occupantsHere = formationCandidate.occupants;
        const causes = events.filter((event) => event.spaceIds.includes(host.id) && event.avatarIds.some((id) => occupantsHere.some((avatar) => avatar.id === id)));
        const event = addEvent(events, state.generation + 1, 'spatial-formation', occupantsHere.map((avatar) => avatar.id), [host.id],
          `Shared use and spatial pressure around ${host.name} generated a new adjoining room.`,
          'architecture.space-formation', { hostSpaceId: host.id, cost: 8, triggeredBy: causes.map((item) => item.id) });
        const directions = [[20, 0], [-20, 0], [0, 18], [0, -18], [15, 13], [-15, 13], [15, -13], [-15, -13]];
        const position = directions
          .map(([dx, dy]) => ({ x: clamp(host.x + dx, 12, 88), y: clamp(host.y + dy, 10, 90) }))
          .sort((left, right) => {
            const clearance = (point) => Math.min(...output.spaces.map((space) => Math.hypot(point.x - space.x, point.y - space.y)));
            return clearance(right) - clearance(left);
          })[0];
        const index = output.spaces.length + 1;
        const newSpace = {
          id: `space-g${String(state.generation + 1).padStart(3, '0')}-${String(index).padStart(2, '0')}`,
          name: ['Shared chamber', 'Exchange room', 'Habitat annex', 'Sheltered niche'][state.generation % 4],
          x: round(position.x),
          y: round(position.y),
          width: 12,
          height: 10,
          planForm: host.planForm || 'clustered',
          serviceDensity: 1,
          useCount: 0,
          lastUsedGeneration: state.generation + 1,
          temperature: round(occupantsHere.reduce((sum, avatar) => sum + avatar.environmentalPreferences.temperature, 0) / occupantsHere.length),
          light: round(occupantsHere.reduce((sum, avatar) => sum + avatar.environmentalPreferences.light, 0) / occupantsHere.length),
          resourceCapacity: Math.max(24, Math.round(host.resourceCapacity * 0.55)),
          availableResources: Math.max(0, Math.round(host.availableResources * 0.35)),
          occupancyCapacity: 2,
          adaptability: host.adaptability,
          modificationCost: 8,
          connections: [host.id],
          specialisation: 'shared',
          transformationHistory: []
        };
        host.connections.push(newSpace.id);
        host.connections.sort(stableCompare);
        output.spaces.push(newSpace);
        remainingBudget -= 8;
        formedSpace = true;
        const previousIds = architecture.spaces.map((space) => space.id);
        const newIds = output.spaces.map((space) => space.id);
        addChange(changes, 'architecture', 'spaces', previousIds, newIds, [event.id], event.ruleId);
        addChange(changes, host.id, 'connections', architecture.spaces.find((space) => space.id === host.id).connections.join(','), host.connections.join(','), [event.id], event.ruleId);
        modifications.push({ eventId: event.id, ruleId: event.ruleId, cost: 8, description: `Formed ${newSpace.name} beside ${host.name} in response to shared demand.` });
      }
    }

    if (!formedSpace && remainingBudget >= 8 && output.spaces.length > 8) {
      const retired = output.spaces
        .filter((space) => !occupantsBySpace.has(space.id) || occupantsBySpace.get(space.id).length === 0)
        .filter((space) => state.generation + 1 - (space.lastUsedGeneration || 0) >= 3 && space.connections.length === 1)
        .sort((left, right) => (left.lastUsedGeneration || 0) - (right.lastUsedGeneration || 0) || stableCompare(left.id, right.id))[0];
      if (retired) {
        const neighbor = output.spaces.find((space) => space.id === retired.connections[0]);
        const event = addEvent(events, state.generation + 1, 'spatial-retirement', [], [retired.id, neighbor.id],
          `${retired.name} had remained unused and peripheral; the plan absorbed it and closed its connection to ${neighbor.name}.`,
          'architecture.space-retirement', { retiredSpaceId: retired.id, neighborSpaceId: neighbor.id });
        const previousIds = architecture.spaces.map((space) => space.id);
        neighbor.connections = neighbor.connections.filter((id) => id !== retired.id);
        output.spaces = output.spaces.filter((space) => space.id !== retired.id);
        remainingBudget -= 8;
        addChange(changes, 'architecture', 'spaces', previousIds, output.spaces.map((space) => space.id), [event.id], event.ruleId);
        addChange(changes, neighbor.id, 'connections', architecture.spaces.find((space) => space.id === neighbor.id).connections.join(','), neighbor.connections.join(','), [event.id], event.ruleId);
        modifications.push({ eventId: event.id, ruleId: event.ruleId, cost: 8, description: `Absorbed the unused peripheral room ${retired.name}.` });
      }
    }

    const positionBeforeResolution = new Map(output.spaces.map((space) => [space.id, { x: space.x, y: space.y }]));
    const positionCauses = new Map(output.spaces.map((space) => [space.id, new Set(movementBySpace.get(space.id)?.eventIds || [])]));
    for (let pass = 0; pass < 8; pass += 1) {
      for (let leftIndex = 0; leftIndex < output.spaces.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < output.spaces.length; rightIndex += 1) {
          const left = output.spaces[leftIndex];
          const right = output.spaces[rightIndex];
          const dx = right.x - left.x;
          const dy = right.y - left.y;
          const overlapX = (left.width + right.width) * .36 + 1 - Math.abs(dx);
          const overlapY = Math.max(4.5, left.height * .38) + Math.max(4.5, right.height * .38) + 1 - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          const relatedEvents = events.filter((event) => event.avatarIds.length && (event.spaceIds.includes(left.id) || event.spaceIds.includes(right.id)));
          if (!relatedEvents.length) {
            const event = addEvent(events, state.generation + 1, 'spatial-adjustment', [], [left.id, right.id],
              `The changing room outlines around ${left.name} and ${right.name} required space to remain distinct in the plan.`,
              'architecture.spatial-reconfiguration');
            positionCauses.get(left.id).add(event.id);
            positionCauses.get(right.id).add(event.id);
          } else {
            relatedEvents.forEach((event) => {
              positionCauses.get(left.id).add(event.id);
              positionCauses.get(right.id).add(event.id);
            });
          }
          const moveX = overlapX < overlapY;
          const direction = moveX ? (dx || (stableCompare(left.id, right.id) < 0 ? 1 : -1)) : (dy || (stableCompare(left.id, right.id) < 0 ? 1 : -1));
          const separation = Math.min(4, (moveX ? overlapX : overlapY) / 2 + .5);
          if (moveX) {
            left.x = clamp(left.x - Math.sign(direction) * separation, Math.max(8, left.width / 2 + 3), Math.min(92, 97 - left.width / 2));
            right.x = clamp(right.x + Math.sign(direction) * separation, Math.max(8, right.width / 2 + 3), Math.min(92, 97 - right.width / 2));
          } else {
            left.y = clamp(left.y - Math.sign(direction) * separation, Math.max(8, left.height / 2 + 5), Math.min(92, 95 - left.height / 2));
            right.y = clamp(right.y + Math.sign(direction) * separation, Math.max(8, right.height / 2 + 5), Math.min(92, 95 - right.height / 2));
          }
        }
      }
    }
    output.spaces.forEach((space) => {
      space.x = round(space.x);
      space.y = round(space.y);
      const previous = architecture.spaces.find((item) => item.id === space.id) || positionBeforeResolution.get(space.id);
      if (!previous) return;
      const causeEventIds = [...positionCauses.get(space.id)];
      if (space.x !== previous.x) addChange(changes, space.id, 'x', previous.x, round(space.x), causeEventIds, 'architecture.spatial-reconfiguration');
      if (space.y !== previous.y) addChange(changes, space.id, 'y', previous.y, round(space.y), causeEventIds, 'architecture.spatial-reconfiguration');
    });

    output.boundaries = syncBoundaries(output);
    const boundaryChangeEvents = [];
    events.filter((event) => event.type === 'boundary-contact').forEach((event) => {
      const boundary = output.boundaries.find((item) => item.id === event.boundaryId);
      const segment = boundary?.segments[event.segmentIndex];
      const avatar = state.avatars.find((item) => item.id === event.avatarIds[0]);
      if (!boundary || !segment || !avatar) return;
      segment.contactCount += 1;
      boundary.useCount += 1;
      boundary.lastContactGeneration = state.generation + 1;
      boundaryChangeEvents.push(event.id);
      const response = (.018 + avatar.adaptability / 100 * .065) * (avatar.spatialInfluence / 100);
      event.traitChanges = [];
      VISUAL_TRAITS.forEach((trait) => {
        const previousValue = segment.traits[trait];
        const sourceValue = avatar.visualTraits[trait];
        const delta = (sourceValue - previousValue) * response;
        if (Math.abs(delta) < .35) return;
        const newValue = round(clamp(previousValue + delta, 0, 100), 2);
        if (newValue === previousValue) return;
        segment.traits[trait] = newValue;
        event.traitChanges.push({ trait, previousValue, newValue });
        segment.sources.push({
          avatarId: avatar.id,
          avatarName: avatar.name,
          hue: Number(avatar.visual.paletteHue || 0),
          trait,
          strength: round(Math.abs(newValue - previousValue), 2),
          generation: state.generation + 1,
          eventId: event.id,
          carriedFrom: (avatar.visualTraitProvenance?.[trait] || []).slice(-3)
        });
      });
      if (event.traitChanges.length) {
        segment.sources = segment.sources.slice(-40);
        event.description = `${avatar.name} contacted a localized point on the shared boundary between ${boundary.spaceIds.join(' and ')}; ${event.traitChanges.length} visual trait${event.traitChanges.length === 1 ? '' : 's'} began to accumulate there.`;
      } else {
        event.description = `${avatar.name} contacted a localized point on the shared boundary between ${boundary.spaceIds.join(' and ')}; its recorded surface traits held steady.`;
      }
    });
    if (JSON.stringify(previousBoundaries) !== JSON.stringify(output.boundaries)) {
      addChange(changes, 'architecture', 'boundaries', previousBoundaries, clone(output.boundaries), boundaryChangeEvents, 'architecture.boundary-adaptation');
    }

    output.generation = state.generation + 1;
    output.spaces.forEach((space) => {
      space.transformationHistory = [...space.transformationHistory, ...changes.filter((change) => change.entityId === space.id).map((change) => ({
        generation: state.generation + 1,
        property: change.property,
        previousValue: change.previousValue,
        newValue: change.newValue,
        ruleId: change.ruleId
      }))];
    });
    const previousConnectivity = architecture.connectivity;
    output.connectivity = round(output.spaces.reduce((sum, space) => sum + space.connections.length, 0) / Math.max(1, output.spaces.length * (output.spaces.length - 1)) * 100);
    const connectionEvents = changes.filter((change) => ['connections', 'spaces'].includes(change.property)).flatMap((change) => change.causeEventIds);
    addChange(changes, 'architecture', 'connectivity', previousConnectivity, output.connectivity, connectionEvents, 'architecture.connectivity-response');
    output.transformationHistory = [
      ...output.transformationHistory,
      ...modifications.map((modification) => ({ generation: state.generation + 1, ...modification })),
      ...changes.filter((change) => change.entityId === 'architecture').map((change) => ({
        generation: state.generation + 1,
        property: change.property,
        previousValue: change.previousValue,
        newValue: change.newValue,
        ruleId: change.ruleId,
        causeEventIds: change.causeEventIds
      }))
    ];
    return { architecture: output, changes, modifications, remainingBudget };
  }

  function transformAvatars(state, placements, social, resources, exposures, events) {
    const changes = [];
    const outputAvatars = state.avatars
      .slice()
      .sort((left, right) => stableCompare(left.id, right.id))
      .map((source) => {
        const avatar = clone(source);
        const assignment = placements.assignments.find((item) => item.avatarId === avatar.id);
        const exposure = exposures.get(avatar.id);
        const usage = resources.usageByAvatar.get(avatar.id);
        const encounters = social.get(avatar.id) || [];
        const cause = (type) => events.filter((event) => event.avatarIds.includes(avatar.id) && event.type === type).map((event) => event.id);
        const before = clone(avatar);
        const rate = Math.round(avatar.adaptability / 20);
        const personalChanges = [];

        if (exposure && exposure.mismatch > avatar.environmentalTolerance * 0.45) {
          const delta = Math.min(rate, Math.ceil((exposure.mismatch - avatar.environmentalTolerance * 0.45) / 18));
          const next = clamp(avatar.environmentalTolerance + delta, 0, 100);
          const change = addChange(changes, avatar.id, 'environmentalTolerance', avatar.environmentalTolerance, next, [exposure.eventId], 'avatar.environmental-acclimation');
          if (change) personalChanges.push(change);
          avatar.environmentalTolerance = next;
          const experiencedPreference = exposure.light;
          const preferenceDelta = clamp(experiencedPreference - avatar.environmentalPreferences.light, -rate, rate);
          avatar.environmentalPreferences.light = clamp(avatar.environmentalPreferences.light + preferenceDelta, 0, 100);
          const preferenceChange = addChange(changes, avatar.id, 'environmentalPreferences.light', before.environmentalPreferences.light, avatar.environmentalPreferences.light, [exposure.eventId], 'avatar.environmental-acclimation');
          if (preferenceChange) personalChanges.push(preferenceChange);
        }

        if (usage?.deficit > 0) {
          const delta = rate ? Math.min(rate + 1, Math.max(1, Math.ceil(usage.deficit / 8))) : 0;
          avatar.resourceDependence = clamp(avatar.resourceDependence + delta, 0, 100);
          const change = addChange(changes, avatar.id, 'resourceDependence', before.resourceDependence, avatar.resourceDependence, [usage.eventId], 'avatar.infrastructure-dependence');
          if (change) personalChanges.push(change);
        } else if (usage?.demand > 0 && usage.deficit === 0 && usage.used >= usage.demand) {
          const delta = rate ? Math.max(1, Math.floor(rate / 2)) : 0;
          avatar.resourceDependence = clamp(avatar.resourceDependence - delta, 0, 100);
          const change = addChange(changes, avatar.id, 'resourceDependence', before.resourceDependence, avatar.resourceDependence, [usage.eventId], 'avatar.infrastructure-dependence');
          if (change) personalChanges.push(change);
        }

        const isolated = encounters.length === 0;
        if (isolated) {
          const isolationEvents = events.filter((event) => event.avatarIds.includes(avatar.id) && ['movement', 'occupation'].includes(event.type));
          if (isolationEvents.length && rate) {
            avatar.collectiveBehaviour = clamp(avatar.collectiveBehaviour - rate, 0, 100);
            const change = addChange(changes, avatar.id, 'collectiveBehaviour', before.collectiveBehaviour, avatar.collectiveBehaviour, isolationEvents.map((event) => event.id), 'avatar.social-isolation');
            if (change) personalChanges.push(change);
          }
        } else {
          const coordinatedStrength = encounters.reduce((sum, eventIdValue) => {
            const event = events.find((item) => item.id === eventIdValue);
            return sum + (event?.detail?.coordination || event?.coordination || 0);
          }, 0) / encounters.length;
          const delta = coordinatedStrength >= 35 ? rate : 0;
          if (delta) {
            avatar.collectiveBehaviour = clamp(avatar.collectiveBehaviour + delta, 0, 100);
            const change = addChange(changes, avatar.id, 'collectiveBehaviour', before.collectiveBehaviour, avatar.collectiveBehaviour, encounters, 'social.co-location');
            if (change) personalChanges.push(change);
          }
        }

        const blocked = events.filter((event) => event.avatarIds.includes(avatar.id) && event.type === 'capacity-exclusion');
        if (blocked.length) {
          const delta = rate ? Math.max(1, Math.round(rate / 2)) : 0;
          avatar.mobility = clamp(avatar.mobility - delta, 0, 100);
          const change = addChange(changes, avatar.id, 'mobility', before.mobility, avatar.mobility, blocked.map((event) => event.id), 'avatar.mobility-barrier');
          if (change) personalChanges.push(change);
        }

        if (exposure && exposure.mismatch > avatar.environmentalTolerance) {
          const vulnerability = Math.min(rate, 2);
          avatar.mobility = clamp(avatar.mobility - vulnerability, 0, 100);
          const change = addChange(changes, avatar.id, 'mobility', before.mobility, avatar.mobility, cause('environmental-stress'), 'avatar.specialization-tradeoff');
          if (change) personalChanges.push(change);
        }

        const boundaryContacts = events.filter((event) => event.type === 'boundary-contact' && event.avatarIds.includes(avatar.id));
        if (boundaryContacts.length && avatar.adaptability > 0) {
          const provenance = clone(avatar.visualTraitProvenance || {});
          VISUAL_TRAITS.forEach((trait) => {
            const encountered = boundaryContacts.map((event) => {
              const boundary = state.architecture.boundaries?.find((item) => item.id === event.boundaryId);
              return { event, segment: boundary?.segments[event.segmentIndex] };
            }).filter((item) => item.segment);
            if (!encountered.length) return;
            const sourcedByOthers = encountered.filter(({ segment }) => segment.sources.some((source) => source.trait === trait && source.avatarId !== avatar.id));
            const records = sourcedByOthers.length ? sourcedByOthers : encountered;
            const roomTrait = records.reduce((sum, item) => sum + item.segment.traits[trait], 0) / records.length;
            const previousValue = avatar.visualTraits[trait];
            const difference = roomTrait - previousValue;
            if (difference < 1) return;
            const response = avatar.adaptability / 100 * .075;
            const newValue = round(clamp(previousValue + difference * response, 0, 100), 2);
            if (newValue === previousValue) return;
            avatar.visualTraits[trait] = newValue;
            const origins = records.flatMap(({ segment }) => segment.sources
              .filter((source) => source.trait === trait)
              .slice(-3)
              .map((source) => ({
                avatarId: source.avatarId,
                eventId: source.eventId,
                generation: source.generation,
                carriedFrom: source.carriedFrom || []
              })));
            const contact = records[0].event;
            const record = {
              generation: state.generation + 1,
              boundaryId: contact.boundaryId,
              spaceIds: contact.spaceIds,
              eventId: contact.id,
              value: newValue,
              inheritedFrom: origins
            };
            provenance[trait] = [...(provenance[trait] || []), record].slice(-30);
          });
          avatar.visualTraitProvenance = provenance;
          const visualChange = JSON.stringify(before.visualTraits) === JSON.stringify(avatar.visualTraits)
            ? null
            : addChange(changes, avatar.id, 'visualTraits', clone(before.visualTraits), clone(avatar.visualTraits), boundaryContacts.map((event) => event.id), 'avatar.architectural-imprint');
          if (visualChange) personalChanges.push(visualChange);
        }

        avatar.locationId = assignment ? assignment.locationId : avatar.locationId;
        avatar.interactionHistory = [...avatar.interactionHistory, ...events.filter((event) => event.avatarIds.includes(avatar.id)).map((event) => event.id)];
        avatar.generationHistory = [...avatar.generationHistory, {
          generation: state.generation + 1,
          locationId: avatar.locationId,
          changes: personalChanges.map((change) => ({ property: change.property, previousValue: change.previousValue, newValue: change.newValue, ruleId: change.ruleId }))
        }];
        return avatar;
      });
    return { avatars: outputAvatars, changes };
  }

  function criticalObservation(avatarChanges, architecturalChanges, interactions, state, nextState) {
    const clauses = [];
    if (architecturalChanges.some((change) => change.property === 'connections')) clauses.push('the plan gained or altered a passage');
    if (architecturalChanges.some((change) => change.property === 'spaces')) clauses.push('the plan formed or absorbed a room');
    if (architecturalChanges.some((change) => ['planForm', 'width', 'height', 'x', 'y', 'serviceDensity'].includes(change.property))) clauses.push('room form, area, position, or built-in services shifted');
    if (architecturalChanges.some((change) => change.property === 'availableResources')) clauses.push('resources were redistributed');
    if (architecturalChanges.some((change) => change.property === 'light')) clauses.push('a space’s light shifted');
    if (architecturalChanges.some((change) => change.property === 'occupancyCapacity')) clauses.push('a space expanded under occupancy pressure');
    const dependenceChanges = avatarChanges.filter((change) => change.property === 'resourceDependence');
    if (dependenceChanges.some((change) => change.newValue > change.previousValue)) clauses.push('at least one avatar became more dependent on resources');
    if (dependenceChanges.some((change) => change.newValue < change.previousValue)) clauses.push('at least one avatar became less dependent on resources');
    if (avatarChanges.some((change) => change.property === 'environmentalTolerance')) clauses.push('environmental tolerance changed through exposure');
    if (avatarChanges.some((change) => change.property === 'collectiveBehaviour')) clauses.push('collective behaviour shifted through contact or isolation');
    if (!clauses.length) return 'No transformation rule crossed its threshold in this generation. The unchanged state is retained as a valid outcome; the interaction record shows what did occur.';
    const occupiedBefore = new Set(interactions.filter((event) => ['occupation', 'movement'].includes(event.type)).flatMap((event) => event.spaceIds));
    const occupancyDescription = `${occupiedBefore.size} spaces hosted movement or occupation events`;
    const changeCount = avatarChanges.length + architecturalChanges.filter((change) => !['useCount', 'lastUsedGeneration'].includes(change.property)).length;
    return `Across ${occupancyDescription}, ${clauses.join('; ')}. The diary records ${changeCount} measured state change${changeCount === 1 ? '' : 's'}; these outcomes follow this model’s rules and do not imply equal agency.`;
  }

  function runGeneration(currentState) {
    assertValidState(currentState);
    const inputState = normalizeState(clone(currentState));
    const events = [];
    const placements = chooseDestinations(inputState, events);
    const social = evaluateSocialInteractions(inputState, placements, events);
    const resources = allocateResources(inputState, placements, events);
    const exposures = calculateEnvironmentalEvents(inputState, placements, events);
    recordBoundaryContacts(inputState, placements, events);
    const interactionSummary = { avatarEvents: placements.avatarEvents };
    const architectureResult = transformArchitecture(inputState, interactionSummary, placements, social, resources, exposures, events);
    const avatarResult = transformAvatars(inputState, placements, social, resources, exposures, events);
    const nextState = {
      generation: inputState.generation + 1,
      avatars: avatarResult.avatars,
      architecture: architectureResult.architecture,
      branchId: inputState.branchId || 'root',
      parentEntryId: null
    };
    assertValidState(nextState);
    const idHash = hashText(JSON.stringify({ state: inputState, events, avatarChanges: avatarResult.changes, architecturalChanges: architectureResult.changes }));
    const entryId = `entry-g${String(nextState.generation).padStart(4, '0')}-${idHash}`;
    nextState.parentEntryId = entryId;
    const diaryEntry = {
      id: entryId,
      generation: nextState.generation,
      branchId: inputState.branchId || 'root',
      parentEntryId: inputState.parentEntryId || null,
      inputState,
      interactions: events,
      avatarChanges: avatarResult.changes,
      architecturalChanges: architectureResult.changes,
      architecturalModifications: architectureResult.modifications,
      remainingModificationBudget: architectureResult.remainingBudget,
      outputState: clone(nextState),
      criticalObservation: criticalObservation(avatarResult.changes, architectureResult.changes, events, inputState, nextState),
      ruleExplanations: Object.fromEntries([...new Set([...avatarResult.changes, ...architectureResult.changes].map((change) => change.ruleId))].map((ruleId) => [ruleId, RULES[ruleId]]))
    };
    nextState.parentEntryId = entryId;
    diaryEntry.outputState.parentEntryId = entryId;
    return { nextState, diaryEntry };
  }

  function createBranch(experiment, entryId, edits = {}) {
    const sourceEntry = experiment.diary.find((entry) => entry.id === entryId);
    if (!sourceEntry) throw new RangeError(`Cannot branch from unknown diary entry: ${entryId}`);
    const branchId = `branch-${hashText(`${entryId}:${JSON.stringify(edits)}`)}`;
    const state = clone(sourceEntry.outputState);
    state.branchId = branchId;
    state.parentEntryId = sourceEntry.id;
    const changed = [];
    if (edits.architecture) {
      const allowedArchitecture = ['connectivity', 'resourceAvailability', 'adaptability'];
      for (const key of allowedArchitecture) {
        const field = key === 'connectivity' ? 'connectivitySetting' : key;
        const supplied = Object.hasOwn(edits.architecture, key) ? key : field;
        if (Object.hasOwn(edits.architecture, supplied)) {
          const value = Number(edits.architecture[supplied]);
          if (!Number.isFinite(value)) throw new TypeError(`Invalid branch architecture value for ${supplied}.`);
          state.architecture[field] = clamp(value, 0, 100);
          if (field === 'adaptability') {
            state.architecture.spaces.forEach((space) => { space.adaptability = state.architecture.adaptability; });
            state.architecture.infrastructure.controlCapacity = Math.round(state.architecture.adaptability / 10);
          }
          if (field === 'resourceAvailability') {
            state.architecture.spaces.forEach((space) => { space.availableResources = round(space.resourceCapacity * state.architecture.resourceAvailability / 100); });
            state.architecture.infrastructure.maintenanceReserve = 100 - state.architecture.resourceAvailability;
          }
          changed.push({ property: `architecture.${field}`, previousValue: sourceEntry.outputState.architecture[field], newValue: state.architecture[field] });
        }
      }
    }
    if (edits.spaces) {
      for (const [spaceId, patch] of Object.entries(edits.spaces)) {
        const space = state.architecture.spaces.find((item) => item.id === spaceId);
        if (!space) throw new RangeError(`Cannot edit unknown architectural space in branch: ${spaceId}`);
        const allowed = ['temperature', 'light', 'resourceCapacity', 'occupancyCapacity', 'adaptability'];
        for (const [key, rawValue] of Object.entries(patch)) {
          if (!allowed.includes(key)) throw new TypeError(`Branch edits cannot change architectural field ${key}.`);
          const value = Number(rawValue);
          if (!Number.isFinite(value)) throw new TypeError(`Invalid branch space value for ${spaceId}.${key}.`);
          const minimum = key === 'occupancyCapacity' || key === 'resourceCapacity' ? 1 : 0;
          const maximum = key === 'occupancyCapacity' ? 8 : key === 'resourceCapacity' ? 200 : 100;
          const nextValue = Math.round(clamp(value, minimum, maximum));
          const previousValue = space[key];
          space[key] = nextValue;
          changed.push({ entityId: spaceId, property: key, previousValue, newValue: nextValue });
          if (key === 'resourceCapacity' && space.availableResources > nextValue) {
            const previousResources = space.availableResources;
            space.availableResources = nextValue;
            changed.push({ entityId: spaceId, property: 'availableResources', previousValue: previousResources, newValue: nextValue });
          }
        }
      }
    }
    if (edits.avatars) {
      for (const [avatarId, patch] of Object.entries(edits.avatars)) {
        const avatar = state.avatars.find((item) => item.id === avatarId);
        if (!avatar) throw new RangeError(`Cannot edit unknown avatar in branch: ${avatarId}`);
        for (const [key, value] of Object.entries(patch)) {
          if (Object.hasOwn(ATTRIBUTES, key) || key === 'resourceRequirements' || key === 'environmentalPreferences' || key === 'visualTraits' || key === 'visual') {
            if (key === 'environmentalPreferences') {
              if (!value || typeof value !== 'object') throw new TypeError(`Invalid branch avatar preferences for ${avatarId}.`);
              for (const preference of ['temperature', 'light']) {
                if (!Number.isFinite(Number(value[preference]))) throw new TypeError(`Invalid branch avatar preference ${avatarId}.${preference}.`);
              }
              const nextValue = {
                temperature: clamp(Number(value.temperature), 0, 100),
                light: clamp(Number(value.light), 0, 100)
              };
              changed.push({ entityId: avatarId, property: key, previousValue: clone(avatar[key]), newValue: nextValue });
              avatar[key] = nextValue;
              continue;
            }
            if (key === 'visualTraits') {
              if (!value || typeof value !== 'object') throw new TypeError(`Invalid branch visual traits for ${avatarId}.`);
              const nextValue = { ...avatar.visualTraits };
              for (const [trait, rawValue] of Object.entries(value)) {
                if (!VISUAL_TRAITS.includes(trait) || !Number.isFinite(Number(rawValue))) throw new TypeError(`Invalid branch visual trait ${avatarId}.${trait}.`);
                nextValue[trait] = clamp(Number(rawValue), 0, 100);
              }
              changed.push({ entityId: avatarId, property: key, previousValue: clone(avatar.visualTraits), newValue: clone(nextValue) });
              avatar.visualTraits = nextValue;
              continue;
            }
            if (key === 'visual') {
              if (!value || typeof value !== 'object' || Object.keys(value).some((field) => field !== 'morphology') || !VISUAL_MORPHOLOGIES.includes(value.morphology)) {
                throw new TypeError(`Invalid branch visual grammar for ${avatarId}.`);
              }
              changed.push({ entityId: avatarId, property: 'visual.morphology', previousValue: avatar.visual.morphology, newValue: value.morphology });
              avatar.visual.morphology = value.morphology;
              continue;
            }
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) throw new TypeError(`Invalid branch avatar value for ${avatarId}.${key}.`);
            changed.push({ entityId: avatarId, property: key, previousValue: avatar[key], newValue: clamp(numeric, 0, 100) });
            avatar[key] = clamp(numeric, 0, 100);
          } else if (key === 'name' || key === 'type' || key === 'description') {
            changed.push({ entityId: avatarId, property: key, previousValue: avatar[key], newValue: String(value) });
            avatar[key] = String(value).slice(0, key === 'description' ? 280 : 80);
          } else {
            throw new TypeError(`Branch edits cannot change avatar field ${key}.`);
          }
        }
      }
      for (const avatarId of edits.removeAvatarIds || []) {
        if (!state.avatars.some((avatar) => avatar.id === avatarId)) throw new RangeError(`Cannot remove unknown avatar in branch: ${avatarId}`);
        if (state.avatars.length <= 1) throw new RangeError('A branch must keep at least one avatar.');
        const removed = state.avatars.find((avatar) => avatar.id === avatarId);
        state.avatars = state.avatars.filter((avatar) => avatar.id !== avatarId);
        changed.push({ entityId: avatarId, property: 'membership', previousValue: 'present', newValue: 'removed', name: removed.name });
      }
      for (const [index, input] of (edits.addAvatars || []).entries()) {
        const avatar = makeAvatar(input, state.avatars.length + index + 1);
        if (state.avatars.some((item) => item.id === avatar.id)) throw new RangeError(`Avatar ID already exists in branch: ${avatar.id}`);
        if (!avatar.locationId) avatar.locationId = state.architecture.spaces[0].id;
        state.avatars.push(avatar);
        changed.push({ entityId: avatar.id, property: 'membership', previousValue: 'absent', newValue: 'added', name: avatar.name });
      }
    }
    assertValidState(state);
    return {
      branchId,
      parentEntryId: sourceEntry.id,
      divergence: changed,
      initialState: state,
      diary: [],
      headState: state
    };
  }

  function readBranches(diaries) {
    return diaries.map((entry) => ({
      entryId: entry.id,
      generation: entry.generation,
      branchId: entry.branchId,
      parentEntryId: entry.parentEntryId,
      outputState: clone(entry.outputState)
    }));
  }

  function compareBranches(leftEntries, rightEntries) {
    const left = leftEntries.slice().sort((a, b) => a.generation - b.generation);
    const right = rightEntries.slice().sort((a, b) => a.generation - b.generation);
    const common = [];
    let index = 0;
    while (index < left.length && index < right.length && left[index].id === right[index].id) {
      common.push(left[index].id);
      index += 1;
    }
    const shared = new Map(left.map((entry) => [entry.id, entry.generation]));
    const sharedGenerations = right.filter((entry) => shared.has(entry.id)).map((entry) => entry.generation);
    const lastSharedGeneration = sharedGenerations.length ? Math.max(...sharedGenerations) : 0;
    const divergenceCandidates = [...left, ...right].filter((entry) => !shared.has(entry.id) && entry.generation > lastSharedGeneration);
    const divergenceGeneration = divergenceCandidates.length ? Math.min(...divergenceCandidates.map((entry) => entry.generation)) : Infinity;
    const leftHead = left[left.length - 1];
    const rightHead = right[right.length - 1];
    const avatarDifferences = [];
    if (leftHead && rightHead) {
      for (const leftAvatar of leftHead.outputState.avatars) {
        const rightAvatar = rightHead.outputState.avatars.find((avatar) => avatar.id === leftAvatar.id);
        if (!rightAvatar) {
          avatarDifferences.push({ avatarId: leftAvatar.id, property: 'membership', left: 'present', right: 'absent' });
          continue;
        }
        for (const key of [...Object.keys(ATTRIBUTES), 'resourceRequirements']) {
          if (leftAvatar[key] !== rightAvatar[key]) avatarDifferences.push({ avatarId: leftAvatar.id, property: key, left: leftAvatar[key], right: rightAvatar[key] });
        }
        VISUAL_TRAITS.forEach((trait) => {
          if (leftAvatar.visualTraits?.[trait] !== rightAvatar.visualTraits?.[trait]) avatarDifferences.push({
            avatarId: leftAvatar.id,
            property: `visualTraits.${trait}`,
            left: leftAvatar.visualTraits?.[trait],
            right: rightAvatar.visualTraits?.[trait]
          });
        });
        if (leftAvatar.visual.morphology !== rightAvatar.visual.morphology) avatarDifferences.push({
          avatarId: leftAvatar.id,
          property: 'visual.morphology',
          left: leftAvatar.visual.morphology,
          right: rightAvatar.visual.morphology
        });
        for (const key of ['name', 'type']) {
          if (leftAvatar[key] !== rightAvatar[key]) avatarDifferences.push({ avatarId: leftAvatar.id, property: key, left: leftAvatar[key], right: rightAvatar[key] });
        }
        for (const key of ['temperature', 'light']) {
          if (leftAvatar.environmentalPreferences[key] !== rightAvatar.environmentalPreferences[key]) avatarDifferences.push({ avatarId: leftAvatar.id, property: `environmentalPreferences.${key}`, left: leftAvatar.environmentalPreferences[key], right: rightAvatar.environmentalPreferences[key] });
        }
      }
      for (const rightAvatar of rightHead.outputState.avatars) {
        if (!leftHead.outputState.avatars.some((avatar) => avatar.id === rightAvatar.id)) {
          avatarDifferences.push({ avatarId: rightAvatar.id, property: 'membership', left: 'absent', right: 'present' });
        }
      }
    }
    const architectureDifferences = [];
    if (leftHead && rightHead) {
      for (const key of ['connectivity', 'connectivitySetting', 'resourceAvailability', 'adaptability']) {
        if (leftHead.outputState.architecture[key] !== rightHead.outputState.architecture[key]) architectureDifferences.push({ spaceId: 'architecture', property: key, left: leftHead.outputState.architecture[key], right: rightHead.outputState.architecture[key] });
      }
      for (const leftSpace of leftHead.outputState.architecture.spaces) {
        const rightSpace = rightHead.outputState.architecture.spaces.find((space) => space.id === leftSpace.id);
        if (!rightSpace) continue;
        for (const key of ['temperature', 'light', 'resourceCapacity', 'availableResources', 'occupancyCapacity', 'width', 'adaptability']) {
          if (leftSpace[key] !== rightSpace[key]) architectureDifferences.push({ spaceId: leftSpace.id, property: key, left: leftSpace[key], right: rightSpace[key] });
        }
        if (leftSpace.connections.join('|') !== rightSpace.connections.join('|')) architectureDifferences.push({ spaceId: leftSpace.id, property: 'connections', left: leftSpace.connections, right: rightSpace.connections });
      }
      const rightBoundaries = new Map((rightHead.outputState.architecture.boundaries || []).map((boundary) => [boundary.id, boundary]));
      (leftHead.outputState.architecture.boundaries || []).forEach((boundary) => {
        const peer = rightBoundaries.get(boundary.id);
        if (JSON.stringify(boundary) !== JSON.stringify(peer)) architectureDifferences.push({
          spaceId: boundary.id,
          property: 'boundary traits',
          left: boundary,
          right: peer || null
        });
      });
      (rightHead.outputState.architecture.boundaries || []).forEach((boundary) => {
        if (!(leftHead.outputState.architecture.boundaries || []).some((candidate) => candidate.id === boundary.id)) architectureDifferences.push({
          spaceId: boundary.id,
          property: 'boundary traits',
          left: null,
          right: boundary
        });
      });
    }
    return {
      sharedEntryIds: common,
      divergenceGeneration: Number.isFinite(divergenceGeneration) ? divergenceGeneration : null,
      avatarDifferences,
      architectureDifferences,
      converged: avatarDifferences.length === 0 && architectureDifferences.length === 0,
      leftGenerationCount: left.length,
      rightGenerationCount: right.length
    };
  }

  function detectPatterns(entries) {
    if (!entries.length) return [];
    const sorted = entries.slice().sort((a, b) => a.generation - b.generation);
    const first = sorted[0].inputState;
    const last = sorted[sorted.length - 1].outputState;
    const patterns = [];
    const connectivityDelta = last.architecture.connectivity - first.architecture.connectivity;
    if (connectivityDelta > 0) patterns.push({ id: 'connectivity-increased', label: 'Greater connectivity', evidence: `Network connectivity proxy increased by ${round(connectivityDelta)} points.`, value: connectivityDelta });
    if (connectivityDelta < 0) patterns.push({ id: 'connectivity-decreased', label: 'Reduced connectivity', evidence: `Network connectivity proxy decreased by ${round(Math.abs(connectivityDelta))} points.`, value: connectivityDelta });
    const dependenceDeltas = last.avatars.map((avatar) => {
      const initial = first.avatars.find((item) => item.id === avatar.id);
      return initial ? avatar.resourceDependence - initial.resourceDependence : 0;
    });
    const dependenceTotal = dependenceDeltas.reduce((sum, value) => sum + value, 0);
    if (dependenceTotal > 0) patterns.push({ id: 'dependence-increased', label: 'Increasing resource dependence', evidence: `Across avatars, resource dependence rose by ${dependenceTotal} points in aggregate.`, value: dependenceTotal });
    if (dependenceTotal < 0) patterns.push({ id: 'dependence-decreased', label: 'Decreasing resource dependence', evidence: `Across avatars, resource dependence fell by ${Math.abs(dependenceTotal)} points in aggregate.`, value: dependenceTotal });
    const changesPerGeneration = sorted.map((entry) => entry.avatarChanges.length + entry.architecturalChanges.length);
    if (changesPerGeneration.length >= 3 && changesPerGeneration.slice(-3).every((count) => count === 0)) patterns.push({ id: 'stabilization', label: 'Recent stabilization', evidence: 'The last three recorded generations contain no state changes.', value: 0 });
    if (sorted.some((entry) => entry.interactions.some((event) => event.type === 'resource-shortage'))) patterns.push({ id: 'resource-pressure', label: 'Persistent resource pressure', evidence: `${sorted.reduce((count, entry) => count + entry.interactions.filter((event) => event.type === 'resource-shortage').length, 0)} recorded resource-shortage interaction(s).`, value: sorted.reduce((count, entry) => count + entry.interactions.filter((event) => event.type === 'resource-shortage').length, 0) });
    const triggerCounts = new Map();
    sorted.forEach((entry) => entry.architecturalChanges.forEach((change) => {
      triggerCounts.set(change.ruleId, (triggerCounts.get(change.ruleId) || 0) + 1);
    }));
    const frequent = [...triggerCounts.entries()].sort((left, right) => right[1] - left[1] || stableCompare(left[0], right[0]))[0];
    if (frequent) patterns.push({ id: 'frequent-trigger', label: 'Repeated architectural trigger', evidence: `${RULES[frequent[0]]} Recorded ${frequent[1]} change(s).`, value: frequent[1], ruleId: frequent[0] });
    return patterns;
  }

  function evolutionNarrative(entries) {
    if (!entries.length) return ['Run a few generations to see how the habitat and its inhabitants respond to one another.'];
    const sorted = entries.slice().sort((left, right) => left.generation - right.generation);
    const first = sorted[0].inputState;
    const last = sorted[sorted.length - 1].outputState;
    const averageDependence = (state) => state.avatars.reduce((sum, avatar) => sum + avatar.resourceDependence, 0) / Math.max(1, state.avatars.length);
    const startingDependence = averageDependence(first);
    const endingDependence = averageDependence(last);
    const connectivityChange = last.architecture.connectivity - first.architecture.connectivity;
    const connectivityStory = connectivityChange > 0
      ? `More of the possible routes were connected by the end: the network rose from ${round(first.architecture.connectivity)}% to ${round(last.architecture.connectivity)}%. In this model, that gives inhabitants more potential paths between spaces.`
      : connectivityChange < 0
        ? `Fewer of the possible routes were connected by the end: the network fell from ${round(first.architecture.connectivity)}% to ${round(last.architecture.connectivity)}%. In this model, that leaves inhabitants with fewer potential paths between spaces.`
        : `The overall share of connected routes stayed about the same at ${round(last.architecture.connectivity)}%. Individual conditions may still have shifted, but the network's total connectivity did not.`;
    const dependenceStory = Math.abs(endingDependence - startingDependence) < .1
      ? `The cast's average resource-dependence score stayed close to ${round(endingDependence, 1)}.`
      : `The cast's average resource-dependence score ${endingDependence > startingDependence ? 'rose' : 'fell'} from ${round(startingDependence, 1)} to ${round(endingDependence, 1)}.`;
    const spaceUses = new Map();
    const routeUses = new Map();
    const spaceNameById = new Map(sorted.flatMap((entry) => [...entry.inputState.architecture.spaces, ...entry.outputState.architecture.spaces]).map((space) => [space.id, space.name]));
    sorted.forEach((entry) => entry.interactions.forEach((event) => {
      if (!['movement', 'occupation'].includes(event.type)) return;
      const path = event.pathSpaceIds?.length ? event.pathSpaceIds : [event.toSpaceId || event.spaceIds?.at(-1)].filter(Boolean);
      path.forEach((spaceId) => spaceUses.set(spaceId, (spaceUses.get(spaceId) || 0) + 1));
      for (let index = 0; index < path.length - 1; index += 1) {
        const key = [path[index], path[index + 1]].sort().join('|');
        routeUses.set(key, (routeUses.get(key) || 0) + 1);
      }
    }));
    const busiestSpace = [...spaceUses.entries()].sort((left, right) => right[1] - left[1] || stableCompare(left[0], right[0]))[0];
    const busiestRoute = [...routeUses.entries()].sort((left, right) => right[1] - left[1] || stableCompare(left[0], right[0]))[0];
    const useStory = busiestSpace
      ? `${spaceNameById.get(busiestSpace[0]) || busiestSpace[0]} was the most-used space, with ${busiestSpace[1]} recorded visit${busiestSpace[1] === 1 ? '' : 's'}${busiestRoute ? `; the busiest route between ${busiestRoute[0].split('|').map((id) => spaceNameById.get(id) || id).join(' and ')} carried ${busiestRoute[1]} journey${busiestRoute[1] === 1 ? '' : 's'}` : ''}. These are the places where the inhabitants’ activity left the strongest accumulated traces.`
      : 'No movement or occupation was recorded, so the system has no used nodes or paths to compare yet.';
    const shortages = sorted.flatMap((entry) => entry.interactions.filter((event) => event.type === 'resource-shortage'));
    const socialEncounters = sorted.flatMap((entry) => entry.interactions.filter((event) => event.type === 'social-encounter'));
    const avatarNames = new Map(sorted.flatMap((entry) => [...entry.inputState.avatars, ...entry.outputState.avatars]).map((avatar) => [avatar.id, avatar.name]));
    const spaceNames = new Map(sorted.flatMap((entry) => [...entry.inputState.architecture.spaces, ...entry.outputState.architecture.spaces]).map((space) => [space.id, space.name]));
    const shortageAvatarIds = [...new Set(shortages.flatMap((event) => event.avatarIds || []))];
    const shortageSpaceIds = [...new Set(shortages.flatMap((event) => event.spaceIds || []))];
    const shortageStory = shortages.length
      ? `${shortages.length} resource shortfall events were recorded. A shortfall means a being's space could not provide all the resource units the model said it needed in that round${shortageAvatarIds.length ? `; this affected ${shortageAvatarIds.map((id) => avatarNames.get(id) || id).join(', ')}` : ''}${shortageSpaceIds.length ? ` across ${shortageSpaceIds.length} space${shortageSpaceIds.length === 1 ? '' : 's'} such as ${shortageSpaceIds.slice(0, 3).map((id) => spaceNames.get(id) || id).join(', ')}` : ''}. The rules allow repeated shortfalls to raise resource dependence.`
      : 'No resource shortfalls were recorded: every modeled request was met by the resources available in its space.';
    const encounterStory = socialEncounters.length
      ? `The model also recorded ${socialEncounters.length} social encounter${socialEncounters.length === 1 ? '' : 's'}. Here, that means two beings were in the same or directly connected spaces; it is a simple measure of proximity, not a claim about a real social bond.`
      : 'No social encounters were recorded; in this model, that means no pair of beings occupied the same or directly connected spaces in a generation.';
    const changeCount = sorted.reduce((sum, entry) => sum + entry.avatarChanges.length + entry.architecturalChanges.length, 0);
    const generations = sorted.length;
    const changesStory = `Across ${generations} recorded generation${generations === 1 ? '' : 's'}, the diary logged ${changeCount} state change${changeCount === 1 ? '' : 's'}. Each counts one modeled value shifting—such as a route, a room condition, or an avatar trait—not one encounter. These are outcomes of this rule set, not a prediction of a real habitat.`;
    return [
      `${connectivityStory} ${dependenceStory}`,
      useStory,
      `${shortageStory} ${encounterStory}`,
      changesStory
    ];
  }

  function exportExperiment(experiment) {
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      experiment: clone(experiment)
    };
  }

  function validateExperimentImport(value) {
    if (!value || typeof value !== 'object' || value.schemaVersion !== SCHEMA_VERSION || !value.experiment || typeof value.experiment !== 'object') {
      return { valid: false, errors: [`Import must be an experiment export with schemaVersion ${SCHEMA_VERSION}.`] };
    }
    const experiment = value.experiment;
    if (typeof experiment.id !== 'string' || !experiment.id.trim()) return { valid: false, errors: ['Experiment is missing a stable ID.'] };
    if (typeof experiment.name !== 'string' || !experiment.name.trim()) return { valid: false, errors: ['Experiment is missing a name.'] };
    if (!Array.isArray(experiment.diary) || !experiment.rootState) return { valid: false, errors: ['Experiment is missing its initial state or diary.'] };
    const errors = validateState(experiment.rootState);
    const seenEntries = new Map();
    experiment.diary.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        errors.push(`Diary entry ${index + 1} is not an object.`);
        return;
      }
      if (typeof entry.id !== 'string' || !entry.id.trim() || seenEntries.has(entry.id)) errors.push(`Diary entry ${index + 1} has a missing or duplicate ID.`);
      if (!Number.isInteger(entry.generation) || entry.generation !== entry.inputState?.generation + 1 || entry.generation !== entry.outputState?.generation) errors.push(`Diary entry ${index + 1} has inconsistent generation numbers.`);
      if (entry.parentEntryId) {
        const parent = seenEntries.get(entry.parentEntryId);
        if (!parent) errors.push(`Diary entry ${index + 1} refers to a parent that has not been recorded.`);
        else if (parent.outputState?.generation !== entry.inputState?.generation) errors.push(`Diary entry ${index + 1} does not begin at its parent generation.`);
        else if (parent.branchId === entry.branchId && JSON.stringify(parent.outputState) !== JSON.stringify(entry.inputState)) errors.push(`Diary entry ${index + 1} does not continue its branch from the complete prior state.`);
      } else if (entry.inputState?.generation > 0) {
        errors.push(`Diary entry ${index + 1} is missing its parent generation.`);
      }
      errors.push(...validateState(entry.inputState).map((error) => `Diary entry ${index + 1} input: ${error}`));
      errors.push(...validateState(entry.outputState).map((error) => `Diary entry ${index + 1} output: ${error}`));
      if (!Array.isArray(entry.interactions) || !Array.isArray(entry.avatarChanges) || !Array.isArray(entry.architecturalChanges)) errors.push(`Diary entry ${index + 1} is missing event or change lists.`);
      const interactions = Array.isArray(entry.interactions) ? entry.interactions : [];
      const avatarChanges = Array.isArray(entry.avatarChanges) ? entry.avatarChanges : [];
      const architecturalChanges = Array.isArray(entry.architecturalChanges) ? entry.architecturalChanges : [];
      for (const change of [...avatarChanges, ...architecturalChanges]) {
        if (!change || typeof change !== 'object') {
          errors.push(`Diary entry ${index + 1} contains a malformed change record.`);
          continue;
        }
        if (!change.ruleId || !RULES[change.ruleId] || !Array.isArray(change.causeEventIds) || !change.causeEventIds.length) errors.push(`Diary entry ${index + 1} contains a change without traceable causes.`);
        if (Array.isArray(change.causeEventIds) && change.causeEventIds.some((id) => !interactions.some((event) => event && event.id === id))) errors.push(`Diary entry ${index + 1} has a change linked to an unknown interaction event.`);
      }
      if (typeof entry.id === 'string') seenEntries.set(entry.id, entry);
    });
    return { valid: errors.length === 0, errors, experiment: errors.length ? null : clone(experiment) };
  }

  function diaryAsText(entries) {
    return entries.slice().sort((left, right) => left.generation - right.generation).map((entry) => {
      const lines = [
        `A HISTORY OF BECOMING — GENERATION ${String(entry.generation).padStart(3, '0')}`,
        `Branch: ${entry.branchId}`,
        `Parent entry: ${entry.parentEntryId || 'Initial state'}`,
        '',
        'INPUT AVATARS',
        ...entry.inputState.avatars.map((avatar) => `- ${avatar.name} (${avatar.type}) at ${avatar.locationId}; mobility ${avatar.mobility}, tolerance ${avatar.environmentalTolerance}, dependence ${avatar.resourceDependence}, adaptability ${avatar.adaptability}, collective behaviour ${avatar.collectiveBehaviour}, spatial influence ${avatar.spatialInfluence}; resource requirement ${avatar.resourceRequirements}.`),
        '',
        'INPUT ARCHITECTURE',
        ...entry.inputState.architecture.spaces.map((space) => `- ${space.id} ${space.name}: temperature ${space.temperature}, light ${space.light}, resources ${space.availableResources}/${space.resourceCapacity}, occupancy ${space.occupancyCapacity}; connections ${space.connections.join(', ') || 'none'}.`),
        ...(entry.inputState.architecture.boundaries || []).map((boundary) => `- ${boundary.id} between ${boundary.spaceIds.join(' and ')}: ${boundary.segments.reduce((sum, segment) => sum + segment.contactCount, 0)} localized contacts; traits ${VISUAL_TRAITS.map((trait) => `${trait} ${Math.round(boundary.segments.reduce((sum, segment) => sum + segment.traits[trait], 0) / boundary.segments.length)}`).join(', ')}.`),
        '',
        'INTERACTIONS',
        ...(entry.interactions.length ? entry.interactions.map((event) => `- [${event.id}; ${event.ruleId}] ${event.description}`) : ['- No interaction events recorded.']),
        '',
        'ARCHITECTURAL TRANSFORMATIONS',
        ...(entry.architecturalChanges.length ? entry.architecturalChanges.map((change) => `- ${change.entityId}.${change.property}: ${change.previousValue} → ${change.newValue}; rule ${change.ruleId}; events ${change.causeEventIds.join(', ')}.`) : ['- No architectural state changes.']),
        '',
        'AVATAR TRANSFORMATIONS',
        ...(entry.avatarChanges.length ? entry.avatarChanges.map((change) => `- ${change.entityId}.${change.property}: ${change.previousValue} → ${change.newValue}; rule ${change.ruleId}; events ${change.causeEventIds.join(', ')}.`) : ['- No avatar state changes.']),
        '',
        'OUTPUT AVATARS',
        ...entry.outputState.avatars.map((avatar) => `- ${avatar.name} at ${avatar.locationId}; mobility ${avatar.mobility}, tolerance ${avatar.environmentalTolerance}, dependence ${avatar.resourceDependence}, adaptability ${avatar.adaptability}, collective behaviour ${avatar.collectiveBehaviour}, spatial influence ${avatar.spatialInfluence}.`),
        '',
        'OUTPUT ARCHITECTURE',
        ...entry.outputState.architecture.spaces.map((space) => `- ${space.id} ${space.name}: temperature ${space.temperature}, light ${space.light}, resources ${space.availableResources}/${space.resourceCapacity}, occupancy ${space.occupancyCapacity}; connections ${space.connections.join(', ') || 'none'}.`),
        ...(entry.outputState.architecture.boundaries || []).map((boundary) => `- ${boundary.id} between ${boundary.spaceIds.join(' and ')}: ${boundary.segments.reduce((sum, segment) => sum + segment.contactCount, 0)} localized contacts; traits ${VISUAL_TRAITS.map((trait) => `${trait} ${Math.round(boundary.segments.reduce((sum, segment) => sum + segment.traits[trait], 0) / boundary.segments.length)}`).join(', ')}.`),
        '',
        `CRITICAL OBSERVATION: ${entry.criticalObservation}`,
        ''
      ];
      return lines.join('\n');
    }).join('\n\n' + '='.repeat(72) + '\n\n');
  }

  function branchTimeline(entries) {
    return entries.map((entry) => ({ id: entry.id, generation: entry.generation, branchId: entry.branchId, parentEntryId: entry.parentEntryId }));
  }

  return {
    SCHEMA_VERSION,
    ATTRIBUTES,
    VISUAL_TRAITS,
    RULES,
    clamp,
    clone,
    createVisualDNA,
    makeAvatar,
    createInitialArchitecture,
    createInitialState,
    normalizeState,
    validateState,
    runGeneration,
    createBranch,
    readBranches,
    compareBranches,
    detectPatterns,
    evolutionNarrative,
    exportExperiment,
    validateExperimentImport,
    diaryAsText,
    branchTimeline,
    avatarCompatibility,
    shortestDistances
  };
}));
