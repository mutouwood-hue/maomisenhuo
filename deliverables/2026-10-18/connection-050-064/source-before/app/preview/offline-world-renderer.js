(function (root) {
  'use strict';
  const PREFIX = 'world-demo-';
  const near = (a, b) => Math.abs(a - b) < 0.015;
  function create({ room, THREE = {}, onChange = () => {} } = {}) {
    if (!room || !room.scene || !room.scene.traverse) throw new Error('WORLD_ROOM_UNAVAILABLE');
    const scene = room.scene;
    const matches = [];
    scene.traverse(node => {
      if (node.isMesh && node.geometry && node.geometry.type === 'BoxGeometry') matches.push(node);
    });
    const floor = matches.filter(n => {
      const p = n.geometry.parameters;
      return near(p.width, 49) && near(p.height, 1.2) && near(p.depth, 44) && near(n.position.y, -.64);
    });
    if (floor.length !== 1) throw new Error('WORLD_ROOM_LAYOUT_UNRECOGNIZED');
    const house = floor[0].parent;
    const windows = house.children.filter(n => n.isGroup && near(n.position.x, -10.5) && near(n.position.y, 14.5) && near(n.position.z, 22.48));
    const windowGroup = windows.length === 1 ? windows[0] : null;
    const glass = windowGroup && windowGroup.children.filter(n => n.isMesh && n.geometry && n.geometry.type === 'BoxGeometry' && near(n.geometry.parameters.width, 13.5) && near(n.geometry.parameters.height, 11.2) && near(n.geometry.parameters.depth, .6) && near(n.position.z, -.15));
    if (!glass || glass.length !== 1) throw new Error('WORLD_WINDOW_LAYOUT_UNRECOGNIZED');
    // bf() creates exactly this glass plus three cloud boxes before its five frame bars.
    const clouds = windowGroup.children.filter(n => n !== glass[0] && n.isMesh && n.geometry && near(n.geometry.parameters.depth, .22) && near(n.position.z, -.52));
    if (clouds.length !== 3) throw new Error('WORLD_WINDOW_CLOUD_LAYOUT_UNRECOGNIZED');
    const Group = THREE.Group || house.constructor;
    const Mesh = THREE.Mesh || floor[0].constructor;
    const BoxGeometry = THREE.BoxGeometry || floor[0].geometry.constructor;
    const Material = THREE.MeshStandardMaterial || floor[0].material.constructor;
    let disposed = false;
    let owned = null;
    let geo = null;let previewTexture=null;
    const materials = new Map();
    let source = null;
    let expanded = false;
    let windowScene = 'original';
    const visibility = new Map();
    const localBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    let nodeCount = 0;
    function material(color) {
      if (!materials.has(color)) materials.set(color, new Material({ color, roughness: .95 }));
      return materials.get(color);
    }
    function box(name, dimensions, position, color) {
      const node = new Mesh(geo, material(color));
      node.name = PREFIX + name;
      node.scale.set(...dimensions);
      node.position.set(...position);
      // Original light/shadow resources remain untouched. Small additions use existing light.
      node.receiveShadow = true;
      node.castShadow = false;
      owned.add(node);
      nodeCount++;
      for (let i = 0; i < 3; i++) {
        localBounds.min[i] = Math.min(localBounds.min[i], position[i] - dimensions[i] / 2);
        localBounds.max[i] = Math.max(localBounds.max[i], position[i] + dimensions[i] / 2);
      }
      return node;
    }
    function balcony() {
      // Original floor's right boundary is x=24.5. This is new physical area, not a zoom.
      box('extension-foundation', [14, 1.2, 27], [31.5, -.64, 3.5], '#bc8d64');
      for (let row = 0; row < 7; row++) {
        box('extension-floor-' + row, [13.84, .16, 3.72], [31.5, 0, -8 + row * 3.85], row % 2 ? '#dcaf82' : '#d3a779');
      }
      box('extension-back-wall', [14, 17, .8], [31.5, 8.3, 17], '#a9d4cf');
      box('extension-back-trim', [14, .9, .5], [31.5, .5, 16.48], '#fff3d9');
      box('threshold', [.55, .12, 11], [24.65, .12, 2], '#fff3d9');
      box('opening-left', [.7, 13, .7], [24.8, 6.5, -3.7], '#fff3d9');
      box('opening-right', [.7, 13, .7], [24.8, 6.5, 7.7], '#fff3d9');
      box('opening-top', [.7, .8, 12.1], [24.8, 13.1, 2], '#fff3d9');
      box('balcony-front-rail', [13.8, .45, .45], [31.5, 4.9, -9.9], '#fff3d9');
      box('balcony-right-rail', [.45, .45, 26.8], [38.2, 4.9, 3.5], '#fff3d9');
      for (let i = 0; i < 5; i++) box('balcony-front-post-' + i, [.35, 4.7, .35], [25.3 + i * 3.2, 2.4, -9.9], '#eacba1');
      for (let i = 0; i < 6; i++) box('balcony-right-post-' + i, [.35, 4.7, .35], [38.2, 2.4, -8 + i * 4.8], '#eacba1');
      box('reading-seat', [5, 1.5, 4], [30, 1, 10], '#e3b697');
      box('reading-cushion', [4.8, .6, 3.8], [30, 2.05, 10], '#eacba1');
      box('planter', [3.1, 2.5, 3.1], [35.2, 1.35, 12], '#cf997b');
      box('plant-trunk', [.55, 3.5, .55], [35.2, 4, 12], '#9e795c');
      box('plant-leaves', [4, 3, 3.8], [35.2, 6.6, 12], '#86aa80');
    }
    function landscape() {
      // The old back wall is solid. An inset shallow diorama replaces only its opaque
      // glass/cloud content, in front of the wall and behind the retained window frame.
      // All positions stay within the original 13.5 x 11.2 opening; nothing is painted
      // over the frame, and no shared original material is replaced or recolored.
      const x = -10.5, y = 14.5;
      box('window-sky', [13.4, 11.1, .045], [x, y, 22.005], '#b7ddd9');
      box('window-distant-hills', [13.3, 3.4, .08], [x, y - 2.8, 21.94], '#b2c8a6');
      box('window-street', [13.25, 2.2, .1], [x, y - 4.45, 21.85], '#e4cda5');
      box('window-footpath', [13.25, .35, .13], [x, y - 3.45, 21.75], '#fff3d9');
      const houses = [[-4.6, 3.1, '#dfae91'], [-.2, 3.9, '#e4cd9b'], [4.3, 2.7, '#a9c0b1']];
      houses.forEach(([dx, height, color], index) => {
        const bottom = y - 3.25;
        box('window-house-' + index, [3.2, height, .18], [x + dx, bottom + height / 2, 21.72], color);
        box('window-roof-' + index, [3.6, .55, .24], [x + dx, bottom + height + .15, 21.64], '#a87d6c');
        box('window-door-' + index, [.7, 1.3, .08], [x + dx, bottom + .65, 21.58], '#728e87');
        for (const side of [-1, 1]) box('window-house-light-' + index + '-' + side, [.55, .7, .08], [x + dx + side * .95, bottom + height - .95, 21.58], '#fff0bd');
      });
      for (const [index, dx] of [[0, -2.65], [1, 2.3]]) {
        box('window-tree-trunk-' + index, [.22, 2.6, .14], [x + dx, y - 2.3, 21.48], '#9e795c');
        box('window-tree-crown-' + index, [1.7, 2.5, .2], [x + dx, y - .45, 21.4], '#86aa80');
      }
      box('window-cloud-one', [2.8, .6, .1], [x - 3.5, y + 3.5, 21.8], '#fff8df');
      box('window-cloud-two', [1.9, .6, .1], [x + 3.7, y + 4.2, 21.8], '#fff8df');
      for (const node of [glass[0], ...clouds]) {
        visibility.set(node, node.visible);
        node.visible = false;
      }
    }
    function clear() {
      for (const [node, visible] of visibility) node.visible = visible;
      visibility.clear();
      if (owned) owned.removeFromParent();
      owned = null;
      previewTexture?.dispose();previewTexture=null;
      if (geo) geo.dispose();
      geo = null;
      for (const value of materials.values()) value.dispose();
      materials.clear();
      nodeCount = 0;
      localBounds.min.fill(Infinity);
      localBounds.max.fill(-Infinity);
      expanded = false;
      windowScene = 'original';
      source = null;
    }
    function inspect() {
      return {
        disposed, expanded, windowScene, source, ownedMeshes: nodeCount,
        ownedGeometries: geo ? 1 : 0, ownedMaterials: materials.size,
        originalFloorBounds: { min: [-24.5, -1.24, -21], max: [24.5, -.04, 23] },
        visibleFloorBounds: { min: [-24.5, 0, -21], max: [expanded ? 38.5 : 24.5, 0, 23] },
        addedLocalBounds: owned ? { min: [...localBounds.min], max: [...localBounds.max] } : null,
        windowMatch: { group: [-10.5, 14.5, 22.48], glassDimensions: [13.5, 11.2, .6], clouds: clouds.length },
        originalHiddenNodes: visibility.size,
        catIdentity: room.model && room.model.state ? { breed: room.model.state().breed, outfit: room.model.state().outfit } : null,
        note: 'Visual geometry only. No added walking path, hotspot, store, seed, reward, or proof.'
      };
    }
    function notify() { onChange(inspect()); }
    return Object.freeze({
      applyGrowth(options = {}) {
        if (disposed) throw new Error('WORLD_RENDERER_DISPOSED');
        if (typeof options.expanded !== 'boolean' || !['street', 'original'].includes(options.windowScene)) throw new Error('WORLD_RENDERER_BAD_OPTIONS');
        if (!['simulation_fixture', 'verified_production_projection'].includes(options.source)) throw new Error('WORLD_RENDERER_SOURCE_REQUIRED');
        clear();
        source = options.source;
        expanded = options.expanded;
        windowScene = options.windowScene;
        if (expanded || windowScene === 'street') {
          owned = new Group(); owned.name = PREFIX + 'growth'; house.add(owned);
          geo = new BoxGeometry(1, 1, 1);
          if (expanded) balcony();
          if (windowScene === 'street') landscape();
        }
        notify();
        return inspect();
      },
      setWindowPreview(canvas){
        if(disposed||!owned)throw Error('WORLD_WINDOW_NOT_READY');
        const T=root.CatTownTHREE;if(!T||!canvas?.width)throw Error('ORIGINAL_TOWN_PREVIEW_REQUIRED');
        previewTexture?.dispose();previewTexture=new T.CanvasTexture(canvas);previewTexture.colorSpace=T.SRGBColorSpace;
        owned.traverse(n=>{if(n.name.startsWith(PREFIX+'window-'))n.visible=n.name===PREFIX+'window-sky';});
        const sky=owned.getObjectByName(PREFIX+'window-sky');
        const previous=materials.get('original-town-preview');previous?.dispose();
        const material=new T.MeshBasicMaterial({map:previewTexture,toneMapped:false});materials.set('original-town-preview',material);sky.material=material;
        return inspect();
      },
      restore() { if (!disposed) { clear(); notify(); } return inspect(); },
      dispose() { if (!disposed) { clear(); disposed = true; notify(); } return inspect(); },
      inspect
    });
  }
  root.CatWorldRenderer = Object.freeze({ create });
})(typeof window === 'object' ? window : globalThis);
