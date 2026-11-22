(function () {
  "use strict";

  var dict = window.PAGE_I18N || {};
  var root = document.documentElement;

  function applyLang(lang) {
    root.lang = lang;
    var d = dict[lang] || {};
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (d[key] !== undefined) el.innerHTML = d[key];
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria");
      if (d[key] !== undefined) el.setAttribute("aria-label", d[key]);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-alt");
      if (d[key] !== undefined) el.setAttribute("alt", d[key]);
    });
    if (d.__title) document.title = d.__title;
    document.querySelectorAll(".lang-btn").forEach(function (b) {
      b.textContent = lang === "zh-CN" ? "EN" : "中文";
      b.setAttribute("aria-label", lang === "zh-CN" ? "Switch to English" : "切换为中文");
    });
    try { localStorage.setItem("ds-lang", lang); } catch (e) {}
  }

  var saved = null;
  try { saved = localStorage.getItem("ds-lang"); } catch (e) {}
  applyLang(saved === "en" || saved === "zh-CN" ? saved : "zh-CN");

  document.querySelectorAll(".lang-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      applyLang(root.lang === "zh-CN" ? "en" : "zh-CN");
    });
  });

  // nav scrolled state
  var nav = document.querySelector(".nav");
  function onScroll() {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // mobile menu
  var burger = document.querySelector(".burger");
  var menu = document.querySelector(".mobile-menu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      burger.textContent = open ? "✕" : "☰";
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        menu.classList.remove("open");
        burger.textContent = "☰";
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  // scroll reveal
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  // scrollspy
  var spyLinks = document.querySelectorAll(".nav-links a[data-spy]");
  var sections = [];
  spyLinks.forEach(function (a) {
    var sec = document.querySelector(a.getAttribute("href"));
    if (sec) sections.push({ a: a, sec: sec });
  });
  function spy() {
    var pos = window.scrollY + 120;
    var current = null;
    sections.forEach(function (s) {
      var top = s.sec.getBoundingClientRect().top + window.scrollY;
      if (top <= pos) current = s;
    });
    spyLinks.forEach(function (a) { a.classList.remove("active"); });
    if (current) current.a.classList.add("active");
  }
  window.addEventListener("scroll", spy, { passive: true });
  spy();

  // hero waveform canvas
  var canvas = document.getElementById("wave");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, raf = null, t = 0;
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var colors = ["#37d6ff", "#7c5cff", "#ff4d9d", "#ffb547"];

    function resize() {
      var r = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function lerpColor(i, n) {
      var pos = (i / n) * (colors.length - 1);
      var a = Math.floor(pos), b = Math.min(a + 1, colors.length - 1), f = pos - a;
      var ca = colors[a], cb = colors[b];
      function hex(c, o) { return parseInt(c.substr(o, 2), 16); }
      var r = Math.round(hex(ca, 1) + (hex(cb, 1) - hex(ca, 1)) * f);
      var g = Math.round(hex(ca, 3) + (hex(cb, 3) - hex(ca, 3)) * f);
      var bl = Math.round(hex(ca, 5) + (hex(cb, 5) - hex(ca, 5)) * f);
      return "rgba(" + r + "," + g + "," + bl + ",";
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var gap = 7, bw = 4;
      var n = Math.ceil(W / gap);
      var base = H * 0.62;
      for (var i = 0; i < n; i++) {
        var x = i * gap;
        var p = i / n;
        var amp =
          Math.sin(p * 9 + t * 0.9) * 0.45 +
          Math.sin(p * 23 - t * 1.4) * 0.3 +
          Math.sin(p * 4.5 + t * 0.5) * 0.25;
        var env = Math.sin(p * Math.PI);
        var h = Math.max(3, (0.22 + Math.abs(amp) * 0.75) * env * H * 0.52);
        var col = lerpColor(i, n);
        ctx.fillStyle = col + "0.75)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, base - h, bw, h * 2, 2);
        else ctx.rect(x, base - h, bw, h * 2);
        ctx.fill();
      }
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "rgba(6,9,26,0)");
      grad.addColorStop(0.25, "rgba(6,9,26,0)");
      grad.addColorStop(0.8, "rgba(6,9,26,0)");
      grad.addColorStop(1, "rgba(6,9,26,0.9)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    function loop() {
      t += 0.016;
      draw();
      raf = requestAnimationFrame(loop);
    }

    resize();
    if (reduced) { t = 3; draw(); }
    else {
      loop();
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
        else if (!raf) loop();
      });
    }
    var rto = null;
    window.addEventListener("resize", function () {
      clearTimeout(rto);
      rto = setTimeout(function () { resize(); if (reduced) draw(); }, 120);
    });
  }

  // footer year
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();