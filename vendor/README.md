# Bundled dependency

- Three.js **0.170.0** (`REVISION = 170`)
- OrbitControls from the **same 0.170.0 release**
- MIT license: `THREE-LICENSE.txt`

Original distribution files:

- https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js
- https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js
- https://cdn.jsdelivr.net/npm/three@0.170.0/LICENSE

These files are included locally. The running application has no CDN or external texture/model dependency. The import map in `index.html` ensures OrbitControls and scene code share this one Three.js instance.
