/* ============================================================================
   BOTTOM SHEET — mockup behaviour
   Reproduces Checkout/Shipping/ShipmentItemsPreview.tsx's mobile branch:
   a MUI Drawer anchored bottom, opened from the shipment's availability
   message, closed by the Close button, the backdrop, or Escape.

   MARKUP CONTRACT
     <button class="sheet-trigger" data-sheet="ca">…</button>
     <div class="sheet" id="sheet-ca" role="dialog" aria-modal="true" hidden>…</div>
   One scrim is created on demand and shared.

   TWO DELIBERATE DIFFERENCES FROM THE LIVE COMPONENT
     1. Scroll lock. `ShipmentItemsPreview` uses MUI's raw `Drawer`, whose
        scroll-lock targets <body> — and on this site <html> is the scroll
        container, so the page scrolls behind the open sheet. The app has a
        `ScrollLockingDrawer` wrapper that exists precisely to fix this, and
        every other drawer in the app uses it; this one does not. The mockup
        locks, because that is the intended behaviour. Raised as a ticket —
        see NOTES.md §21.
     2. Focus. The mockup moves focus to the sheet and restores it on close.
        MUI does this for real; it is reproduced here so a keyboard review of
        the mockup is not misleading.
   ============================================================================ */

(function (global) {
  "use strict";

  var scrim = null;
  var openSheet = null;
  var lastFocus = null;

  function getScrim() {
    if (!scrim) {
      scrim = document.createElement("div");
      scrim.className = "sheet-scrim";
      scrim.setAttribute("aria-hidden", "true");
      scrim.addEventListener("click", close);
      document.body.appendChild(scrim);
    }
    return scrim;
  }

  function open(id) {
    var sheet = document.getElementById("sheet-" + id);
    if (!sheet || openSheet === sheet) return;
    if (openSheet) close();

    lastFocus = document.activeElement;
    sheet.hidden = false;
    getScrim();

    /* Two frames: one for `hidden` to clear, one for the transition to have a
       start value to animate from. */
    global.requestAnimationFrame(function () {
      global.requestAnimationFrame(function () {
        sheet.classList.add("is-open");
        scrim.classList.add("is-open");
      });
    });

    document.documentElement.style.overflow = "hidden";   /* see note 1 above */
    openSheet = sheet;

    /* Focus the panel, not the Close button — which is what MUI does. Focusing
       the button lands a visible focus ring on the one control the shopper is
       least likely to want first, and reads as "Close" to a screen reader
       before it has said what opened. */
    sheet.focus();
  }

  function close() {
    if (!openSheet) return;
    var sheet = openSheet;
    openSheet = null;

    sheet.classList.remove("is-open");
    if (scrim) scrim.classList.remove("is-open");
    document.documentElement.style.overflow = "";

    var done = function () {
      if (!sheet.classList.contains("is-open")) sheet.hidden = true;
      sheet.removeEventListener("transitionend", done);
    };
    sheet.addEventListener("transitionend", done);
    global.setTimeout(done, 400);   /* transitionend does not fire if unpainted */

    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  /* ══════════════════════════════════════════════════════════════════════
     DISCLOSURE → SHEET
     The shipping page already renders each shipment's message as the summary
     of a <details>, opening an inline item preview. That IS the desktop half
     of ShipmentItemsPreview, arrived at independently. On mobile the live
     component swaps the same trigger for a bottom sheet, so this intercepts
     the summary click below 600px and does the same.

     The sheet is BUILT FROM THE DISCLOSURE'S OWN CONTENT, not authored twice.
     Every item, every price and every word of the message therefore has one
     source in the HTML, and a wording change lands in both views at once.
     ══════════════════════════════════════════════════════════════════════ */

  var seq = 0;

  /* Review flags (.flag) are kept in the markup as the inline record of what
     changed, and hidden with `display: none`. textContent does not care about
     display, so reading a heading raw would title the sheet "Transfer to
     RareStorage New". Clone, strip, then read. */
  function textOf(el) {
    if (!el) return "";
    var c = el.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll(".flag"), function (f) { f.remove(); });
    return c.textContent.replace(/\s+/g, " ").trim();
  }

  function buildFromDisclosure(details) {
    var group   = details.closest(".ship-group");
    var titleEl = group && group.querySelector(".ship-group__title");
    var rows    = details.querySelectorAll(".item-preview__row");

    var sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.id = "sheet-auto-" + (++seq);
    sheet.hidden = true;
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("tabindex", "-1");

    var head = document.createElement("div");
    head.className = "sheet__head";

    var titleWrap = document.createElement("div");
    var title = document.createElement("div");
    title.className = "sheet__title";
    /* The GROUP heading, not the sub-group message. The shopper just tapped
       that message, so repeating it as the title would answer a question they
       have already asked; what the sheet has to say is which shipment this is.
       Live passes "Shipment #1:" for the same reason, trailing colon and all. */
    title.textContent = textOf(titleEl) || "Shipment";
    var count = document.createElement("span");
    count.className = "sheet__count";
    count.textContent = rows.length + (rows.length === 1 ? " item" : " items");
    titleWrap.appendChild(title);
    titleWrap.appendChild(count);

    var close = document.createElement("button");
    close.className = "sheet__close";
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.setAttribute("data-sheet-close", "");
    close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

    head.appendChild(titleWrap);
    head.appendChild(close);

    var body = document.createElement("div");
    body.className = "sheet__body";

    Array.prototype.forEach.call(rows, function (r) {
      var row = document.createElement("div");
      row.className = "sheet-row";

      var thumb = document.createElement("div");
      thumb.className = "sheet-row__thumb";
      var svg = r.querySelector("svg");
      if (svg) thumb.appendChild(svg.cloneNode(true));

      var rb = document.createElement("div");
      rb.className = "sheet-row__body";
      var nm = document.createElement("div");
      nm.className = "sheet-row__name";
      nm.textContent = textOf(r.querySelector(".item-preview__name"));
      var sub = document.createElement("div");
      sub.className = "sheet-row__sub";
      /* "Qty 2 \u00B7 $43.98" — quantity and line total, the two figures the
         preview row already shows. Live prints "Subtotal: $21.99 x 2", which
         labels the UNIT price as a subtotal; see NOTES.md \u00A721. */
      sub.textContent = [textOf(r.querySelector(".item-preview__qty")),
                         textOf(r.querySelector(".item-preview__total"))]
                        .filter(Boolean).join(" \u00B7 ");
      rb.appendChild(nm);
      rb.appendChild(sub);

      row.appendChild(thumb);
      row.appendChild(rb);
      body.appendChild(row);
    });

    var handle = document.createElement("div");
    handle.className = "sheet__handle";

    sheet.appendChild(handle);
    sheet.appendChild(head);
    sheet.appendChild(body);
    document.body.appendChild(sheet);

    details.setAttribute("data-sheet-id", sheet.id.replace("sheet-", ""));
    return sheet;
  }

  document.addEventListener("click", function (e) {
    var summary = e.target.closest ? e.target.closest(".items-disclose > summary") : null;
    if (!summary || global.innerWidth >= 600) return;
    e.preventDefault();                       /* do not toggle the <details> */
    var details = summary.parentElement;
    var id = details.getAttribute("data-sheet-id");
    if (!id) id = buildFromDisclosure(details).id.replace("sheet-", "");
    open(id);
  }, true);

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-sheet]") : null;
    if (t) { e.preventDefault(); open(t.getAttribute("data-sheet")); return; }
    if (e.target.closest && e.target.closest("[data-sheet-close]")) close();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });

  /* A sheet left open while the window grows past the breakpoint would be
     hidden by CSS but still holding the scroll lock and focus. */
  global.addEventListener("resize", function () {
    if (openSheet && global.innerWidth >= 600) close();
  });

  global.KLSheet = { open: open, close: close };

})(window);
