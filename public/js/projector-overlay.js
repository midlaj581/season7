// PPL Season 7 — projector-overlay.js — upgraded
(function () {
  'use strict';
  const overlay = {
    playerEl: null,
    bidEl: null,
    init: function () {
      this.playerEl = document.getElementById('pplOverlayPlayer');
      this.bidEl = document.getElementById('pplOverlayBid');
    },
    transitionOut: function (cb) {
      if (!this.playerEl) return void (cb && cb());
      this.playerEl.classList.add('ppl-fade-out');
      setTimeout(function () {
        if (cb) cb();
      }, 300);
    },
    transitionIn: function () {
      if (!this.playerEl) return;
      this.playerEl.classList.remove('ppl-fade-out');
      this.playerEl.classList.add('ppl-slide-in');
      const el = this.playerEl;
      setTimeout(function () {
        el.classList.remove('ppl-slide-in');
      }, 400);
    },
    animateBid: function (amount) {
      if (!this.bidEl) return;
      this.bidEl.classList.remove('ppl-bid-pop');
      void this.bidEl.offsetWidth;
      this.bidEl.classList.add('ppl-bid-pop');
      setTimeout(function () {
        this.bidEl.classList.remove('ppl-bid-pop');
      }.bind(this), 500);
    },
  };
  window.PPLProjectorOverlay = overlay;
})();
