/* ============================================================
   QuestBox — shared storefront logic
   Cart persisted in localStorage. No backend required.
   ============================================================ */

const QB_PRODUCTS = {
  "starter-kit": {
    name: "QuestBox Starter Kit",
    meta: "Base unit + 2 cartridges",
    price: 79,
    was: 94,
    image: "assets/starter-kit.svg",
    level: 0,
  },
  "scent-trail": {
    name: "Scent Trail Cartridge",
    meta: "Expansion pack · Level 1",
    price: 29,
    image: "assets/pack-scent-trail.svg",
    level: 1,
  },
  "sliding-gates": {
    name: "Sliding Gates Cartridge",
    meta: "Expansion pack · Level 2",
    price: 32,
    image: "assets/pack-sliding-gates.svg",
    level: 2,
  },
  "flip-panels": {
    name: "Flip Panels Cartridge",
    meta: "Expansion pack · Level 2",
    price: 32,
    image: "assets/pack-flip-panels.svg",
    level: 2,
  },
  "rotating-wheel": {
    name: "Rotating Wheel Cartridge",
    meta: "Expansion pack · Level 3",
    price: 36,
    image: "assets/pack-rotating-wheel.svg",
    level: 3,
  },
  "hidden-compartments": {
    name: "Hidden Compartments Cartridge",
    meta: "Expansion pack · Level 3",
    price: 36,
    image: "assets/pack-hidden-compartments.svg",
    level: 3,
  },
  "treat-vault": {
    name: "Treat Vault Cartridge",
    meta: "Expansion pack · Level 4",
    price: 39,
    image: "assets/pack-treat-vault.svg",
    level: 4,
  },
};

const QB_FREE_SHIP = 60;
const QB_SHIPPING = 6;
const QB_CART_KEY = "questbox-cart-v1";

/* ---------------- Cart store ---------------- */
function qbReadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(QB_CART_KEY) || "{}");
    const clean = {};
    Object.keys(raw).forEach((id) => {
      if (QB_PRODUCTS[id] && Number.isInteger(raw[id]) && raw[id] > 0) clean[id] = raw[id];
    });
    return clean;
  } catch {
    return {};
  }
}

function qbWriteCart(cart) {
  localStorage.setItem(QB_CART_KEY, JSON.stringify(cart));
  qbUpdateBadge();
}

function qbCartCount(cart) {
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

function qbCartTotals(cart) {
  const subtotal = Object.keys(cart).reduce(
    (sum, id) => sum + QB_PRODUCTS[id].price * cart[id],
    0
  );
  const shipping = subtotal === 0 || subtotal >= QB_FREE_SHIP ? 0 : QB_SHIPPING;
  return { subtotal, shipping, total: subtotal + shipping };
}

function qbMoney(n) {
  return `$${n.toFixed(2).replace(/\.00$/, "")}`;
}

function qbUpdateBadge() {
  const badge = document.querySelector(".cart-count");
  if (!badge) return;
  const count = qbCartCount(qbReadCart());
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.classList.toggle("has-items", count > 0);
  if (count > 0) {
    badge.classList.remove("bump");
    void badge.offsetWidth;
    badge.classList.add("bump");
  }
}

/* ---------------- Toast ---------------- */
let qbToastTimer;
function qbToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `<img src="assets/favicon.svg" alt="" /> <span></span>`;
    document.body.appendChild(toast);
  }
  toast.querySelector("span").textContent = message;
  toast.classList.add("show");
  clearTimeout(qbToastTimer);
  qbToastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

/* ---------------- Add to cart ---------------- */
function qbAddToCart(id, qty = 1) {
  const product = QB_PRODUCTS[id];
  if (!product) return;
  const cart = qbReadCart();
  cart[id] = (cart[id] || 0) + qty;
  qbWriteCart(cart);
  qbToast(`${product.name} added to cart`);
}

function qbSetQty(id, qty) {
  const cart = qbReadCart();
  if (qty <= 0) delete cart[id];
  else cart[id] = qty;
  qbWriteCart(cart);
}

