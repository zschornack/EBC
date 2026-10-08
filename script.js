// MENU HAMBÚRGUER (tablet e celular)
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.getElementById('nav-links');

  function setOpen(open) {
    links.classList.toggle('open', open);
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  }

  toggle.addEventListener('click', function () {
    setOpen(!links.classList.contains('open'));
  });

  links.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 900) setOpen(false);
  });
})();


// ESTANTE: livros que saem da prateleira e abrem em 3D
(function () {
  var modal = document.getElementById('book-modal');
  var book = document.getElementById('bm-book');
  var bk = book.querySelector('.bk');
  var stage = book.parentNode;
  var info = document.getElementById('bm-info');
  var closeBtn = document.getElementById('bm-close');
  var shelf = document.querySelector('.bookshelf');
  var spines = document.querySelectorAll('.spine');
  var current = null, busy = false, ready = false;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var T = function (ms) { return calm ? 1 : ms; };
  var COVERS = ['cover-one', 'cover-two', 'cover-three', 'reveal'];

  // número em cada lombada + entrada da estante
  spines.forEach(function (s, i) {
    s.style.setProperty('--i', i);
    var n = document.createElement('span');
    n.className = 'spine-num';
    n.textContent = s.dataset.kind === 'upcoming' ? '?' : s.dataset.num.replace('LIVRO ', '');
    s.appendChild(n);
  });
  shelf.classList.add('pre');
  new IntersectionObserver(function (es, o) {
    if (es[0].isIntersecting) { shelf.classList.remove('pre'); shelf.classList.add('in'); o.disconnect(); }
  }, { threshold: .3 }).observe(shelf);

  function tf(dx, dy, s, z, ry, rx) {
    return 'translate(' + dx + 'px, ' + dy + 'px) scale3d(' + s + ',' + s + ',' + s + ') translateZ(' + z + 'px) rotateY(' + ry + 'deg) rotateX(' + rx + 'deg)';
  }
  var REST = tf(0, 0, 1, 0, 24, -6);

  // pose do livro grande que coincide com a lombada na estante (lombada de frente)
  function pose(spine, ry) {
    var r = spine.getBoundingClientRect(), b = book.getBoundingClientRect();
    var s = r.height / book.offsetHeight;
    return {
      s: s, d: r.width / s,
      dx: r.left + r.width / 2 - (b.left + b.width / 2),
      dy: r.top + r.height / 2 - (b.top + b.height / 2),
      z: -book.offsetWidth / 2, ry: ry
    };
  }
  function at(p) { return tf(p.dx, p.dy, p.s, p.z, 90, 0); }

  function open(spine) {
    if (busy) return;
    busy = true; ready = false; current = spine;
    var d = spine.dataset;
    document.getElementById('bm-tag').textContent = d.tag;
    document.getElementById('bm-title').textContent = d.title;
    document.getElementById('bm-desc').textContent = d.desc;
    document.getElementById('bm-num').textContent = d.num;
    document.getElementById('bm-spine').innerHTML = spine.innerHTML;
    modal.dataset.kind = d.kind;
    modal.dataset.book = COVERS.filter(function (c) { return spine.classList.contains(c); })[0];
    book.className = 'book-3d ' + modal.dataset.book;
    document.getElementById('bm-front').style.backgroundImage = d.cover ? 'url("' + d.cover + '")' : '';
    book.classList.toggle('has-image', !!d.cover);

    modal.hidden = false;
    document.documentElement.classList.add('modal-open');
    modal.getBoundingClientRect();
    modal.classList.add('show');

    var p = pose(spine);
    book.style.setProperty('--d', p.d + 'px');
    book.style.setProperty('--k', p.s);
    book.style.setProperty('--fs', getComputedStyle(spine.querySelector('.spine-title')).fontSize);
    spine.classList.add('pulled');

    var a = book.animate([
      { transform: at(p), offset: 0 },
      { transform: tf(p.dx * .4, p.dy * .4 - 60, p.s + (1 - p.s) * .6, 70, 60, -4), offset: .4 },
      { transform: REST, offset: 1 }
    ], { duration: T(1100), easing: 'cubic-bezier(.22,1,.36,1)' });
    info.animate([
      { opacity: 0, transform: 'translateX(-24px)' },
      { opacity: 1, transform: 'none' }
    ], { duration: T(520), delay: T(480), fill: 'backwards', easing: 'ease-out' });

    a.finished.then(function () { busy = false; ready = true; closeBtn.focus(); });
  }

  function close() {
    if (busy || !current) return;
    busy = true; ready = false;
    var spine = current;
    bk.style.setProperty('--rx', '0deg'); bk.style.setProperty('--ry', '0deg');
    modal.classList.remove('show');
    info.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(200), fill: 'forwards' });
    var p = pose(spine);
    var a = book.animate([
      { transform: REST, offset: 0 },
      { transform: tf(p.dx * .4, p.dy * .4 - 50, p.s + (1 - p.s) * .6, 60, 60, -4), offset: .55 },
      { transform: at(p), offset: 1 }
    ], { duration: T(800), easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });

    a.finished.then(function () {
      modal.hidden = true;
      book.getAnimations().concat(info.getAnimations()).forEach(function (x) { x.cancel(); });
      spine.classList.remove('pulled');
      document.documentElement.classList.remove('modal-open');
      spine.focus();
      current = null; busy = false;
    });
  }

  // o livro acompanha o mouse depois de aberto
  stage.addEventListener('mousemove', function (e) {
    if (!ready || calm) return;
    var r = stage.getBoundingClientRect();
    var nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5;
    bk.style.setProperty('--ry', (nx * 22) + 'deg');
    bk.style.setProperty('--rx', (-ny * 14) + 'deg');
  });
  stage.addEventListener('mouseleave', function () {
    bk.style.setProperty('--ry', '0deg'); bk.style.setProperty('--rx', '0deg');
  });

  spines.forEach(function (s) { s.addEventListener('click', function () { open(s); }); });
  closeBtn.addEventListener('click', close);
  document.getElementById('bm-backdrop').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();


