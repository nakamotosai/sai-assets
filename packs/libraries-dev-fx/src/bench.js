/* libraries-dev-fx · 试吃台脚本(远程试吃,非 vendored)
 * 来源:Libraries.dev — https://github.com/Jakubantalik/Libraries.dev(MIT 许可证)
 * 拆自 demos/libraries-dev-fx/index.html 的内联 module script。
 *
 * 两个刻意的选择:
 * 1) 以普通脚本(<script defer>)加载,CDN 依赖全部走动态 import() —— 这样本地直开
 *    也能成立(module 脚本在本地文件页面会被 CORS 拦掉),且 importmap 对动态 import 同样生效。
 * 2) 五个组件各自独立 try/catch:任一加载失败只把红字写进对应 stage,
 *    不产生未捕获错误(控制台 0 报错是硬项)。 */

(() => {
  'use strict';

  const STAGES = ['stage-beam', 'stage-orbs', 'stage-gooey', 'stage-metal', 'stage-image'];

  /* 五个试吃项:stage id / 展示用包名 / esm.sh 地址(含 deps 固定,避免多份 React 副本) */
  const CDN = {
    beam: {
      stage: 'stage-beam',
      pkg: 'border-beam',
      url: 'https://esm.sh/border-beam@1.3.0?deps=react@18.3.1,react-dom@18.3.1'
    },
    orbs: {
      stage: 'stage-orbs',
      pkg: 'thinking-orbs',
      url: 'https://esm.sh/thinking-orbs?deps=react@18.3.1,react-dom@18.3.1'
    },
    gooey: {
      stage: 'stage-gooey',
      pkg: 'liquid-gooey',
      url: 'https://esm.sh/liquid-gooey?deps=react@18.3.1,react-dom@18.3.1'
    },
    metal: {
      stage: 'stage-metal',
      pkg: 'metal-fx',
      url: 'https://esm.sh/metal-fx?deps=react@18.3.1,react-dom@18.3.1'
    },
    image: {
      stage: 'stage-image',
      pkg: 'img-fx',
      url: 'https://esm.sh/img-fx?deps=react@18.3.1,react-dom@18.3.1,three@0.169.0'
    }
  };

  function fail(stageId, pkg, e) {
    const el = document.getElementById(stageId);
    if (!el) return;
    el.innerHTML = '';
    const s = document.createElement('status');
    s.className = 'err';
    s.textContent = `❌ ${pkg} 加载失败:${(e && e.message) || e}`;
    el.appendChild(s);
  }

  function ok(stageId, node) {
    const el = document.getElementById(stageId);
    if (!el) return;
    el.innerHTML = '';
    el.appendChild(node);
  }

  /* 环境不满足时的中性说明(不是红字错误:这不是加载失败,是这台机器给不了能力) */
  function skip(stageId, msg) {
    const el = document.getElementById(stageId);
    if (!el) return;
    el.innerHTML = '';
    const s = document.createElement('status');
    s.className = 'skip';
    s.textContent = '⏭ ' + msg;
    el.appendChild(s);
  }

  /* three.js 系组件要 WebGL:先探一次,不给就整格跳过。
     不探的话,组件内部创建上下文会抛错、而且是 React 渲染期抛的(异步),外层 try/catch 接不住,
     控制台就会留下 uncaught error。 */
  function hasWebGL() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return false;
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return true;
    } catch (e) {
      return false;
    }
  }

  function failAll(e) {
    STAGES.forEach((id) => fail(id, 'React 运行时', e));
  }

  async function boot() {
    /* React / htm 运行时:连它也拿不到时,五个 stage 一起红字 */
    let React, createRoot, htm;
    try {
      React = (await import('react')).default;
      createRoot = (await import('react-dom/client')).createRoot;
      htm = (await import('htm')).default;
    } catch (e) {
      failAll(e);
      return;
    }
    const html = htm.bind(React.createElement);
    const lhtml = htm.bind(React.createElement);

    /* ---------- 1. Border Beam:整圈流光 + 只闪底部一条线 ---------- */
    async function borderBeamDemo() {
      try {
        const mod = await import(CDN.beam.url);
        const BorderBeam = mod.BorderBeam || mod.default;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;gap:24px;flex-wrap:wrap;justify-content:center;';
        ok(CDN.beam.stage, wrap);
        createRoot(wrap).render(html`
          <${BorderBeam} size="md" colorVariant="colorful">
            <div class="demo-card">
              <div class="line title"></div>
              <div class="line"></div>
              <div class="line short"></div>
            </div>
          <//>
          <${BorderBeam} size="line" colorVariant="ocean">
            <input class="demo-input" placeholder="搜索框:底部流光" />
          <//>
        `);
      } catch (e) { fail(CDN.beam.stage, CDN.beam.pkg, e); }
    }

    /* ---------- 2. Thinking Orbs:searching / working / breathing ---------- */
    async function thinkingOrbsDemo() {
      try {
        const mod = await import(CDN.orbs.url);
        const ThinkingOrb = mod.ThinkingOrb;
        if (!ThinkingOrb) throw new Error('找不到导出 ThinkingOrb,实际导出: ' + Object.keys(mod).join(','));
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;gap:24px;align-items:center;';
        ok(CDN.orbs.stage, wrap);
        createRoot(wrap).render(
          React.createElement('div', {style:{display:'flex',gap:'28px',alignItems:'flex-end'}},
            ['searching','working','breathing'].map(s =>
              React.createElement('div', {key:s, style:{textAlign:'center'}},
                React.createElement(ThinkingOrb, {state:s, size:64}),
                React.createElement('div', {className:'pkg', style:{marginTop:'6px'}}, s)
              )
            )
          )
        );
      } catch (e) { fail(CDN.orbs.stage, CDN.orbs.pkg, e); }
    }

    /* ---------- 3. Gooey:两滴黏液靠近吸附(自动开合) ---------- */
    async function gooeyDemo() {
      try {
        const mod = await import(CDN.gooey.url);
        const Liquid = mod.Liquid;
        if (!Liquid) throw new Error('找不到导出 Liquid,实际导出: ' + Object.keys(mod).join(','));
        const wrap = document.createElement('div');
        ok(CDN.gooey.stage, wrap);
        function GooeyDemo() {
          const [open, setOpen] = React.useState(false);
          React.useEffect(() => { const t = setInterval(() => setOpen(v => !v), 1800); return () => clearInterval(t); }, []);
          const blob = (label) => React.createElement('div', {
            style: { width: 56, height: 56, borderRadius: '50%', background: '#b8bb26', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#121212', fontWeight: 700, fontSize: 18 }
          }, label);
          return lhtml`
            <${Liquid} blur=${6} contrast=${18} fill="#b8bb26">
              <${Liquid.Item} x=${open ? -40 : 0} y=${open ? -36 : 0} transition="bouncy">${blob('A')}<//>
              <${Liquid.Item} x=${open ? 40 : 0} y=${open ? -36 : 0} transition="bouncy">${blob('B')}<//>
              <${Liquid.Item} x=${0} y=${open ? 40 : 0} transition="bouncy">${blob('C')}<//>
            <//>
          `;
        }
        createRoot(wrap).render(React.createElement(GooeyDemo));
      } catch (e) { fail(CDN.gooey.stage, CDN.gooey.pkg, e); }
    }

    /* ---------- 4. Metal:chromatic / silver / gold ---------- */
    async function metalDemo() {
      try {
        const mod = await import(CDN.metal.url);
        const MetalFx = mod.MetalFx;
        if (!MetalFx) throw new Error('找不到导出 MetalFx,实际导出: ' + Object.keys(mod).join(','));
        const wrap = document.createElement('div');
        ok(CDN.metal.stage, wrap);
        const btnStyle = { padding: '12px 28px', borderRadius: 999, border: 'none', background: '#2a2a2a', color: '#eee', fontSize: 15, cursor: 'pointer' };
        const mk = (preset, label) => React.createElement(MetalFx, {variant:'button', preset, theme:'dark'},
          React.createElement('button', {style: btnStyle}, label));
        createRoot(wrap).render(
          React.createElement('div', {style:{display:'flex',flexDirection:'column',gap:'16px',alignItems:'center'}},
            mk('chromatic','Chromatic 彩虹金属'), mk('silver','Silver 冷钢'), mk('gold','Gold 暖金'))
        );
      } catch (e) { fail(CDN.metal.stage, CDN.metal.pkg, e); }
    }

    /* ---------- 5. Image FX:pixels-organic + 占位图(需要 WebGL) ---------- */
    async function imageFxDemo() {
      if (!hasWebGL()) {
        skip(CDN.image.stage, '本浏览器没有可用的 WebGL,img-fx(three.js 滤镜)跳过;其余四格不受影响。');
        return;
      }
      try {
        const mod = await import(CDN.image.url);
        const ImageGeneration = mod.ImageGeneration;
        if (!ImageGeneration) throw new Error('找不到导出 ImageGeneration,实际导出: ' + Object.keys(mod).join(','));
        const wrap = document.createElement('div');
        ok(CDN.image.stage, wrap);
        createRoot(wrap).render(html`
          <${ImageGeneration}
            preset="pixels-organic"
            images=${['https://picsum.photos/seed/beam-a/640/640', 'https://picsum.photos/seed/beam-b/640/640']}
            autoReveal=${true}
          >
            <div style=${{ width: 260, height: 200, borderRadius: 16, background: '#1d1d1d' }}></div>
          <//>
        `);
      } catch (e) { fail(CDN.image.stage, CDN.image.pkg, e); }
    }

    /* 五个 stage 并行加载;每个 demo 内部已吞掉自己的异常 */
    await Promise.all([borderBeamDemo(), thinkingOrbsDemo(), gooeyDemo(), metalDemo(), imageFxDemo()]);
  }

  /* 兜底:boot 自身也绝不抛出未捕获错误 */
  boot().catch(failAll);
})();
