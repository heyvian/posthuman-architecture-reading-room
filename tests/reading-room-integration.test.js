const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('author-date citations open the corresponding reading cards', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), context);
  const expected = {
    'Jencks, 1977': 'metabolism',
    'Schalk, 2014': 'schalk-metabolism',
    'Constant and Debord, 1958': 'amsterdam-declaration',
    'Negroponte, 1969': 'negroponte-machines'
  };
  const citations = [...html.matchAll(/<button class="citation-link"[^>]*data-reading-id="([^"]+)"[^>]*>([^<]+)<\/button>/g)];
  assert.equal(citations.length, Object.keys(expected).length);
  for (const [, id, label] of citations) {
    assert.equal(id, expected[label]);
    assert.equal(context.window.readings.filter((reading) => reading.id === id).length, 1);
  }
  assert.ok(html.indexOf('id="authorship"') < html.indexOf('id="process-log"'));
  assert.ok(!html.includes('id="references"'));
});

test('roaming entities keep evolving, scatter after scrolling, and respect reduced motion', () => {
  let now = 0;
  let scheduled;
  let interval;
  const events = {};
  const media = { matches: false, addEventListener: (name, callback) => { events.motion = callback; } };
  const entities = Array.from({ length: 13 }, (_, index) => {
    const form = ['branch', 'wave', 'coil'][index % 3];
    const element = {
      dataset: { form },
      get clientWidth() { return parseFloat(this.style.width); },
      style: {},
      path: { setAttribute: (name, value) => { element.d = value; } },
      querySelector: () => element.path
    };
    return element;
  });
  function layer() {
    return {
      style: {},
      append(element) { element.parentElement = this; },
      getBoundingClientRect: () => ({ left: 100, top: 200 })
    };
  }
  const background = layer();
  const foreground = layer();
  const piles = Array.from({ length: 5 }, layer);
  const window = {
    innerWidth: 1000, innerHeight: 800, scrollY: 0,
    matchMedia: () => media,
    addEventListener: (name, callback) => { events[name] = callback; }
  };
  const document = {
    hidden: false,
    documentElement: { scrollHeight: 4800 },
    querySelectorAll: (selector) => selector === '.roaming-entity' ? entities : piles,
    querySelector: (selector) => selector === '.roaming-background' ? background : foreground,
    addEventListener: (name, callback) => { events[name] = callback; }
  };
  const math = Object.create(Math);
  math.random = () => .5;
  const context = {
    window, document, Math: math, performance: { now: () => now },
    requestAnimationFrame: (callback) => { scheduled = callback; return 1; },
    setInterval: (callback) => { interval = callback; return 1; },
    clearInterval: () => { interval = null; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'ambient-entities.js'), 'utf8'), context);
  scheduled();
  const initialPath = entities[0].d;
  const initialTop = entities[0].style.top;
  assert.ok(initialPath);
  assert.equal(entities[0].style.width, '35px');
  assert.equal(entities[1].style.width, '105px');
  const initialBranches = (initialPath.match(/M50 50L/g) || []).length;

  now = 5000;
  window.scrollY = 4000;
  events.scroll();
  scheduled();
  assert.notEqual(entities[0].d, initialPath);
  assert.notEqual(entities[0].style.top, initialTop);
  assert.ok((entities[0].d.match(/M50 50L/g) || []).length > initialBranches);
  assert.match(entities[0].d, /Q/);

  const pileOffset = () => piles.includes(entities[0].parentElement) ? { x: 100, y: 200 } : { x: 0, y: 0 };
  const position = () => ({ x: parseFloat(entities[0].style.left) + pileOffset().x, y: parseFloat(entities[0].style.top) + pileOffset().y });
  const start = position();
  const distances = [start.x, 1000 - 35 - start.x, start.y, 800 - 35 - start.y];
  const closest = distances.indexOf(Math.min(...distances));
  now += 5200;
  interval();
  scheduled();
  const scattered = position();
  const edgeDistances = [scattered.x, 1000 - 35 - scattered.x, scattered.y, 800 - 35 - scattered.y];
  assert.ok(edgeDistances[closest] <= 30, `Expected scatter toward edge ${closest}, got ${edgeDistances}`);

  const forwardPath = entities[0].d;
  window.scrollY = 0;
  events.scroll();
  scheduled();
  const resumed = position();
  assert.ok(Math.abs(resumed.x - scattered.x) < 1);
  assert.ok(Math.abs(resumed.y - scattered.y) < 1);
  assert.notEqual(entities[0].d, forwardPath);

  window.scrollY = 12000;
  events.scroll();
  scheduled();
  const laterPath = entities[0].d;
  window.scrollY = 0;
  events.scroll();
  scheduled();
  assert.notEqual(entities[0].d, laterPath);

  media.matches = true;
  events.motion();
  scheduled();
  assert.equal(interval, null);
  assert.equal(entities[0].style.transform, 'none');
});
