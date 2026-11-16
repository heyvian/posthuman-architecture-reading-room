(() => {
  const entities = [...document.querySelectorAll('.roaming-entity')];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const background = document.querySelector('.roaming-background');
  const foreground = document.querySelector('.roaming-foreground');
  const pileLayers = [...document.querySelectorAll('.pile-roaming-layer')];
  const destinations = [background, background, ...pileLayers, ...Array(entities.length - pileLayers.length - 2).fill(foreground)];
  for (let i = destinations.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [destinations[i], destinations[j]] = [destinations[j], destinations[i]];
  }
  const occupants = entities.map((element, index) => {
    const destination = destinations[index];
    destination.append(element);
    const pile = pileLayers.includes(destination);
    if (pile) destination.style.zIndex = String(2 + Math.floor(Math.random() * 37));
    const phase = Math.random() * Math.PI * 2;
    return {
      element, pile, path: element.querySelector('path'), form: element.dataset.form, index,
      size: index === 0 ? 35 : index === 1 ? 105 : 35 + Math.random() * 70,
      seed: Math.random() * 10000,
      phase,
      scrollSpeed: .65 + Math.random() * .8,
      driftSpeed: .75 + Math.random() * .5,
      x: .5 + .38 * Math.sin(phase),
      y: .5 + .33 * Math.sin(phase * 1.3),
      scatterFrom: null,
      scatterTo: null,
      from: .12 + Math.random() * .18,
      to: .12 + Math.random() * .18,
      started: performance.now(),
      duration: 6000 + Math.random() * 4000
    };
  });
  let timer = null;
  let frame = null;
  let scrollDistance = 0;
  let lastScroll = window.scrollY;
  let lastScrollAt = performance.now();
  let lastFrameAt = lastScrollAt;

  function gene(seed, generation, channel) {
    const value = Math.sin(seed + generation * 91.73 + channel * 47.31) * 43758.5453;
    return value - Math.floor(value);
  }

  function shape(form, trait, maturity, genes) {
    let path = '';
    if (form === 'branch') {
      const count = 4 + Math.floor(trait * 8 + maturity * genes[0] * 5);
      for (let i = 0; i < count; i += 1) {
        const angle = i * Math.PI * 2 / count + maturity * .18 * Math.sin(i * 2.1 + genes[1] * 6);
        const length = (20 + trait * 14) * (1 - maturity * .3 * (1 + Math.sin(i * 3.2 + genes[2] * 6)) / 2);
        const x = 50 + Math.cos(angle) * length;
        const y = 50 + Math.sin(angle) * length;
        const bx = 50 + Math.cos(angle) * length * .6;
        const by = 50 + Math.sin(angle) * length * .6;
        path += `M50 50L${x} ${y}M${bx} ${by}l${Math.cos(angle + .7) * length * .3} ${Math.sin(angle + .7) * length * .3}`;
        if (trait > .7) {
          path += `M${bx} ${by}l${Math.cos(angle - .7) * length * .3} ${Math.sin(angle - .7) * length * .3}`;
        }
      }
    } else if (form === 'coil') {
      const turns = 1.5 + trait * (2.5 + genes[0] * 2);
      for (let i = 0; i <= 100; i += 1) {
        const angle = i / 100 * turns * Math.PI * 2;
        const radius = (2 + i / 100 * 35) * (1 - maturity * .16 * (1 + Math.sin(angle * 2 + genes[1] * 6)));
        path += `${i ? 'L' : 'M'}${50 + Math.cos(angle) * radius} ${50 + Math.sin(angle) * radius}`;
      }
    } else {
      const lines = 2 + Math.floor(trait * 4 + maturity * genes[0] * 3);
      for (let line = 0; line < lines; line += 1) {
        for (let i = 0; i <= 30; i += 1) {
          const x = 10 + i / 30 * 80;
          const y = 50 + (line - (lines - 1) / 2) * 7 + Math.sin(i / 30 * Math.PI * (4 + trait * 4) + line * maturity * genes[1]) * (3 + trait * 4);
          path += `${i ? 'L' : 'M'}${x} ${y}`;
        }
      }
    }
    if (maturity > .08) {
      const rays = Math.floor(maturity * (3 + genes[2] * 6));
      for (let i = 0; i < rays; i += 1) {
        const angle = i * Math.PI * 2 / Math.max(1, rays) + genes[3] * 2;
        const start = 10 + genes[1] * 12;
        const end = 22 + genes[0] * 18 + 5 * Math.sin(i * 2 + genes[2] * 6);
        const x1 = 50 + Math.cos(angle) * start, y1 = 50 + Math.sin(angle) * start;
        const x2 = 50 + Math.cos(angle) * end, y2 = 50 + Math.sin(angle) * end;
        const bend = 3 + genes[3] * 7;
        path += `M${x1} ${y1}Q${(x1+x2)/2 + Math.cos(angle+1.57)*bend} ${(y1+y2)/2 + Math.sin(angle+1.57)*bend} ${x2} ${y2}`;
        if (i % 2 === 0) {
          const radius = 1.5 + genes[4] * 3;
          path += `M${x2+radius} ${y2}a${radius} ${radius} 0 1 0 ${-2*radius} 0a${radius} ${radius} 0 1 0 ${2*radius} 0`;
        }
      }
      const cuts = Math.floor(maturity * (2 + genes[4] * 4));
      for (let i = 0; i < cuts; i += 1) {
        const angle = genes[2] * Math.PI + i * 1.3;
        const offset = (i - (cuts - 1) / 2) * 7;
        const cx = 50 + Math.cos(angle + 1.57) * offset;
        const cy = 50 + Math.sin(angle + 1.57) * offset;
        const length = 8 + genes[3] * 16;
        path += `M${cx-Math.cos(angle)*length} ${cy-Math.sin(angle)*length}L${cx+Math.cos(angle)*length} ${cy+Math.sin(angle)*length}`;
      }
    }
    return path;
  }

  function render() {
    frame = null;
    const now = performance.now();
    const elapsed = Math.min(250, Math.max(0, now - lastFrameAt));
    lastFrameAt = now;
    const still = motion.matches;
    const scroll = still ? 0 : window.scrollY;
    const maturity = still ? 0 : 1 - Math.exp(-scrollDistance / (window.innerHeight * 1.4));
    const scatterTime = Math.max(0, Math.min(1, (now - lastScrollAt - 200) / 5000));
    const scatter = still ? 0 : scatterTime * scatterTime * (3 - 2 * scatterTime);
    occupants.forEach((entity) => {
      if (!still && now - entity.started >= entity.duration) {
        entity.from = entity.to;
        entity.to = .12 + Math.random() * .18;
        entity.started = now;
        entity.duration = 6000 + Math.random() * 4000;
      }
      const progress = still ? 0 : Math.min(1, (now - entity.started) / entity.duration);
      const base = entity.from + (entity.to - entity.from) * progress;
      const generation = still ? 0 : scrollDistance * entity.scrollSpeed / 650;
      const stage = Math.floor(generation);
      const blend = generation - stage;
      const genes = Array.from({length:5}, (_, channel) => {
        const previous = gene(entity.seed, stage, channel);
        return previous + (gene(entity.seed, stage + 1, channel) - previous) * blend;
      });
      const trait = base + maturity * (.65 + genes[0] * .6);
      entity.element.style.width = `${entity.size}px`;
      entity.element.style.height = `${entity.size}px`;
      const size = entity.element.clientWidth;
      const movingX = .5 + .38 * Math.sin(scroll * entity.scrollSpeed / 1800 + entity.phase);
      const movingY = .5 + .33 * Math.sin(scroll * entity.scrollSpeed / 1300 + entity.phase * 1.3);
      if (!still && scatterTime > 0) {
        if (!entity.scatterFrom) {
          entity.scatterFrom = {x:entity.x,y:entity.y};
          const distances = [entity.x * (window.innerWidth - size), (1-entity.x) * (window.innerWidth - size), entity.y * (window.innerHeight - size), (1-entity.y) * (window.innerHeight - size)];
          const edge = distances.indexOf(Math.min(...distances));
          entity.scatterTo = {x:edge===0?0:edge===1?1:entity.x,y:edge===2?0:edge===3?1:entity.y};
        }
        entity.x = entity.scatterFrom.x + (entity.scatterTo.x - entity.scatterFrom.x) * scatter;
        entity.y = entity.scatterFrom.y + (entity.scatterTo.y - entity.scatterFrom.y) * scatter;
      } else if (!still && now - lastScrollAt <= 200) {
        const follow = 1 - Math.exp(-elapsed / 900);
        entity.x += (movingX - entity.x) * follow;
        entity.y += (movingY - entity.y) * follow;
      }
      const horizontal = still ? .12 + (entity.index % 4) * .25 : entity.x;
      const vertical = still ? .15 + Math.floor(entity.index / 4) * .22 : entity.y;
      const driftX = still ? 0 : Math.sin(now * entity.driftSpeed / 3500 + entity.phase) * 26;
      const driftY = still ? 0 : Math.cos(now * entity.driftSpeed / 4200 + entity.phase) * 20;
      const x = Math.max(0, Math.min(window.innerWidth - size, (window.innerWidth - size) * horizontal + driftX));
      const y = Math.max(0, Math.min(window.innerHeight - size, (window.innerHeight - size) * vertical + driftY));
      const pileBounds = entity.pile ? entity.element.parentElement.getBoundingClientRect() : null;
      entity.element.style.left = `${x - (pileBounds ? pileBounds.left : 0)}px`;
      entity.element.style.top = `${y - (pileBounds ? pileBounds.top : 0)}px`;
      entity.element.style.transform = still ? 'none' : `rotate(${Math.sin(scroll / 900 + entity.phase) * 25}deg)`;
      entity.path.setAttribute('d', shape(entity.form, trait, maturity, genes));
    });
  }

  function scheduleRender() {
    if (frame === null) frame = requestAnimationFrame(render);
  }

  function updateMotion() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    lastScroll = window.scrollY;
    if (!motion.matches && !document.hidden) timer = setInterval(scheduleRender, 160);
    scheduleRender();
  }

  window.addEventListener('scroll', () => {
    if (!motion.matches) scrollDistance += Math.abs(window.scrollY - lastScroll);
    lastScroll = window.scrollY;
    lastScrollAt = performance.now();
    occupants.forEach(entity => { entity.scatterFrom = null; entity.scatterTo = null; });
    scheduleRender();
  }, { passive: true });
  window.addEventListener('resize', scheduleRender);
  document.addEventListener('visibilitychange', updateMotion);
  motion.addEventListener('change', updateMotion);
  updateMotion();
})();
