(function (root, factory) {
  const geometry = factory();
  if (typeof module === 'object' && module.exports) module.exports = geometry;
  else root.BecomingRegions = geometry;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const scaleX = 1.48;
  const segments = 72;
  const cellWidth = 24 * scaleX;
  const cellHeight = 24;
  const cache = new WeakMap();
  const cutCache = new WeakMap();

  function cellKey(x, y) {
    return Math.floor(x / cellWidth) + ':' + Math.floor(y / cellHeight);
  }

  function cutShape(cut) {
    let points = cutCache.get(cut);
    if (!points) {
      const phase = cut.x * .031 + cut.y * .017;
      points = Array.from({ length: 36 }, (_, i) => {
        const angle = i / 36 * Math.PI * 2;
        const radius = cut.radius * (1 + .04 * Math.sin(3 * angle + phase) + .02 * Math.sin(5 * angle - phase));
        return [cut.x + Math.cos(angle) * radius * scaleX, cut.y + Math.sin(angle) * radius];
      });
      cutCache.set(cut, points);
    }
    return points;
  }

  function cutPolygon(region, cut) {
    const boundary = cutShape(cut);
    let points = polygon(region);
    for (let edge = 0; edge < boundary.length; edge++) {
      const a = boundary[edge], b = boundary[(edge + 1) % boundary.length];
      const side = point => (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
      const input = points;
      points = [];
      if (!input.length) break;
      for (let i = 0; i < input.length; i++) {
        const start = input[i], end = input[(i + 1) % input.length];
        const startSide = side(start), endSide = side(end);
        if (startSide >= 0) points.push(start);
        if ((startSide >= 0) !== (endSide >= 0)) {
          const t = startSide / (startSide - endSide);
          points.push([start[0] + t * (end[0] - start[0]), start[1] + t * (end[1] - start[1])]);
        }
      }
    }
    return points;
  }

  function area(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(area) / 2;
  }

  function isEmpty(region) {
    const total = area(polygon(region));
    const removed = (region.cuts || []).reduce((sum, cut) => sum + area(cutPolygon(region, cut)), 0);
    return total - removed < 1e-5;
  }

  function inPolygon(points, x, y) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function inCut(cut, x, y) {
    const bound = cut.radius * 1.06;
    return Math.abs(x - cut.x) <= bound * scaleX && Math.abs(y - cut.y) <= bound
      && inPolygon(cutShape(cut), x, y);
  }

  function radiusAt(region, angle) {
    const irregular = .14 * Math.sin(angle * 3 + region.phase)
      + .085 * Math.sin(angle * 5 - region.phase * 1.7)
      + .055 * Math.sin(angle * 8 + region.phase * .7);
    const bias = (region.biasX || 0) * Math.cos(angle) + (region.biasY || 0) * Math.sin(angle);
    return region.radius * (1 + irregular * region.irregularity + bias);
  }

  function polygon(region) {
    const signature = [region.x, region.y, region.radius, region.phase, region.irregularity, region.biasX, region.biasY];
    const saved = cache.get(region);
    if (saved && signature.every((value, index) => value === saved.signature[index])) return saved.points;
    const points = Array.from({ length: segments }, (_, index) => {
      const angle = index / segments * Math.PI * 2;
      const radius = radiusAt(region, angle);
      return [region.x + Math.cos(angle) * radius * scaleX, region.y + Math.sin(angle) * radius];
    });
    cache.set(region, { signature, points });
    return points;
  }

  function innerRadius(region, points) {
    const saved = cache.get(region);
    if (saved.innerRadius !== undefined) return saved.innerRadius;
    let minimum = Infinity;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const dx = (b[0] - a[0]) / scaleX, dy = b[1] - a[1];
      const px = (region.x - a[0]) / scaleX, py = region.y - a[1];
      const length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1, (px * dx + py * dy) / length)) : 0;
      minimum = Math.min(minimum, Math.hypot(px - t * dx, py - t * dy));
    }
    saved.innerRadius = minimum;
    return minimum;
  }

  function contains(region, x, y, ignoreCuts = false) {
    const bound = region.radius * (1 + .28 * region.irregularity + Math.hypot(region.biasX || 0, region.biasY || 0));
    if (Math.abs(x - region.x) > bound * scaleX || Math.abs(y - region.y) > bound) return false;
    if (!inPolygon(polygon(region), x, y)) return false;
    return ignoreCuts || !(region.cuts || []).some(cut => inCut(cut, x, y));
  }

  function mayOverlap(first, second) {
    const bound = region => region.radius * (1 + .28 * region.irregularity + Math.hypot(region.biasX || 0, region.biasY || 0));
    return Math.hypot((first.x - second.x) / scaleX, first.y - second.y) <= bound(first) + bound(second);
  }

  // Earlier regions keep their full footprint; later regions occupy the remainder.
  function at(regions, x, y, ignoreCutsForGroup) {
    for (const region of regions) {
      if (!contains(region, x, y, ignoreCutsForGroup !== undefined && region.groupId === ignoreCutsForGroup)) continue;
      const dx = (x - region.x) / scaleX;
      const dy = y - region.y;
      const distance = Math.min(.999999, Math.hypot(dx, dy) / radiusAt(region, Math.atan2(dy, dx)));
      return { region, distance };
    }
    return null;
  }

  // Rebuild after region footprints change; bucket order preserves ownership.
  function spatialIndex(regions) {
    const width = 80 * scaleX, height = 80;
    const cells = new Map(), order = new Map();
    const key = (x, y) => x + ':' + y;
    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      order.set(region, i);
      const bound = region.radius * (1 + .28 * region.irregularity + Math.hypot(region.biasX || 0, region.biasY || 0));
      const minX = Math.floor((region.x - bound * scaleX) / width), maxX = Math.floor((region.x + bound * scaleX) / width);
      const minY = Math.floor((region.y - bound) / height), maxY = Math.floor((region.y + bound) / height);
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const cell = key(x, y);
        if (!cells.has(cell)) cells.set(cell, []);
        cells.get(cell).push(region);
      }
    }
    return {
      at(x, y, ignoreCutsForGroup) {
        return at(cells.get(key(Math.floor(x / width), Math.floor(y / height))) || [], x, y, ignoreCutsForGroup);
      },
      nearby(x, y, radius) {
        const found = new Set();
        const minX = Math.floor((x - radius * scaleX) / width), maxX = Math.floor((x + radius * scaleX) / width);
        const minY = Math.floor((y - radius) / height), maxY = Math.floor((y + radius) / height);
        for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
          for (const region of cells.get(key(cx, cy)) || []) found.add(region);
        }
        return [...found].sort((a, b) => order.get(a) - order.get(b));
      }
    };
  }

  function reachesGroupEdge(regions, groupId, cut, index) {
    const reach = cut.radius * 1.06;
    const nearby = (index ? index.nearby(cut.x, cut.y, reach) : regions).filter(region => {
      const bound = region.radius * (1 + .28 * region.irregularity + Math.hypot(region.biasX || 0, region.biasY || 0));
      return Math.abs(cut.x - region.x) <= (bound + reach) * scaleX
        && Math.abs(cut.y - region.y) <= bound + reach;
    });
    let earlierOtherGroup = false;
    for (const region of nearby) {
      if (region.groupId !== groupId) {
        earlierOtherGroup = true;
      } else if (!earlierOtherGroup && contains(region, cut.x, cut.y, true)) {
        const points = polygon(region);
        const distance = Math.hypot((cut.x - region.x) / scaleX, cut.y - region.y);
        if (distance + reach < innerRadius(region, points)) return false;
        let enclosed = true;
        for (let i = 0; i < points.length; i++) {
          const a = points[i], b = points[(i + 1) % points.length];
          const dx = (b[0] - a[0]) / scaleX, dy = b[1] - a[1];
          const px = (cut.x - a[0]) / scaleX, py = cut.y - a[1];
          const length = dx * dx + dy * dy;
          const t = length ? Math.max(0, Math.min(1, (px * dx + py * dy) / length)) : 0;
          if ((px - t * dx) ** 2 + (py - t * dy) ** 2 <= reach * reach) {
            enclosed = false;
            break;
          }
        }
        if (enclosed) return false;
      }
    }
    const center = at(nearby, cut.x, cut.y, groupId);
    const angle = center && center.region.groupId === groupId
      ? Math.atan2(cut.y - center.region.y, (cut.x - center.region.x) / scaleX)
      : 0;
    const start = (Math.round(angle / (Math.PI * 2) * 36) + 36) % 36;
    const phase = cut.x * .031 + cut.y * .017;
    for (let offset = 0; offset < 36; offset++) {
      const sampleAngle = (start + offset) % 36 / 36 * Math.PI * 2;
      const radius = cut.radius * (1 + .04 * Math.sin(3 * sampleAngle + phase) + .02 * Math.sin(5 * sampleAngle - phase));
      const x = cut.x + Math.cos(sampleAngle) * radius * scaleX;
      const y = cut.y + Math.sin(sampleAngle) * radius;
      const owner = at(nearby, x, y, groupId);
      if (!owner || owner.region.groupId !== groupId) return true;
    }
    return false;
  }

  function canCreate(regions, x, y) {
    return !at(regions, x, y) && regions.every(region => Math.hypot((x - region.x) / scaleX, y - region.y) >= 36);
  }

  function limitRadius(region, regions) {
    let limit = Infinity;
    for (const other of regions) {
      if (other === region || (region.groupId !== undefined && region.groupId === other.groupId)) continue;
      const distance = Math.hypot((region.x - other.x) / scaleX, region.y - other.y);
      limit = Math.min(limit, distance / (1 + .28 * region.irregularity + .23) * .96);
    }
    return limit;
  }

  function touching(first, second, regions) {
    if (!mayOverlap(first, second)) return false;
    for (const point of polygon(second)) {
      if ((second.cuts || []).some(cut => inCut(cut, point[0], point[1]))) continue;
      if (!contains(first, point[0], point[1])) continue;
      const owner = at(regions, point[0], point[1]);
      if (owner && owner.region.groupId === first.groupId) return true;
    }
    return false;
  }

  function merge(regions, first, second, tick) {
    const oldGroup = second.groupId;
    const newGroup = first.groupId;
    const members = regions.filter(region => region.groupId === oldGroup || region.groupId === newGroup);
    const established = members.some(region => region.established);
    for (const region of members) {
      region.groupId = newGroup;
      region.builderContact = null;
      region.growerContact = null;
      if (established && !region.established) {
        region.established = true;
        region.establishedAt = tick;
        region.protection = 0;
        region.strength = Math.max(region.strength, .64);
      }
    }
    first.links.push(second.id);
    second.links.push(first.id);
  }

  function connectedRadius(region, regions) {
    let minimum = 0;
    for (const id of region.links) {
      const neighbor = regions.find(other => other.id === id);
      if (!neighbor) continue;
      const dx = (neighbor.x - region.x) / scaleX;
      const dy = neighbor.y - region.y;
      const angle = Math.atan2(dy, dx);
      const factor = radiusAt({ ...region, radius: 1 }, angle);
      minimum = Math.max(minimum, (Math.hypot(dx, dy) - radiusAt(neighbor, angle + Math.PI) + 2) / factor);
    }
    return minimum;
  }

  return { polygon, cellKey, cutShape, cutPolygon, isEmpty, contains, mayOverlap, at, spatialIndex, reachesGroupEdge, canCreate, limitRadius, touching, merge, connectedRadius };
});
