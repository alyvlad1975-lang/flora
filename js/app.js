/* ============ Состояние и утилиты ============ */
const LS_CART = 'flora_cart_v1';
const LS_ORDERS = 'flora_orders_v1';

const state = {
  cart: loadJSON(LS_CART, {}), // { productId: qty }
  filter: 'all',
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* хранилище недоступно — корзина живёт до конца сессии */
  }
}

const fmt = new Intl.NumberFormat('ru-RU');
const formatPrice = (n) => `${fmt.format(n)} ₽`;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const getProduct = (id) => PRODUCTS.find((p) => p.id === id);

function cartCount() {
  return Object.values(state.cart).reduce((sum, q) => sum + q, 0);
}

function cartSubtotal() {
  return Object.entries(state.cart).reduce((sum, [id, q]) => {
    const p = getProduct(id);
    return p ? sum + p.price * q : sum;
  }, 0);
}

function deliveryCost() {
  const sub = cartSubtotal();
  if (sub === 0 || sub >= FREE_DELIVERY_FROM) return 0;
  return DELIVERY_COST;
}

/* ============ Тосты ============ */
function toast(message) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
    <span></span>`;
  el.querySelector('span').textContent = message;
  box.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s ease';
    setTimeout(() => el.remove(), 320);
  }, 2600);
}

/* ============ Корзина: изменение ============ */
function setQty(id, qty) {
  if (qty <= 0) {
    delete state.cart[id];
  } else {
    state.cart[id] = Math.min(qty, 99);
  }
  saveJSON(LS_CART, state.cart);
  syncCartUI();
}

function addToCart(id, qty = 1) {
  const p = getProduct(id);
  if (!p) return;
  setQty(id, (state.cart[id] || 0) + qty);
  toast(`«${p.name}» — в корзине`);
}

/* ============ Бейдж корзины ============ */
function syncBadge() {
  const badge = $('#cart-badge');
  const n = cartCount();
  badge.hidden = n === 0;
  badge.textContent = n > 99 ? '99+' : String(n);
}

/* ============ Рендер каталога ============ */
function cardHTML(p) {
  const qty = state.cart[p.id] || 0;
  const tag = p.tag
    ? `<span class="card__tag${p.tagAccent ? ' card__tag--accent' : ''}">${p.tag}</span>`
    : '';
  const action = qty > 0
    ? `<div class="stepper" data-stepper="${p.id}">
         <button type="button" class="stepper__btn" data-step="dec" aria-label="Убавить один букет">−</button>
         <span class="stepper__val">${qty}</span>
         <button type="button" class="stepper__btn" data-step="inc" aria-label="Прибавить один букет">+</button>
       </div>`
    : `<button type="button" class="card__add" data-add="${p.id}">В корзину</button>`;

  return `
    <article class="card reveal" data-id="${p.id}">
      <button type="button" class="card__media" data-view="${p.id}" aria-label="Подробнее о букете «${p.name}»">
        ${tag}
        <img src="${p.img}" alt="Букет «${p.name}» — ${p.composition}" loading="lazy" width="1024" height="1280" />
      </button>
      <div class="card__body">
        <h3 class="card__name">${p.name}</h3>
        <p class="card__comp">${p.composition}</p>
        <div class="card__row">
          <span class="price">${formatPrice(p.price)}</span>
          ${action}
        </div>
      </div>
    </article>`;
}

function renderGrid() {
  const grid = $('#product-grid');
  const empty = $('#grid-empty');
  const items = PRODUCTS.filter((p) => state.filter === 'all' || p.category === state.filter);
  grid.innerHTML = items.map(cardHTML).join('');
  empty.hidden = items.length > 0;
  observeReveals();
}

/* ============ Drawer корзины ============ */
function cartItemHTML([id, qty]) {
  const p = getProduct(id);
  if (!p) return '';
  return `
    <div class="cart-item" data-id="${p.id}">
      <img class="cart-item__img" src="${p.img}" alt="" width="72" height="90" />
      <div>
        <p class="cart-item__name">${p.name}</p>
        <p class="cart-item__price">${formatPrice(p.price)} · ${formatPrice(p.price * qty)}</p>
        <div class="cart-item__row">
          <div class="stepper" data-stepper="${p.id}">
            <button type="button" class="stepper__btn" data-step="dec" aria-label="Убавить один букет">−</button>
            <span class="stepper__val">${qty}</span>
            <button type="button" class="stepper__btn" data-step="inc" aria-label="Прибавить один букет">+</button>
          </div>
          <button type="button" class="cart-item__remove" data-remove="${p.id}">Убрать</button>
        </div>
      </div>
    </div>`;
}

function renderCart() {
  const body = $('#cart-body');
  const foot = $('#cart-foot');
  const entries = Object.entries(state.cart).filter(([id]) => getProduct(id));

  if (entries.length === 0) {
    body.innerHTML = `
      <div class="cart-empty">
        <p class="cart-empty__text">В корзине пока пусто.<br>Загляните в каталог — там пионы, розы и тюльпаны.</p>
        <button type="button" class="btn btn--primary" id="cart-empty-btn">Выбрать букет</button>
      </div>`;
    foot.innerHTML = '';
    return;
  }

  const sub = cartSubtotal();
  const del = deliveryCost();
  const left = FREE_DELIVERY_FROM - sub;

  body.innerHTML = entries.map(cartItemHTML).join('');
  foot.innerHTML = `
    <div class="cart-summary">
      <div class="cart-summary__row cart-summary__row--muted">
        <span>Букеты</span><span>${formatPrice(sub)}</span>
      </div>
      <div class="cart-summary__row cart-summary__row--muted">
        <span>Доставка</span><span>${del === 0 ? 'Бесплатно' : formatPrice(del)}</span>
      </div>
      ${left > 0 ? `<p class="cart-summary__hint">До бесплатной доставки ещё ${formatPrice(left)}</p>` : ''}
      <div class="cart-summary__row cart-summary__total">
        <span>Итого</span><span>${formatPrice(sub + del)}</span>
      </div>
    </div>
    <button type="button" class="btn btn--primary btn--block" id="checkout-open">Оформить заказ</button>`;
}

function syncCartUI() {
  syncBadge();
  renderCart();
  renderGrid();
}

let lastTrigger = null;

function openCart(trigger) {
  lastTrigger = trigger || null;
  renderCart();
  $('#overlay').hidden = false;
  requestAnimationFrame(() => $('#overlay').classList.add('is-open'));
  const drawer = $('#cart-drawer');
  drawer.hidden = false;
  requestAnimationFrame(() => drawer.classList.add('is-open'));
  document.body.style.overflow = 'hidden';
  $('#cart-close').focus();
}

function closeCart() {
  $('#overlay').classList.remove('is-open');
  const drawer = $('#cart-drawer');
  drawer.classList.remove('is-open');
  document.body.style.overflow = '';
  setTimeout(() => {
    $('#overlay').hidden = true;
    drawer.hidden = true;
  }, 280);
  if (lastTrigger) lastTrigger.focus();
}

/* ============ Модалка товара ============ */
let productModalQty = 1;

function openProductModal(id, trigger) {
  const p = getProduct(id);
  if (!p) return;
  productModalQty = 1;
  lastTrigger = trigger || null;

  $('#product-modal-card').innerHTML = `
    <button class="icon-btn modal__close" id="product-close" type="button" aria-label="Закрыть описание букета">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
    <div class="product">
      <div class="product__media">
        <img src="${p.img}" alt="Букет «${p.name}» — ${p.composition}" width="1024" height="1280" />
      </div>
      <div class="product__info">
        <h3 class="product__name">${p.name}</h3>
        <p class="product__comp">${p.composition}</p>
        <p class="product__desc">${p.description}</p>
        <div class="product__meta">
          ${p.meta.map((m) => `<span>${m}</span>`).join('')}
          <span>${CATEGORIES[p.category]}</span>
        </div>
        <div class="product__buy">
          <span class="product__price">${formatPrice(p.price)}</span>
          <div class="stepper" id="modal-stepper">
            <button type="button" class="stepper__btn" data-mstep="dec" aria-label="Убавить количество">−</button>
            <span class="stepper__val" id="modal-qty">1</span>
            <button type="button" class="stepper__btn" data-mstep="inc" aria-label="Прибавить количество">+</button>
          </div>
        </div>
        <button type="button" class="btn btn--primary btn--block" id="modal-add">
          Добавить в корзину · <span id="modal-total">${formatPrice(p.price)}</span>
        </button>
      </div>
    </div>`;

  const modal = $('#product-modal');
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#product-close').focus();

  const syncModal = () => {
    $('#modal-qty').textContent = productModalQty;
    $('#modal-total').textContent = formatPrice(p.price * productModalQty);
  };

  $('#modal-stepper').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mstep]');
    if (!btn) return;
    productModalQty = Math.max(1, Math.min(99, productModalQty + (btn.dataset.mstep === 'inc' ? 1 : -1)));
    syncModal();
  });

  $('#modal-add').addEventListener('click', () => {
    addToCart(p.id, productModalQty);
    closeProductModal();
    openCart($('#cart-open'));
  });

  $('#product-close').addEventListener('click', () => closeProductModal());
}

function closeProductModal() {
  $('#product-modal').hidden = true;
  if ($('#cart-drawer').hidden) document.body.style.overflow = '';
  if (lastTrigger) lastTrigger.focus();
}

/* ============ Оформление заказа ============ */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function orderSummaryHTML(receive, addr) {
  const sub = cartSubtotal();
  const del = receive === 'delivery' ? deliveryCost() : 0;
  const lines = Object.entries(state.cart)
    .filter(([id]) => getProduct(id))
    .map(([id, q]) => {
      const p = getProduct(id);
      return `<div class="cart-summary__row cart-summary__row--muted"><span>${p.name} × ${q}</span><span>${formatPrice(p.price * q)}</span></div>`;
    })
    .join('');
  return `
    <div class="checkout__summary">
      ${lines}
      ${receive === 'delivery' ? `<div class="cart-summary__row cart-summary__row--muted"><span>Доставка${addr ? ` — ${addr}` : ''}</span><span>${del === 0 ? 'Бесплатно' : formatPrice(del)}</span></div>` : '<div class="cart-summary__row cart-summary__row--muted"><span>Самовывоз</span><span>Бесплатно</span></div>'}
      <div class="cart-summary__row cart-summary__total"><span>К оплате</span><span>${formatPrice(sub + del)}</span></div>
    </div>`;
}

function checkoutFormHTML() {
  return `
    <h3 class="checkout__title">Оформление заказа</h3>
    <p class="checkout__sub">Заполните контакты и адрес — перезвоним для подтверждения в течение 10 минут.</p>
    <form class="form" id="checkout-form" novalidate>
      <div id="checkout-summary-slot">${orderSummaryHTML('delivery', '')}</div>

      <div class="form__row form__row--2">
        <div class="field" data-field="name">
          <label class="field__label" for="f-name">Ваше имя</label>
          <input class="field__input" id="f-name" name="name" type="text" autocomplete="name" placeholder="Мария" />
          <span class="field__error">Введите имя — минимум 2 буквы.</span>
        </div>
        <div class="field" data-field="phone">
          <label class="field__label" for="f-phone">Телефон</label>
          <input class="field__input" id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 123-45-67" />
          <span class="field__error">Введите телефон в формате +7 900 123-45-67.</span>
        </div>
      </div>

      <div class="choice-group">
        <p class="choice-group__label">Способ получения</p>
        <label class="choice">
          <input type="radio" name="receive" value="delivery" checked />
          Доставка курьером
          <span class="choice__note">${formatPrice(DELIVERY_COST)} · бесплатно от ${formatPrice(FREE_DELIVERY_FROM)}</span>
        </label>
        <label class="choice">
          <input type="radio" name="receive" value="pickup" />
          Самовывоз
          <span class="choice__note">ул. Цветочная, 12 · бесплатно</span>
        </label>
      </div>

      <div class="field" data-field="address" id="address-field">
        <label class="field__label" for="f-address">Адрес доставки</label>
        <input class="field__input" id="f-address" name="address" type="text" autocomplete="street-address" placeholder="Улица, дом, квартира, этаж" />
        <span class="field__error">Укажите адрес: улица, дом и квартира.</span>
      </div>

      <div class="form__row form__row--2">
        <div class="field" data-field="date">
          <label class="field__label" for="f-date">Дата</label>
          <input class="field__input" id="f-date" name="date" type="date" min="${todayISO()}" value="${todayISO()}" />
          <span class="field__error">Выберите дату не раньше сегодняшней.</span>
        </div>
        <div class="field" data-field="slot">
          <label class="field__label" for="f-slot">Время</label>
          <select class="field__select" id="f-slot" name="slot">
            ${TIME_SLOTS.map((s) => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="field" data-field="payment">
        <label class="field__label" for="f-payment">Оплата</label>
        <select class="field__select" id="f-payment" name="payment">
          <option value="online">Картой онлайн</option>
          <option value="card">Картой курьеру</option>
          <option value="cash">Наличными курьеру</option>
        </select>
      </div>

      <div class="field" data-field="comment">
        <label class="field__label" for="f-comment">Комментарий <small>(необязательно)</small></label>
        <textarea class="field__textarea" id="f-comment" name="comment" placeholder="Надпись на открытке, пожелания по цветам, код домофона…"></textarea>
      </div>

      <label class="consent" id="consent-field">
        <input type="checkbox" id="f-consent" />
        <span>Согласен(на) на обработку персональных данных и с условиями доставки.</span>
      </label>

      <button type="submit" class="btn btn--primary btn--block" id="checkout-submit">Подтвердить заказ</button>
    </form>`;
}

function openCheckout() {
  $('#checkout-content').innerHTML = checkoutFormHTML();
  const modal = $('#checkout-modal');
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#checkout-close').focus();

  const form = $('#checkout-form');

  // Переключение доставка/самовывоз
  form.addEventListener('change', (e) => {
    if (e.target.name === 'receive') {
      const isDelivery = e.target.value === 'delivery';
      $('#address-field').style.display = isDelivery ? '' : 'none';
      const addr = isDelivery ? ($('#f-address').value || '') : '';
      $('#checkout-summary-slot').innerHTML = orderSummaryHTML(isDelivery ? 'delivery' : 'pickup', addr);
    }
    if (e.target.id === 'f-address') {
      $('#checkout-summary-slot').innerHTML = orderSummaryHTML('delivery', e.target.value);
    }
  });

  form.addEventListener('input', (e) => {
    const field = e.target.closest('.field');
    if (field) field.classList.remove('has-error');
    if (e.target.id === 'f-consent') $('#consent-field').classList.remove('has-error');
  });

  form.addEventListener('submit', handleCheckoutSubmit);
}

function closeCheckout() {
  $('#checkout-modal').hidden = true;
  document.body.style.overflow = '';
  const btn = $('#checkout-open');
  if (btn) btn.focus();
}

function validateCheckout(form) {
  const data = Object.fromEntries(new FormData(form));
  let firstInvalid = null;

  const mark = (name, ok) => {
    const field = form.querySelector(`[data-field="${name}"]`);
    if (!field) return;
    field.classList.toggle('has-error', !ok);
    if (!ok && !firstInvalid) firstInvalid = field.querySelector('input, select, textarea');
  };

  mark('name', (data.name || '').trim().length >= 2);
  mark('phone', /^(\+7|8)[\s(]?\d{3}[\s)]?\d{3}[-\s]?\d{2}[-\s]?\d{2}$/.test((data.phone || '').trim()));
  mark('address', data.receive !== 'delivery' || (data.address || '').trim().length >= 8);
  mark('date', !!data.date && data.date >= todayISO());

  const consent = $('#f-consent').checked;
  $('#consent-field').classList.toggle('has-error', !consent);
  if (!consent && !firstInvalid) firstInvalid = $('#f-consent');

  return { ok: !firstInvalid, data, firstInvalid };
}

function handleCheckoutSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const { ok, data, firstInvalid } = validateCheckout(form);
  if (!ok) {
    firstInvalid.focus();
    return;
  }

  const btn = $('#checkout-submit');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn__spinner" aria-hidden="true"></span> Оформляем…';

  setTimeout(() => {
    const orders = loadJSON(LS_ORDERS, []);
    const num = `FL-${String(100000 + orders.length * 7 + Math.floor(Math.random() * 90) + 10)}`;
    const sub = cartSubtotal();
    const del = data.receive === 'delivery' ? deliveryCost() : 0;
    orders.push({ num, data, total: sub + del, created: new Date().toISOString() });
    saveJSON(LS_ORDERS, orders);

    const items = Object.entries(state.cart)
      .filter(([id]) => getProduct(id))
      .map(([id, q]) => `${getProduct(id).name} × ${q}`)
      .join(', ');

    state.cart = {};
    saveJSON(LS_CART, state.cart);
    syncBadge();
    renderCart();

    $('#checkout-content').innerHTML = `
      <div class="success">
        <span class="success__icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
        </span>
        <h3 class="success__title">Заказ принят!</h3>
        <p class="success__num">№ ${num}</p>
        <p class="success__text">${items}. Сумма ${formatPrice(sub + del)}. Подтвердим по телефону ${data.phone} в течение 10 минут.</p>
        <button type="button" class="btn btn--primary" id="success-close">Отлично</button>
      </div>`;
    $('#success-close').addEventListener('click', () => {
      closeCheckout();
      closeCart();
    });
  }, 900);
}

/* ============ Появление секций ============ */
let revealObserver = null;

function observeReveals() {
  if (!('IntersectionObserver' in window)) return;
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            revealObserver.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 }
    );
  }
  $$('.reveal:not(.is-in)').forEach((el) => revealObserver.observe(el));
}

/* ============ Мобильное меню ============ */
function initBurger() {
  const burger = $('#burger');
  const nav = $('#mobile-nav');
  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    nav.hidden = open;
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      burger.setAttribute('aria-expanded', 'false');
      nav.hidden = true;
    }
  });
}

/* ============ Глобальные обработчики ============ */
function initGlobalEvents() {
  // Шапка: тень при прокрутке
  const header = $('.header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Фильтры
  $('#filters').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.filter = chip.dataset.cat;
    $$('#filters .chip').forEach((c) => {
      c.classList.toggle('is-active', c === chip);
      c.setAttribute('aria-pressed', String(c === chip));
    });
    renderGrid();
  });

  // Каталог: делегирование кликов
  $('#product-grid').addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      addToCart(add.dataset.add, 1);
      return;
    }
    const step = e.target.closest('[data-step]');
    if (step) {
      const id = step.closest('[data-stepper]').dataset.stepper;
      setQty(id, (state.cart[id] || 0) + (step.dataset.step === 'inc' ? 1 : -1));
      return;
    }
    const view = e.target.closest('[data-view]');
    if (view) {
      openProductModal(view.dataset.view, view);
    }
  });

  // Корзина: открытие/закрытие
  $('#cart-open').addEventListener('click', () => openCart($('#cart-open')));
  $('#cart-close').addEventListener('click', closeCart);
  $('#overlay').addEventListener('click', closeCart);

  // Содержимое корзины: делегирование
  $('#cart-drawer').addEventListener('click', (e) => {
    if (e.target.closest('#cart-empty-btn')) {
      closeCart();
      $('#catalog').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (e.target.closest('#checkout-open')) {
      closeCart();
      openCheckout();
      return;
    }
    const step = e.target.closest('[data-step]');
    if (step) {
      const id = step.closest('[data-stepper]').dataset.stepper;
      setQty(id, (state.cart[id] || 0) + (step.dataset.step === 'inc' ? 1 : -1));
      return;
    }
    const remove = e.target.closest('[data-remove]');
    if (remove) {
      setQty(remove.dataset.remove, 0);
      toast('Букет убран из корзины');
    }
  });

  // Модалка товара: клик по фону
  $('#product-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeProductModal();
  });

  // Модалка оформления: клик по фону
  $('#checkout-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCheckout();
  });
  $('#checkout-close').addEventListener('click', closeCheckout);

  // Esc закрывает любое окно
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#checkout-modal').hidden) closeCheckout();
    else if (!$('#product-modal').hidden) closeProductModal();
    else if (!$('#cart-drawer').hidden) closeCart();
    else if (!$('#mobile-nav').hidden) {
      $('#burger').setAttribute('aria-expanded', 'false');
      $('#mobile-nav').hidden = true;
    }
  });
}

/* ============ Старт ============ */
document.addEventListener('DOMContentLoaded', () => {
  renderGrid();
  syncBadge();
  initBurger();
  initGlobalEvents();
  observeReveals();
});
