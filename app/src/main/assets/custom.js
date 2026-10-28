window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});/**
 * PakePlus 注入脚本 — 针对 https://nenos.netlify.app/
 *
 * 解决的问题：
 *   PakePlus 的 Android 模板里 `setSupportMultipleWindows(true)` 被注释掉了
 *   （PakePlus-Android/app/src/main/java/com/app/pakeplus/MainActivity.kt:247）。
 *   WebView 默认关闭多窗口支持，导致页面里所有 target="_blank" 的链接
 *   点击后毫无反应——既不打开新窗口，也不在当前窗口加载。
 *
 *   NENO 首页有 GitHub 链接、设置页有开发者文档链接，全部是 target="_blank"，
 *   双击等于死链。
 *
 * 处理方式：
 *   捕获点击阶段，把 _blank 的 http(s)/mailto 链接改成当前窗口跳转。
 *   代价是没有"新标签页"，但手机上本来也不需要。
 *
 * 使用方法：
 *   PakePlus 项目配置 → 「脚本文件」→ 上传本文件。
 *   脚本在 onPageStarted 阶段注入（MainActivity.kt:1060），每次导航都会执行一次。
 */

(function () {
  'use strict';

  // 避免 SPA 内部路由重复注入时叠加监听
  if (window.__nenoBlankFixInstalled) return;
  window.__nenoBlankFixInstalled = true;

  function isExternal(href) {
    return /^(https?:|mailto:|tel:)/i.test(href || '');
  }

  function patchOne(a) {
    if (!a || a.__nenoPatched) return;
    var href = a.getAttribute('href') || '';
    if (a.getAttribute('target') === '_blank' && isExternal(href)) {
      // 去掉 target，让 WebView 在当前窗口加载（会走 shouldOverrideUrlLoading）
      a.removeAttribute('target');
      a.setAttribute('rel', 'noopener noreferrer');
      a.__nenoPatched = true;
    }
  }

  function scan() {
    var nodes = document.querySelectorAll('a[target="_blank"]');
    for (var i = 0; i < nodes.length; i++) patchOne(nodes[i]);
  }

  // 1) 首轮全量扫描
  scan();

  // 2) 捕获阶段拦点击，兜住之后动态渲染出来的链接（NENO 是 Svelte，DOM 常变）
  document.addEventListener(
    'click',
    function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (a.getAttribute('target') !== '_blank' || !isExternal(href)) return;

      // 阻止开新窗口的默认行为，改为当前窗口加载
      e.preventDefault();
      a.removeAttribute('target');
      window.location.href = href;
    },
    true
  );

  // 3) DOM 变化时增量修补
  if (window.MutationObserver) {
    new MutationObserver(function () {
      scan();
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  // 4) 站点更新后 Service Worker 缓存旧内容时，提供一个手动刷新入口：
  //    长按空白处 1.5 秒清缓存重载（调试用，正式包可删掉这段）
  var pressTimer = null;
  document.addEventListener(
    'touchstart',
    function () {
      pressTimer = setTimeout(function () {
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
          navigator.serviceWorker.getRegistrations().then(function (rs) {
            rs.forEach(function (r) { r.unregister(); });
            if (window.caches && caches.keys) {
              caches.keys().then(function (ks) {
                ks.forEach(function (k) { caches.delete(k); });
              });
            }
            location.reload();
          });
        }
      }, 1500);
    },
    { passive: true }
  );
  ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) {
    document.addEventListener(ev, function () {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    }, { passive: true });
  });
})();
