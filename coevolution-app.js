(function () {
  'use strict';

  const Model = window.CoevolutionModel;
  const Storage = window.CoevolutionStorage;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const AVATAR_FIELDS = [
    ['mobility', 'Mobility'],
    ['environmentalTolerance', 'Environmental tolerance'],
    ['resourceDependence', 'Resource dependence'],
    ['adaptability', 'Adaptability'],
    ['collectiveBehaviour', 'Collective behaviour'],
    ['spatialInfluence', 'Spatial influence'],
    ['resourceRequirements', 'Resource requirement']
  ];
  const ARCHITECTURE_FIELDS = [
    ['connectivitySetting', 'Initial network connectivity'],
    ['resourceAvailability', 'Resource availability'],
    ['adaptability', 'Architectural adaptability']
  ];
  const ARCHITECTURE_STORIES = {
    connectivitySetting: 'More links can make travel between spaces easier. They do not guarantee that every being can use them.',
    resourceAvailability: 'Sets the shared supply at the start. A low supply makes scarcity and distribution easier to notice.',
    adaptability: 'Sets how much capacity the building can use to respond to pressure. Change still has a cost.'
  };
  const AVATAR_STORIES = {
    mobility: 'How readily this being travels. Higher mobility also draws longer-reaching lines.',
    environmentalTolerance: 'How much temperature and light difference it can live with; higher tolerance adds more branching vein-lines.',
    resourceDependence: 'How strongly it relies on shared resources; higher dependence gathers more spiral traces.',
    adaptability: 'How quickly its traits respond to experience; higher adaptability layers more shifting contours and colors.',
    collectiveBehaviour: 'How likely it is to coordinate or seek contact; higher collective behaviour adds branches to its drawn lines.',
    spatialInfluence: 'How strongly it presses spaces to change; higher influence expands its drawing and gives lines more weight.',
    resourceRequirements: 'How much supply it needs; higher requirements increase the drawing’s hatch density.'
  };
  const WORLD_PRESETS = {
    reciprocal: { name: 'A shared habitat', connectivity: 68, resourceAvailability: 76, adaptability: 72 },
    scarcity: { name: 'A resource pinch', connectivity: 46, resourceAvailability: 30, adaptability: 56 },
    shifting: { name: 'A changing climate', connectivity: 58, resourceAvailability: 54, adaptability: 88 }
  };
  const initialAvatars = [
    { id: 'moss-network', name: 'Moss network', type: 'Collective plant-fungal life', description: 'A slow, distributed organism whose needs do not align with individual occupancy.', mobility: 18, environmentalTolerance: 25, resourceDependence: 70, adaptability: 80, collectiveBehaviour: 82, spatialInfluence: 90, resourceRequirements: 60, environmentalPreferences: { temperature: 30, light: 20 } },
    { id: 'tidal-intelligence', name: 'Tidal intelligence', type: 'Water-linked collective', description: 'A shifting intelligence that moves through connected wet and dry spaces.', mobility: 75, environmentalTolerance: 55, resourceDependence: 40, adaptability: 65, collectiveBehaviour: 70, spatialInfluence: 85, resourceRequirements: 75, environmentalPreferences: { temperature: 65, light: 35 } },
    { id: 'machine-pollinator', name: 'Machine pollinator', type: 'Speculative autonomous system', description: 'A maintained, resource-dependent entity that exchanges work with living systems.', mobility: 40, environmentalTolerance: 20, resourceDependence: 90, adaptability: 45, collectiveBehaviour: 32, spatialInfluence: 80, resourceRequirements: 85, environmentalPreferences: { temperature: 20, light: 18 } }
  ];
  const defaultArchitecture = { connectivity: WORLD_PRESETS.reciprocal.connectivity, resourceAvailability: WORLD_PRESETS.reciprocal.resourceAvailability, adaptability: WORLD_PRESETS.reciprocal.adaptability };
  const state = {
    experiment: null,
    experiments: [],
    draft: null,
    branchEntryId: null,
    selectedDiaryId: null,
    storageReady: false,
    saveTimer: null,
    playTimer: null,
    advanced: false,
    selectedPreset: 'reciprocal'
  };

  function createId() {
    return window.crypto?.randomUUID ? window.crypto.randomUUID() : `experiment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function generationNarrative(entry) {
    const spaces = new Map(entry.inputState.architecture.spaces.map((space) => [space.id, space.name]));
    const avatars = new Map(entry.inputState.avatars.map((avatar) => [avatar.id, avatar.name]));
    const paragraphs = [];
    const movements = entry.interactions.filter((event) => ['movement', 'occupation', 'capacity-exclusion'].includes(event.type));
    if (movements.length) {
      const arrivals = movements.slice(0, 3).map((event) => {
        const name = event.avatarIds.map((id) => avatars.get(id)).filter(Boolean).join(' and ') || 'A being';
        const destination = spaces.get(event.toSpaceId || event.spaceIds[event.spaceIds.length - 1]) || 'a reachable space';
        if (event.type === 'movement') {
          const origin = spaces.get(event.fromSpaceId) || 'another space';
          const route = (event.pathSpaceIds || [event.fromSpaceId, event.toSpaceId]).map((id) => spaces.get(id) || id).join(' → ');
          return `${name} moved from ${origin} to ${destination}${route ? ` along ${route}` : ''}`;
        }
        if (event.type === 'capacity-exclusion') return `${name} could not find a reachable space with room`;
        return `${name} stayed in ${destination}`;
      });
      paragraphs.push(`${arrivals.join('; ')}. The network determines which spaces are within reach; temperature, light, and available resources at those spaces shape which destination fits best. Each journey also leaves a visible trace on the route and places it passes.`);
    }
    const shortages = entry.interactions.filter((event) => event.type === 'resource-shortage');
    if (shortages.length) {
      const locations = [...new Set(shortages.map((event) => spaces.get(event.spaceIds[0])).filter(Boolean))];
      const affected = [...new Set(shortages.flatMap((event) => event.avatarIds).map((id) => avatars.get(id)).filter(Boolean))];
      paragraphs.push(`${shortages.length} resource shortfall${shortages.length === 1 ? '' : 's'} occurred${affected.length ? ` for ${affected.join(', ')}` : ''}${locations.length ? ` in ${locations.slice(0, 2).join(' and ')}` : ''}: those spaces could not supply everything the beings were modeled to need. The resulting pressure can shift resource dependence and prompt the system to redistribute supply.`);
    }
    const stresses = entry.interactions.filter((event) => event.type === 'environmental-stress');
    if (stresses.length) {
      const names = [...new Set(stresses.flatMap((event) => event.avatarIds).map((id) => avatars.get(id)).filter(Boolean))];
      paragraphs.push(`${names.slice(0, 3).join(', ') || 'Some avatars'} encountered conditions outside their modeled tolerance. This is a signal in the rules, not a measure of lived distress.`);
    }
    const encounters = entry.interactions.filter((event) => event.type === 'social-encounter');
    if (encounters.length) {
      const participants = [...new Set(encounters.flatMap((event) => event.avatarIds).map((id) => avatars.get(id)).filter(Boolean))];
      paragraphs.push(`${participants.join(', ')} shared a space or connected route in ${encounters.length} modeled encounter${encounters.length === 1 ? '' : 's'}. In this experiment, proximity can strengthen collective behaviour; it stands for spatial contact, not a fully modeled social relationship.`);
    }
    const avatarChanges = entry.avatarChanges.filter((change) => ['environmentalTolerance', 'environmentalPreferences.light', 'resourceDependence', 'collectiveBehaviour', 'mobility'].includes(change.property));
    const avatarResponses = avatarChanges.slice(0, 3).map((change) => {
      const name = avatars.get(change.entityId) || 'A being';
      const trigger = entry.interactions.find((event) => change.causeEventIds.includes(event.id));
      const location = trigger?.spaceIds?.map((id) => spaces.get(id)).filter(Boolean)[0];
      const cause = change.property === 'resourceDependence'
        ? `supply in ${location || 'its occupied space'}`
        : change.property === 'environmentalTolerance' || change.property === 'environmentalPreferences.light'
          ? `conditions in ${location || 'its occupied space'}`
          : change.property === 'collectiveBehaviour'
            ? 'contact or isolation around shared spaces'
            : 'movement limits or environmental conditions';
      const trait = change.property.replace('environmentalPreferences.light', 'preferred light').replace('environmentalTolerance', 'tolerance').replace('resourceDependence', 'resource dependence').replace('collectiveBehaviour', 'collective behaviour').replace('mobility', 'mobility');
      return `${cause} shifted ${name}’s modeled ${trait} from ${change.previousValue} to ${change.newValue}`;
    });
    if (avatarResponses.length) paragraphs.push(`The habitat pushed back on its inhabitants too: ${avatarResponses.join('; ')}. These are the rule-based effects of conditions and movement, not measures of lived experience.`);
    const architectureChanges = entry.architecturalChanges.filter((change) => change.property !== 'availableResources');
    if (architectureChanges.length) {
      const changes = architectureChanges.map((change) => {
        const space = spaces.get(change.entityId);
        if (change.property === 'connections') return `a route between spaces changed`;
        if (change.property === 'connectivity') return `network connectivity shifted from ${change.previousValue} to ${change.newValue}`;
        if (change.property === 'light') return `light in ${space || change.entityId} shifted from ${change.previousValue} to ${change.newValue}`;
        if (change.property === 'occupancyCapacity') return `${space || change.entityId} made room for ${change.newValue} occupants`;
        return `${space || change.entityId} changed in ${change.property}`;
      });
      const responsibleAvatars = [...new Set(architectureChanges.flatMap((change) => change.causeEventIds).flatMap((eventId) => entry.interactions.find((event) => event.id === eventId)?.avatarIds || []).map((id) => avatars.get(id)).filter(Boolean))];
      paragraphs.push(`The habitat changed in response: ${[...new Set(changes)].slice(0, 3).join('; ')}${responsibleAvatars.length ? `, under pressure from ${responsibleAvatars.slice(0, 3).join(', ')}` : ''}. The recorded encounters show how inhabitants’ use and conditions feed back into the spaces.`);
    } else {
      paragraphs.push('No new route, capacity, or environmental adjustment was recorded. Resource levels still shifted as they were used and shared; an interaction does not have to change the building’s form.');
    }
    const output = entry.outputState;
    const resources = output.architecture.spaces.reduce((sum, space) => sum + space.availableResources, 0).toFixed(1);
    paragraphs.push(`At the end, ${output.avatars.length} avatars occupy a network with ${output.architecture.connectivity}% connectivity and ${resources} modeled resource units remaining. The account follows the simulation’s rules; it does not predict a real ecosystem.`);
    return paragraphs;
  }

  function newExperiment(name = 'Untitled becoming study') {
    const rootState = Model.createInitialState(initialAvatars, defaultArchitecture);
    return {
      id: createId(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      selectedPreset: 'reciprocal',
      rootState,
      headState: Model.clone(rootState),
      activeBranchId: 'root',
      diary: [],
      branches: {
        root: { id: 'root', label: 'Original path', parentEntryId: null, initialState: Model.clone(rootState), headState: Model.clone(rootState), entryIds: [] }
      }
    };
  }

  function normalizeExperiment(experiment) {
    if (!experiment.branches || !Object.keys(experiment.branches).length) {
      experiment.branches = {
        root: { id: 'root', label: 'Original path', parentEntryId: null, initialState: Model.clone(experiment.rootState), headState: Model.clone(experiment.headState || experiment.rootState), entryIds: experiment.diary.map((entry) => entry.id) }
      };
    }
    for (const [id, branch] of Object.entries(experiment.branches)) {
      branch.id = branch.id || id;
      branch.entryIds = branch.entryIds || experiment.diary.filter((entry) => entry.branchId === id).map((entry) => entry.id);
      branch.headState = branch.headState || Model.clone(experiment.diary.filter((entry) => entry.branchId === id).slice(-1)[0]?.outputState || branch.initialState || experiment.rootState);
    }
    experiment.activeBranchId = experiment.activeBranchId || 'root';
    const morphologyByAvatarId = new Map();
    const usedMorphologies = new Set();
    const normalizeState = (simulationState) => {
      if (!simulationState?.avatars) return;
      simulationState.avatars.forEach((avatar, index) => {
        const visual = Model.makeAvatar(avatar, index + 1).visual;
        if (!morphologyByAvatarId.has(avatar.id)) {
          if (usedMorphologies.has(visual.morphology)) {
            visual.morphology = Model.createVisualDNA(visual.seed, [...usedMorphologies]).morphology;
          }
          morphologyByAvatarId.set(avatar.id, visual.morphology);
          usedMorphologies.add(visual.morphology);
        }
        visual.morphology = morphologyByAvatarId.get(avatar.id);
        avatar.visual = visual;
      });
    };
    normalizeState(experiment.rootState);
    normalizeState(experiment.headState);
    normalizeState(experiment.pendingDraftState);
    Object.values(experiment.branches).forEach((branch) => {
      normalizeState(branch.initialState);
      normalizeState(branch.headState);
    });
    experiment.diary.forEach((entry) => {
      normalizeState(entry.inputState);
      normalizeState(entry.outputState);
    });
    const active = experiment.branches[experiment.activeBranchId];
    experiment.headState = Model.clone(active?.headState || experiment.rootState);
    return experiment;
  }

  function activeBranch() {
    return state.experiment.branches[state.experiment.activeBranchId];
  }

  function experimentDraft(experiment) {
    const validationErrors = experiment.pendingDraftState ? Model.validateState(experiment.pendingDraftState) : ['No pending configuration'];
    return validationErrors.length ? Model.clone(experiment.branches[experiment.activeBranchId].headState) : Model.clone(experiment.pendingDraftState);
  }

  function activeLineage(branchId = state.experiment.activeBranchId) {
    const branch = state.experiment.branches[branchId];
    if (!branch) return [];
    const entries = new Map(state.experiment.diary.map((entry) => [entry.id, entry]));
    const lineage = [];
    const seen = new Set();
    const addAncestors = (entryId) => {
      if (!entryId || seen.has(entryId)) return;
      const entry = entries.get(entryId);
      if (!entry) return;
      seen.add(entryId);
      addAncestors(entry.parentEntryId);
      lineage.push(entry);
    };
    if (branch.entryIds.length) addAncestors(branch.entryIds[branch.entryIds.length - 1]);
    else addAncestors(branch.parentEntryId);
    return lineage;
  }

  function mixHue(first, second, amount) {
    const delta = ((second - first + 540) % 360) - 180;
    return (first + delta * amount + 360) % 360;
  }

  function avatarDrawingProfile(avatar) {
    const preference = avatar.environmentalPreferences || {};
    const trait = (key) => Model.clamp(Number(avatar[key]) || 0, 0, 100) / 100;
    const dna = avatar.visual || Model.createVisualDNA(Array.from(avatar.id).reduce((sum, char) => sum + char.charCodeAt(0), 0));
    const hue = (Number(dna.paletteHue || 0) + (Number(preference.temperature || 0) - 50) * .55 + (Number(preference.light || 0) - 50) * .28 + trait('mobility') * 24 + 360) % 360;
    const paletteCount = Math.max(1, Math.min(5, 1 + Math.round(Number(dna.paletteDiversity || 0) * 2 + trait('adaptability') * 2.5 + trait('collectiveBehaviour') * 1.5)));
    return {
      seed: Number(dna.seed) >>> 0,
      morphology: dna.morphology || Model.createVisualDNA(Number(dna.seed) >>> 0).morphology,
      hue,
      paletteCount,
      dependence: trait('resourceDependence'),
      requirements: trait('resourceRequirements'),
      adaptability: trait('adaptability'),
      mobility: trait('mobility'),
      tolerance: trait('environmentalTolerance'),
      collective: trait('collectiveBehaviour'),
      influence: trait('spatialInfluence'),
      rotation: Number(dna.rotationBias || 0) * 90 + trait('mobility') * 35,
      lineWeight: .8 + Number(dna.lineWeightBias || 0) * .7 + trait('spatialInfluence') * .45,
      paletteDiversity: Number(dna.paletteDiversity || 0),
      dashScale: Number(dna.dashScale || 1) * (.85 + trait('environmentalTolerance') * .35),
      spread: 27 + Number(dna.spreadBias || 0) * 8 + trait('mobility') * 5 + trait('spatialInfluence') * 11,
      branchCount: 2 + Math.round(Number(dna.branchBias || 0) * 2 + trait('collectiveBehaviour') * 4),
      contourCount: 1 + Math.round(Number(dna.contourBias || 0) * 2 + trait('adaptability') * 3),
      spiralCount: 1 + Math.round(Number(dna.spiralBias || 0) + trait('resourceDependence') * 2 + trait('resourceRequirements')),
      dashScale: Number(dna.dashScale || 1) * (.85 + trait('environmentalTolerance') * .35)
    };
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function irregularContour(cx, cy, radiusX, radiusY, seed, count = 11, variation = .22, contain = false) {
    const random = seededRandom(seed);
    const points = Array.from({ length: count }, (_, index) => {
      const angle = -Math.PI / 2 + (index + (random() - .5) * .32) * Math.PI * 2 / count;
      const radius = .72 + random() * variation;
      const x = cx + Math.cos(angle) * radiusX * radius;
      const y = cy + Math.sin(angle) * radiusY * radius;
      return contain ? constrainDrawingPoint(x, y) : [x, y];
    });
    const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let path = `M${midpoint(points.at(-1), points[0]).map((value) => value.toFixed(1)).join(' ')}`;
    points.forEach((point, index) => {
      path += ` Q${point.map((value) => value.toFixed(1)).join(' ')} ${midpoint(point, points[(index + 1) % points.length]).map((value) => value.toFixed(1)).join(' ')}`;
    });
    return `${path} Z`;
  }

  function ellipsePath(cx, cy, rx, ry) {
    return `M${(cx - rx).toFixed(1)} ${cy.toFixed(1)} A${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(cx + rx).toFixed(1)} ${cy.toFixed(1)} A${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(cx - rx).toFixed(1)} ${cy.toFixed(1)}`;
  }

  function rotatePoint(x, y, angle, cx = 60, cy = 60) {
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * Math.cos(angle) - dy * Math.sin(angle), cy + dx * Math.sin(angle) + dy * Math.cos(angle)];
  }

  function renderAvatarStructure(profile, colorFor) {
    const phase = profile.rotation * Math.PI / 180;
    const radius = profile.spread;
    const path = (className, points, colorIndex = 0, close = false) => {
      const coordinates = points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`);
      return `<path class="${className}" d="M${coordinates[0]} ${coordinates.slice(1).map((point) => `L${point}`).join(' ')}${close ? ' Z' : ''}" style="stroke:${colorFor(colorIndex)}${className === 'avatar-spiral' ? ';stroke-dasharray:none' : ''}" />`;
    };
    const circle = (rx, ry, colorIndex = 0, className = 'avatar-contour', rotation = 0) =>
      `<path class="${className}" d="${ellipsePath(60, 60, rx, ry)}" style="stroke:${colorFor(colorIndex)}" transform="rotate(${rotation.toFixed(1)} 60 60)" />`;

    if (profile.morphology === 'coiled') {
      const turns = 1.15 + profile.spiralCount * .42 + profile.dependence * .7;
      const points = Array.from({ length: 92 }, (_, index) => {
        const t = index / 91;
        const angle = phase + t * turns * Math.PI * 2;
        const distance = 1.5 + t * (radius * (.76 + profile.requirements * .18));
        return [60 + Math.cos(angle) * distance, 60 + Math.sin(angle) * distance * .78];
      });
      return `${circle(radius * .84, radius * .66, 1)}${path('avatar-spiral', points, 0)}${circle(4 + profile.dependence * 3, 3.5 + profile.dependence * 2, 2, 'avatar-contour', profile.rotation)}`;
    }

    if (profile.morphology === 'segmented') {
      const count = 4 + Math.round(profile.mobility * 3 + profile.adaptability * 2);
      const length = Math.min(76, radius * 1.9 + profile.mobility * 10);
      const segmentLength = length / count;
      const start = -(count - 1) * segmentLength / 2;
      const segments = Array.from({ length: count }, (_, index) => {
        const [x, y] = rotatePoint(60 + start + index * segmentLength, 60 + Math.sin(index * .62 + phase) * 4, phase);
        const rx = segmentLength * (.39 + (index === 0 || index === count - 1 ? .08 : 0));
        const ry = 5.5 + profile.influence * 2.6;
        return `<path class="avatar-contour" d="${ellipsePath(x, y, rx, ry)}" style="stroke:${colorFor(index)}" transform="rotate(${(profile.rotation + Math.sin(index * .62 + phase) * 12).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" />`;
      }).join('');
      const spine = path('avatar-line', [rotatePoint(60 - length * .56, 60, phase), rotatePoint(60 + length * .56, 60, phase)], 1);
      return `${segments}${spine}`;
    }

    if (profile.morphology === 'radial') {
      const rays = 6 + Math.round(profile.collective * 7);
      const rings = 1 + Math.round(profile.adaptability * 3);
      const spokes = Array.from({ length: rays }, (_, index) => {
        const angle = phase + index * Math.PI * 2 / rays;
        return path('avatar-line', [
          [60 + Math.cos(angle) * 5, 60 + Math.sin(angle) * 5],
          [60 + Math.cos(angle) * radius, 60 + Math.sin(angle) * radius]
        ], index % 3);
      }).join('');
      const circles = Array.from({ length: rings }, (_, index) => {
        const ringRadius = 8 + (radius - 8) * (index + 1) / (rings + 1);
        return circle(ringRadius, ringRadius * (.72 + profile.tolerance * .12), index + 1, 'avatar-contour', profile.rotation);
      }).join('');
      return `${spokes}${circles}${circle(4 + profile.influence * 3, 4 + profile.influence * 3, 0)}`;
    }

    if (profile.morphology === 'reticular') {
      const rings = [radius * .34, radius * .68, radius];
      const points = rings.map((ringRadius, ringIndex) => {
        const pointCount = 6 + ringIndex * 3;
        return Array.from({ length: pointCount }, (_, index) => {
          const angle = phase + index * Math.PI * 2 / pointCount;
          return [60 + Math.cos(angle) * ringRadius, 60 + Math.sin(angle) * ringRadius * .78];
        });
      });
      const paths = points.map((ringPoints, ringIndex) => path('avatar-contour', ringPoints, ringIndex, true)).join('');
      const links = points.slice(0, -1).map((innerRing, ringIndex) => innerRing.map((point, index) => {
        const outerRing = points[ringIndex + 1];
        const outerPoint = outerRing[Math.floor(index * outerRing.length / innerRing.length)];
        return path('avatar-branch', [point, outerPoint], index + ringIndex);
      }).join('')).join('');
      return `${paths}${links}`;
    }

    if (profile.morphology === 'lobed') {
      const lobes = 5 + Math.round(profile.tolerance * 4);
      const layers = profile.contourCount;
      const outlines = Array.from({ length: layers }, (_, layer) => {
        const layerRadius = radius * (1 - layer * .13);
        const points = Array.from({ length: 72 }, (_, index) => {
          const angle = phase + index * Math.PI * 2 / 72;
          const wave = 1 + .19 * Math.cos(lobes * angle) + .045 * Math.sin((lobes - 1) * angle + phase);
          return [60 + Math.cos(angle) * layerRadius * wave, 60 + Math.sin(angle) * layerRadius * wave * .78];
        });
        return path('avatar-contour', points, layer, true);
      }).join('');
      const folds = Array.from({ length: lobes }, (_, index) => {
        const angle = phase + index * Math.PI * 2 / lobes;
        return path('avatar-vein', [
          [60 + Math.cos(angle) * radius * .28, 60 + Math.sin(angle) * radius * .22],
          [60 + Math.cos(angle) * radius * .76, 60 + Math.sin(angle) * radius * .59]
        ], index + 1);
      }).join('');
      return `${outlines}${folds}`;
    }

    const stems = 2 + Math.round(profile.collective * 2);
    const branches = Array.from({ length: stems }, (_, index) => {
      const angle = phase + index * Math.PI * 2 / stems;
      const end = [60 + Math.cos(angle) * radius, 60 + Math.sin(angle) * radius * .82];
      const base = [60 + Math.cos(angle) * radius * .42, 60 + Math.sin(angle) * radius * .34];
      const main = path('avatar-line', [[60, 60], base, end], index);
      const sideMarks = [.38, .68].map((position, sideIndex) => {
        const x = 60 + (end[0] - 60) * position;
        const y = 60 + (end[1] - 60) * position;
        const sideLength = radius * (.22 + profile.mobility * .12) * (1 - position * .32);
        const sign = sideIndex % 2 === 0 ? 1 : -1;
        const sideAngle = angle + sign * (.66 + profile.tolerance * .18);
        const branchEnd = [x + Math.cos(sideAngle) * sideLength, y + Math.sin(sideAngle) * sideLength];
        return path('avatar-branch', [[x, y], branchEnd], index + sideIndex + 1);
      }).join('');
      return main + sideMarks;
    }).join('');
    return `${circle(radius * .76, radius * .62, 1)}${branches}`;
  }

  function renderAvatarGlyph(avatar, compact = false, imprint = null) {
    const profile = avatarDrawingProfile(avatar);
    const hue = imprint ? mixHue(profile.hue, imprint.hue, imprint.strength * .58) : profile.hue;
    const palette = Array.from({ length: profile.paletteCount }, (_, index) => {
      const paletteHue = (hue + index * (17 + profile.paletteDiversity * 42) + 360) % 360;
      const lightness = 28 + (index % 3) * 8;
      return `hsl(${paletteHue.toFixed(1)} ${(26 + profile.paletteDiversity * 20).toFixed(1)}% ${lightness}%)`;
    });
    const colorFor = (index) => palette[index % palette.length];
    const hatchCount = Math.round(profile.requirements * 7 + profile.dependence * 3);
    const hatches = Array.from({ length: hatchCount }, (_, index) => {
      const row = Math.floor(index / 4);
      const column = index % 4;
      const x = 68 + column * 3.5;
      const y = 42 + row * 3.5;
      return `<path class="avatar-hatch" d="M${x.toFixed(1)} ${y.toFixed(1)} l2.2 2.2" style="stroke:${colorFor(index + 1)}" />`;
    }).join('');
    const dashLength = (2 + profile.dashScale * 2).toFixed(1);
    const guides = `<path class="avatar-guide" d="M60 14 V22 M60 98 V106 M14 60 H22 M98 60 H106" style="stroke-dasharray:${dashLength} ${(dashLength * .75).toFixed(1)}" />`;
    const imprintLines = imprint?.strength > .08
      ? `<path class="avatar-imprint" d="${irregularContour(60, 60, profile.spread * .88, profile.spread * .72, profile.seed + 511, 12, .06 + imprint.density * .06)}" style="stroke:${colorFor(1)};stroke-width:${(.8 + Math.min(.65, imprint.visitedSpaces * .08)).toFixed(1)}px;opacity:${(.34 + imprint.strength * .58).toFixed(2)}" />`
      : '';
    const routeImprint = imprint?.routeVisits
      ? `<path class="avatar-route-imprint" d="${irregularContour(60, 60, profile.spread * .72, profile.spread * .54, profile.seed + 733, 12, .04)}" style="stroke:hsl(${imprint.routeHue} 26% 38%);stroke-width:${(.7 + Math.min(.8, imprint.routeVisits * .08)).toFixed(1)}px;stroke-dasharray:${imprint.routeMobility > .62 ? '5 2' : imprint.routeCollective > .62 ? '1.5 2.5' : '3 2'};opacity:${(.4 + imprint.routeStrength * .48).toFixed(2)}" />`
      : '';
    const dash = (2 + profile.dashScale * 2).toFixed(1);
    return `<svg viewBox="0 0 120 120" class="generated-avatar ${compact ? 'compact-glyph' : ''}" role="img" aria-label="Trait-generated architectural drawing for ${escapeHTML(avatar.name)}${imprint?.strength > .08 ? ', visually influenced by encountered spaces' : ''}" style="--avatar-ink:${colorFor(0)};--avatar-secondary:${colorFor(1)};--avatar-line-opacity:${(.58 + profile.influence * .35).toFixed(2)};--avatar-line-width:${(profile.lineWeight + profile.dependence * .35).toFixed(2)}px;--avatar-dash:${dash}px">
      ${guides}${renderAvatarStructure(profile, colorFor)}${hatches}${imprintLines}${routeImprint}
      <path class="avatar-reference" d="M56 60 h8 M60 56 v8" />
    </svg>`;
  }

  function avatarToken(avatar, compact = false, imprint = null) {
    return `<span class="avatar-token" data-avatar-token="${escapeHTML(avatar.id)}" title="${escapeHTML(avatar.name)}">${renderAvatarGlyph(avatar, compact, imprint)}</span>`;
  }

  function refreshAvatarVisual(avatar) {
    document.querySelectorAll('[data-avatar-glyph]').forEach((element) => {
      if (element.dataset.avatarGlyph === avatar.id) element.innerHTML = renderAvatarGlyph(avatar);
    });
    document.querySelectorAll('[data-avatar-token]').forEach((element) => {
      if (element.dataset.avatarToken === avatar.id) element.innerHTML = renderAvatarGlyph(avatar, true);
    });
  }

  function createVisualRecord() {
    return { weight: 0, hueX: 0, hueY: 0, mobility: 0, dependence: 0, adaptability: 0, collective: 0, tolerance: 0, requirements: 0, influence: 0, avatars: new Map(), contacts: 0, uses: 0 };
  }

  function recordAvatarInfluence(record, avatar, weight) {
    if (!avatar || !weight) return;
    const profile = avatarDrawingProfile(avatar);
    const hue = profile.hue * Math.PI / 180;
    record.weight += weight;
    record.hueX += Math.cos(hue) * weight;
    record.hueY += Math.sin(hue) * weight;
    record.mobility += profile.mobility * weight;
    record.dependence += profile.dependence * weight;
    record.adaptability += profile.adaptability * weight;
    record.collective += profile.collective * weight;
    record.tolerance += profile.tolerance * weight;
    record.requirements += profile.requirements * weight;
    record.influence += profile.influence * weight;
    record.avatars.set(avatar.id, avatar.name);
    record.contacts += 1;
  }

  function visualRecordStyle(record, fallbackHue) {
    if (!record?.weight) return { hue: fallbackHue, mobility: .5, dependence: .3, adaptability: .35, collective: .35, tolerance: .5, requirements: .2, influence: .3, strength: 0, weight: 0, contacts: 0, uses: 0, avatarCount: 0, avatarNames: [] };
    const hue = (Math.atan2(record.hueY, record.hueX) * 180 / Math.PI + 360) % 360;
    return {
      hue,
      strength: Math.min(.9, record.weight / (record.weight + 6) * .75 + Math.min(record.uses, 12) / 12 * .25),
      mobility: record.mobility / record.weight,
      dependence: record.dependence / record.weight,
      adaptability: record.adaptability / record.weight,
      collective: record.collective / record.weight,
      tolerance: record.tolerance / record.weight,
      requirements: record.requirements / record.weight,
      influence: record.influence / record.weight,
      weight: record.weight,
      contacts: record.contacts,
      uses: record.uses,
      avatarCount: record.avatars.size,
      avatarNames: [...record.avatars.values()]
    };
  }

  function visualHistory(lineage) {
    const spaces = new Map();
    const routes = new Map();
    const avatarJourneys = new Map();
    const firstState = lineage[0]?.inputState || state.experiment.rootState;
    firstState.architecture.spaces.forEach((space) => spaces.set(space.id, createVisualRecord()));
    const routeKey = (from, to) => [from, to].sort().join('|');
    lineage.forEach((entry) => {
      const avatarById = new Map(entry.inputState.avatars.map((avatar) => [avatar.id, avatar]));
      entry.inputState.architecture.spaces.forEach((space) => {
        if (!spaces.has(space.id)) spaces.set(space.id, createVisualRecord());
      });
      entry.interactions.forEach((event) => {
        const fromSpace = entry.inputState.architecture.spaces.find((space) => space.id === event.fromSpaceId);
        const legacyPath = event.fromSpaceId === event.toSpaceId
          ? [event.fromSpaceId]
          : fromSpace?.connections.includes(event.toSpaceId) ? [event.fromSpaceId, event.toSpaceId] : [];
        const pathSpaceIds = event.pathSpaceIds?.length ? event.pathSpaceIds : legacyPath;
        const involvedSpaces = [...new Set([...(event.spaceIds || []), ...pathSpaceIds, event.fromSpaceId, event.toSpaceId].filter(Boolean))];
        const eventWeight = event.type === 'movement' ? 1.5 : event.type === 'environmental-stress' ? 1.2 : event.type === 'social-encounter' ? 1.15 : .8;
        (event.avatarIds || []).forEach((avatarId) => {
          const avatar = avatarById.get(avatarId) || entry.outputState.avatars.find((item) => item.id === avatarId);
          if (!avatar) return;
          const weight = eventWeight * (.45 + Number(avatar.spatialInfluence || 0) / 100);
          involvedSpaces.forEach((spaceId) => {
            if (!spaces.has(spaceId)) spaces.set(spaceId, createVisualRecord());
            const record = spaces.get(spaceId);
            recordAvatarInfluence(record, avatar, weight);
            if (['movement', 'occupation'].includes(event.type)) record.uses += 1;
            if (!avatarJourneys.has(avatarId)) avatarJourneys.set(avatarId, { spaces: new Map(), routes: new Map() });
            const journey = avatarJourneys.get(avatarId).spaces;
            journey.set(spaceId, (journey.get(spaceId) || 0) + weight);
          });
          const path = pathSpaceIds.length ? pathSpaceIds : [];
          for (let index = 0; index < path.length - 1; index += 1) {
            const key = routeKey(path[index], path[index + 1]);
            if (!routes.has(key)) routes.set(key, createVisualRecord());
            const record = routes.get(key);
            recordAvatarInfluence(record, avatar, weight * 1.25);
            record.uses += 1;
            if (!avatarJourneys.has(avatarId)) avatarJourneys.set(avatarId, { spaces: new Map(), routes: new Map() });
            const journey = avatarJourneys.get(avatarId).routes;
            journey.set(key, (journey.get(key) || 0) + weight * 1.25);
          }
        });
      });
      entry.architecturalChanges.forEach((change) => {
        if (!change.entityId || !spaces.has(change.entityId)) return;
        const avatarIds = entry.interactions.find((event) => event.id === change.causeEventIds?.[0])?.avatarIds || [];
        avatarIds.forEach((avatarId) => {
          const avatar = avatarById.get(avatarId);
          if (avatar) recordAvatarInfluence(spaces.get(change.entityId), avatar, 1.4);
        });
      });
    });
    const spaceStyles = new Map();
    for (const [spaceId, record] of spaces) {
      const lastSpace = [...lineage].reverse().map((entry) => entry.outputState.architecture.spaces.find((space) => space.id === spaceId)).find(Boolean)
        || firstState.architecture.spaces.find((space) => space.id === spaceId);
      const environmentHue = lastSpace ? 205 - Number(lastSpace.temperature) * 1.55 + Number(lastSpace.light) * .22 : 145;
      const influence = visualRecordStyle(record, environmentHue);
      spaceStyles.set(spaceId, {
        ...influence,
        hue: mixHue(environmentHue, influence.hue, influence.strength * .72),
        environmentHue
      });
    }
    const routeStyles = new Map([...routes].map(([key, record]) => [key, visualRecordStyle(record, 145)]));
    const avatarImprints = new Map();
    for (const [avatarId, journey] of avatarJourneys) {
      let hueX = 0;
      let hueY = 0;
      let total = 0;
      let strength = 0;
      let density = 0;
      let routeHueX = 0;
      let routeHueY = 0;
      let routeWeight = 0;
      let routeStrength = 0;
      let routeMobility = 0;
      let routeCollective = 0;
      for (const [spaceId, weight] of journey.spaces) {
        const style = spaceStyles.get(spaceId);
        if (!style) continue;
        const angle = style.hue * Math.PI / 180;
        hueX += Math.cos(angle) * weight;
        hueY += Math.sin(angle) * weight;
        total += weight;
        strength += style.strength * weight;
        density += style.dependence * weight;
      }
      for (const [routeId, weight] of journey.routes) {
        const style = routeStyles.get(routeId);
        if (!style) continue;
        const angle = style.hue * Math.PI / 180;
        routeHueX += Math.cos(angle) * weight;
        routeHueY += Math.sin(angle) * weight;
        routeWeight += weight;
        routeStrength += style.strength * weight;
        routeMobility += style.mobility * weight;
        routeCollective += style.collective * weight;
      }
      if (total) {
        avatarImprints.set(avatarId, {
          hue: (Math.atan2(hueY, hueX) * 180 / Math.PI + 360) % 360,
          strength: Math.min(.88, .18 + strength / total * .72 + Math.min(.16, Math.max(0, journey.spaces.size - 1) * .035)),
          density: density / total,
          visitedSpaces: journey.spaces.size,
          routeHue: routeWeight ? (Math.atan2(routeHueY, routeHueX) * 180 / Math.PI + 360) % 360 : null,
          routeStrength: routeWeight ? routeStrength / routeWeight : 0,
          routeMobility: routeWeight ? routeMobility / routeWeight : 0,
          routeCollective: routeWeight ? routeCollective / routeWeight : 0,
          routeVisits: [...journey.routes.keys()].reduce((sum, key) => sum + (routeStyles.get(key)?.uses || 0), 0)
        });
      }
    }
    return {
      spaceStyles,
      routeStyles,
      avatarImprints
    };
  }

  function setStatus(message, isError = false) {
    const status = $('#storage-status');
    status.textContent = message;
    status.classList.toggle('error', isError);
  }

  function setGenerationStatus(message, isError = false) {
    const status = $('#generation-status');
    status.textContent = message;
    status.classList.toggle('error', isError);
  }

  async function saveExperiment(showMessage = true) {
    if (!state.experiment) return;
    state.experiment.name = $('#experiment-name').value.trim().slice(0, 80) || 'Untitled becoming study';
    state.experiment.updatedAt = new Date().toISOString();
    state.experiment.headState = Model.clone(activeBranch().headState);
    state.experiment.pendingDraftState = Model.clone(state.draft);
    state.experiment.pendingBranchEntryId = state.branchEntryId;
    state.experiment.selectedPreset = state.selectedPreset;
    if (!state.storageReady) {
      if (showMessage) setStatus('Not saved: browser storage is unavailable.', true);
      return;
    }
    try {
      await Storage.save(state.experiment);
      state.experiments = await Storage.list();
      renderExperimentSelect();
      if (showMessage) setStatus('Saved locally in this browser.');
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  function scheduleSave() {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => saveExperiment(false), 350);
  }

  function renderExperimentSelect() {
    const select = $('#experiment-select');
    const records = state.experiments.slice();
    if (state.experiment && !records.some((item) => item.id === state.experiment.id)) records.push(state.experiment);
    select.innerHTML = records
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((item) => `<option value="${escapeHTML(item.id)}" ${item.id === state.experiment.id ? 'selected' : ''}>${escapeHTML(item.name)}</option>`)
      .join('');
  }

  function renderArchitectureControls() {
    const globalControls = ARCHITECTURE_FIELDS.map(([field, label]) => `
      <div class="range-row">
        <label for="architecture-${field}">${label}</label>
        <output for="architecture-${field}">${Math.round(state.draft.architecture[field])}</output>
        <input id="architecture-${field}" type="range" min="0" max="100" step="1" value="${Math.round(state.draft.architecture[field])}" data-architecture-field="${field}" />
        <p class="range-note">${ARCHITECTURE_STORIES[field]}</p>
      </div>`).join('');
    const spaces = state.draft.architecture.spaces.map((space) => `
      <details class="space-card">
        <summary><span>${escapeHTML(space.name)}</span><small>${space.connections.length} connected spaces</small></summary>
        <div class="space-fields">
          ${[['temperature', 'Temperature', 0, 100], ['light', 'Light', 0, 100], ['resourceCapacity', 'Resource capacity', 10, 120], ['occupancyCapacity', 'Occupancy capacity', 1, 8]].map(([field, label, min, max]) => `
            <div class="range-row">
              <label for="${space.id}-${field}">${label}</label>
              <output for="${space.id}-${field}">${Math.round(space[field])}</output>
              <input id="${space.id}-${field}" type="range" min="${min}" max="${max}" step="1" value="${Math.round(space[field])}" data-space-id="${escapeHTML(space.id)}" data-field="${field}" />
              <p class="range-note">${field === 'temperature' ? 'A warmer or cooler setting changes which beings feel at home here.' : field === 'light' ? 'A brighter or darker setting changes environmental fit.' : field === 'resourceCapacity' ? 'The maximum shared resource this place can hold.' : 'How many entities can occupy this space at once.'}</p>
            </div>`).join('')}
        </div>
      </details>`).join('');
    $('#architecture-controls').innerHTML = `${globalControls}<p class="space-control-label">SPACE MODULES · EDIT INITIAL CONDITIONS</p>${spaces}`;
  }

  function avatarRange(avatar, field, label) {
    return `<div class="range-row avatar-range"><label for="${escapeHTML(avatar.id)}-${field}">${label}</label><output for="${escapeHTML(avatar.id)}-${field}">${Math.round(avatar[field])}</output><input id="${escapeHTML(avatar.id)}-${field}" type="range" min="0" max="100" step="1" value="${Math.round(avatar[field])}" data-avatar-id="${escapeHTML(avatar.id)}" data-field="${field}" /><p class="range-note">${AVATAR_STORIES[field]}</p></div>`;
  }

  function renderAvatarEditor() {
    const host = $('#avatar-editor-list');
    host.innerHTML = state.draft.avatars.map((avatar, index) => `
      <details class="avatar-card" ${index === 0 ? 'open' : ''} data-avatar-card="${escapeHTML(avatar.id)}">
        <summary><span class="avatar-summary-name"><span class="avatar-glyph" data-avatar-glyph="${escapeHTML(avatar.id)}">${renderAvatarGlyph(avatar)}</span><span class="avatar-summary-name-text">${escapeHTML(avatar.name)}</span></span><small>${escapeHTML(avatar.type)}</small></summary>
        <div class="avatar-fields">
          <label>Name<input type="text" maxlength="80" value="${escapeHTML(avatar.name)}" data-avatar-id="${escapeHTML(avatar.id)}" data-field="name" /></label>
          <label>Kind / type<input type="text" maxlength="80" value="${escapeHTML(avatar.type)}" data-avatar-id="${escapeHTML(avatar.id)}" data-field="type" /></label>
          <label class="wide">Description<textarea rows="2" maxlength="280" data-avatar-id="${escapeHTML(avatar.id)}" data-field="description">${escapeHTML(avatar.description)}</textarea></label>
          ${AVATAR_FIELDS.map(([field, label]) => avatarRange(avatar, field, label)).join('')}
          <label>Preferred temperature<input type="number" min="0" max="100" step="1" value="${avatar.environmentalPreferences.temperature}" data-avatar-id="${escapeHTML(avatar.id)}" data-preference="temperature" /><small class="field-note">The temperature this being tends to seek.</small></label>
          <label>Preferred light<input type="number" min="0" max="100" step="1" value="${avatar.environmentalPreferences.light}" data-avatar-id="${escapeHTML(avatar.id)}" data-preference="light" /><small class="field-note">The brightness this being tends to seek.</small></label>
        </div>
        <div class="avatar-actions"><button type="button" data-avatar-action="duplicate" data-avatar-id="${escapeHTML(avatar.id)}">Duplicate</button><button type="button" class="danger" data-avatar-action="remove" data-avatar-id="${escapeHTML(avatar.id)}" ${state.draft.avatars.length <= 1 ? 'disabled' : ''}>Remove</button></div>
      </details>`).join('');
  }

  function renderConfigure() {
    $('#experiment-name').value = state.experiment.name;
    renderArchitectureControls();
    renderAvatarEditor();
    $('#starter-cast').innerHTML = state.draft.avatars.map((avatar) => `<article class="starter-being">${avatarToken(avatar)}<div class="starter-being-copy"><strong>${escapeHTML(avatar.name)}</strong><small>${escapeHTML(avatar.type)}</small><p>${escapeHTML(avatar.description || 'An example being with its own preferences and needs.')}</p></div></article>`).join('');
    document.querySelectorAll('[data-world-preset]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.worldPreset === state.selectedPreset)));
  }

  function applyWorldPreset(key) {
    const preset = WORLD_PRESETS[key];
    if (!preset) return;
    state.selectedPreset = key;
    state.experiment.selectedPreset = key;
    const architecture = Model.createInitialArchitecture({
      connectivity: preset.connectivity,
      resourceAvailability: preset.resourceAvailability,
      adaptability: preset.adaptability
    });
    if (key === 'shifting') {
      architecture.spaces.forEach((space, index) => {
        space.temperature = Model.clamp(space.temperature + [-20, 12, 24, -8, 18, -17, 7, 28][index], 0, 100);
      });
    }
    state.draft.architecture = architecture;
    renderConfigure();
    scheduleSave();
  }

  function setAdvancedMode(enabled) {
    state.advanced = enabled;
    const toggle = $('#advanced-mode-toggle');
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.textContent = `Advanced mode · ${enabled ? 'On' : 'Off'}`;
    document.querySelectorAll('.advanced-only').forEach((element) => { element.hidden = !enabled; });
    const note = $('#branch-edit-note');
    note.hidden = !state.branchEntryId;
    if (state.branchEntryId) {
      const source = state.experiment.diary.find((entry) => entry.id === state.branchEntryId);
      note.textContent = `Editing a new path from generation ${source?.generation ?? '?'}; the existing history will not be changed.`;
    }
  }

  function architectureNodeSvg(style, seed, resourceRatio = .5) {
    const hue = style.hue;
    const visitScale = 1 + Math.min(style.uses, 12) * .018;
    const rx = (56 + resourceRatio * 9) * visitScale;
    const ry = (33 + resourceRatio * 6) * visitScale;
    const shell = irregularContour(70, 46, rx, ry, seed, 12, .07 + style.adaptability * .06);
    const layers = Math.min(5, 1 + Math.floor(style.uses / 2) + Math.round(style.tolerance * 2));
    const contours = Array.from({ length: layers }, (_, index) => `<path class="space-contour" d="${irregularContour(70, 46, rx * (.82 - index * .13), ry * (.8 - index * .13), seed + index * 91 + 7, 12, .06)}" />`).join('');
    const rayCount = 2 + Math.round(style.collective * 5);
    const phase = ((seed * .037) % 360) * Math.PI / 180;
    const structuralLines = Array.from({ length: rayCount }, (_, index) => {
      const angle = phase + index * Math.PI * 2 / rayCount;
      const endX = 70 + Math.cos(angle) * (18 + style.mobility * 27);
      const endY = 46 + Math.sin(angle) * (10 + style.mobility * 18);
      return `<path d="M70 46 L${endX.toFixed(1)} ${endY.toFixed(1)}" />`;
    }).join('');
    const hatches = Array.from({ length: Math.round((style.dependence * .55 + style.requirements * .45) * 10) }, (_, index) => {
      const column = index % 5;
      const row = Math.floor(index / 5);
      const x = 34 + column * 5;
      const y = 27 + row * 4;
      return `<path d="M${x} ${y} l3 -2" />`;
    }).join('');
    const stroke = `hsl(${hue.toFixed(1)} 23% 34%)`;
    const secondary = `hsl(${(hue + 9).toFixed(1)} 17% 49%)`;
    return `<svg class="space-geometry" viewBox="0 0 140 92" aria-hidden="true" style="--node-ink:${stroke};--node-secondary:${secondary};--node-line:${(1 + style.strength * 1.2 + Math.min(style.uses, 8) * .12).toFixed(1)}px">
      <path class="space-shell" d="${shell}" />
      ${contours}
      <g class="space-structure">${structuralLines}</g>
      <g class="space-hatch">${hatches}</g>
      <path class="space-register" d="M9 10 h9 M9 10 v9 M122 82 h9 M131 73 v9" />
    </svg>`;
  }

  function renderWorld(simulationState, entry = null, lineage = []) {
    const diagram = $('#world-diagram');
    const positions = new Map(simulationState.architecture.spaces.map((space) => [space.id, space]));
    const visuals = visualHistory(lineage);
    const recentRoutes = new Set();
    const recentSpaces = new Set();
    (entry?.interactions || []).forEach((event) => {
      if (!['movement', 'occupation'].includes(event.type)) return;
      (event.pathSpaceIds || []).forEach((spaceId) => recentSpaces.add(spaceId));
      for (let index = 0; index < (event.pathSpaceIds || []).length - 1; index += 1) {
        recentRoutes.add([event.pathSpaceIds[index], event.pathSpaceIds[index + 1]].sort().join('|'));
      }
    });
    const lines = simulationState.architecture.spaces.flatMap((space) => space.connections
      .filter((otherId) => space.id < otherId)
      .map((otherId) => {
        const peer = positions.get(otherId);
        const key = [space.id, otherId].sort().join('|');
        const style = visuals.routeStyles.get(key) || visualRecordStyle(null, 145);
        const x1 = space.x * 10;
        const y1 = space.y * 6;
        const x2 = peer.x * 10;
        const y2 = peer.y * 6;
        const bend = style.weight ? (8 + style.mobility * 28) * (space.id.charCodeAt(space.id.length - 1) % 2 ? 1 : -1) : 0;
        const curveX = (x1 + x2) / 2 - (y2 - y1) / 100 * bend;
        const curveY = (y1 + y2) / 2 + (x2 - x1) / 100 * bend;
        const strokeWidth = (1.2 + style.strength * 1.6 + Math.min(2.4, style.uses * .38) + style.influence * .5).toFixed(1);
        const dash = style.collective > .66 ? '2 3' : style.mobility > .66 ? '7 3' : 'none';
        const routeNames = style.avatarNames.length ? style.avatarNames.join(', ') : 'no avatar recorded yet';
        return `<path class="world-route${recentRoutes.has(key) ? ' route-used-this-round' : ''}" d="M${x1} ${y1} Q${curveX.toFixed(1)} ${curveY.toFixed(1)} ${x2} ${y2}" style="--route-hue:${style.hue};--route-width:${strokeWidth}px;--route-opacity:${Math.min(.95, .34 + style.strength * .42 + Math.min(.38, style.uses * .055)).toFixed(2)};--route-dash:${dash}"><title>${style.uses} recorded traversal${style.uses === 1 ? '' : 's'} · ${escapeHTML(routeNames)}</title></path>`;
      })).join('');
    const avatarsBySpace = new Map(simulationState.architecture.spaces.map((space) => [space.id, []]));
    simulationState.avatars.forEach((avatar) => {
      if (avatarsBySpace.has(avatar.locationId)) avatarsBySpace.get(avatar.locationId).push(avatar);
    });
    const nodes = simulationState.architecture.spaces.map((space) => {
      const style = visuals.spaceStyles.get(space.id) || visualRecordStyle(null, 145);
      const occupants = avatarsBySpace.get(space.id);
      const resourceRatio = space.resourceCapacity ? space.availableResources / space.resourceCapacity : 0;
      const influenceNote = style.uses
        ? `<span class="space-influence-note">${style.uses} visit${style.uses === 1 ? '' : 's'} · ${escapeHTML(style.avatarNames.slice(0, 2).join(', '))}${style.avatarNames.length > 2 ? ` +${style.avatarNames.length - 2}` : ''}</span>`
        : '';
      return `<div class="world-space${recentSpaces.has(space.id) ? ' space-used-this-round' : ''}" style="left:${space.x}%;top:${space.y}%;--resource-level:${Math.round(space.availableResources / space.resourceCapacity * 100)}%;--node-hue:${style.hue.toFixed(1)};--node-influence:${style.strength.toFixed(2)}">
        ${architectureNodeSvg(style, space.x + space.y, resourceRatio)}
        <div class="space-content"><strong>${escapeHTML(space.name)}</strong>
        <small>${Math.round(space.temperature)}° T · ${Math.round(space.light)} L · ${Math.round(space.availableResources)}/${space.resourceCapacity} R · cap ${space.occupancyCapacity}</small>
        <span class="avatar-tokens">${occupants.map((avatar) => avatarToken(avatar, true, visuals.avatarImprints.get(avatar.id))).join('')}</span>
        ${influenceNote}</div>
      </div>`;
    }).join('');
    diagram.innerHTML = `<svg class="world-connections" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${nodes}`;
    $('#world-generation').textContent = `GEN ${String(simulationState.generation).padStart(3, '0')} · ${simulationState.architecture.connectivity}% CONNECTIVITY`;
    $('#world-legend').innerHTML = `<span class="visual-key">A moving highlight marks this round’s journeys. Paths thicken with repeat use and carry travelers’ traits into their drawings. Visited spaces gather those traits; their climate and resources shape avatar choices and changes.</span>${simulationState.avatars.map((avatar) => `<span class="legend-item">${avatarToken(avatar, true, visuals.avatarImprints.get(avatar.id))}${escapeHTML(avatar.name)}</span>`).join('')}`;
    const events = entry?.interactions || [];
    $('#interaction-count').textContent = `${events.length} EVENTS`;
    $('#latest-events').innerHTML = events.length ? events.map((event) => `<div class="event-record"><strong>${escapeHTML(event.type)} · ${escapeHTML(event.ruleId)}</strong><p>${escapeHTML(event.description)}</p></div>`).join('') : '<p>No interaction events recorded in this generation.</p>';
  }

  function renderSimulation() {
    const branch = activeBranch();
    const lineage = activeLineage();
    const lastEntry = lineage[lineage.length - 1] || null;
    renderWorld(branch.headState, lastEntry, lineage);
    $('#generation-story').innerHTML = lastEntry
      ? `<p class="story-kicker">GENERATION ${String(lastEntry.generation).padStart(3, '0')} · ${escapeHTML(branch.label)}</p>${generationNarrative(lastEntry).map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`).join('')}`
      : '<p>Choose a starting situation, then let the first generation unfold. Follow where the beings go, what they encounter, and what shifts in the shared environment.</p>';
  }

  function stateSummary(simulationState) {
    const mean = (key) => (simulationState.avatars.reduce((sum, avatar) => sum + avatar[key], 0) / simulationState.avatars.length).toFixed(1);
    return `<div class="snapshot-card"><h5>Avatars · generation ${String(simulationState.generation).padStart(3, '0')}</h5>
      <p>${simulationState.avatars.length} entities · average mobility ${mean('mobility')}</p>
      <p>Average tolerance ${mean('environmentalTolerance')} · dependence ${mean('resourceDependence')}</p>
      <p>Average adaptability ${mean('adaptability')} · collective behaviour ${mean('collectiveBehaviour')}</p></div>
      <div class="snapshot-card"><h5>Architecture</h5>
      <p>${simulationState.architecture.spaces.length} spaces · network connectivity ${simulationState.architecture.connectivity}%</p>
      <p>${simulationState.architecture.spaces.reduce((sum, space) => sum + space.connections.length, 0) / 2} reciprocal links · resources ${simulationState.architecture.spaces.reduce((sum, space) => sum + space.availableResources, 0).toFixed(1)} total</p>
      <p>System adaptability ${simulationState.architecture.adaptability} · resource setting ${simulationState.architecture.resourceAvailability}</p></div>`;
  }

  function systemMapSvg(simulationState, comparisonState, isAfter, visuals) {
    const spaces = simulationState.architecture.spaces;
    const otherConnections = new Set(comparisonState.architecture.spaces.flatMap((space) => space.connections
      .map((peer) => [space.id, peer].sort().join('|'))));
    const lines = spaces.flatMap((space) => space.connections
      .filter((peer) => space.id < peer)
      .map((peerId) => {
        const peer = spaces.find((candidate) => candidate.id === peerId);
        const key = [space.id, peerId].sort().join('|');
        const changed = isAfter ? !otherConnections.has(key) : !otherConnections.has(key);
        const klass = changed ? (isAfter ? 'added' : 'removed') : '';
        const style = visuals?.routeStyles.get(key) || visualRecordStyle(null, 145);
        const x1 = space.x * 2.35 + 8;
        const y1 = space.y * 1.35 + 8;
        const x2 = peer.x * 2.35 + 8;
        const y2 = peer.y * 1.35 + 8;
        const bend = style.weight ? 1 + style.mobility * 5 : 0;
        const dash = style.collective > .66 ? '1.5 2' : style.mobility > .66 ? '4 2' : 'none';
        const routeNames = style.avatarNames.join(', ') || 'no avatar recorded yet';
        return `<path class="map-link ${klass}" d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${((x1 + x2) / 2).toFixed(1)} ${(y1 + y2) / 2 - bend} ${x2.toFixed(1)} ${y2.toFixed(1)}" style="--route-hue:${style.hue};--route-width:${(1 + Math.min(2, style.strength * 1.4) + Math.min(1.5, style.uses * .18)).toFixed(1)}px;stroke-dasharray:${dash}"><title>${style.uses} recorded traversal${style.uses === 1 ? '' : 's'} · ${escapeHTML(routeNames)}</title></path>`;
      })).join('');
    const nodes = spaces.map((space) => {
      const x = space.x * 2.35 + 8;
      const y = space.y * 1.35 + 8;
      const resourceRatio = space.resourceCapacity ? space.availableResources / space.resourceCapacity : 0;
      const style = visuals?.spaceStyles.get(space.id) || visualRecordStyle(null, 205 - space.temperature * 1.55 + space.light * .22);
      const nodeSize = 5 + resourceRatio * 2.2 + Math.min(style.uses, 12) * .12;
      const shape = irregularContour(x, y, nodeSize, nodeSize, Math.round(space.x * 17 + space.y * 11), 9 + Math.round(style.adaptability * 4), .06);
      const markers = simulationState.avatars.filter((avatar) => avatar.locationId === space.id).map((avatar, index, list) => {
        const angle = Math.PI * 2 * index / Math.max(1, list.length);
        const avatarImprint = visuals?.avatarImprints.get(avatar.id);
        const profile = avatarDrawingProfile(avatar);
        const hue = avatarImprint ? mixHue(profile.hue, avatarImprint.hue, avatarImprint.strength * .58) : profile.hue;
        const markerX = x + Math.cos(angle) * 7;
        const markerY = y + Math.sin(angle) * 7;
        return `<path d="${irregularContour(markerX, markerY, 2.2 + profile.influence * 1.4, 1.8 + profile.collective, profile.seed + index, 6, .1)}" fill="none" stroke="hsl(${hue.toFixed(1)} 23% 31%)" stroke-width=".8"><title>${escapeHTML(avatar.name)}</title></path>`;
      }).join('');
      const inner = style.dependence > .55 ? `<path d="${irregularContour(x, y, 3.2 + resourceRatio, 3 + resourceRatio, Math.round(space.x * 7 + space.y * 3), 6, .12)}" fill="none" stroke="hsl(${style.hue.toFixed(1)} 21% 47%)" stroke-width=".6" />` : '';
      return `<g><path class="map-space" d="${shape}" fill="none" stroke="hsl(${style.hue.toFixed(1)} 23% 37%)" stroke-width="${(0.7 + style.strength * .6 + Math.min(style.uses, 8) * .08).toFixed(1)}"><title>${escapeHTML(space.name)}: ${style.uses} recorded visit${style.uses === 1 ? '' : 's'} by ${escapeHTML(style.avatarNames.join(', ') || 'no avatar yet')}; ${Math.round(space.temperature)} temperature, ${Math.round(space.availableResources)} of ${space.resourceCapacity} resource</title></path>${inner}${markers}<path d="M${(x - 2).toFixed(1)} ${y.toFixed(1)} h4 M${x.toFixed(1)} ${(y - 2).toFixed(1)} v4" stroke="#747467" stroke-width=".45" /><text x="${x.toFixed(1)}" y="${(y + 13).toFixed(1)}">${escapeHTML(space.id.slice(-2))}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 250 145" role="img" aria-label="Generative architectural map of spaces, paths, and accumulated visitor traces">${lines}${nodes}</svg>`;
  }

  function avatarVisualHistory(entry, beforeVisuals, afterVisuals) {
    return entry.inputState.avatars.map((before) => {
      const after = entry.outputState.avatars.find((avatar) => avatar.id === before.id);
      const changes = entry.avatarChanges.filter((change) => change.entityId === before.id);
      const labels = changes.slice(0, 3).map((change) => `${change.property}: ${change.previousValue} → ${change.newValue}`);
      return `<article class="avatar-change-pair">
        <strong>${escapeHTML(before.name)}</strong>
        <span class="avatar-change-side"><small>Before</small><span class="avatar-glyph history-glyph">${renderAvatarGlyph(before, false, beforeVisuals?.avatarImprints.get(before.id))}</span></span>
        <span class="arrow" aria-hidden="true">→</span>
        <span class="avatar-change-side"><small>After</small>${after ? `<span class="avatar-glyph history-glyph">${renderAvatarGlyph(after, false, afterVisuals?.avatarImprints.get(after.id))}</span>` : '<span class="avatar-absent">No longer present</span>'}</span>
        <small class="avatar-change-note">${labels.length ? escapeHTML(labels.join(' · ')) : 'No modeled trait crossed a change rule.'}</small>
      </article>`;
    }).join('');
  }

  function renderDiaryEntry(entry, lineage = []) {
    if (!entry) {
      $('#diary-detail').innerHTML = '<p>Run a generation to begin the diary.</p>';
      return;
    }
    const changesHTML = (changes) => changes.length ? changes.map((change) => `
      <div class="diary-record"><strong>${escapeHTML(change.entityId)} · ${escapeHTML(change.property)}</strong>: ${escapeHTML(JSON.stringify(change.previousValue))} → ${escapeHTML(JSON.stringify(change.newValue))}
        <small>Rule: ${escapeHTML(change.ruleId)} · Trigger event(s): ${escapeHTML(change.causeEventIds.join(', '))}${entry.ruleExplanations?.[change.ruleId] ? ` · ${escapeHTML(entry.ruleExplanations[change.ruleId])}` : ''}</small>
      </div>`).join('') : '<p class="diary-record">No state changes recorded.</p>';
    const branch = state.experiment.branches[entry.branchId];
    const divergenceHTML = branch?.divergence?.length
      ? `<details><summary>Branch setup edits · ${branch.divergence.length}</summary>${branch.divergence.map((change) => `<div class="diary-record"><strong>${escapeHTML(change.entityId || change.property)} · ${escapeHTML(change.property)}</strong>: ${escapeHTML(JSON.stringify(change.previousValue))} → ${escapeHTML(JSON.stringify(change.newValue))}<small>User-directed branch setup; this is a divergence from the parent state, not a simulated transformation.</small></div>`).join('')}</details>`
      : '';
    const narrative = generationNarrative(entry);
    const resourceTotal = (simulationState) => simulationState.architecture.spaces.reduce((sum, space) => sum + space.availableResources, 0).toFixed(1);
    const entryIndex = lineage.findIndex((item) => item.id === entry.id);
    const beforeVisuals = visualHistory(lineage.slice(0, Math.max(0, entryIndex)));
    const afterVisuals = visualHistory(lineage.slice(0, entryIndex + 1));
    $('#diary-detail').innerHTML = `
      <div class="panel-heading"><div><p class="eyebrow">${escapeHTML(entry.branchId)} · parent ${escapeHTML(entry.parentEntryId || 'initial state')}</p><h4>Generation ${String(entry.generation).padStart(3, '0')}</h4></div><button type="button" class="button" data-branch-entry="${escapeHTML(entry.id)}">Branch from this generation</button></div>
      <div class="diary-narrative">${narrative.map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`).join('')}</div>
      <p class="diary-observation">Model reflection: ${escapeHTML(entry.criticalObservation)}</p>
      <section class="diary-visual-section"><div class="visual-section-heading"><h5>The shared environment</h5><p>Used routes gather traces from travelers; visited spaces gather traces from their inhabitants. Their conditions shape movement and can change the beings who encounter them.</p></div>
        <div class="system-visual-history">
          <div class="system-map-card"><strong>Before · ${entry.inputState.architecture.connectivity}% connected · ${resourceTotal(entry.inputState)} resource units</strong>${systemMapSvg(entry.inputState, entry.outputState, false, beforeVisuals)}</div>
          <div class="system-map-card"><strong>After · ${entry.outputState.architecture.connectivity}% connected · ${resourceTotal(entry.outputState)} resource units</strong>${systemMapSvg(entry.outputState, entry.inputState, true, afterVisuals)}</div>
        </div>
        <div class="avatar-visual-history">${avatarVisualHistory(entry, beforeVisuals, afterVisuals)}</div>
        <p class="visual-disclaimer">A place’s temperature, light, resources, and connections shape what happens there. Those conditions can change an avatar’s recorded traits; repeated visits also leave visible traces in both the space and the avatar. These are interpretive architectural drawings, not biological portraits or physical predictions.</p>
      </section>
      <details class="advanced-only" ${state.advanced ? '' : 'hidden'}><summary>Before and after · measured state</summary><div class="snapshot-grid">${stateSummary(entry.inputState)}${stateSummary(entry.outputState)}</div></details>
      ${divergenceHTML}
      <p class="diary-metrics">${entry.interactions.length} interactions · ${entry.avatarChanges.length + entry.architecturalChanges.length} measured changes · ${entry.architecturalModifications.length} funded building responses</p>
      <details class="advanced-only" ${state.advanced ? '' : 'hidden'}><summary>Recorded interactions · ${entry.interactions.length}</summary>${entry.interactions.map((event) => `<div class="diary-record"><strong>${escapeHTML(event.type)} · ${escapeHTML(event.id)}</strong><small>${escapeHTML(event.ruleId)} · ${escapeHTML(event.description)}</small></div>`).join('') || '<p class="diary-record">No interaction events.</p>'}</details>
      <details class="advanced-only" ${state.advanced ? '' : 'hidden'}><summary>Avatar changes · ${entry.avatarChanges.length}</summary>${changesHTML(entry.avatarChanges)}</details>
      <details class="advanced-only" ${state.advanced ? '' : 'hidden'}><summary>Architectural changes · ${entry.architecturalChanges.length}</summary>${changesHTML(entry.architecturalChanges)}</details>
      <details class="advanced-only" ${state.advanced ? '' : 'hidden'}><summary>Architectural modifications · ${entry.architecturalModifications.length}</summary>${entry.architecturalModifications.map((item) => `<div class="diary-record"><strong>${escapeHTML(item.ruleId)} · cost ${item.cost}</strong><small>${escapeHTML(item.description)} · event ${escapeHTML(item.eventId)}</small></div>`).join('') || '<p class="diary-record">No architectural modification was funded.</p>'}</details>
    `;
  }

  function renderTrajectorySummary(lineage) {
    const start = lineage[0]?.inputState || state.draft;
    const current = lineage.at(-1)?.outputState || activeBranch().headState;
    const startVisuals = visualHistory([]);
    const currentVisuals = visualHistory(lineage);
    const cast = (simulationState, visuals) => simulationState.avatars.map((avatar) => {
      const imprint = visuals.avatarImprints.get(avatar.id);
      return `<div class="trajectory-avatar"><span class="avatar-glyph">${renderAvatarGlyph(avatar, false, imprint)}</span><strong>${escapeHTML(avatar.name)}</strong><small>mobility ${Math.round(avatar.mobility)} · collective ${Math.round(avatar.collectiveBehaviour)}${imprint?.strength > .08 ? ` · ${imprint.visitedSpaces} spaces encountered` : ''}</small></div>`;
    }).join('');
    const generation = current.generation;
    const branchLabel = escapeHTML(activeBranch().label);
    const totalResources = (simulationState) => simulationState.architecture.spaces.reduce((sum, space) => sum + space.availableResources, 0).toFixed(0);
    $('#trajectory-summary').innerHTML = `
      <div class="trajectory-heading"><div><p class="eyebrow">A living record of the whole path</p><h4>From the first arrangement to now</h4></div><p>${generation ? `${generation} generation${generation === 1 ? '' : 's'} recorded · ${branchLabel}` : 'No generations yet · this is the initial arrangement'}</p></div>
      <p class="trajectory-explainer">Paths set which places can be reached. The rooms then push back through their climate and shared resources, sometimes changing the beings that use them. Repeated journeys and visits build traces into both the system and the avatars.</p>
      <div class="trajectory-states">
        <article class="trajectory-state"><header><div><span>START</span><strong>Initial conditions · generation 0</strong></div><small>${start.architecture.connectivity}% connected · ${totalResources(start)} shared resources</small></header>
          <div class="trajectory-map">${systemMapSvg(start, start, false, startVisuals)}</div><div class="trajectory-cast">${cast(start, startVisuals)}</div>
        </article>
        <article class="trajectory-state current"><header><div><span>NOW</span><strong>Generation ${String(generation).padStart(3, '0')} · ${branchLabel}</strong></div><small>${current.architecture.connectivity}% connected · ${totalResources(current)} shared resources</small></header>
          <div class="trajectory-map">${systemMapSvg(current, start, true, currentVisuals)}</div><div class="trajectory-cast">${cast(current, currentVisuals)}</div>
        </article>
      </div>
      <div class="trajectory-key"><span><i class="key-route"></i> paths carry encounter color and weight</span><span><i class="key-node"></i> node linework reflects avatar traits</span><span><i class="key-avatar"></i> avatar drawings borrow from encountered spaces</span></div>`;
  }

  function renderDiary() {
    const lineage = activeLineage();
    const timeline = $('#diary-timeline');
    timeline.innerHTML = lineage.length ? lineage.map((entry) => `<button type="button" data-diary-id="${escapeHTML(entry.id)}" aria-current="${entry.id === state.selectedDiaryId ? 'true' : 'false'}">Generation ${String(entry.generation).padStart(3, '0')}<small>${escapeHTML(entry.branchId)} · ${entry.avatarChanges.length + entry.architecturalChanges.length} changes</small></button>`).join('') : '<p>No generations recorded.</p>';
    const selected = lineage.find((entry) => entry.id === state.selectedDiaryId) || lineage[lineage.length - 1];
    if (selected) state.selectedDiaryId = selected.id;
    const selectedLineage = selected ? lineage.slice(0, lineage.findIndex((entry) => entry.id === selected.id) + 1) : lineage;
    renderTrajectorySummary(selectedLineage);
    $('#diary-play-toggle').disabled = lineage.length < 2;
    renderDiaryEntry(selected, selectedLineage);
  }

  function stepDiary(direction) {
    const lineage = activeLineage();
    if (!lineage.length) return;
    const currentIndex = lineage.findIndex((entry) => entry.id === state.selectedDiaryId);
    const nextIndex = Math.max(0, Math.min(lineage.length - 1, (currentIndex < 0 ? lineage.length - 1 : currentIndex) + direction));
    state.selectedDiaryId = lineage[nextIndex].id;
    renderDiary();
    if (state.playTimer && nextIndex === lineage.length - 1) stopDiaryPlayback();
  }

  function stopDiaryPlayback() {
    window.clearInterval(state.playTimer);
    state.playTimer = null;
    $('#diary-play-toggle').textContent = 'Play';
  }

  function toggleDiaryPlayback() {
    if (state.playTimer) {
      stopDiaryPlayback();
      return;
    }
    const lineage = activeLineage();
    if (lineage.length < 2) return;
    const currentIndex = lineage.findIndex((entry) => entry.id === state.selectedDiaryId);
    if (currentIndex >= lineage.length - 1) state.selectedDiaryId = lineage[0].id;
    $('#diary-play-toggle').textContent = 'Pause';
    stepDiary(1);
    state.playTimer = window.setInterval(() => stepDiary(1), 1100);
  }

  function renderComparison() {
    const branches = Object.values(state.experiment.branches);
    const options = branches.map((branch) => `<option value="${escapeHTML(branch.id)}">${escapeHTML(branch.label)}</option>`).join('');
    const left = $('#compare-left');
    const right = $('#compare-right');
    const oldLeft = left.value;
    const oldRight = right.value;
    left.innerHTML = options;
    right.innerHTML = options;
    if (branches.some((branch) => branch.id === oldLeft)) left.value = oldLeft;
    else left.value = branches[0]?.id || '';
    if (branches.some((branch) => branch.id === oldRight)) right.value = oldRight;
    else right.value = branches[1]?.id || branches[0]?.id || '';
    updateComparison();
  }

  function updateComparison() {
    const leftId = $('#compare-left').value;
    const rightId = $('#compare-right').value;
    const leftEntries = activeLineage(leftId);
    const rightEntries = activeLineage(rightId);
    if (!leftEntries.length || !rightEntries.length) {
      $('#comparison-result').innerHTML = '<p>Run generations on both paths to compare them.</p>';
      return;
    }
    const comparison = Model.compareBranches(leftEntries, rightEntries);
    const avatarRows = comparison.avatarDifferences.map((item) => `<p>${escapeHTML(item.avatarId)} · ${escapeHTML(item.property)}: ${item.left} / ${item.right}</p>`).join('');
    const architectureRows = comparison.architectureDifferences.map((item) => `<p>${escapeHTML(item.spaceId)} · ${escapeHTML(item.property)}: ${escapeHTML(JSON.stringify(item.left))} / ${escapeHTML(JSON.stringify(item.right))}</p>`).join('');
    $('#comparison-result').innerHTML = `<p>${comparison.converged ? 'The two paths currently have the same measured attributes and spaces.' : `The paths first diverge at generation ${comparison.divergenceGeneration ?? 'unknown'}.`}</p>
      <p>${comparison.sharedEntryIds.length} generations are shared · path lengths ${comparison.leftGenerationCount} / ${comparison.rightGenerationCount}.</p>
      <details class="advanced-only" ${state.advanced ? '' : 'hidden'}><summary>Avatar differences · ${comparison.avatarDifferences.length}</summary>${avatarRows || '<p>No avatar attribute differences.</p>'}</details>
      <details class="advanced-only" ${state.advanced ? '' : 'hidden'}><summary>Architectural differences · ${comparison.architectureDifferences.length}</summary>${architectureRows || '<p>No listed architectural differences.</p>'}</details>`;
  }

  function renderChart(lineage) {
    const target = $('#evolution-chart');
    if (!lineage.length) {
      target.innerHTML = '<p>No generations to chart yet.</p>';
      return;
    }
    const points = [{ generation: lineage[0].generation - 1, state: lineage[0].inputState }, ...lineage.map((entry) => ({ generation: entry.generation, state: entry.outputState }))];
    const width = Math.max(440, points.length * 70);
    const pad = 25;
    const height = 145;
    const x = (index) => pad + index * (width - pad * 2) / Math.max(1, points.length - 1);
    const y = (value) => height - pad - value * (height - pad * 2) / 100;
    const networks = points.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point.state.architecture.connectivity)}`).join(' ');
    const dependence = points.map((point, index) => {
      const mean = point.state.avatars.reduce((sum, avatar) => sum + avatar.resourceDependence, 0) / point.state.avatars.length;
      return `${index ? 'L' : 'M'}${x(index)},${y(mean)}`;
    }).join(' ');
    target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart of network connectivity and average avatar resource dependence by generation">
      <line x1="${pad}" y1="${y(50)}" x2="${width - pad}" y2="${y(50)}" stroke="#d7d3c8" />
      <text x="0" y="${y(100) + 3}">100</text><text x="6" y="${y(0) + 3}">0</text>
      <path d="${networks}" class="series series-network" /><path d="${dependence}" class="series series-dependence" />
      ${points.map((point, index) => `<circle class="chart-dot" cx="${x(index)}" cy="${y(point.state.architecture.connectivity)}" r="3" fill="#4a7150"><title>Gen ${point.generation}: network ${point.state.architecture.connectivity}</title></circle>`).join('')}
      ${points.map((point, index) => `<circle class="chart-dot" cx="${x(index)}" cy="${y(point.state.avatars.reduce((sum, avatar) => sum + avatar.resourceDependence, 0) / point.state.avatars.length)}" r="3" fill="#9c6f49"><title>Gen ${point.generation}: average dependence ${Math.round(point.state.avatars.reduce((sum, avatar) => sum + avatar.resourceDependence, 0) / point.state.avatars.length)}</title></circle>`).join('')}
      ${points.map((point, index) => `<text x="${x(index) - 13}" y="${height - 5}">${point.generation}</text>`).join('')}
      <text x="${Math.min(width - 120, pad + 20)}" y="12">● Network connectivity</text><text x="${Math.min(width - 120, pad + 190)}" y="12">● Average dependence</text>
    </svg>`;
  }

  function renderEvolution() {
    const lineage = activeLineage();
    const head = activeBranch().headState;
    const events = lineage.reduce((sum, entry) => sum + entry.interactions.length, 0);
    const changes = lineage.reduce((sum, entry) => sum + entry.avatarChanges.length + entry.architecturalChanges.length, 0);
    $('#evolution-story').innerHTML = Model.evolutionNarrative(lineage).map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`).join('');
    $('#evolution-summary').innerHTML = `<span class="metric-chip">${lineage.length} recorded generations on ${escapeHTML(activeBranch().label)}</span><span class="metric-chip">${head.architecture.connectivity}% network connectivity</span><span class="metric-chip">${head.avatars.length} current avatars</span><span class="metric-chip">${events} interactions · ${changes} state changes</span>`;
    const patterns = Model.detectPatterns(lineage);
    $('#pattern-list').innerHTML = patterns.length ? patterns.map((pattern) => `<div class="pattern-card"><strong>${escapeHTML(pattern.label)}</strong><p>${escapeHTML(pattern.evidence)}</p></div>`).join('') : '<p>No cross-generation pattern is evidenced yet. Run at least one generation; some patterns require a longer sequence.</p>';
    renderChart(lineage);
    renderComparison();
  }

  function renderAll() {
    renderExperimentSelect();
    renderConfigure();
    renderSimulation();
    renderDiary();
    renderEvolution();
    setAdvancedMode(state.advanced);
  }

  function showView(name) {
    if (name !== 'diary' && state.playTimer) stopDiaryPlayback();
    for (const viewName of ['configure', 'simulate', 'diary', 'evolution']) {
      const active = viewName === name;
      $(`#view-${viewName}`).hidden = !active;
      $(`#tab-${viewName}`).setAttribute('aria-selected', String(active));
      $(`#tab-${viewName}`).tabIndex = active ? 0 : -1;
    }
  }

  function nextAvatarId() {
    let number = state.draft.avatars.length + 1;
    let id = `avatar-custom-${String(number).padStart(2, '0')}`;
    while (state.draft.avatars.some((avatar) => avatar.id === id)) {
      number += 1;
      id = `avatar-custom-${String(number).padStart(2, '0')}`;
    }
    return id;
  }

  function randomInteger(minimum, maximum) {
    return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
  }

  function createDistinctAvatar() {
    const id = nextAvatarId();
    const avatar = Model.makeAvatar({
      id,
      name: `New being ${state.draft.avatars.length + 1}`,
      type: 'Speculative presence',
      description: 'A new being with its own preferences and needs.',
      mobility: randomInteger(5, 96),
      environmentalTolerance: randomInteger(4, 97),
      resourceDependence: randomInteger(3, 98),
      adaptability: randomInteger(7, 95),
      collectiveBehaviour: randomInteger(2, 98),
      spatialInfluence: randomInteger(12, 100),
      resourceRequirements: randomInteger(5, 96),
      environmentalPreferences: { temperature: randomInteger(5, 95), light: randomInteger(3, 97) },
      visual: Model.createVisualDNA(randomInteger(0, 4294967295), state.draft.avatars.map((existing) => existing.visual.morphology))
    }, state.draft.avatars.length + 1);
    avatar.locationId = state.draft.architecture.spaces[randomInteger(0, state.draft.architecture.spaces.length - 1)].id;
    return avatar;
  }

  function setDraftAvatarField(avatar, field, value) {
    if (field === 'name' || field === 'type' || field === 'description') {
      avatar[field] = field === 'description' ? String(value).slice(0, 280) : String(value).slice(0, 80);
    } else {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) avatar[field] = Model.clamp(numeric, 0, 100);
    }
  }

  function buildBranchEdits(sourceState, draft) {
    const edits = { architecture: {}, avatars: {}, spaces: {}, addAvatars: [], removeAvatarIds: [] };
    for (const field of ['connectivitySetting', 'resourceAvailability', 'adaptability']) {
      if (sourceState.architecture[field] !== draft.architecture[field]) edits.architecture[field === 'connectivitySetting' ? 'connectivity' : field] = draft.architecture[field];
    }
    for (const source of sourceState.avatars) {
      const next = draft.avatars.find((avatar) => avatar.id === source.id);
      if (!next) {
        edits.removeAvatarIds.push(source.id);
        continue;
      }
      const patch = {};
      for (const field of [...Object.keys(Model.ATTRIBUTES), 'resourceRequirements', 'name', 'type', 'description']) {
        if (source[field] !== next[field]) patch[field] = next[field];
      }
      if (JSON.stringify(source.environmentalPreferences) !== JSON.stringify(next.environmentalPreferences)) patch.environmentalPreferences = Model.clone(next.environmentalPreferences);
      if (Object.keys(patch).length) edits.avatars[source.id] = patch;
    }
    for (const source of sourceState.architecture.spaces) {
      const next = draft.architecture.spaces.find((space) => space.id === source.id);
      if (!next) continue;
      const patch = {};
      for (const field of ['temperature', 'light', 'resourceCapacity', 'occupancyCapacity']) {
        if (source[field] !== next[field]) patch[field] = next[field];
      }
      if (Object.keys(patch).length) edits.spaces[source.id] = patch;
    }
    const sourceIds = new Set(sourceState.avatars.map((avatar) => avatar.id));
    edits.addAvatars = draft.avatars.filter((avatar) => !sourceIds.has(avatar.id)).map((avatar) => Model.clone(avatar));
    if (!Object.keys(edits.architecture).length) delete edits.architecture;
    if (!Object.keys(edits.avatars).length) delete edits.avatars;
    if (!Object.keys(edits.spaces).length) delete edits.spaces;
    if (!edits.addAvatars.length) delete edits.addAvatars;
    if (!edits.removeAvatarIds.length) delete edits.removeAvatarIds;
    return edits;
  }

  function hasEdits(edits) {
    return Boolean(edits.architecture || edits.avatars || edits.spaces || edits.addAvatars || edits.removeAvatarIds);
  }

  async function beginOrContinue() {
    let sourceId = state.branchEntryId;
    if (!sourceId && state.experiment.diary.length) sourceId = activeBranch().entryIds.at(-1) || activeBranch().parentEntryId;
    if (sourceId) {
      const source = state.experiment.diary.find((entry) => entry.id === sourceId);
      if (!source) throw new RangeError('The selected branch point is no longer available.');
      const edits = buildBranchEdits(source.outputState, state.draft);
      if (state.branchEntryId || hasEdits(edits)) {
        const branch = Model.createBranch(state.experiment, source.id, edits);
        let branchId = branch.branchId;
        let suffix = 2;
        while (state.experiment.branches[branchId]) {
          branchId = `${branch.branchId}-${suffix}`;
          suffix += 1;
        }
        branch.initialState.branchId = branchId;
        branch.headState.branchId = branchId;
        state.experiment.branches[branchId] = {
          id: branchId,
          label: `Branch from generation ${source.generation}`,
          parentEntryId: source.id,
          initialState: Model.clone(branch.initialState),
          headState: Model.clone(branch.headState),
          entryIds: [],
          divergence: branch.divergence
        };
        state.experiment.activeBranchId = branchId;
        $('#compare-right').value = branchId;
      }
    } else {
      const errors = Model.validateState(state.draft);
      if (errors.length) throw new TypeError(errors.join(' '));
      const customizedSpaces = new Map(state.draft.architecture.spaces.map((space) => [space.id, space]));
      const configuredArchitecture = Model.createInitialArchitecture({
        connectivity: state.draft.architecture.connectivitySetting,
        resourceAvailability: state.draft.architecture.resourceAvailability,
        adaptability: state.draft.architecture.adaptability
      });
      configuredArchitecture.spaces = configuredArchitecture.spaces.map((space) => {
        const customized = customizedSpaces.get(space.id);
        if (!customized) return space;
        space.temperature = customized.temperature;
        space.light = customized.light;
        space.resourceCapacity = customized.resourceCapacity;
        space.availableResources = Number((space.resourceCapacity * configuredArchitecture.resourceAvailability / 100).toFixed(2));
        space.occupancyCapacity = customized.occupancyCapacity;
        return space;
      });
      state.draft.architecture = configuredArchitecture;
      state.experiment.rootState = Model.clone(state.draft);
      state.experiment.branches.root.initialState = Model.clone(state.draft);
      state.experiment.branches.root.headState = Model.clone(state.draft);
      state.experiment.branches.root.entryIds = [];
    }
    state.branchEntryId = null;
    state.experiment.headState = Model.clone(activeBranch().headState);
    state.draft = Model.clone(activeBranch().headState);
    state.experiment.pendingDraftState = Model.clone(state.draft);
    state.experiment.pendingBranchEntryId = null;
    showView('simulate');
    renderAll();
    await saveExperiment(false);
  }

  async function runGenerations(count) {
    const runButtons = [$('#run-one'), ...document.querySelectorAll('[data-run-count]')];
    runButtons.forEach((button) => { button.disabled = true; });
    setGenerationStatus(`Running ${count} deterministic generation${count === 1 ? '' : 's'}…`);
    try {
      for (let index = 0; index < count; index += 1) {
        const result = Model.runGeneration(activeBranch().headState);
        state.experiment.diary.push(result.diaryEntry);
        activeBranch().entryIds.push(result.diaryEntry.id);
        activeBranch().headState = Model.clone(result.nextState);
        state.experiment.headState = Model.clone(result.nextState);
        if (count > 1) {
          renderSimulation();
          setGenerationStatus(`Generation ${result.diaryEntry.generation} unfolding · ${index + 1} of ${count}`);
          await new Promise((resolve) => window.setTimeout(resolve, 420));
        }
      }
      state.draft = Model.clone(activeBranch().headState);
      state.experiment.pendingDraftState = Model.clone(state.draft);
      state.experiment.pendingBranchEntryId = null;
      state.selectedDiaryId = activeBranch().entryIds.at(-1);
      renderAll();
      setGenerationStatus(`Recorded through generation ${activeBranch().headState.generation}.`);
      await saveExperiment(false);
    } catch (error) {
      setGenerationStatus(error.message, true);
      throw error;
    } finally {
      runButtons.forEach((button) => { button.disabled = false; });
    }
  }

  function branchFrom(entryId) {
    if (state.playTimer) stopDiaryPlayback();
    const entry = state.experiment.diary.find((item) => item.id === entryId);
    if (!entry) return;
    state.branchEntryId = entryId;
    state.draft = Model.clone(entry.outputState);
    state.experiment.pendingDraftState = Model.clone(state.draft);
    state.experiment.pendingBranchEntryId = entryId;
    scheduleSave();
    showView('configure');
    renderConfigure();
    $('#configurator').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function download(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function renderNavActive() {
    const current = window.location.hash || '#library';
    document.querySelectorAll('.topbar nav a').forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === current);
    });
  }

  function init() {
    state.experiment = newExperiment();
    state.draft = Model.clone(state.experiment.headState);
    renderAll();
    renderNavActive();
    window.addEventListener('hashchange', renderNavActive);

    Storage.list().then((records) => {
      state.storageReady = true;
      state.experiments = records;
      if (records.length) {
        state.experiment = normalizeExperiment(records[0]);
        state.draft = experimentDraft(state.experiment);
        state.branchEntryId = state.experiment.pendingBranchEntryId || null;
        state.selectedPreset = state.experiment.selectedPreset || null;
        $('#experiment-name').value = state.experiment.name;
        renderAll();
      } else {
        saveExperiment(false).then(() => setStatus('Local storage ready. Experiments save in this browser.'));
      }
      setStatus('Local experiment storage ready.');
    }).catch((error) => {
      setStatus(error.message, true);
    });

    $('#experiment-name').addEventListener('input', () => {
      state.experiment.name = $('#experiment-name').value;
      renderExperimentSelect();
      scheduleSave();
    });
    $('#experiment-select').addEventListener('change', async (event) => {
      const selected = state.experiments.find((experiment) => experiment.id === event.target.value);
      if (!selected) return;
      state.experiment = normalizeExperiment(Model.clone(selected));
      state.draft = experimentDraft(state.experiment);
      state.branchEntryId = state.experiment.pendingBranchEntryId || null;
      renderAll();
    });
    $('#new-experiment').addEventListener('click', async () => {
      state.experiment = newExperiment();
      state.draft = Model.clone(state.experiment.headState);
      state.branchEntryId = null;
      state.selectedDiaryId = null;
      state.selectedPreset = 'reciprocal';
      state.experiments.push(state.experiment);
      renderAll();
      await saveExperiment();
      showView('configure');
    });
    $('#save-experiment').addEventListener('click', () => saveExperiment());
    $('#delete-experiment').addEventListener('click', async () => {
      if (!window.confirm(`Permanently delete “${state.experiment.name}” and its saved history from this browser?`)) return;
      try {
        if (state.storageReady) await Storage.remove(state.experiment.id);
        state.experiments = state.experiments.filter((item) => item.id !== state.experiment.id);
        state.experiment = state.experiments.length ? normalizeExperiment(Model.clone(state.experiments[0])) : newExperiment();
        state.draft = Model.clone(activeBranch().headState);
        state.branchEntryId = null;
        state.selectedPreset = state.experiment.selectedPreset || 'reciprocal';
        state.selectedDiaryId = null;
        renderAll();
        if (state.storageReady && !state.experiments.length) await saveExperiment(false);
        setStatus(state.storageReady ? 'Experiment deleted from local storage.' : 'Experiment cleared from this tab only.');
      } catch (error) {
        setStatus(error.message, true);
      }
    });
    $('#reset-experiment').addEventListener('click', async () => {
      if (!window.confirm(`Reset “${state.experiment.name}” to a new empty history? This cannot be undone.`)) return;
      const name = state.experiment.name;
      const id = state.experiment.id;
      state.experiment = newExperiment(name);
      state.experiment.id = id;
      state.draft = Model.clone(state.experiment.headState);
      state.branchEntryId = null;
      state.selectedDiaryId = null;
      state.selectedPreset = 'reciprocal';
      renderAll();
      await saveExperiment();
    });
    $('#architecture-controls').addEventListener('input', (event) => {
      const field = event.target.dataset.architectureField;
      const spaceId = event.target.dataset.spaceId;
      const spaceField = event.target.dataset.field;
      if (spaceId && spaceField) {
        const space = state.draft.architecture.spaces.find((item) => item.id === spaceId);
        if (!space) return;
        space[spaceField] = Number(event.target.value);
        event.target.previousElementSibling.textContent = event.target.value;
        scheduleSave();
        return;
      }
      if (!field) return;
      state.draft.architecture[field] = Number(event.target.value);
      event.target.previousElementSibling.textContent = event.target.value;
      scheduleSave();
    });
    $('#avatar-editor-list').addEventListener('input', (event) => {
      const avatar = state.draft.avatars.find((item) => item.id === event.target.dataset.avatarId);
      if (!avatar) return;
      const field = event.target.dataset.field;
      if (field) {
        setDraftAvatarField(avatar, field, event.target.value);
        const output = event.target.parentElement.querySelector('output');
        if (output) output.value = event.target.value;
        const summary = event.target.closest('.avatar-card').querySelector('.avatar-summary-name-text');
        if (field === 'name') summary.textContent = avatar.name;
        if (field === 'type') event.target.closest('.avatar-card').querySelector('summary small').textContent = avatar.type;
      }
      const preference = event.target.dataset.preference;
      if (preference) avatar.environmentalPreferences[preference] = Model.clamp(Number(event.target.value) || 0, 0, 100);
      refreshAvatarVisual(avatar);
      scheduleSave();
    });
    $('#avatar-editor-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-avatar-action]');
      if (!button) return;
      const avatar = state.draft.avatars.find((item) => item.id === button.dataset.avatarId);
      if (!avatar) return;
      if (button.dataset.avatarAction === 'remove') {
        if (state.draft.avatars.length <= 1) return;
        state.draft.avatars = state.draft.avatars.filter((item) => item.id !== avatar.id);
      } else {
        const copy = Model.clone(avatar);
        copy.id = nextAvatarId();
        copy.name = `${avatar.name} (copy)`.slice(0, 80);
        copy.visual = Model.createVisualDNA(randomInteger(0, 4294967295));
        copy.interactionHistory = [];
        copy.generationHistory = [];
        state.draft.avatars.push(copy);
      }
      renderAvatarEditor();
      scheduleSave();
    });
    $('#add-avatar').addEventListener('click', () => {
      const avatar = createDistinctAvatar();
      state.draft.avatars.push(avatar);
      renderAvatarEditor();
      scheduleSave();
      const newest = $('#avatar-editor-list').lastElementChild;
      newest.open = true;
      newest.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    document.querySelectorAll('[data-world-preset]').forEach((button) => button.addEventListener('click', () => applyWorldPreset(button.dataset.worldPreset)));
    $('#advanced-mode-toggle').addEventListener('click', () => setAdvancedMode(!state.advanced));
    $('#start-simulation').addEventListener('click', () => {
      try {
        beginOrContinue().catch((error) => setGenerationStatus(error.message, true));
      } catch (error) {
        setGenerationStatus(error.message, true);
      }
    });
    $('#run-one').addEventListener('click', () => runGenerations(1).catch(() => {}));
    document.querySelectorAll('[data-run-count]').forEach((button) => button.addEventListener('click', () => runGenerations(Number(button.dataset.runCount)).catch(() => {})));
    document.querySelectorAll('.view-tabs [role="tab"]').forEach((tab) => tab.addEventListener('click', () => showView(tab.id.replace('tab-', ''))));
    $('#diary-timeline').addEventListener('click', (event) => {
      const button = event.target.closest('[data-diary-id]');
      if (!button) return;
      state.selectedDiaryId = button.dataset.diaryId;
      renderDiary();
    });
    document.querySelectorAll('[data-diary-step]').forEach((button) => button.addEventListener('click', () => stepDiary(Number(button.dataset.diaryStep))));
    $('#diary-play-toggle').addEventListener('click', toggleDiaryPlayback);
    $('#diary-detail').addEventListener('click', (event) => {
      const button = event.target.closest('[data-branch-entry]');
      if (button) branchFrom(button.dataset.branchEntry);
    });
    $('#compare-left').addEventListener('change', updateComparison);
    $('#compare-right').addEventListener('change', updateComparison);
    $('#export-experiment').addEventListener('click', () => download(`${state.experiment.name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase() || 'experiment'}.json`, JSON.stringify(Model.exportExperiment(state.experiment), null, 2), 'application/json'));
    $('#export-diary').addEventListener('click', () => download(`${state.experiment.name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase() || 'experiment'}-diary.txt`, Model.diaryAsText(activeLineage()), 'text/plain;charset=utf-8'));
    $('#import-experiment').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const validation = Model.validateExperimentImport(parsed);
        if (!validation.valid) throw new TypeError(validation.errors.join(' '));
        const imported = normalizeExperiment(validation.experiment);
        if (state.experiments.some((item) => item.id === imported.id)) imported.id = createId();
        state.experiment = imported;
        state.draft = experimentDraft(imported);
        state.branchEntryId = imported.pendingBranchEntryId || null;
        state.selectedPreset = imported.selectedPreset || null;
        state.experiments.push(imported);
        renderAll();
        await saveExperiment();
        setStatus('Validated experiment imported and saved locally.');
      } catch (error) {
        setStatus(`Import rejected: ${error.message}`, true);
      } finally {
        event.target.value = '';
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
