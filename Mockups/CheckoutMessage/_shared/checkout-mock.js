/* ============================================================================
   CHECKOUT SHIPMENT MESSAGING — SHARED SCENARIO STATE
   Used by cart-summary.html · shipping-methods.html · order-review.html ·
   receipt.html

   NOT PART OF THE DESIGN. This is the plumbing behind the mockup toolbar, so
   one file can show many scenarios instead of one file per scenario (see the
   design-system README: "build one page and toggle between states on one page").

   ── How a page uses it ────────────────────────────────────────────────────
   1. Toolbar buttons declare which dimension they set:
        <button data-ctl="fulfilment" data-val="shipping">Shipping</button>

   2. Any element can declare when it is visible:
        data-when="fulfilment:shipping"            show only for shipping
        data-when="composition:full|canv"          show for either value
        data-when="fulfilment:shipping; zip:yes"   all conditions must pass
        data-unless="composition:ca"               hide for that value

   3. Auto-numbering across whatever groups ended up visible:
        [data-seq]        → this group's 1-based index
        [data-seq-total]  → total visible groups
        [data-count]      → same total, for prose ("3 shipments")
        [data-count-word] → "shipment" / "shipments", pluralised to match

   4. A page can add its own logic:
        window.onMockRender = function (state) { ... }
   ============================================================================ */

(function (global) {
  "use strict";

  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var state = {};

  /* ── Condition parsing ───────────────────────────────────────────────────
     "fulfilment:shipping|delivery; zip:yes" → every clause must match. */
  function matches(expr) {
    return expr.split(";").every(function (clause) {
      var parts = clause.split(":");
      if (parts.length !== 2) return true;
      var dim = parts[0].trim();
      var allowed = parts[1].split("|").map(function (v) { return v.trim(); });
      return allowed.indexOf(state[dim]) !== -1;
    });
  }

  /* ── Visibility pass ─────────────────────────────────────────────────── */
  function applyVisibility() {
    $$("[data-when]").forEach(function (el) {
      el.classList.toggle("is-hidden", !matches(el.getAttribute("data-when")));
    });
    $$("[data-unless]").forEach(function (el) {
      el.classList.toggle("is-hidden", matches(el.getAttribute("data-unless")));
    });
  }

  /* ── Numbering pass — runs after visibility, so counts reflect reality ── */
  function applySequence() {
    var all = $$("[data-group]");
    var groups = all.filter(function (g) {
      return !g.classList.contains("is-hidden");
    });
    var total = groups.length;

    /* Dividers are driven from here, not from a CSS sibling selector, so the
       rule always sits BETWEEN visible groups and never above the first one. */
    all.forEach(function (g) { g.classList.remove("has-divider"); });
    groups.forEach(function (g, i) { if (i > 0) g.classList.add("has-divider"); });

    groups.forEach(function (group, i) {
      $$("[data-seq]", group).forEach(function (el) { el.textContent = i + 1; });
      $$("[data-seq-total]", group).forEach(function (el) { el.textContent = total; });
    });

    $$("[data-count]").forEach(function (el) { el.textContent = total; });
    $$("[data-count-word]").forEach(function (el) {
      el.textContent = total === 1 ? "shipment" : "shipments";
    });
  }

  function render() {
    applyVisibility();
    applySequence();

    // Reflect pressed state on the toolbar
    $$("[data-ctl]").forEach(function (btn) {
      var on = state[btn.getAttribute("data-ctl")] === btn.getAttribute("data-val");
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });

    if (typeof global.onMockRender === "function") global.onMockRender(state);
  }

  /* ── Toolbar wiring ──────────────────────────────────────────────────── */
  function init(defaults) {
    Object.keys(defaults || {}).forEach(function (k) { state[k] = defaults[k]; });

    // Let the URL preselect a scenario, so a specific case can be linked to:
    //   cart-summary.html?composition=ca&zip=no
    var params = new URLSearchParams(global.location.search);
    params.forEach(function (value, key) {
      if (key in state) state[key] = value;
    });

    /* ?chrome=off hides the mockup toolbar. Used by phone.html, which frames a
       page at 390px and supplies its own controls — the toolbar inside the
       frame would be reviewing the mockup rather than the design. Not a media
       query: on a real phone, at the same width, the toolbar is still wanted. */
    if (params.get("chrome") === "off") {
      document.body.classList.add("mock-chrome-off");
    }

    document.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-ctl]") : null;
      if (!btn) return;
      state[btn.getAttribute("data-ctl")] = btn.getAttribute("data-val");
      render();
    });

    render();
  }

  global.KLMock = { init: init, render: render, state: state };
})(window);
