/* After Nine — theme script */
(function () {
  const theme = window.theme || { routes: {} };

  /* Header: solid once past the hero */
  const header = document.getElementById('header');
  const hero = document.querySelector('.hero');
  if (header && header.dataset.overlay === 'true' && hero) {
    const onScroll = () => header.classList.toggle('solid', window.scrollY > hero.offsetHeight - 80);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* Live clock */
  const clocks = document.querySelectorAll('[data-clock]');
  if (clocks.length) {
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: theme.timezone || 'Australia/Brisbane' });
    } catch (e) {
      fmt = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit' });
    }
    const tick = () => clocks.forEach((el) => { el.textContent = fmt.format(new Date()).toLowerCase(); });
    tick();
    setInterval(tick, 30000);
  }

  /* Cart drawer */
  const drawer = document.querySelector('[data-drawer]');
  let lastFocus = null;

  function openDrawer() {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    drawer.querySelector('.drawer__panel').focus();
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  function renderCart(sections, count) {
    const html = sections && sections['cart-drawer'];
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.querySelector('[data-cart-body]');
      document.querySelectorAll('[data-cart-body]').forEach((el) => { if (fresh) el.innerHTML = fresh.innerHTML; });
    }
    if (typeof count === 'number') {
      document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = count; });
    }
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cart-open]') && drawer && document.body.classList.contains('template-cart') === false) {
      e.preventDefault();
      openDrawer();
    }
    if (e.target.closest('[data-cart-close]')) closeDrawer();

    const qtyBtn = e.target.closest('[data-line]');
    if (qtyBtn) {
      const bodies = document.querySelectorAll('[data-cart-body]');
      bodies.forEach((b) => b.classList.add('is-busy'));
      fetch(theme.routes.cartChange + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ line: Number(qtyBtn.dataset.line), quantity: Number(qtyBtn.dataset.qty), sections: 'cart-drawer' })
      })
        .then((r) => r.json())
        .then((cart) => renderCart(cart.sections, cart.item_count))
        .finally(() => bodies.forEach((b) => b.classList.remove('is-busy')));
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) closeDrawer();
  });

  /* Product form: variants + add to bag */
  document.querySelectorAll('[data-product]').forEach((root) => {
    const form = root.querySelector('[data-product-form]');
    if (!form) return;
    const variants = JSON.parse(root.querySelector('[data-variants]').textContent);
    const idInput = form.querySelector('[data-variant-id]');
    const addBtn = form.querySelector('[data-add]');
    const priceEl = root.querySelector('[data-price]');
    const errorEl = form.querySelector('[data-error]');
    const radios = form.querySelectorAll('input[data-option-index]');
    const labels = { add: addBtn.textContent.trim(), out: 'Sold out', na: 'Unavailable' };
    const money = (cents) => {
      const v = cents / 100;
      return '$' + (Number.isInteger(v) ? v : v.toFixed(2));
    };

    function selected() {
      const values = [];
      radios.forEach((r) => { if (r.checked) values[Number(r.dataset.optionIndex)] = r.value; });
      return values;
    }

    function markAvailability(values) {
      radios.forEach((r) => {
        const i = Number(r.dataset.optionIndex);
        const test = values.slice();
        test[i] = r.value;
        const ok = variants.some((v) => v.available && v.options.every((o, j) => j === i || test[j] === undefined || o === test[j]) && v.options[i] === r.value);
        r.closest('.opt__value').classList.toggle('is-out', !ok);
      });
    }

    function update() {
      const values = selected();
      const v = variants.find((x) => x.options.every((o, i) => o === values[i]));
      markAvailability(values);
      if (!v) {
        addBtn.disabled = true;
        addBtn.textContent = labels.na;
        return;
      }
      idInput.value = v.id;
      addBtn.disabled = !v.available;
      addBtn.textContent = v.available ? labels.add : labels.out;
      if (priceEl) {
        priceEl.innerHTML = (v.compare_at_price > v.price ? '<s class="price__was">' + money(v.compare_at_price) + '</s> ' : '') + money(v.price);
      }
      const url = new URL(location.href);
      url.searchParams.set('variant', v.id);
      history.replaceState({}, '', url);
    }

    radios.forEach((r) => r.addEventListener('change', update));
    if (radios.length) markAvailability(selected());

    form.addEventListener('submit', (e) => {
      if (!drawer) return;
      e.preventDefault();
      errorEl.hidden = true;
      addBtn.disabled = true;
      fetch(theme.routes.cartAdd + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: Number(idInput.value), quantity: 1 }], sections: 'cart-drawer' })
      })
        .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          if (!ok) throw new Error(data.description || data.message || 'Could not add to bag.');
          return fetch(theme.routes.cart + '.js').then((r) => r.json()).then((cart) => {
            renderCart(data.sections, cart.item_count);
            openDrawer();
          });
        })
        .catch((err) => {
          errorEl.textContent = err.message;
          errorEl.hidden = false;
        })
        .finally(() => { addBtn.disabled = false; });
    });
  });
})();