// ENTRADA SUAVE DOS BLOCOS AO ROLAR A PÁGINA
(function () {
  var sel = '.section-heading, .stats div, .program-card, .process-grid article, .included-item, .teacher-card, .testimonial, .faq-list details, .waitlist-inner > *';
  var els = document.querySelectorAll(sel);
  if (!('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('fx-in'); io.unobserve(e.target); } });
  }, { threshold: .15 });
  els.forEach(function (el) {
    el.style.setProperty('--fxi', Array.prototype.indexOf.call(el.parentNode.children, el) % 4);
    el.classList.add('fx'); io.observe(el);
  });
})();


// CONTAGEM REGRESSIVA
// Conta sempre até o próximo 1º de fevereiro ou 1º de agosto, à meia-noite
// no horário de Brasília (UTC-3). Quando a data chega, passa sozinho para a próxima.
(function () {
  function nextLaunchDate(now) {
    var year = now.getUTCFullYear();
    // Meia-noite em Brasília = 03:00 em UTC. Meses em JS começam em 0 (0 = jan).
    var candidates = [
      Date.UTC(year, 1, 1, 3),     // 1º de fevereiro deste ano
      Date.UTC(year, 7, 1, 3),     // 1º de agosto deste ano
      Date.UTC(year + 1, 1, 1, 3)  // 1º de fevereiro do ano que vem
    ];
    return candidates.find(function (date) { return date > now.getTime(); });
  }

  function update() {
    var now = new Date();
    var total = Math.floor((nextLaunchDate(now) - now.getTime()) / 1000);
    var values = {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60
    };
    Object.keys(values).forEach(function (unit) {
      document.querySelector('[data-unit="' + unit + '"]').textContent = String(values[unit]).padStart(2, '0');
    });
  }

  update();
  setInterval(update, 1000);
})();


// FORMULÁRIO DA LISTA DE ESPERA
// Envia os dados para o nosso backend (/api/lead) sem sair da página.
(function () {
  var form = document.getElementById('waitlist-form');
  var status = document.getElementById('form-status');
  var button = form.querySelector('button[type="submit"]');
  var buttonText = button.textContent;

  function showStatus(message, type) {
    status.textContent = message;
    status.className = 'form-status ' + (type || '');
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault(); // impede o navegador de recarregar a página

    // usa a validação do próprio navegador (campos obrigatórios, e-mail válido)
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    button.disabled = true;
    button.textContent = 'Enviando…';
    showStatus('');

    try {
      var response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      if (!response.ok) throw new Error('Falha no envio');

      form.reset();
      showStatus('Obrigado! Você está na lista de espera. Entraremos em contato em breve.', 'success');
    } catch (error) {
      showStatus('Não foi possível enviar agora. Tente novamente em alguns instantes.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = buttonText;
    }
  });
})();
