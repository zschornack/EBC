// TELA DE CARREGAMENTO
// Espera as imagens e as fontes carregarem e então some com um fade.
// Se algo demorar demais, some sozinha depois de 8 segundos.
(function () {
  var loader = document.getElementById('page-loader');
  var root = document.documentElement;
  var finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    loader.classList.add('done');
    root.classList.remove('is-loading');
    setTimeout(function () { loader.remove(); }, 700);
  }

  if (document.readyState === 'complete') { finish(); return; } // já estava tudo em cache

  window.addEventListener('load', function () {
    var fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    fonts.then(finish, finish);
  });
  setTimeout(finish, 8000); // trava de segurança
})();


// MENU HAMBÚRGUER (tablet e celular)
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.getElementById('nav-links');

  var scrollWhenOpened = 0;

  function setOpen(open) {
    if (open) scrollWhenOpened = window.scrollY;
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

  // fecha o menu quando a pessoa começa a rolar a página
  // (tolerância de 12px para não fechar com um toque que mexe a tela sem querer)
  window.addEventListener('scroll', function () {
    if (links.classList.contains('open') && Math.abs(window.scrollY - scrollWhenOpened) > 12) setOpen(false);
  }, { passive: true });
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
    // as cores vêm do próprio livro (style="--cover-bg: ...; --cover-fg: ..." no HTML)
    var css = getComputedStyle(spine);
    var bg = css.getPropertyValue('--cover-bg'), fg = css.getPropertyValue('--cover-fg');
    book.className = 'book-3d' + (spine.classList.contains('reveal') ? ' reveal' : '');
    book.style.setProperty('--cover-bg', bg);
    book.style.setProperty('--cover-fg', fg);
    // cor da etiqueta da turma no livro aberto: usa --cover-accent se o livro tiver, senão a cor das letras
    var accent = css.getPropertyValue('--cover-accent').trim() || fg;
    modal.style.setProperty('--book-accent', d.kind === 'upcoming' ? '' : accent);
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


// PRÓXIMA ABERTURA DE TURMAS
// As turmas começam em 1º de fevereiro e 1º de agosto, à meia-noite de Brasília.
// Esta regra é usada pelo contador e pelo ano da lista de espera.
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


// ANO DA LISTA DE ESPERA
// Mostra o ano da próxima turma: 2027 até a turma de agosto de 2027 começar, depois 2028, e assim por diante.
(function () {
  var year = new Date(nextLaunchDate(new Date())).getUTCFullYear();
  document.querySelectorAll('[data-launch-year]').forEach(function (el) { el.textContent = year; });
  document.querySelectorAll('[data-launch-year-num]').forEach(function (el) { el.dataset.num = year + ' ?'; });
})();


// CONTAGEM REGRESSIVA
// Conta até a data abaixo (horário de Brasília). Para mudar, é só trocar a data:
// formato "ANO-MÊS-DIATHORA:MINUTO:SEGUNDO-03:00" (o -03:00 é o fuso de Brasília).
// Depois que essa data passa, o contador volta sozinho a contar até a próxima
// abertura de turma (1º de fevereiro ou 1º de agosto), então nunca fica zerado.
var COUNTDOWN_DATE = '2026-12-11T00:00:00-03:00';

(function () {
  var fixedDate = Date.parse(COUNTDOWN_DATE);

  function update() {
    var now = new Date();
    var target = fixedDate > now.getTime() ? fixedDate : nextLaunchDate(now);
    var total = Math.floor((target - now.getTime()) / 1000);
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
  var phone = form.querySelector('input[name="phone"]');

  var PHONE_ERROR = 'O número de WhatsApp não está certo. Confira o DDD e o número, ex.: (11) 98765-4321.';
  var MESSAGES = {
    captcha: 'Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo.',
    invalid_phone: PHONE_ERROR,
    invalid_name: 'Confira o nome do responsável.',
    invalid_student_name: 'Confira o nome do aluno.',
    invalid_age: 'Selecione a idade do aluno.',
    invalid_program: 'Selecione a turma de interesse.'
  };

  // DDDs que existem no Brasil
  var DDDS = [11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,
    51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];

  // Confere se o telefone faz sentido: DDD real, celular com 9 na frente, fixo começando de 2 a 5
  function phoneIsValid(value) {
    var d = value.replace(/\D/g, '');
    if (d.length !== 10 && d.length !== 11) return false;
    if (DDDS.indexOf(Number(d.slice(0, 2))) === -1) return false;
    if (d.length === 11) return d[2] === '9';
    return '2345'.indexOf(d[2]) !== -1;
  }

  // ANTI-ROBÔ (Turnstile): só liga se a Site Key estiver preenchida no <form> do index.html
  var siteKey = (form.dataset.turnstileSitekey || '').trim();
  var widgetId = null;
  if (siteKey) {
    window.onTurnstileLoad = function () {
      widgetId = window.turnstile.render('#turnstile-box', { sitekey: siteKey, language: 'pt-br', size: 'flexible' });
    };
    var ts = document.createElement('script');
    ts.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
    ts.async = true;
    document.head.appendChild(ts);
  }
  function resetTurnstile() {
    if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = 'form-status ' + (type || '');
  }

  function markPhone(invalid) {
    phone.classList.toggle('invalid', invalid);
    phone.setAttribute('aria-invalid', invalid ? 'true' : 'false');
  }

  // máscara do telefone: vai formatando enquanto a pessoa digita → (11) 98765-4321
  phone.addEventListener('input', function () {
    var d = phone.value.replace(/\D/g, '').slice(0, 11);
    var out = d;
    if (d.length > 2) out = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 6) {
      var split = d.length === 11 ? 7 : 6; // celular tem 9 dígitos, fixo tem 8
      out = '(' + d.slice(0, 2) + ') ' + d.slice(2, split) + '-' + d.slice(split);
    }
    phone.value = out;
    if (phone.classList.contains('invalid') && phoneIsValid(out)) { markPhone(false); showStatus(''); }
  });

  // Sucesso: o formulário dá lugar a um cartão verde com animação de ✓
  var success = document.getElementById('waitlist-success');
  function showSuccess() {
    var student = form.elements.studentName.value.trim();
    document.getElementById('success-student').textContent = student || 'Seu filho';
    document.getElementById('success-phone').textContent = phone.value.trim();
    form.reset();
    resetTurnstile();
    showStatus('');
    form.hidden = true;
    success.hidden = false;
    success.classList.remove('is-shown');
    void success.offsetWidth; // reinicia a animação
    success.classList.add('is-shown');
    var top = success.getBoundingClientRect().top;
    if (top < 90 || top > window.innerHeight * 0.7) success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    success.focus({ preventScroll: true });
  }
  document.getElementById('success-again').addEventListener('click', function () {
    success.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault(); // impede o navegador de recarregar a página

    // 1. telefone: mensagem específica, antes de qualquer outra coisa
    if (phone.value.trim() !== '' && !phoneIsValid(phone.value)) {
      markPhone(true);
      showStatus(PHONE_ERROR, 'error');
      phone.focus();
      return;
    }
    markPhone(false);

    // 2. demais campos: validação do próprio navegador (obrigatórios)
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

      if (!response.ok) {
        // o servidor diz qual campo está errado (ex.: { error: "invalid_phone" })
        var data = await response.json().catch(function () { return {}; });
        if (data.error === 'invalid_phone') { markPhone(true); phone.focus(); }
        showStatus(MESSAGES[data.error] || 'Não foi possível enviar agora. Tente novamente em alguns instantes.', 'error');
        resetTurnstile();
        return;
      }

      showSuccess();
    } catch (error) {
      showStatus('Não foi possível enviar agora. Verifique sua conexão e tente novamente.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = buttonText;
    }
  });
})();


/* ---------- Depoimentos: carrossel automático + print ampliado ----------
   - rola sozinho, em loop (a lista é duplicada no fim para emendar sem "pulo");
   - pausa com o mouse em cima, enquanto a pessoa arrasta/toca, fora da tela ou com o print ampliado;
   - ‹ ›: um clique pula um bloco; segurar acelera; botão do meio pausa/continua;
   - quem prefere menos movimento (configuração do sistema) começa com ele pausado. */
(function () {
  var track = document.getElementById('feedback-track');
  if (!track) return;
  var dialog = document.getElementById('feedback-dialog');
  var big = dialog.querySelector('img');
  var prev = document.getElementById('feedback-prev');
  var next = document.getElementById('feedback-next');
  var pauseBtn = document.getElementById('feedback-pause');

  var SPEED = window.matchMedia('(max-width: 600px)').matches ? 32 : 45; // px por segundo
  var BOOST = 14;          // quantas vezes mais rápido ao segurar ‹ ou ›
  var HOLD_MS = 260;       // a partir de quanto tempo segurando conta como "segurar"
  var RESUME_MS = 2500;    // volta a andar este tempo depois que a pessoa para de mexer

  // 1. duplica os prints para o loop infinito (cópias escondidas de leitores de tela e do Tab)
  var originals = Array.prototype.slice.call(track.children);
  originals.forEach(function (fig) {
    var copy = fig.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelector('button').tabIndex = -1;
    copy.querySelector('img').alt = '';
    track.appendChild(copy);
  });
  var firstCopy = track.children[originals.length];
  var loopWidth = 0;
  function measure() { loopWidth = firstCopy.offsetLeft - originals[0].offsetLeft; }
  measure();
  window.addEventListener('resize', measure);
  track.addEventListener('load', measure, true); // quando cada imagem termina de carregar

  // 2. estado
  var pos = track.scrollLeft;
  var lastSet = pos;
  var userPaused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hovering = false, onScreen = false, interactingUntil = 0, boost = 0, tween = null, last = 0;

  function setPaused(value) {
    userPaused = value;
    pauseBtn.setAttribute('aria-pressed', String(value));
    pauseBtn.setAttribute('aria-label', value ? 'Continuar o carrossel' : 'Pausar o carrossel');
  }
  setPaused(userPaused);

  function wrap(value) {
    if (!loopWidth) return value;
    while (value >= loopWidth) value -= loopWidth;
    while (value < 0) value += loopWidth;
    return value;
  }

  function frame(now) {
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;

    // se a pessoa rolou na mão (dedo, trackpad), segue de onde ela parou
    if (Math.abs(track.scrollLeft - lastSet) > 1) { pos = track.scrollLeft; interactingUntil = now + RESUME_MS; }

    var moving = onScreen && !dialog.open && !document.hidden;
    if (tween) {
      var t = Math.min((now - tween.start) / tween.duration, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      pos = tween.from + (tween.to - tween.from) * eased;
      if (t === 1) tween = null;
    } else if (boost && moving) {
      pos += SPEED * BOOST * boost * dt;
    } else if (moving && !userPaused && !hovering && now > interactingUntil) {
      pos += SPEED * dt;
    }

    var wrapped = wrap(pos);
    if (tween && wrapped !== pos) { tween.from += wrapped - pos; tween.to += wrapped - pos; }
    pos = wrapped;
    if (Math.round(pos) !== Math.round(track.scrollLeft)) track.scrollLeft = Math.round(pos);
    lastSet = track.scrollLeft;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 3. quando pausa sozinho
  new IntersectionObserver(function (entries) { onScreen = entries[0].isIntersecting; }).observe(track);
  track.addEventListener('mouseenter', function () { hovering = true; });
  track.addEventListener('mouseleave', function () { hovering = false; });
  ['touchstart', 'wheel'].forEach(function (type) {
    track.addEventListener(type, function () { interactingUntil = performance.now() + RESUME_MS; tween = null; }, { passive: true });
  });

  // 4. arrastar com o mouse (no celular o dedo já rola naturalmente)
  var drag = null, suppressClick = false;
  track.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, pos: pos, moved: false };
    tween = null;
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6 && !drag.moved) { drag.moved = true; track.classList.add('is-dragging'); }
    if (drag.moved) { pos = wrap(drag.pos - dx); track.scrollLeft = Math.round(pos); lastSet = track.scrollLeft; interactingUntil = performance.now() + RESUME_MS; }
  });
  window.addEventListener('pointerup', function () {
    if (!drag) return;
    suppressClick = drag.moved;
    drag = null;
    track.classList.remove('is-dragging');
  });

  // 5. botões ‹ ›: clique = pula um bloco; segurar = acelera
  function jump(direction) {
    var from = tween ? tween.to : pos;
    tween = { from: pos, to: from + direction * track.clientWidth * 0.7, start: performance.now(), duration: 650 };
    interactingUntil = performance.now() + RESUME_MS;
  }
  [[prev, -1], [next, 1]].forEach(function (pair) {
    var btn = pair[0], direction = pair[1], timer = null, held = false;
    function stop() {
      clearTimeout(timer);
      if (held) { boost = 0; btn.classList.remove('is-active'); interactingUntil = performance.now() + RESUME_MS; }
    }
    btn.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      held = false;
      timer = setTimeout(function () { held = true; tween = null; boost = direction; btn.classList.add('is-active'); }, HOLD_MS);
    });
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); }); // segurar no celular não abre menu
    btn.addEventListener('click', function () {
      if (held) { held = false; return; } // foi "segurar", não clique
      jump(direction);
    });
  });
  pauseBtn.addEventListener('click', function () { setPaused(!userPaused); });

  // teclado: setas com o carrossel em foco
  track.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); jump(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); jump(-1); }
  });

  // 6. clique num print = abre ampliado
  track.addEventListener('click', function (e) {
    if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
    var button = e.target.closest('.feedback-open');
    if (!button || typeof dialog.showModal !== 'function') return;
    var img = button.querySelector('img');
    var original = img.closest('[aria-hidden]') ? originals[Array.prototype.indexOf.call(track.children, img.closest('.feedback')) - originals.length].querySelector('img') : img;
    big.src = img.currentSrc || img.src;
    big.alt = original.alt;
    dialog.showModal();
    dialog.scrollTop = 0;
  });
  dialog.querySelector('.feedback-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
})();