function qbBindAddButtons() {
  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.add;
      const qtyInput = document.querySelector("[data-qty-input]");
      const qty = qtyInput && button.dataset.useQty ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
      qbAddToCart(id, qty);
      button.classList.add("added");
      const original = button.innerHTML;
      button.innerHTML = `Added <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2.5 8l3.4 3.4L12.5 4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      setTimeout(() => {
        button.classList.remove("added");
        button.innerHTML = original;
      }, 1400);
    });
  });
}

/* ---------------- Cart page ---------------- */
function qbRenderCart() {
  const itemsWrap = document.querySelector("[data-cart-items]");
  const summaryWrap = document.querySelector("[data-cart-summary]");
  if (!itemsWrap) return;

  const cart = qbReadCart();
  const ids = Object.keys(cart);

  if (ids.length === 0) {
    itemsWrap.innerHTML = `
      <div class="empty-cart">
        <img src="assets/dog-beagle.svg" alt="Sad puzzle-less pup" />
        <h3>Your cart is empty</h3>
        <p>Your dog's next favorite puzzle is one click away.</p>
        <a class="button button-primary" href="expansion-packs.html">Browse expansion packs</a>
      </div>`;
    if (summaryWrap) summaryWrap.innerHTML = "";
    return;
  }

  itemsWrap.innerHTML = ids
    .map((id) => {
      const p = QB_PRODUCTS[id];
      const qty = cart[id];
      return `
      <article class="cart-item" data-cart-item="${id}">
        <img class="thumb" src="${p.image}" alt="${p.name}" />
        <div class="info">
          <h3>${p.name}</h3>
          <p class="meta">${p.meta} · ${qbMoney(p.price)} each</p>
          <div class="controls">
            <div class="qty-field">
              <button type="button" data-dec="${id}" aria-label="Decrease quantity">&minus;</button>
              <input type="number" min="1" max="99" value="${qty}" data-qty="${id}" aria-label="Quantity for ${p.name}" />
              <button type="button" data-inc="${id}" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="remove-link" data-remove="${id}">Remove</button>
          </div>
        </div>
        <p class="line-price">${qbMoney(p.price * qty)}</p>
      </article>`;
    })
    .join("");

  if (summaryWrap) {
    const { subtotal, shipping, total } = qbCartTotals(cart);
    const remaining = Math.max(0, QB_FREE_SHIP - subtotal);
    const pct = Math.min(100, Math.round((subtotal / QB_FREE_SHIP) * 100));
    summaryWrap.innerHTML = `
      <div class="summary-card">
        <h3>Order summary</h3>
        <div class="row"><span>Subtotal</span><strong>${qbMoney(subtotal)}</strong></div>
        <div class="row"><span>Shipping</span><strong>${shipping === 0 ? "Free" : qbMoney(shipping)}</strong></div>
        <div class="row total"><span>Total</span><strong>${qbMoney(total)}</strong></div>
        ${
          remaining > 0
            ? `<div class="free-ship">Add ${qbMoney(remaining)} more for free shipping</div>`
            : `<div class="free-ship">You unlocked free shipping</div>`
        }
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <a class="button" href="checkout.html">Proceed to checkout</a>
        <p class="fineprint">30-day tail-wag guarantee · Cancel anytime</p>
      </div>`;
  }

  itemsWrap.querySelectorAll("[data-inc]").forEach((button) =>
    button.addEventListener("click", () => {
      const id = button.dataset.inc;
      const input = itemsWrap.querySelector(`[data-qty="${id}"]`);
      qbSetQty(id, (parseInt(input.value, 10) || 1) + 1);
      qbRenderCart();
    })
  );
  itemsWrap.querySelectorAll("[data-dec]").forEach((button) =>
    button.addEventListener("click", () => {
      const id = button.dataset.dec;
      const input = itemsWrap.querySelector(`[data-qty="${id}"]`);
      const next = (parseInt(input.value, 10) || 1) - 1;
      if (next <= 0) {
        const row = itemsWrap.querySelector(`[data-cart-item="${id}"]`);
        row.classList.add("removing");
        setTimeout(() => {
          qbSetQty(id, 0);
          qbRenderCart();
        }, 280);
      } else {
        qbSetQty(id, next);
        qbRenderCart();
      }
    })
  );
  itemsWrap.querySelectorAll("[data-remove]").forEach((button) =>
    button.addEventListener("click", () => {
      const row = itemsWrap.querySelector(`[data-cart-item="${button.dataset.remove}"]`);
      row.classList.add("removing");
      setTimeout(() => {
        qbSetQty(button.dataset.remove, 0);
        qbRenderCart();
        qbToast("Item removed from cart");
      }, 280);
    })
  );
  itemsWrap.querySelectorAll("[data-qty]").forEach((input) =>
    input.addEventListener("change", () => {
      const qty = Math.min(99, Math.max(1, parseInt(input.value, 10) || 1));
      qbSetQty(input.dataset.qty, qty);
      qbRenderCart();
    })
  );
}

/* ---------------- Checkout page ---------------- */
function qbRenderCheckout() {
  const list = document.querySelector("[data-checkout-items]");
  const totals = document.querySelector("[data-checkout-totals]");
  const button = document.querySelector("[data-place-order]");
  if (!list || !totals) return;

  const cart = qbReadCart();
  const ids = Object.keys(cart);

  if (ids.length === 0) {
    list.closest(".summary-card").innerHTML = `
      <h3>Nothing to check out yet</h3>
      <p style="color:rgba(255,247,232,.7);font-size:14.5px;margin:10px 0 20px">
        Add a starter kit or an expansion pack first.</p>
      <a class="button" href="expansion-packs.html">Browse packs</a>`;
    if (button) button.disabled = true;
    return;
  }

  list.innerHTML = ids
    .map((id) => {
      const p = QB_PRODUCTS[id];
      return `
      <div class="mini-item">
        <img src="${p.image}" alt="" />
        <p class="n">${p.name}<span>Qty ${cart[id]}</span></p>
        <p class="p">${qbMoney(p.price * cart[id])}</p>
      </div>`;
    })
    .join("");

  const { subtotal, shipping, total } = qbCartTotals(cart);
  totals.innerHTML = `
    <div class="row"><span>Subtotal</span><strong>${qbMoney(subtotal)}</strong></div>
    <div class="row"><span>Shipping</span><strong>${shipping === 0 ? "Free" : qbMoney(shipping)}</strong></div>
    <div class="row"><span>Tax</span><strong>Calculated at delivery</strong></div>
    <div class="row total"><span>Total</span><strong>${qbMoney(total)}</strong></div>`;

  if (button && !button.disabled) {
    window.qbPlaceOrder = () => {
      const orderNo = `QB-${Math.floor(100000 + Math.random() * 900000)}`;
      localStorage.setItem("questbox-last-order", orderNo);
      qbWriteCart({});
      document.querySelector(".checkout-layout").style.display = "none";
      const success = document.querySelector("[data-success]");
      success.hidden = false;
      success.querySelector(".order-no").textContent = `Order ${orderNo}`;
      window.scrollTo({ top: 0, behavior: "smooth" });
      qbUpdateBadge();
    };
  }
}

/* ---------------- Expansion pack filters ---------------- */
function qbBindFilters() {
  const chips = document.querySelectorAll(".filter-row .chip");
  const cards = document.querySelectorAll("[data-level]");
  if (!chips.length || !cards.length) return;
  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const level = chip.dataset.filter;
      cards.forEach((card) => {
        const match = level === "all" || card.dataset.level === level;
        card.style.display = match ? "" : "none";
        if (match) {
          card.style.animation = "none";
          void card.offsetWidth;
          card.style.animation = "item-in 0.45s var(--ease)";
        }
      });
    })
  );
}

/* ---------------- Product gallery ---------------- */
function qbBindGallery() {
  const main = document.querySelector("[data-gallery-main] img");
  const thumbs = document.querySelectorAll("[data-gallery-thumb]");
  if (!main || !thumbs.length) return;
  thumbs.forEach((thumb) =>
    thumb.addEventListener("click", () => {
      thumbs.forEach((t) => t.classList.remove("active"));
      thumb.classList.add("active");
      main.src = thumb.querySelector("img").src;
      main.animate(
        [
          { opacity: 0.25, transform: "scale(0.97)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)" }
      );
    })
  );
}

/* ---------------- Mobile nav ---------------- */
function qbBindNav() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".mobile-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );
}

/* ---------------- Reveal on scroll ---------------- */
function qbBindReveal() {
  const items = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  items.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 55, 280)}ms`;
    observer.observe(item);
  });
  window.addEventListener("load", () => {
    setTimeout(() => items.forEach((item) => item.classList.add("is-visible")), 1500);
  });
}

/* ---------------- Footer newsletter ---------------- */
function qbBindFooterForm() {
  const form = document.querySelector(".footer-form");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.textContent = "Treats incoming";
    setTimeout(() => (button.textContent = "Send"), 2200);
  });
}

/* ---------------- Init ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  qbUpdateBadge();
  qbBindAddButtons();
  qbRenderCart();
  qbRenderCheckout();
  qbBindFilters();
  qbBindGallery();
  qbBindNav();
  qbBindReveal();
  qbBindFooterForm();
});
