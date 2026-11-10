(function (root, factory) {
  const visuals = factory();
  if (typeof module === 'object' && module.exports) module.exports = visuals;
  root.CoevolutionVisuals = visuals;
}(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  const VIEW_WIDTH = 1000;
  const VIEW_HEIGHT = 600;
  const ROOM_COLORS = ['#e9eee1', '#f4e7de', '#e3eceb', '#f0ead7', '#e8e4ef', '#e7eee6', '#f1e4dc', '#e5ecef'];
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  function hash(text) {
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function unit(seed, index = 0) {
    let value = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    value ^= value >>> 16;
    return (value >>> 0) / 4294967296;
  }

  function avatarInk(avatar) {
    const hue = Number(avatar.visual?.paletteHue ?? avatar.visual?.hue ?? (hash(avatar.id) % 360));
    return {
      hue: ((hue % 360) + 360) % 360,
      stroke: `hsl(${hue} 48% 29%)`,
      fill: `hsl(${hue} 54% 92%)`
    };
  }

  function avatarGeometry(avatar, size = 120) {
    const visual = avatar.visual || {};
    const traits = avatar.visualTraits || {};
    const grammar = ['branching', 'spiral', 'radial', 'cellular', 'waveform', 'geometric'].includes(visual.morphology)
      ? visual.morphology
      : 'branching';
    const seed = Number(visual.seed ?? hash(avatar.id));
    const phase = unit(seed) * Math.PI * 2;
    const hairiness = clamp(Number(traits.hairiness || 0) / 100, 0, 1);
    const bumpiness = clamp(Number(traits.bumpiness || 0) / 100, 0, 1);
    const waviness = clamp(Number(traits.waviness || 0) / 100, 0, 1);
    const angularity = clamp(Number(traits.angularity || 0) / 100, 0, 1);
    const layering = clamp(Number(traits.layering || 0) / 100, 0, 1);
    const porosity = clamp(Number(traits.porosity || 0) / 100, 0, 1);
    const branching = clamp(Number(traits.branching || 0) / 100, 0, 1);
    const connectivity = clamp(Number(traits.connectivity || 0) / 100, 0, 1);
    const reach = clamp(Number(traits.reach || 0) / 100, 0, 1);
    const scale = size / 120;
    const cx = 60;
    const cy = 60;
    const path = (points, close = false) => {
      const line = points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L');
      return `<path d="M${line}${close ? ' Z' : ''}" />`;
    };
    const circle = (x, y, radius) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius.toFixed(2)}" />`;
    const point = (angle, radius, yScale = 1) => [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * yScale];
    const marks = [];

    if (grammar === 'branching') {
      const stems = 2 + Math.round(1 + branching * 3);
      for (let stem = 0; stem < stems; stem += 1) {
        const angle = phase - Math.PI / 2 + (stem - (stems - 1) / 2) * .34;
        const base = point(angle, 6);
        const tip = point(angle + (unit(seed, stem) - .5) * .18, 38 + reach * 9);
        const middle = point(angle - .05, 22 + unit(seed, stem + 19) * 7);
        marks.push(path([base, middle, tip]));
        [-1, 1].forEach((side) => {
          const branchStart = point(angle + side * .06, 21 + unit(seed, stem + side * 23) * 7);
          const branchEnd = point(angle + side * (.28 + unit(seed, stem + side * 29) * .3), 34 + reach * 8);
          marks.push(path([branchStart, point(angle + side * .16, 29), branchEnd]));
        });
      }
    } else if (grammar === 'spiral') {
      const turns = 2.2 + Number(visual.spiralBias || 0) * 1.2 + layering * .8;
      const points = Array.from({ length: 92 }, (_, index) => {
        const progress = index / 91;
        const radius = 2 + progress * (34 + reach * 8);
        const angle = phase + progress * turns * Math.PI * 2;
        const interruption = angularity > .15 && index % 12 < 2 ? angularity * 3 : 0;
        return [cx + Math.cos(angle) * (radius + interruption), cy + Math.sin(angle) * (radius + interruption) * .85];
      });
      marks.push(path(points));
      for (let layer = 0; layer < Math.round(layering * 2); layer += 1) {
        const radius = 42 + layer * 4;
        marks.push(path(Array.from({ length: 48 }, (_, index) => point(phase + index / 47 * Math.PI * 2, radius, .85)), true));
      }
    } else if (grammar === 'radial') {
      const rays = 7 + Math.round(2 + reach * 5);
      for (let index = 0; index < rays; index += 1) {
        const angle = phase + index * Math.PI * 2 / rays;
        const length = 28 + reach * 12 + unit(seed, index) * 4;
        const start = point(angle, 5);
        const end = point(angle, length);
        marks.push(path([start, end]));
        marks.push(circle(end[0], end[1], 1.6 + porosity * 1.2));
      }
      marks.push(circle(cx, cy, 5 + connectivity * 3));
    } else if (grammar === 'cellular') {
      const lobes = 4 + Math.round(2 + porosity * 3);
      for (let index = 0; index < lobes; index += 1) {
        const angle = phase + index * Math.PI * 2 / lobes;
        const center = point(angle, 17 + unit(seed, index) * 4);
        marks.push(`<circle cx="${center[0].toFixed(2)}" cy="${center[1].toFixed(2)}" r="${(10 + unit(seed, index + 10) * 4 + layering * 2).toFixed(2)}" />`);
      }
      if (connectivity > .15) {
        for (let index = 0; index < lobes; index += 1) {
          const first = point(phase + index * Math.PI * 2 / lobes, 17);
          const second = point(phase + (index + 2) * Math.PI * 2 / lobes, 17);
          marks.push(path([first, second]));
        }
      }
    } else if (grammar === 'waveform') {
      const lineCount = 2 + Math.round(layering * 2);
      for (let line = 0; line < lineCount; line += 1) {
        const y = 42 + line * (16 / Math.max(1, lineCount - 1));
        const points = Array.from({ length: 42 }, (_, index) => {
          const x = 20 + index * 80 / 41;
          const phaseOffset = phase + line * .9;
          const amp = 3 + waviness * 10 + bumpiness * 2;
          return [x, y + Math.sin(index / 41 * Math.PI * (3 + waviness * 3) + phaseOffset) * amp];
        });
        marks.push(path(points));
      }
    } else {
      const corners = 5 + Math.round(angularity * 4);
      const rings = 1 + Math.round(layering * 2);
      for (let ring = 0; ring < rings; ring += 1) {
        const radius = 39 - ring * 9;
        const points = Array.from({ length: corners }, (_, index) => {
          const angle = phase + index * Math.PI * 2 / corners;
          const alternating = index % 2 ? 1 - angularity * .28 : 1;
          return point(angle, radius * alternating);
        });
        marks.push(path(points, true));
      }
    }

    if (grammar !== 'waveform' && waviness > .3) {
      for (let row = 0; row < Math.round(1 + waviness * 2); row += 1) {
        const y = 48 + row * 11;
        marks.push(path(Array.from({ length: 32 }, (_, index) => [
          34 + index * 52 / 31,
          y + Math.sin(index / 31 * Math.PI * (2 + waviness * 2) + phase + row) * (1 + waviness * 5)
        ])));
      }
    }
    if (hairiness > .22) {
      const hairs = Math.round(3 + hairiness * 13);
      for (let index = 0; index < hairs; index += 1) {
        const angle = phase + index * Math.PI * 2 / hairs;
        const start = point(angle, 38 + layering * 2);
        const tip = point(angle + Math.sin(index * 2.1) * .06, 43 + hairiness * 13 + reach * 4);
        marks.push(path([start, tip]));
      }
    }
    if (bumpiness > .35) {
      const bumps = Math.round(2 + bumpiness * 7);
      for (let index = 0; index < bumps; index += 1) {
        const [x, y] = point(phase + index * Math.PI * 2 / bumps, 40 + unit(seed, index + 88) * 3);
        marks.push(circle(x, y, 1.1 + bumpiness * 2));
      }
    }
    if (grammar !== 'geometric' && angularity > .5) {
      const teeth = Math.round(3 + angularity * 6);
      marks.push(path(Array.from({ length: teeth + 1 }, (_, index) => {
        const angle = phase + index * Math.PI * 2 / teeth;
        return point(angle, 40 + (index % 2 ? 2 : 8) * angularity);
      }), true));
    }
    if (grammar !== 'cellular' && porosity > .55) {
      const holes = Math.round(porosity * 8);
      for (let index = 0; index < holes; index += 1) {
        const [x, y] = point(phase + index * 2.4, 17 + unit(seed, index + 122) * 16);
        marks.push(circle(x, y, 1.1 + porosity));
      }
    }
    if (grammar !== 'geometric' && layering > .45) {
      const count = Math.round(layering * 2);
      for (let layer = 0; layer < count; layer += 1) {
        const radius = 43 - layer * 5;
        marks.push(path(Array.from({ length: 48 }, (_, index) => point(phase + index / 47 * Math.PI * 2, radius, .86)), true));
      }
    }
    if (connectivity > .55 && grammar !== 'radial' && grammar !== 'cellular') {
      const links = Math.round(2 + connectivity * 4);
      for (let index = 0; index < links; index += 1) {
        const first = point(phase + index * Math.PI * 2 / links, 10 + unit(seed, index + 150) * 13);
        const second = point(phase + (index + 2) * Math.PI * 2 / links, 28 + unit(seed, index + 161) * 9);
        marks.push(path([first, second]));
        marks.push(circle(second[0], second[1], 1.3));
      }
    }

    const color = avatarInk(avatar);
    return `<svg class="coev-avatar coev-avatar-${grammar}" viewBox="0 0 120 120" role="img" aria-label="${safe(avatar.name)} · ${grammar} grammar" style="--avatar-ink:${color.stroke};--avatar-fill:${color.fill};--avatar-scale:${scale.toFixed(3)}"><g class="coev-avatar-geometry" transform="translate(${(60 * (1 - scale)).toFixed(2)} ${(60 * (1 - scale)).toFixed(2)}) scale(${scale.toFixed(3)})">${marks.join('')}</g></svg>`;
  }

  function clipCell(space, spaces, sites) {
    const site = sites.get(space.id);
    let polygon = [[28, 28], [972, 28], [972, 572], [28, 572]];
    spaces.forEach((other) => {
      if (other.id === space.id || polygon.length < 3) return;
      const peer = sites.get(other.id);
      const a = 2 * (peer.x - site.x);
      const b = 2 * (peer.y - site.y);
      const c = peer.x ** 2 + peer.y ** 2 - site.x ** 2 - site.y ** 2 + site.weight ** 2 - peer.weight ** 2;
      const value = ([x, y]) => a * x + b * y - c;
      const next = [];
      polygon.forEach((point, index) => {
        const end = polygon[(index + 1) % polygon.length];
        const from = value(point);
        const to = value(end);
        const inside = from <= .001;
        const endInside = to <= .001;
        if (inside) next.push(point);
        if (inside !== endInside) {
          const ratio = from / (from - to);
          next.push([point[0] + (end[0] - point[0]) * ratio, point[1] + (end[1] - point[1]) * ratio]);
        }
      });
      polygon = next;
    });
    return polygon;
  }

  function pointKey(point) {
    return point.map((coordinate) => coordinate.toFixed(2)).join(',');
  }

  function pathCommands(points, begin = true) {
    if (points.length < 2) return '';
    let output = begin ? `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}` : '';
    for (let index = 0; index < points.length - 1; index += 1) {
      const previous = points[index - 1] || [2 * points[index][0] - points[index + 1][0], 2 * points[index][1] - points[index + 1][1]];
      const current = points[index];
      const next = points[index + 1];
      const after = points[index + 2] || [2 * next[0] - current[0], 2 * next[1] - current[1]];
      const control1 = [current[0] + (next[0] - previous[0]) / 6, current[1] + (next[1] - previous[1]) / 6];
      const control2 = [next[0] - (after[0] - current[0]) / 6, next[1] - (after[1] - current[1]) / 6];
      output += ` C${control1[0].toFixed(2)} ${control1[1].toFixed(2)} ${control2[0].toFixed(2)} ${control2[1].toFixed(2)} ${next[0].toFixed(2)} ${next[1].toFixed(2)}`;
    }
    return output;
  }

  function wallTraits(boundary, t) {
    const segments = boundary?.segments || [];
    if (!segments.length) return { values: {}, hue: 205 };
    const scaled = clamp(t, 0, .99999) * segments.length;
    const index = Math.floor(scaled);
    const fraction = scaled - index;
    const current = segments[index];
    const next = segments[Math.min(segments.length - 1, index + 1)];
    const values = {};
    Object.keys(current.traits || {}).forEach((trait) => {
      const first = Number(current.traits[trait] || 0);
      const second = Number(next.traits?.[trait] ?? first);
      values[trait] = clamp((first + (second - first) * fraction) / 100, 0, 1);
    });
    const source = (current.sources || []).slice().reverse().find((item) => item.trait && item.hue !== undefined);
    return { values, hue: source?.hue ?? 205, segment: current };
  }

  function edgePoints(first, second, boundary, seed, samples = 32) {
    const dx = second[0] - first[0];
    const dy = second[1] - first[1];
    const length = Math.hypot(dx, dy) || 1;
    const normal = [-dy / length, dx / length];
    const phase = unit(seed) * Math.PI * 2;
    return Array.from({ length: samples + 1 }, (_, index) => {
      const t = index / samples;
      const { values } = wallTraits(boundary, t);
      const envelope = Math.sin(Math.PI * t);
      const wave = Number(values.waviness || 0) * 13 * Math.sin(t * Math.PI * 4 + phase) * envelope;
      const bump = Number(values.bumpiness || 0) * 5.5 * Math.sin(t * Math.PI * 10 + phase * .7) * envelope;
      const angular = Number(values.angularity || 0) * 3.2 * Math.sin(t * Math.PI * 12 + phase) * envelope;
      const organicAmplitude = 9 + Number(values.waviness || 0) * 5;
      const organic = (
        Math.sin(t * Math.PI * 2.8 + phase) * organicAmplitude
        + Math.sin(t * Math.PI * 5.2 + phase * .63) * organicAmplitude * .22
      ) * envelope;
      const displacement = wave + bump + angular + organic;
      return [first[0] + dx * t + normal[0] * displacement, first[1] + dy * t + normal[1] * displacement];
    });
  }

  function pathAlongEdge(edge, reverse = false, start = true) {
    const points = reverse ? edge.points.slice().reverse() : edge.points;
    return pathCommands(points, start);
  }

  function pointAlong(edge, t) {
    const position = clamp(t, 0, 1) * (edge.points.length - 1);
    const index = Math.floor(position);
    const fraction = position - index;
    const current = edge.points[index];
    const next = edge.points[Math.min(edge.points.length - 1, index + 1)];
    return [current[0] + (next[0] - current[0]) * fraction, current[1] + (next[1] - current[1]) * fraction];
  }

  function edgeFeatures(edge) {
    const boundary = edge.boundary;
    if (!boundary) return '';
    const marks = [];
    const dx = edge.last[0] - edge.first[0];
    const dy = edge.last[1] - edge.first[1];
    const length = Math.hypot(dx, dy) || 1;
    const normal = [-dy / length, dx / length];
    const segmentCount = boundary.segments?.length || 0;
    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const segment = boundary.segments[segmentIndex];
      const center = (segmentIndex + .5) / segmentCount;
      const start = segmentIndex / segmentCount;
      const end = (segmentIndex + 1) / segmentCount;
      const trait = (key) => clamp(Number(segment.traits?.[key] || 0) / 100, 0, 1);
      const hue = (segment.sources || []).slice().reverse().find((source) => source.hue !== undefined)?.hue ?? 205;
      const color = `hsl(${hue} 52% 32%)`;
      const hair = trait('hairiness');
      const reach = trait('reach');
      const filaments = Math.round(hair * 9);
      for (let index = 0; index < filaments; index += 1) {
        const t = start + (end - start) * (index + 1) / (filaments + 1);
        const point = pointAlong(edge, t);
        const direction = index % 2 ? 1 : -1;
        const extent = 4 + hair * 9 + reach * 5;
        marks.push(`<path class="coev-wall-feature coev-wall-hair" d="M${point[0].toFixed(2)} ${point[1].toFixed(2)} l${(normal[0] * extent * direction).toFixed(2)} ${(normal[1] * extent * direction).toFixed(2)}" stroke="${color}" />`);
      }
      const bumpiness = trait('bumpiness');
      const bumps = Math.round(bumpiness * 5);
      for (let index = 0; index < bumps; index += 1) {
        const point = pointAlong(edge, start + (end - start) * (index + 1) / (bumps + 1));
        marks.push(`<circle class="coev-wall-feature coev-wall-bump" cx="${point[0].toFixed(2)}" cy="${point[1].toFixed(2)}" r="${(1 + bumpiness * 2.1).toFixed(2)}" fill="#fbf8ef" stroke="${color}" />`);
      }
      const porosity = trait('porosity');
      const pores = Math.round(porosity * 7);
      for (let index = 0; index < pores; index += 1) {
        const point = pointAlong(edge, start + (end - start) * (index + .5) / Math.max(1, pores));
        marks.push(`<circle class="coev-wall-feature coev-wall-pore" cx="${point[0].toFixed(2)}" cy="${point[1].toFixed(2)}" r="${(1 + porosity).toFixed(2)}" stroke="${color}" />`);
      }
      const branching = trait('branching');
      const branches = Math.round(branching * 3);
      for (let index = 0; index < branches; index += 1) {
        const point = pointAlong(edge, start + (end - start) * (index + 1) / (branches + 1));
        const endX = point[0] + normal[0] * (5 + branching * 10);
        const endY = point[1] + normal[1] * (5 + branching * 10);
        const side = index % 2 ? -1 : 1;
        marks.push(`<path class="coev-wall-feature coev-wall-branch" d="M${point[0].toFixed(2)} ${point[1].toFixed(2)} Q${(point[0] + normal[0] * 4).toFixed(2)} ${(point[1] + normal[1] * 4).toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)} m${(normal[1] * side * 4).toFixed(2)} ${(-normal[0] * side * 4).toFixed(2)} l${(normal[0] * 4).toFixed(2)} ${(normal[1] * 4).toFixed(2)}" stroke="${color}" />`);
      }
      const layering = trait('layering');
      if (layering > .15) {
        [-1, 1].forEach((side) => {
          const from = pointAlong(edge, start + (end - start) * .08);
          const to = pointAlong(edge, end - (end - start) * .08);
          marks.push(`<path class="coev-wall-layer" d="M${(from[0] + normal[0] * side * (2 + layering * 3)).toFixed(2)} ${(from[1] + normal[1] * side * (2 + layering * 3)).toFixed(2)} L${(to[0] + normal[0] * side * (2 + layering * 3)).toFixed(2)} ${(to[1] + normal[1] * side * (2 + layering * 3)).toFixed(2)}" stroke="${color}" />`);
        });
      }
      const connectivity = trait('connectivity');
      if (connectivity > .2) {
        const point = pointAlong(edge, center);
        const radius = 1.5 + connectivity * 2;
        marks.push(`<circle class="coev-wall-feature coev-wall-link" cx="${point[0].toFixed(2)}" cy="${point[1].toFixed(2)}" r="${radius.toFixed(2)}" stroke="${color}" />`);
      }
      const density = trait('density');
      const dots = Math.round(density * 8);
      for (let index = 0; index < dots; index += 1) {
        const point = pointAlong(edge, start + (end - start) * (index + .5) / Math.max(1, dots));
        const side = index % 2 ? 1 : -1;
        marks.push(`<circle cx="${(point[0] + normal[0] * side * 3).toFixed(2)}" cy="${(point[1] + normal[1] * side * 3).toFixed(2)}" r=".75" fill="${color}" stroke="none" />`);
      }
    }
    return marks.join('');
  }

  function renderPlan(simulationState, options = {}) {
    const architecture = simulationState.architecture;
    const spaces = architecture.spaces;
    const showNames = options.showNames !== false;
    const showAvatars = options.showAvatars !== false;
    const edgeSampleCount = options.compact ? 14 : 32;
    const avatarSize = options.compact ? 22 : 32;
    const boundaries = new Map((architecture.boundaries || []).map((boundary) => [boundary.spaceIds.slice().sort().join('|'), boundary]));
    const xValues = spaces.map((space) => Number(space.x) || 0);
    const yValues = spaces.map((space) => Number(space.y) || 0);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const sites = new Map(spaces.map((space) => {
      const area = Math.sqrt(Math.max(1, Number(space.width || 15) * Number(space.height || 13)));
      const use = Number(space.useCount || 0);
      const services = Number(space.serviceDensity || 0);
      return [space.id, {
        x: maxX === minX ? VIEW_WIDTH / 2 : 125 + ((Number(space.x) - minX) / (maxX - minX)) * 750,
        y: maxY === minY ? VIEW_HEIGHT / 2 : 100 + ((Number(space.y) - minY) / (maxY - minY)) * 400,
        weight: 84 + area * 2.9 + Math.min(42, use * .5) + services * 2.1
      }];
    }));
    const cells = spaces.map((space) => {
      const polygon = clipCell(space, spaces, sites);
      return polygon.length >= 3 ? { space, polygon, center: polygon.reduce((sum, point) => [sum[0] + point[0] / polygon.length, sum[1] + point[1] / polygon.length], [0, 0]) } : null;
    }).filter(Boolean);
    const edges = new Map();
    cells.forEach((cell) => {
      cell.polygon.forEach((first, index) => {
        const second = cell.polygon[(index + 1) % cell.polygon.length];
        const key = [pointKey(first), pointKey(second)].sort().join('|');
        if (!edges.has(key)) edges.set(key, { first, last: second, owners: [] });
        edges.get(key).owners.push(cell.space.id);
      });
    });
    edges.forEach((edge, key) => {
      const canonical = [edge.first, edge.last].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      edge.first = canonical[0];
      edge.last = canonical[1];
      edge.owners.sort();
      const pair = edge.owners.length === 2 ? edge.owners.join('|') : '';
      edge.boundary = pair ? boundaries.get(pair) : null;
      edge.seed = hash(`${key}:${pair}`);
      edge.points = edgePoints(edge.first, edge.last, edge.boundary, edge.seed, edgeSampleCount);
    });
    const cellMarkup = cells.map(({ space, polygon, center }) => {
      const commands = [];
      polygon.forEach((first, index) => {
        const second = polygon[(index + 1) % polygon.length];
        const edge = edges.get([pointKey(first), pointKey(second)].sort().join('|'));
        const reversed = pointKey(first) !== pointKey(edge.first);
        const points = reversed ? edge.points.slice().reverse() : edge.points;
        commands.push(pathCommands(points, index === 0));
      });
      const fill = ROOM_COLORS[hash(space.id) % ROOM_COLORS.length];
      const areaFactor = Math.sqrt(Math.max(.2, Number(space.width) * Number(space.height) / (15 * 13)));
      const occupants = showAvatars ? simulationState.avatars.filter((avatar) => avatar.locationId === space.id) : [];
      const name = showNames ? `<text class="coev-room-label" x="${center[0].toFixed(1)}" y="${(center[1] + (occupants.length ? -10 : 4)).toFixed(1)}">${safe(space.name)}</text>` : '';
      const avatarMarkup = occupants.map((avatar, index) => {
        const position = occupants.length === 1
          ? [center[0], center[1] + 18]
          : [center[0] + (index - (occupants.length - 1) / 2) * (avatarSize + 2), center[1] + 18];
        return `<g class="coev-room-avatar" transform="translate(${(position[0] - avatarSize / 2).toFixed(1)} ${(position[1] - avatarSize / 2).toFixed(1)})"><title>${safe(avatar.name)} · ${safe(avatar.visual?.morphology || 'branching')}</title>${renderAvatar(avatar, { size: avatarSize })}</g>`;
      }).join('');
      return `<g class="coev-room" data-room-id="${safe(space.id)}" style="--room-fill:${fill};--room-area:${areaFactor.toFixed(2)}"><path class="coev-room-shape" d="${commands.join('')} Z" /><title>${safe(space.name)} · ${Math.round(space.width)} × ${Math.round(space.height)} · ${Math.round(space.temperature)}° · light ${Math.round(space.light)}</title>${name}${avatarMarkup}</g>`;
    }).join('');
    const wallMarkup = [...edges.values()].map((edge) => {
      const d = pathCommands(edge.points);
      const contacts = Number(edge.boundary?.useCount || 0);
      const width = 1.25 + Math.min(1.7, contacts * .035);
      const featureMarks = edgeFeatures(edge);
      const connected = edge.owners.length === 2 && (spaces.find((space) => space.id === edge.owners[0])?.connections || []).includes(edge.owners[1]);
      const threshold = connected
        ? (() => {
          const point = pointAlong(edge, .5);
          const tangent = [edge.last[0] - edge.first[0], edge.last[1] - edge.first[1]];
          const angle = Math.atan2(tangent[1], tangent[0]) * 180 / Math.PI;
          return `<g class="coev-threshold" transform="translate(${point[0].toFixed(2)} ${point[1].toFixed(2)}) rotate(${angle.toFixed(2)})"><path d="M-5 0 Q0 -3 5 0" /></g>`;
        })()
        : '';
      return `<g class="coev-wall${contacts ? ' has-contact' : ''}" data-wall-owners="${safe(edge.owners.join('|'))}" style="--wall-width:${width.toFixed(2)}px"><path class="coev-wall-line" d="${d}" />${featureMarks}${threshold}</g>`;
    }).join('');
    const label = options.label ? `<text class="coev-plan-caption" x="30" y="34">${safe(options.label)}</text>` : '';
    return `<svg class="coev-plan" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" role="img" aria-label="${safe(options.ariaLabel || 'Interconnected organic rooms with recognizable avatar grammars and shared, evolving walls')}">${label}<g class="coev-room-fills">${cellMarkup}</g><g class="coev-room-walls">${wallMarkup}</g></svg>`;
  }

  function renderAvatar(avatar, options = {}) {
    const size = Number(options.size || 0);
    const attributes = size ? ` width="${size}" height="${size}" style="width:${size}px;height:${size}px"` : '';
    return avatarGeometry(avatar, 120).replace('<svg ', `<svg${attributes} `);
  }

  return { renderAvatar, renderPlan, avatarGeometry };
}));
