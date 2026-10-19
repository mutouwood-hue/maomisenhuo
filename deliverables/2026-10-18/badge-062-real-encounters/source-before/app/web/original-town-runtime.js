/* Full original town, mechanically wrapped. No reconstructed street substitute. */
(function(root){'use strict';root.CatOriginalTown={create({THREE,renderer:hostRenderer,onHome=()=>{},onGarden=()=>{},playerModel=null,playerProfile=null}){
if(!THREE||!hostRenderer)throw Error('ORIGINAL_TOWN_ENGINE_REQUIRED');
const parent=hostRenderer.domElement.parentNode,nextSibling=hostRenderer.domElement.nextSibling;
const saved={outputColorSpace:hostRenderer.outputColorSpace,toneMapping:hostRenderer.toneMapping,exposure:hostRenderer.toneMappingExposure,pixelRatio:hostRenderer.getPixelRatio(),shadowEnabled:hostRenderer.shadowMap.enabled,shadowType:hostRenderer.shadowMap.type};
const panel=document.createElement('section');panel.id='original-town';panel.hidden=true;panel.setAttribute('aria-label','原素材喵喵瀑布镇');panel.innerHTML="<div class=\"town-demo-label\">小镇散步 · 镇上居民为NPC</div>\n\n    <!-- 3D 渲染容器 -->\n    <div id=\"canvas-container\"></div>\n\n    <!-- 电影模式上下黑边 (Cinematic Letterbox) -->\n    <div id=\"letterbox-top\" class=\"letterbox fixed top-0 left-0 w-full h-0 bg-black/90 z-10 flex items-center justify-between px-6 overflow-hidden\">\n        <div class=\"flex items-center space-x-3 text-amber-300/80 text-xs tracking-widest uppercase\">\n            <span class=\"w-2 h-2 rounded-full bg-red-500 animate-ping\"></span>\n            <span>CINEMATIC CAT CAM // AUTO-DIRECTOR</span>\n            <span id=\"cam-avoid-badge\" class=\"hidden px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] font-mono\">⚡ 镜头避障已介入</span>\n            <span id=\"cam-xray-badge\" class=\"hidden px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-[10px] font-mono\">👁️ 遮挡物半透明透视</span>\n        </div>\n        <div id=\"shot-code-display\" class=\"text-white/60 text-xs font-mono\">FOV: 45mm | SHOT: TRACKING</div>\n    </div>\n    <div id=\"letterbox-bottom\" class=\"letterbox fixed bottom-0 left-0 w-full h-0 bg-black/90 z-10\"></div>\n\n    <!-- 顶部小镇标题与时间光照切换栏 -->\n    <div id=\"original-town-top\" class=\"fixed top-4 left-4 right-4 z-20 flex flex-wrap justify-between items-start gap-3 pointer-events-none\">\n        <!-- 左侧标题卡片 -->\n        <div class=\"glass-panel rounded-2xl px-5 py-3.5 text-amber-50 pointer-events-auto flex items-center space-x-3.5\">\n            <div class=\"w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center shadow-lg text-2xl\">\n                🐾\n            </div>\n            <div>\n                <div class=\"flex items-center space-x-2\">\n                    <h1 class=\"title-font text-xl sm:text-2xl tracking-wide text-amber-200\">喵喵瀑布镇</h1>\n                    <span class=\"text-xs px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200\">Voxel Haven</span>\n                    <span id=\"assembly-status-pill\" class=\"text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-medium\">✨ 高空落下组装中...</span>\n                </div>\n                <p class=\"text-xs text-amber-100/70 mt-0.5\">遍地体素繁花 · 高空落下Q弹组装 · 智能避障跟拍与遮挡半透明透视</p>\n            </div>\n        </div>\n\n        <!-- 右侧光影氛围与重播组装按钮面板 -->\n        <div class=\"glass-panel rounded-2xl p-2 text-amber-50 pointer-events-auto flex flex-wrap items-center gap-1.5\">\n            <button data-town-call=\"replayTownAssembly()\" class=\"btn-glow px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md flex items-center space-x-1 mr-1\">\n                <span>🧱 重播小镇组装</span>\n            </button>\n            <div class=\"h-4 w-[1px] bg-white/15 mx-0.5 hidden sm:block\"></div>\n            <button id=\"btn-time-sunset\" data-town-call=\"setLightingMood('sunset')\" class=\"px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-500/30 text-amber-200 border border-amber-400/40 transition\">\n                🌇 梦幻黄昏\n            </button>\n            <button id=\"btn-time-day\" data-town-call=\"setLightingMood('day')\" class=\"px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-white/10 text-amber-100/70 transition\">\n                ☀️ 晴朗午后\n            </button>\n            <button id=\"btn-time-night\" data-town-call=\"setLightingMood('night')\" class=\"px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-white/10 text-amber-100/70 transition\">\n                🏮 暖灯夜色\n            </button>\n        </div>\n    </div>\n\n    <!-- 3D 空间映射的猫咪头顶心情气泡 -->\n    <div id=\"cat-thought-bubble\" class=\"fixed top-0 left-0 z-15 opacity-0 -translate-x-1/2 -translate-y-full pointer-events-none\">\n        <div class=\"bg-white/95 text-slate-800 px-3 py-1.5 rounded-2xl shadow-xl border-2 border-amber-300 text-xs font-bold flex items-center space-x-1.5 whitespace-nowrap\">\n            <span id=\"bubble-emoji\" class=\"text-sm\">🐟</span>\n            <span id=\"bubble-text\">今天鲜鱼店进货啦！</span>\n        </div>\n        <div class=\"w-2.5 h-2.5 bg-white border-r-2 border-b-2 border-amber-300 rotate-45 mx-auto -mt-1.5\"></div>\n    </div>\n\n    <!-- 底部交互与电影跟拍控制中心 -->\n    <div id=\"original-town-bottom\" class=\"fixed bottom-5 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-3xl pointer-events-none flex flex-col items-center space-y-3\">\n        \n        <!-- 跟随状态下的猫咪信息与运镜状态卡片 -->\n        <div id=\"follow-hud\" class=\"glass-panel rounded-2xl px-5 py-3.5 w-full pointer-events-auto hidden transition-all duration-300\">\n            <div class=\"flex flex-col sm:flex-row sm:items-center justify-between gap-3\">\n                <!-- 猫咪身份与动作 -->\n                <div class=\"flex items-center space-x-3.5\">\n                    <div id=\"cat-avatar-dot\" class=\"w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/20 bg-amber-500/30\">\n                        🐱\n                    </div>\n                    <div>\n                        <div class=\"flex items-center space-x-2\">\n                            <span id=\"hud-cat-name\" class=\"font-bold text-base text-amber-200\">橘座大叔</span>\n                            <span id=\"hud-cat-role\" class=\"text-xs px-2 py-0.5 rounded-md bg-white/10 text-amber-100/90\">拉面馆常客</span>\n                        </div>\n                        <div class=\"flex items-center space-x-3 mt-1 text-xs text-amber-100/80\">\n                            <span>当前动作：<strong id=\"hud-cat-action\" class=\"text-emerald-300\">漫步巡街</strong></span>\n                            <span class=\"text-white/20\">|</span>\n                            <span>目的地：<strong id=\"hud-cat-target\" class=\"text-amber-300\">喵鲜鱼铺</strong></span>\n                        </div>\n                    </div></div>\n                    <!-- 电影运镜实时说明与切换 -->\n                <div class=\"flex items-center justify-between sm:justify-end space-x-2.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/10\">\n                    <div class=\"text-left sm:text-right mr-1\">\n                        <div class=\"flex items-center sm:justify-end space-x-1.5\">\n                            <span class=\"text-[11px] uppercase tracking-wider text-amber-300/70\">电影运镜模式</span>\n                            <span id=\"hud-avoid-indicator\" class=\"text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30\">视野畅通</span>\n                        </div>\n                        <div id=\"hud-shot-name\" class=\"text-xs font-semibold text-rose-300 mt-0.5\">侧面平滑跟拍 (Steadicam Side)</div>\n                    </div>\n                    <button data-town-call=\"cycleCameraShotOverride()\" title=\"手动切换机位\" class=\"px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-amber-100 text-xs font-medium border border-white/15 transition flex items-center space-x-1\">\n                        <span>🎥 切机位</span>\n                    </button>\n                </div>\n            </div>\n        </div>\n\n        <!-- 主控制按钮栏 -->\n        <div class=\"glass-panel rounded-2xl p-2 pointer-events-auto flex flex-wrap items-center justify-center gap-2 shadow-2xl\">\n            <button id=\"btn-follow-toggle\" data-town-call=\"toggleFollowMode()\" class=\"btn-glow px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg flex items-center space-x-2\">\n                <span id=\"follow-btn-icon\">🎬</span>\n                <span id=\"follow-btn-text\">跟随猫咪 (电影运镜)</span>\n            </button>\n\n            <button id=\"btn-prev-cat\" data-town-call=\"switchFollowedCat(-1)\" class=\"px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-amber-100 border border-white/10 transition flex items-center space-x-1\">\n                <span>⏮️ 上一只</span>\n            </button>\n\n            <button id=\"btn-next-cat\" data-town-call=\"switchFollowedCat(1)\" class=\"px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-amber-100 border border-white/10 transition flex items-center space-x-1\">\n                <span>下一只 ⏭️</span>\n            </button>\n\n            <div class=\"h-5 w-[1px] bg-white/15 mx-1 hidden sm:block\"></div>\n\n            <button data-town-call=\"resetOverviewCamera()\" class=\"px-3.5 py-2.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/15 text-amber-100/80 transition flex items-center space-x-1\">\n                <span>🗺️ 全景俯瞰</span>\n            </button>\n        </div>\n    </div>\n\n    <!-- 右下角操作提示浮窗 -->\n    <div class=\"fixed bottom-5 right-5 z-10 hidden lg:block pointer-events-none\">\n        <div class=\"glass-panel rounded-xl px-3.5 py-2.5 text-[11px] text-amber-100/70 space-y-1\">\n            <div>🖱️ <strong>左键拖拽</strong>：360° 环绕观察</div>\n            <div>🖱️ <strong>右键拖拽</strong>：平移视野焦点</div>\n            <div>⚙️ <strong>滚轮缩放</strong>：拉近细节 / 远眺全镇</div>\n            <div>🐾 <strong>点击小猫</strong>：直接锁定电影跟拍</div>\n        </div>\n    </div>\n\n<div class=\"town-host-actions\"><button data-host=\"home\">回小家</button><button data-host=\"garden\">原生活小花园</button><button data-host=\"zoom-out\" aria-label=\"缩小原镇视角\">−</button><button data-host=\"zoom-in\" aria-label=\"放大原镇视角\">＋</button></div>";document.body.append(panel);
let active=false,disposed=false,frameId=0,initialized=false,shown=false,townPlayer=null;const listeners=[];
function listen(target,event,fn,options){target.addEventListener(event,fn,options);listeners.push(()=>target.removeEventListener(event,fn,options));}
function overviewRadius(){return Math.max(68,68*Math.max(1,1.35/(window.innerWidth/window.innerHeight)));}

        // ==========================================
        // 1. 全局配置、场景初始化与柔和梦幻配色
        // ==========================================
        let scene, camera, renderer, clock;
        let raycaster, mouse, collisionRaycaster;

        // 相机控制变量（支持自由环绕缩放 & 电影级跟拍平滑过渡）
        const orbitState = {
            isDraggingLeft: false,
            isDraggingRight: false,
            prevX: 0,
            prevY: 0,
            theta: Math.PI * 0.22,     // 水平角度
            phi: Math.PI * 0.34,       // 俯仰角度
            radius: 68,                // 距离
            target: new THREE.Vector3(0, 4, 0),
            velTheta: 0,
            velPhi: 0,
            velRadius: 0
        };

        // 电影跟拍状态
        const followState = {
            active: false,
            catIndex: 0,
            shotOverride: null,        // 用户手动指定的镜头模式（null 则根据猫咪动作智能导演）
            shotTimer: 0,
            orbitAngle: 0,
            currentCamPos: new THREE.Vector3(45, 38, 45),
            currentLookAt: new THREE.Vector3(0, 4, 0),
            currentFov: 45,
            isAvoidingObstacle: false,
            occludedCount: 0
        };

        // 开场高空落下组装动画系统状态 (Sky-Drop Assembly System)
        const assemblySystem = {
            active: true,
            startTime: 0,
            duration: 2.8,
            items: [] // { obj, targetY, targetScale, delay, duration, dropHeight }
        };

        // 动态遮挡半透明与碰撞避让集合 (Dynamic Occlusion & Camera Collision)
        const occludableGroups = []; // { group, meshes, materials, currentOpacity, targetOpacity, boundingSphere }
        const cameraColliderMeshes = []; // 用于射线碰撞检测的所有实体网格

        // 动画环境元素集合
        const cats = [];
        const flowerClusters = []; // 地面五彩体素小花簇
        const waterfallParticles = [];
        const splashParticles = [];
        const sakuraPetals = [];
        const smokePuffs = [];
        const floatingLanterns = [];
        const fishList = [];
        const interactiveMeshes = [];
        const lampPointLights = [];
        const windowMaterials = [];
        let windmillBlades = null;
        let waterwheelMesh = null;
        let riverWaterMesh = null;

        // 光照对象引用
        let hemiLight, dirLight, ambientLight;
        let currentMood = 'sunset';

        // 体素材质缓存池（提升性能与统一质感）
        const matCache = {};
        function getVoxelMat(hexColor, options = {}) {
            const key = `${hexColor}_${options.emissive || 0}_${options.roughness || 0.82}_${options.transparent || false}_${options.opacity || 1}`;
            if (!matCache[key]) {
                matCache[key] = new THREE.MeshStandardMaterial({
                    color: hexColor,
                    roughness: options.roughness !== undefined ? options.roughness : 0.82,
                    metalness: options.metalness !== undefined ? options.metalness : 0.06,
                    emissive: options.emissive ? new THREE.Color(options.emissive) : new THREE.Color(0x000000),
                    emissiveIntensity: options.emissiveIntensity !== undefined ? options.emissiveIntensity : 1.0,
                    transparent: options.transparent || false,
                    opacity: options.opacity !== undefined ? options.opacity : 1.0,
                    flatShading: true
                });
            }
            return matCache[key];
        }

        // 共享基础单位立方体几何体
        const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);

        // 工具函数：创建体素块
        function createVoxel(w, h, d, colorHex, x, y, z, parent, matOptions = {}, castShadow = true, receiveShadow = true) {
            const mat = getVoxelMat(colorHex, matOptions);
            const mesh = new THREE.Mesh(unitBoxGeo, mat);
            mesh.scale.set(w, h, d);
            mesh.position.set(x, y, z);
            mesh.castShadow = castShadow;
            mesh.receiveShadow = receiveShadow;
            if (parent) parent.add(mesh);
            return mesh;
        }

        // ==========================================
        // 1B. 注册高空落下组装动画 & 注册可半透明遮挡建筑组
        // ==========================================
        function registerSkyDrop(obj, delay, duration = 0.68, dropHeight = 46, scaleEffect = true) {
            const targetY = obj.position.y;
            const targetScale = obj.scale.clone();
            assemblySystem.items.push({
                obj,
                targetY,
                targetScale,
                delay,
                duration,
                dropHeight,
                scaleEffect
            });
        }

        // 将建筑、树木、拱桥或巨石注册为可遮挡透视&镜头碰撞检测对象
        function registerOccludableStructure(group, isCameraCollider = true, options = {}) {
            const meshes = [];
            const clonedMats = [];

            group.traverse((child) => {
                if (child.isMesh && child.material && child.visible && child.material.visible !== false) {
                    // 为每个可半透明组克隆独立材质，避免修改全局缓存导致全镇变透明
                    const matClone = child.material.clone();
                    matClone.userData = {
                        baseOpacity: matClone.opacity !== undefined ? matClone.opacity : 1.0,
                        baseTransparent: matClone.transparent || false
                    };
                    if(windowMaterials.includes(child.material))windowMaterials.push(matClone);
                    child.material = matClone;
                    child.userData.baseCastShadow = child.castShadow;
                    child.userData.occludableGroupRef = group;
                    meshes.push(child);
                    clonedMats.push(matClone);
                    if (isCameraCollider) {
                        cameraColliderMeshes.push(child);
                    }
                }
            });

            // 大体量地形类结构（悬崖、拱桥、广场）按"单个体素块"逐块透视，避免一靠近就整片山体发白
            const units = options.perMesh
                ? meshes.map((m, k) => ({ meshes: [m], materials: [clonedMats[k]] }))
                : [{ meshes, materials: clonedMats }];
            units.forEach(u => occludableGroups.push({
                group,
                meshes: u.meshes,
                materials: u.materials,
                solid: isCameraCollider,      // 实体：参与镜头避让；非实体（树/灯/桥）：只做 X-Ray 透视
                dynamic: !!options.dynamic,   // 会转动的物体（风车/水车）需持续刷新包围盒
                everyFrame: !!options.everyFrame, // 移动物体（猫咪）每帧刷新包围盒
                catIndex: options.catIndex !== undefined ? options.catIndex : -1,
                box: null,
                boxReady: false,
                holdTimer: 0,
                wantOpacity: 1.0,
                currentOpacity: 1.0,
                targetOpacity: 1.0
            }));
        }

        // 触发/重播全镇从空中落下组装动画
        const replayTownAssembly = function() {
            if (!clock) return;
            assemblySystem.active = true;
            assemblySystem.startTime = clock.getElapsedTime();

            const pill = document.getElementById('assembly-status-pill');
            if (pill) {
                pill.textContent = '✨ 高空落下组装中...';
                pill.className = 'text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-medium animate-pulse';
            }

            assemblySystem.items.forEach(item => {
                item.obj.position.y = item.targetY + item.dropHeight;
                if (item.scaleEffect) {
                    item.obj.scale.set(0.001, 0.001, 0.001);
                }
            });
        };

        // Ease-Out-Back + 落地轻弹曲线
        function easeOutBackBounce(t) {
            if (t <= 0) return 0;
            if (t >= 1) return 1;
            const c1 = 1.45;
            const c3 = c1 + 1;
            return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        }

        function updateSkyDropAssembly(elapsed) {
            if (!assemblySystem.active) return;
            const localTime = elapsed - assemblySystem.startTime;
            let allFinished = true;

            for (let i = 0; i < assemblySystem.items.length; i++) {
                const item = assemblySystem.items[i];
                const t = (localTime - item.delay) / item.duration;

                if (t <= 0) {
                    allFinished = false;
                    item.obj.position.y = item.targetY + item.dropHeight;
                    if (item.scaleEffect) {
                        item.obj.scale.set(0.001, 0.001, 0.001);
                    }
                } else if (t < 1.0) {
                    allFinished = false;
                    const eased = easeOutBackBounce(t);
                    item.obj.position.y = item.targetY + item.dropHeight * (1.0 - eased);
                    if (item.scaleEffect) {
                        // 落地瞬间带有一点果冻挤压回弹感
                        const squash = 1.0 + Math.sin(t * Math.PI * 2.5) * 0.12 * (1.0 - t);
                        const sFactor = Math.min(1.15, Math.max(0.05, eased));
                        item.obj.scale.set(
                            item.targetScale.x * sFactor * squash,
                            item.targetScale.y * (sFactor / squash),
                            item.targetScale.z * sFactor * squash
                        );
                    }
                } else {
                    item.obj.position.y = item.targetY;
                    if (item.scaleEffect) {
                        item.obj.scale.copy(item.targetScale);
                    }
                }
            }

            if (allFinished) {
                assemblySystem.active = false;
                const pill = document.getElementById('assembly-status-pill');
                if (pill) {
                    pill.textContent = '🏡 小镇组装完成';
                    pill.className = 'text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 font-medium';
                }
            }
        }

        // ==========================================
        // 2. 生成式柔和天空盒与环境光照
        // ==========================================
        let skyDomeMesh = null;
        function createSkyDome() {
            const skyGeo = new THREE.SphereGeometry(260, 32, 24);
            const skyMat = new THREE.ShaderMaterial({
                uniforms: {
                    topColor: { value: new THREE.Color(0x2b1e4a) },
                    midColor: { value: new THREE.Color(0xb85d79) },
                    bottomColor: { value: new THREE.Color(0xffb88c) }
                },
                vertexShader: `
                    varying vec3 vWorldPosition;
                    void main() {
                        // 天空球始终以相机为中心，用局部方向计算渐变，任意缩放都不会被远裁剪面切出黑洞
                        vWorldPosition = position;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 topColor;
                    uniform vec3 midColor;
                    uniform vec3 bottomColor;
                    varying vec3 vWorldPosition;
                    void main() {
                        float h = normalize(vWorldPosition).y;
                        vec3 col = mix(bottomColor, midColor, smoothstep(-0.05, 0.25, h));
                        col = mix(col, topColor, smoothstep(0.25, 0.75, h));
                        gl_FragColor = vec4(col, 1.0);
                        #include <colorspace_fragment>
                    }
                `,
                side: THREE.BackSide,
                depthWrite: false
            });
            const sky = new THREE.Mesh(skyGeo, skyMat);
            sky.name = 'skyDome';
            sky.frustumCulled = false;
            sky.renderOrder = -1;
            scene.add(sky);
            skyDomeMesh = sky;
        }

        function setupLighting() {
            ambientLight = new THREE.LegacyAmbientLight(0xffdec7, 0.45);
            scene.add(ambientLight);

            hemiLight = new THREE.LegacyHemisphereLight(0xffb58a, 0x3b2d54, 0.65);
            hemiLight.position.set(0, 60, 0);
            scene.add(hemiLight);

            dirLight = new THREE.LegacyDirectionalLight(0xffa970, 1.25);
            dirLight.position.set(48, 62, 38);
            dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 2048;
            dirLight.shadow.mapSize.height = 2048;
            dirLight.shadow.camera.near = 10;
            dirLight.shadow.camera.far = 160;
            const d = 55;
            dirLight.shadow.camera.left = -d;
            dirLight.shadow.camera.right = d;
            dirLight.shadow.camera.top = d;
            dirLight.shadow.camera.bottom = -d;
            dirLight.shadow.bias = -0.0005;
            scene.add(dirLight);
        }

        // 切换小镇昼夜/黄昏氛围
        const setLightingMood = function(mood) {
            currentMood = mood;
            const sky = scene.getObjectByName('skyDome');
            const btnSunset = document.getElementById('btn-time-sunset');
            const btnDay = document.getElementById('btn-time-day');
            const btnNight = document.getElementById('btn-time-night');

            [btnSunset, btnDay, btnNight].forEach(b => {
                b.className = "px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-white/10 text-amber-100/70 transition";
            });

            if (mood === 'sunset') {
                btnSunset.className = "px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-500/30 text-amber-200 border border-amber-400/40 transition";
                sky.material.uniforms.topColor.value.setHex(0x2b1e4a);
                sky.material.uniforms.midColor.value.setHex(0xb85d79);
                sky.material.uniforms.bottomColor.value.setHex(0xffb88c);
                scene.fog.color.setHex(0xd98a82);
                ambientLight.color.setHex(0xffdec7);
                ambientLight.intensity = 0.45;
                hemiLight.color.setHex(0xffb58a);
                hemiLight.groundColor.setHex(0x3b2d54);
                dirLight.color.setHex(0xffa970);
                dirLight.intensity = 1.25;
                dirLight.position.set(48, 52, 38);
                lampPointLights.forEach(l => l.intensity = 1.1);
                windowMaterials.forEach(m => m.emissiveIntensity = 0.9);
            } else if (mood === 'day') {
                btnDay.className = "px-3 py-1.5 rounded-xl text-xs font-medium bg-sky-500/30 text-sky-200 border border-sky-400/40 transition";
                sky.material.uniforms.topColor.value.setHex(0x38bdf8);
                sky.material.uniforms.midColor.value.setHex(0x93c5fd);
                sky.material.uniforms.bottomColor.value.setHex(0xfef3c7);
                scene.fog.color.setHex(0xbae6fd);
                ambientLight.color.setHex(0xffffff);
                ambientLight.intensity = 0.6;
                hemiLight.color.setHex(0xe0f2fe);
                hemiLight.groundColor.setHex(0x4d7c0f);
                dirLight.color.setHex(0xfffbeb);
                dirLight.intensity = 1.35;
                dirLight.position.set(35, 78, 25);
                lampPointLights.forEach(l => l.intensity = 0.25);
                windowMaterials.forEach(m => m.emissiveIntensity = 0.25);
            } else if (mood === 'night') {
                btnNight.className = "px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 transition";
                sky.material.uniforms.topColor.value.setHex(0x090a1a);
                sky.material.uniforms.midColor.value.setHex(0x1b1e3d);
                sky.material.uniforms.bottomColor.value.setHex(0x2e294e);
                scene.fog.color.setHex(0x181730);
                ambientLight.color.setHex(0x6366f1);
                ambientLight.intensity = 0.28;
                hemiLight.color.setHex(0x312e81);
                hemiLight.groundColor.setHex(0x0f172a);
                dirLight.color.setHex(0x818cf8);
                dirLight.intensity = 0.45;
                dirLight.position.set(-40, 65, -30);
                lampPointLights.forEach(l => l.intensity = 1.9);
                windowMaterials.forEach(m => m.emissiveIntensity = 1.45);
            }
        };

        // ==========================================
        // 3. 构建体素地形、悬崖、瀑布与溪流
        // ==========================================
        function buildTerrainAndWaterfall() {
            const terrainGroup = new THREE.Group();
            scene.add(terrainGroup);

            // 1) 底部深色水池底座与小镇双岛草地（第一阶段落下组装：0.0s - 0.55s）
            const westIslandGroup = new THREE.Group();
            terrainGroup.add(westIslandGroup);
            createVoxel(33, 4, 64, 0x5c4738, -19.5, -2, 0, westIslandGroup); // 泥土层
            createVoxel(33.4, 1.2, 64.4, 0x7cb368, -19.5, 0.4, 0, westIslandGroup); // 青草层
            registerSkyDrop(westIslandGroup, 0.0, 0.55, 35, false);

            const eastIslandGroup = new THREE.Group();
            terrainGroup.add(eastIslandGroup);
            createVoxel(33, 4, 64, 0x5c4738, 19.5, -2, 0, eastIslandGroup);
            createVoxel(33.4, 1.2, 64.4, 0x82b96c, 19.5, 0.4, 0, eastIslandGroup);
            registerSkyDrop(eastIslandGroup, 0.08, 0.55, 35, false);

            const riverbedGroup = new THREE.Group();
            terrainGroup.add(riverbedGroup);
            // 中央河床底层 (x: -4 到 4)
            createVoxel(10, 2, 64, 0x475569, 0, -2.5, 0, riverbedGroup);

            // 河道两侧鹅卵石堤岸
            for (let z = -31; z <= 31; z += 2) {
                const hLeft = 0.8 + (Math.sin(z * 0.5) * 0.2);
                const hRight = 0.8 + (Math.cos(z * 0.5) * 0.2);
                createVoxel(1.4, hLeft, 1.9, z % 4 === 0 ? 0x94a3b8 : 0x64748b, -3.2, 0.1, z, riverbedGroup);
                createVoxel(1.4, hRight, 1.9, z % 4 === 0 ? 0x64748b : 0x94a3b8, 3.2, 0.1, z, riverbedGroup);
            }
            registerSkyDrop(riverbedGroup, 0.14, 0.55, 35, false);

            // 2) 北侧壮观的多层体素岩石悬崖（第二阶段落下组装：0.35s - 1.05s）
            const cliffGroup = new THREE.Group();
            terrainGroup.add(cliffGroup);

            // 左侧高山岩体 (x: -35 到 -3.5)
            createVoxel(31, 14, 15, 0x57534e, -19, 6.5, -26, cliffGroup);
            createVoxel(31.4, 1.2, 15.4, 0x65a358, -19, 13.8, -26, cliffGroup); // 崖顶草坪

            // 右侧高山岩体 (x: 3.5 到 35)
            createVoxel(31, 14, 15, 0x57534e, 19, 6.5, -26, cliffGroup);
            createVoxel(31.4, 1.2, 15.4, 0x65a358, 19, 13.8, -26, cliffGroup);

            // 悬崖源头后山背景层
            createVoxel(70, 20, 8, 0x44403c, 0, 9.5, -35, cliffGroup);
            createVoxel(70.4, 1.4, 8.4, 0x528c49, 0, 19.8, -35, cliffGroup);

            // 悬崖自然层叠体素岩石细节（打破呆板立方体）
            const rockColors = [0x57534e, 0x78716c, 0x44403c, 0x64748b];
            for (let i = 0; i < 65; i++) {
                const isLeft = Math.random() > 0.5;
                const rx = isLeft ? (-4.5 - Math.random() * 28) : (4.5 + Math.random() * 28);
                const rz = -17.5 - Math.random() * 6;
                const rw = 2 + Math.random() * 4.5;
                const rh = 2 + Math.random() * 10;
                const rd = 2 + Math.random() * 4;
                const col = rockColors[i % rockColors.length];
                createVoxel(rw, rh, rd, col, rx, rh / 2, rz, cliffGroup);
                // 岩石顶部青苔点缀
                if (Math.random() > 0.45) {
                    createVoxel(rw + 0.2, 0.6, rd + 0.2, 0x6ea85e, rx, rh + 0.2, rz, cliffGroup);
                }
            }

            // 瀑布两侧凸出的巨型猫耳形状奇岩
            createVoxel(4, 16, 5, 0x64748b, -5.2, 8, -21, cliffGroup);
            createVoxel(4, 16, 5, 0x64748b, 5.2, 8, -21, cliffGroup);

            // 3) 崖顶源头水池与瀑布主体
            // 崖顶水道
            createVoxel(7.2, 1.2, 14, 0x38bdf8, 0, 13.5, -26, cliffGroup, { roughness: 0.2, transparent: true, opacity: 0.88 });
            // 瀑布垂直水幕背板
            createVoxel(6.6, 14.5, 1.5, 0x22d3ee, 0, 6.5, -18.8, cliffGroup, { roughness: 0.15, transparent: true, opacity: 0.82 });

            registerSkyDrop(cliffGroup, 0.35, 0.68, 48, true);
            registerOccludableStructure(cliffGroup, true, { perMesh: true });

            // 中央主河道水面
            const waterMat = getVoxelMat(0x2dd4bf, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.84 });
            riverWaterMesh = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.2, 64), waterMat);
            riverWaterMesh.position.set(0, -0.6, 0);
            riverWaterMesh.receiveShadow = true;
            terrainGroup.add(riverWaterMesh);
            registerSkyDrop(riverWaterMesh, 0.22, 0.55, 32, false);

            // 4) 动态瀑布体素流体粒子与底部水花泡泡
            const dropGeo = new THREE.BoxGeometry(0.95, 1.4, 0.95);
            const dropColors = [0x67e8f9, 0xa5f3fc, 0x38bdf8, 0xe0f2fe];
            for (let i = 0; i < 110; i++) {
                const mat = getVoxelMat(dropColors[i % dropColors.length], {
                    emissive: 0x0284c7,
                    emissiveIntensity: 0.25,
                    transparent: true,
                    opacity: 0.9
                });
                const drop = new THREE.Mesh(dropGeo, mat);
                resetWaterfallDrop(drop, true);
                scene.add(drop);
                waterfallParticles.push(drop);
            }

            // 瀑布底部拍打的白色体素泡沫
            const foamGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
            const foamMat = getVoxelMat(0xffffff, { emissive: 0xe0f2fe, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 });
            for (let i = 0; i < 45; i++) {
                const foam = new THREE.Mesh(foamGeo, foamMat);
                foam.userData = {
                    baseX: (Math.random() - 0.5) * 6.5,
                    baseZ: -17.5 + (Math.random() - 0.5) * 3.5,
                    phase: Math.random() * Math.PI * 2,
                    speed: 2 + Math.random() * 3
                };
                foam.position.set(foam.userData.baseX, 0.3, foam.userData.baseZ);
                scene.add(foam);
                splashParticles.push(foam);
            }

            // 河道中的锦鲤小鱼
            for (let i = 0; i < 8; i++) {
                const fishGroup = new THREE.Group();
                const fColor = i % 2 === 0 ? 0xf97316 : 0xf43f5e;
                createVoxel(0.35, 0.25, 0.7, fColor, 0, 0, 0, fishGroup);
                createVoxel(0.2, 0.2, 0.35, 0xffffff, 0, 0, -0.45, fishGroup);
                fishGroup.userData = {
                    zCenter: -10 + i * 5,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.8 + Math.random() * 0.6,
                    radiusX: 1.2 + Math.random() * 0.8
                };
                scene.add(fishGroup);
                fishList.push(fishGroup);
            }
        }

        function resetWaterfallDrop(drop, randomProgress = false) {
            const progress = randomProgress ? Math.random() : 0;
            drop.userData = {
                progress: progress,
                speed: 0.45 + Math.random() * 0.25,
                xOffset: (Math.random() - 0.5) * 5.8,
                zOffset: (Math.random() - 0.5) * 0.8
            };
        }

        // ==========================================
        // 4. 铺设石板路、朱红拱桥、河岸木栈道与中央喷泉广场
        // ==========================================
        function buildRoadsAndBridges() {
            const roadGroup = new THREE.Group();
            scene.add(roadGroup);

            // 石板路铺设函数
            function layCobblePath(xStart, zStart, xEnd, zEnd, width = 3.2) {
                const steps = Math.max(Math.abs(xEnd - xStart), Math.abs(zEnd - zStart));
                for (let i = 0; i <= steps; i += 1.4) {
                    const t = steps === 0 ? 0 : i / steps;
                    const cx = xStart + (xEnd - xStart) * t;
                    const cz = zStart + (zEnd - zStart) * t;
                    const col = (Math.floor(i) % 2 === 0) ? 0xd6d3d1 : 0xa8a29e;
                    createVoxel(width, 0.25, 1.2, col, cx, 1.02, cz, roadGroup);
                }
            }

            // 左侧主街南北通道 (x = -9.5)
            layCobblePath(-9.5, -14, -9.5, 24, 3.6);
            // 右侧主街南北通道 (x = 9.5)
            layCobblePath(9.5, -14, 9.5, 24, 3.6);
            // 连接各店铺的支路
            layCobblePath(-17, -6, -9.5, -6, 2.8);
            layCobblePath(-17, 7, -9.5, 7, 2.8);
            layCobblePath(-15, 19, -9.5, 19, 2.8);
            layCobblePath(9.5, -7, 17, -7, 2.8);
            layCobblePath(9.5, 7, 17, 7, 2.8);
            layCobblePath(9.5, 19, 15, 19, 2.8);

            // 中央猫咪跨河拱桥 (z = 2, x 从 -5 到 5)
            const bridgeGroup = new THREE.Group();
            bridgeGroup.position.set(0, 0, 2);
            roadGroup.add(bridgeGroup);

            for (let bx = -5; bx <= 5; bx += 1) {
                const archY = 1.15 + Math.cos((bx / 5.5) * (Math.PI / 2)) * 1.65;
                // 桥面木板
                createVoxel(0.95, 0.35, 5.2, 0xb45309, bx, archY, 0, bridgeGroup).userData.townBridgeDeck=true;
                // 两侧朱红栏杆立柱
                if (Math.abs(bx) % 2 === 0) {
                    createVoxel(0.35, 1.3, 0.35, 0xdc2626, bx, archY + 0.7, -2.4, bridgeGroup);
                    createVoxel(0.35, 1.3, 0.35, 0xdc2626, bx, archY + 0.7, 2.4, bridgeGroup);
                    // 柱顶金色猫耳装饰球
                    createVoxel(0.45, 0.35, 0.45, 0xfbbf24, bx, archY + 1.4, -2.4, bridgeGroup);
                    createVoxel(0.45, 0.35, 0.45, 0xfbbf24, bx, archY + 1.4, 2.4, bridgeGroup);
                }
                // 栏杆扶手
                createVoxel(1.05, 0.22, 0.22, 0xef4444, bx, archY + 1.05, -2.4, bridgeGroup);
                createVoxel(1.05, 0.22, 0.22, 0xef4444, bx, archY + 1.05, 2.4, bridgeGroup);
            }

            // 南侧河面踏脚石桥 (z = 16, x 从 -3.5 到 3.5)
            for (let sx = -3; sx <= 3; sx += 1.5) {
                createVoxel(1.1, 0.8, 1.3, 0xe2e8f0, sx, 0.2, 16 + (sx % 2) * 0.2, roadGroup);
            }

            // 左侧黄金猫咪纪念喷泉小广场 (x = -9.5, z = 2)
            const plazaGroup = new THREE.Group();
            plazaGroup.position.set(-9.5, 1.0, 2);
            roadGroup.add(plazaGroup);
            createVoxel(7.5, 0.3, 7.5, 0xe7e5e4, 0, 0.05, 0, plazaGroup);
            // 喷泉池座
            createVoxel(3.8, 0.9, 3.8, 0xa8a29e, 0, 0.45, 0, plazaGroup);
            createVoxel(3.1, 0.7, 3.1, 0x38bdf8, 0, 0.65, 0, plazaGroup, { transparent: true, opacity: 0.85 });
            // 黄金招财猫雕像
            createVoxel(1.3, 1.5, 1.3, 0xfbbf24, 0, 1.4, 0, plazaGroup, { metalness: 0.4, roughness: 0.3 });
            createVoxel(1.1, 1.0, 1.1, 0xfbbf24, 0, 2.4, 0, plazaGroup, { metalness: 0.4, roughness: 0.3 });
            // 雕像猫耳
            createVoxel(0.35, 0.45, 0.35, 0xf59e0b, -0.35, 3.05, 0, plazaGroup);
            createVoxel(0.35, 0.45, 0.35, 0xf59e0b, 0.35, 3.05, 0, plazaGroup);
            // 举起的招财右爪
            createVoxel(0.35, 0.8, 0.35, 0xfde047, 0.7, 2.2, 0.3, plazaGroup);

            // 注册石板路、跨河拱桥与喷泉广场的高空落下组装与遮挡检测
            registerSkyDrop(roadGroup, 0.26, 0.58, 36, false);
            registerSkyDrop(bridgeGroup, 0.52, 0.65, 42, true);
            registerSkyDrop(plazaGroup, 0.62, 0.65, 40, true);
            registerOccludableStructure(bridgeGroup, false, { perMesh: true });
            registerOccludableStructure(plazaGroup, false, { perMesh: true });
        }

        // ==========================================
        // 5. 构建小镇核心商业建筑群（体素精细建模）
        // ==========================================
        // 辅助函数：创建发光温暖窗户
        function createWarmWindow(w, h, d, x, y, z, parent) {
            const winMat = getVoxelMat(0xfef08a, {
                emissive: 0xf59e0b,
                emissiveIntensity: 0.95,
                roughness: 0.2
            });
            windowMaterials.push(winMat);
            const mesh = new THREE.Mesh(unitBoxGeo, winMat);
            mesh.scale.set(w, h, d);
            mesh.position.set(x, y, z);
            parent.add(mesh);
            // 窗框
            createVoxel(w + 0.2, 0.2, d + 0.1, 0x451a03, x, y + h / 2, z, parent);
            createVoxel(w + 0.2, 0.2, d + 0.1, 0x451a03, x, y - h / 2, z, parent);
        }

        // 辅助函数：创建屋顶猫耳造型装饰
        function addCatEarsOnRoof(x, y, z, colorHex, innerColorHex, parent, scale = 1) {
            const earGroup = new THREE.Group();
            earGroup.position.set(x, y, z);
            earGroup.scale.set(scale, scale, scale);
            parent.add(earGroup);

            // 左耳与右耳阶梯体素
            [-1.6, 1.6].forEach(offsetX => {
                createVoxel(1.4, 0.8, 0.8, colorHex, offsetX, 0.4, 0, earGroup);
                createVoxel(1.0, 0.8, 0.7, colorHex, offsetX, 1.1, 0, earGroup);
                createVoxel(0.6, 0.6, 0.6, colorHex, offsetX, 1.7, 0, earGroup);
                // 粉色内耳窝
                createVoxel(0.7, 0.7, 0.85, innerColorHex, offsetX, 0.85, 0.05, earGroup);
            });
        }

        function buildTownBuildings() {
            const buildingsGroup = new THREE.Group();
            scene.add(buildingsGroup);

            // ----------------------------------------------------
            // 建筑 1：【喵鲜鱼铺】(Fresh Fish Market) - 河岸左上 (-18.5, 1, -7)
            // ----------------------------------------------------
            const fishShop = new THREE.Group();
            fishShop.position.set(-18.5, 1, -7);
            buildingsGroup.add(fishShop);

            // 地基与木质主体
            createVoxel(9.5, 0.6, 8.5, 0x78716c, 0, 0.3, 0, fishShop);
            createVoxel(8.6, 6.2, 7.6, 0xfef3c7, 0, 3.6, 0, fishShop);
            // 海洋蓝木质护墙板
            createVoxel(8.8, 2.2, 7.8, 0x0284c7, 0, 1.6, 0, fishShop);
            // 阶梯海蓝色瓦片屋顶
            for (let i = 0; i < 5; i++) {
                createVoxel(9.8 - i * 1.4, 0.75, 8.8 - i * 1.2, i % 2 === 0 ? 0x0369a1 : 0x0284c7, 0, 7.0 + i * 0.7, 0, fishShop);
            }
            // 屋顶巨型立体体素鲷鱼招牌
            const bigFishSign = new THREE.Group();
            bigFishSign.position.set(1.2, 11.2, 1.5);
            fishShop.add(bigFishSign);
            createVoxel(3.2, 1.8, 0.9, 0x38bdf8, 0, 0, 0, bigFishSign);
            createVoxel(1.2, 2.2, 0.7, 0x0284c7, -2.0, 0, 0, bigFishSign); // 鱼尾
            createVoxel(0.4, 0.4, 1.05, 0x0f172a, 0.9, 0.3, 0, bigFishSign); // 鱼眼
            // 门前蓝白条纹遮阳篷（面向东侧主街 +X）
            for (let strip = -3.2; strip <= 3.2; strip += 1.05) {
                const col = Math.round(strip) % 2 === 0 ? 0x38bdf8 : 0xffffff;
                createVoxel(2.2, 0.4, 0.95, col, 4.9, 4.3, strip, fishShop);
            }
            // 冰鲜鱼摊位与小鱼干架
            createVoxel(1.8, 1.3, 5.2, 0x93c5fd, 5.1, 0.9, 0, fishShop);
            createVoxel(0.9, 0.35, 1.2, 0xf97316, 5.2, 1.65, -1.2, fishShop); // 三文鱼片
            createVoxel(0.9, 0.35, 1.2, 0x38bdf8, 5.2, 1.65, 0.8, fishShop);  // 鲜鲭鱼
            // 窗户
            createWarmWindow(0.3, 2.2, 2.6, 4.32, 3.6, -1.8, fishShop);
            createWarmWindow(0.3, 2.2, 2.6, 4.32, 3.6, 1.8, fishShop);
            createWarmWindow(2.8, 2.0, 0.3, 0, 4.2, 3.82, fishShop);

            // ----------------------------------------------------
            // 建筑 2：【肉垫烘焙坊】(Cat Paw Bakery) - 主街左下 (-19, 1, 7.5)
            // ----------------------------------------------------
            const bakery = new THREE.Group();
            bakery.position.set(-19, 1, 7.5);
            buildingsGroup.add(bakery);

            // 奶油色主体与焦糖木柱
            createVoxel(9.5, 0.6, 9.0, 0xa8a29e, 0, 0.3, 0, bakery);
            createVoxel(8.6, 6.5, 8.0, 0xfffbeb, 0, 3.8, 0, bakery);
            createVoxel(8.8, 1.8, 8.2, 0xd97706, 0, 1.4, 0, bakery);
            // 草莓粉焦糖波浪屋顶
            for (let i = 0; i < 5; i++) {
                createVoxel(10.0 - i * 1.5, 0.8, 9.2 - i * 1.3, i % 2 === 0 ? 0xf472b6 : 0xfb7185, 0, 7.3 + i * 0.75, 0, bakery);
            }
            addCatEarsOnRoof(2.2, 10.6, 0, 0xf472b6, 0xfef08a, bakery, 1.1);
            // 砖砌面包烤炉烟囱（带动态炊烟点位）
            createVoxel(1.6, 5.5, 1.6, 0xb45309, -2.5, 9.8, -2.0, bakery);
            // 粉白遮阳篷与户外牛角包甜点展示台
            for (let strip = -3.2; strip <= 3.2; strip += 1.05) {
                const col = Math.round(strip) % 2 === 0 ? 0xfb7185 : 0xfff1f2;
                createVoxel(2.2, 0.4, 0.95, col, 4.9, 4.4, strip, bakery);
            }
            createVoxel(1.6, 1.4, 4.5, 0x78350f, 5.1, 1.0, -0.5, bakery);
            // 金色猫爪吐司模型
            createVoxel(0.8, 0.7, 0.8, 0xf59e0b, 5.1, 1.9, -1.5, bakery);
            createVoxel(0.8, 0.7, 0.8, 0xfbbf24, 5.1, 1.9, 0.2, bakery);
            createWarmWindow(0.3, 2.4, 3.4, 4.32, 3.6, 0, bakery);
            createWarmWindow(3.0, 2.2, 0.3, 0, 4.0, 4.02, bakery);

            // ----------------------------------------------------
            // 建筑 3：【深夜喵拉面馆】(Meow Ramen) - 街角南侧 (-16.5, 1, 19.5)
            // ----------------------------------------------------
            const ramenShop = new THREE.Group();
            ramenShop.position.set(-16.5, 1, 19.5);
            buildingsGroup.add(ramenShop);

            // 传统日式深色木屋主体
            createVoxel(8.2, 0.6, 7.6, 0x57534e, 0, 0.3, 0, ramenShop);
            createVoxel(7.4, 5.8, 6.8, 0x451a03, 0, 3.4, 0, ramenShop);
            createVoxel(7.0, 5.4, 6.4, 0xfef3c7, 0, 3.4, 0, ramenShop);
            // 飞檐黛瓦屋顶
            for (let i = 0; i < 4; i++) {
                createVoxel(9.2 - i * 1.4, 0.7, 8.6 - i * 1.3, 0x1e293b, 0, 6.5 + i * 0.65, 0, ramenShop);
            }
            // 屋顶大号拉面碗立体模型
            createVoxel(2.6, 1.4, 2.6, 0xdc2626, 0.8, 9.5, 0, ramenShop);
            createVoxel(2.2, 0.4, 2.2, 0xfef08a, 0.8, 10.3, 0, ramenShop); // 面汤
            createVoxel(0.25, 2.4, 0.25, 0xd97706, 1.5, 11.1, 0, ramenShop); // 筷子
            // 门前红色暖帘 (Noren) 与拉面吧台高脚凳
            for (let nz = -2.2; nz <= 2.2; nz += 1.1) {
                createVoxel(0.2, 1.5, 0.85, 0xdc2626, 4.2, 4.2, nz, ramenShop);
            }
            // 食客木质吧台与三张小圆凳
            createVoxel(1.4, 1.3, 5.2, 0xb45309, 4.5, 0.95, 0, ramenShop);
            [-1.6, 0, 1.6].forEach(sz => {
                createVoxel(0.8, 0.8, 0.8, 0x78350f, 5.8, 0.7, sz, ramenShop);
            });
            createWarmWindow(0.3, 2.2, 4.2, 3.72, 3.2, 0, ramenShop);

            // ----------------------------------------------------
            // 建筑 4：【樱花猫咪咖啡馆】(Sakura Cat Cafe) - 右岛北侧 (18.5, 1, -7.5)
            // ----------------------------------------------------
            const catCafe = new THREE.Group();
            catCafe.position.set(18.5, 1, -7.5);
            buildingsGroup.add(catCafe);

            // 一层抹茶绿与薄荷奶油墙体
            createVoxel(10.0, 0.6, 9.2, 0x78716c, 0, 0.3, 0, catCafe);
            createVoxel(9.0, 5.6, 8.2, 0xecfdf5, 0, 3.3, 0, catCafe);
            createVoxel(9.2, 1.8, 8.4, 0x10b981, 0, 1.4, 0, catCafe);
            // 二层阳光露台与阁楼
            createVoxel(9.6, 0.5, 8.8, 0xd97706, 0, 6.2, 0, catCafe);
            createVoxel(5.6, 4.2, 5.6, 0xfef2f2, 1.2, 8.5, 0, catCafe);
            // 阁楼珊瑚粉尖顶与猫耳
            for (let i = 0; i < 4; i++) {
                createVoxel(6.8 - i * 1.3, 0.7, 6.8 - i * 1.3, 0xfb7185, 1.2, 10.9 + i * 0.65, 0, catCafe);
            }
            addCatEarsOnRoof(1.2, 13.4, 0, 0xfb7185, 0xfff1f2, catCafe, 1.15);
            // 咖啡馆前庭阳伞桌椅（西侧朝向溪流 -X）
            [-2.4, 2.4].forEach(tz => {
                // 小圆桌
                createVoxel(1.6, 1.1, 1.6, 0xfef3c7, -6.2, 0.85, tz, catCafe);
                // 遮阳伞柱与伞面
                createVoxel(0.25, 2.8, 0.25, 0x78350f, -6.2, 2.2, tz, catCafe);
                createVoxel(2.8, 0.4, 2.8, tz < 0 ? 0xf43f5e : 0x10b981, -6.2, 3.6, tz, catCafe);
                createVoxel(2.0, 0.4, 2.0, 0xffffff, -6.2, 3.9, tz, catCafe);
            });
            createWarmWindow(0.3, 2.6, 4.8, -4.52, 3.5, 0, catCafe);
            createWarmWindow(0.3, 2.0, 3.0, -1.62, 8.5, 0, catCafe);

            // ----------------------------------------------------
            // 建筑 5：【魔法毛线杂货铺】(Yarn & Toy Atelier) - 右岛中南 (18.5, 1, 7.5)
            // ----------------------------------------------------
            const yarnShop = new THREE.Group();
            yarnShop.position.set(18.5, 1, 7.5);
            buildingsGroup.add(yarnShop);

            createVoxel(8.6, 0.6, 8.2, 0x78716c, 0, 0.3, 0, yarnShop);
            createVoxel(7.6, 6.0, 7.2, 0xf5f3ff, 0, 3.5, 0, yarnShop);
            createVoxel(7.8, 1.8, 7.4, 0x7c3aed, 0, 1.4, 0, yarnShop);
            // 梦幻紫罗兰阶梯屋顶
            for (let i = 0; i < 5; i++) {
                createVoxel(8.8 - i * 1.4, 0.75, 8.4 - i * 1.3, i % 2 === 0 ? 0x8b5cf6 : 0xa78bfa, 0, 6.8 + i * 0.7, 0, yarnShop);
            }
            // 屋顶巨型彩色毛线球装饰
            createVoxel(2.4, 2.4, 2.4, 0xf43f5e, -0.5, 11.2, 0.5, yarnShop);
            createVoxel(2.6, 1.6, 1.6, 0xfb7185, -0.5, 11.2, 0.5, yarnShop);
            createVoxel(0.25, 3.2, 0.25, 0xfde047, 0.2, 12.0, 0.5, yarnShop); // 毛线针
            createWarmWindow(0.3, 2.4, 4.0, -3.82, 3.6, 0, yarnShop);

            // ----------------------------------------------------
            // 建筑 6：【喵喵钟楼与大风车】(Windmill & Clock Tower) - 左崖顶 (-21, 14, -25)
            // ----------------------------------------------------
            const windmillTower = new THREE.Group();
            windmillTower.position.set(-21, 14, -25);
            buildingsGroup.add(windmillTower);

            createVoxel(7.5, 11, 7.5, 0xfef3c7, 0, 5.5, 0, windmillTower);
            createVoxel(8.0, 2.5, 8.0, 0x78350f, 0, 1.25, 0, windmillTower);
            for (let i = 0; i < 5; i++) {
                createVoxel(8.6 - i * 1.4, 0.9, 8.6 - i * 1.4, 0xd97706, 0, 11.4 + i * 0.8, 0, windmillTower);
            }
            addCatEarsOnRoof(0, 15.2, 0, 0xd97706, 0xfef08a, windmillTower, 1.2);
            createWarmWindow(2.4, 2.4, 0.3, 0, 6.5, 3.78, windmillTower);

            // 旋转风车叶片组件
            windmillBlades = new THREE.Group();
            windmillBlades.position.set(0, 9.2, 4.2);
            windmillTower.add(windmillBlades);
            createVoxel(1.2, 1.2, 1.2, 0x451a03, 0, 0, 0, windmillBlades);
            for (let b = 0; b < 4; b++) {
                const bladeArm = new THREE.Group();
                bladeArm.rotation.z = (Math.PI / 2) * b;
                createVoxel(0.4, 7.5, 0.3, 0x78350f, 0, 4.0, 0, bladeArm);
                createVoxel(1.8, 5.5, 0.15, 0xfef9c3, 0.9, 4.6, 0.1, bladeArm);
                windmillBlades.add(bladeArm);
            }

            // ----------------------------------------------------
            // 建筑 7：【崖顶猫神社与观景凉亭】(Cliffside Cat Shrine) - 右崖顶 (19, 14, -25)
            // ----------------------------------------------------
            const shrine = new THREE.Group();
            shrine.position.set(19, 14, -25);
            buildingsGroup.add(shrine);

            createVoxel(8.5, 1.0, 8.5, 0xd6d3d1, 0, 0.5, 0, shrine);
            // 四根朱红亭柱
            [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]].forEach(([px, pz]) => {
                createVoxel(0.7, 5.2, 0.7, 0xdc2626, px, 3.1, pz, shrine);
            });
            for (let i = 0; i < 4; i++) {
                createVoxel(10.0 - i * 1.8, 0.75, 10.0 - i * 1.8, 0x991b1b, 0, 5.8 + i * 0.7, 0, shrine);
            }
            addCatEarsOnRoof(0, 8.6, 0, 0xdc2626, 0xfbbf24, shrine, 1.1);
            // 崖边朱红鸟居 (Torii Gate)
            const torii = new THREE.Group();
            torii.position.set(-7.5, 14, -19.5);
            buildingsGroup.add(torii);
            createVoxel(0.65, 5.5, 0.65, 0xdc2626, -2.2, 2.75, 0, torii);
            createVoxel(0.65, 5.5, 0.65, 0xdc2626, 2.2, 2.75, 0, torii);
            createVoxel(6.4, 0.6, 0.85, 0xdc2626, 0, 5.4, 0, torii);
            createVoxel(7.2, 0.45, 1.0, 0x1e293b, 0, 5.85, 0, torii);
            createVoxel(5.2, 0.45, 0.6, 0xdc2626, 0, 4.2, 0, torii);

            // ----------------------------------------------------
            // 建筑 8：【溪畔旋转水车】(Riverside Waterwheel) - 瀑布下游 (-3.8, 1.6, -12)
            // ----------------------------------------------------
            waterwheelMesh = new THREE.Group();
            waterwheelMesh.position.set(-3.4, 1.6, -12);
            buildingsGroup.add(waterwheelMesh);
            createVoxel(0.8, 0.8, 0.8, 0x451a03, 0, 0, 0, waterwheelMesh);
            for (let w = 0; w < 8; w++) {
                const spoke = new THREE.Group();
                spoke.rotation.x = (Math.PI / 4) * w;
                createVoxel(0.3, 5.2, 0.3, 0x78350f, 0, 0, 0, spoke);
                createVoxel(0.9, 0.35, 1.1, 0xb45309, 0.2, 2.5, 0, spoke);
                waterwheelMesh.add(spoke);
            }

            // 第三阶段（0.75s - 1.65s）：各大商业建筑逐栋从高空落下Q弹组装，并注册动态半透明遮挡与镜头碰撞
            const allMajorBuildings = [fishShop, bakery, ramenShop, catCafe, yarnShop, windmillTower, shrine, torii, waterwheelMesh];
            allMajorBuildings.forEach((bGroup, idx) => {
                registerSkyDrop(bGroup, 0.75 + idx * 0.09, 0.72, 48, true);
                registerOccludableStructure(bGroup, true, { dynamic: bGroup === waterwheelMesh || bGroup === windmillTower });
            });
        }

        // ==========================================
        // 6. 构建植物群落（樱花树、青松、五彩体素地面小花簇）与暖色街灯
        // ==========================================
        function buildFloraAndLanterns() {
            const envGroup = new THREE.Group();
            scene.add(envGroup);

            // 樱花树生成函数
            function createSakuraTree(x, y, z, scale = 1.0, delayIdx = 0) {
                const tree = new THREE.Group();
                tree.position.set(x, y, z);
                tree.scale.set(scale, scale, scale);
                envGroup.add(tree);

                createVoxel(1.1, 4.2, 1.1, 0x5c4033, 0, 2.1, 0, tree);
                createVoxel(0.7, 2.2, 0.7, 0x5c4033, 0.6, 3.8, 0.4, tree);
                // 多层梦幻粉色树冠
                createVoxel(4.6, 2.2, 4.6, 0xf9a8d4, 0, 4.8, 0, tree);
                createVoxel(3.8, 2.0, 3.8, 0xf472b6, 0.5, 6.0, 0.4, tree);
                createVoxel(3.2, 1.8, 3.2, 0xfbcfe8, -0.6, 6.4, -0.4, tree);
                createVoxel(2.2, 1.2, 2.2, 0xfff1f2, 0, 7.2, 0, tree);

                registerSkyDrop(tree, 1.35 + delayIdx * 0.045, 0.62, 40, true);
                registerOccludableStructure(tree, false);
            }

            // 翠绿松树生成函数
            function createPineTree(x, y, z, scale = 1.0, delayIdx = 0) {
                const pine = new THREE.Group();
                pine.position.set(x, y, z);
                pine.scale.set(scale, scale, scale);
                envGroup.add(pine);

                createVoxel(0.9, 3.0, 0.9, 0x451a03, 0, 1.5, 0, pine);
                createVoxel(3.8, 1.8, 3.8, 0x15803d, 0, 3.2, 0, pine);
                createVoxel(3.0, 1.8, 3.0, 0x16a34a, 0, 4.6, 0, pine);
                createVoxel(2.0, 1.6, 2.0, 0x22c55e, 0, 5.9, 0, pine);
                createVoxel(1.0, 1.2, 1.0, 0x4ade80, 0, 6.9, 0, pine);

                registerSkyDrop(pine, 1.42 + delayIdx * 0.045, 0.62, 40, true);
                registerOccludableStructure(pine, false);
            }

            // 种植樱花树与松树
            const sakuraCoords = [
                [-6.5, 1, -13], [7.2, 1, -13], [-27, 1, 0], [27, 1, -1],
                [14, 1, 18], [-26, 1, 16], [8, 14, -22], [-11, 14, -22],
                [26, 1, -15], [-26, 1, -15]
            ];
            sakuraCoords.forEach(([x, y, z], idx) => createSakuraTree(x, y, z, 0.85 + (idx % 3) * 0.18, idx));

            const pineCoords = [
                [-30, 14, -28], [-13, 14, -30], [11, 14, -30], [29, 14, -27],
                [-29, 1, -20], [29, 1, 14], [-28, 1, 24], [27, 1, 24]
            ];
            pineCoords.forEach(([x, y, z], idx) => createPineTree(x, y, z, 0.9 + (idx % 3) * 0.2, idx));

            // ----------------------------------------------------
            // 重点新增：地面上丰富的五彩体素小花簇与草丛 (Voxel Flowers & Grass Clusters)
            // ----------------------------------------------------
            const flowerPalettes = [
                { petal: 0xf472b6, center: 0xfef08a }, // 樱花粉
                { petal: 0xfacc15, center: 0xf97316 }, // 向日葵柠檬黄
                { petal: 0x38bdf8, center: 0xffffff }, // 勿忘我天空蓝
                { petal: 0xc084fc, center: 0xfef08a }, // 薰衣草紫
                { petal: 0xfb7185, center: 0xfff1f2 }, // 珊瑚红郁金香
                { petal: 0xffffff, center: 0xfbbf24 }  // 雏菊纯白
            ];

            function createVoxelFlowerCluster(x, y, z, delayIdx) {
                const cluster = new THREE.Group();
                cluster.position.set(x, y, z);
                envGroup.add(cluster);

                // 底层深浅不一的体素小草叶底座
                const grassCol = delayIdx % 2 === 0 ? 0x4ade80 : 0x22c55e;
                createVoxel(0.75, 0.22, 0.75, grassCol, 0, 0.11, 0, cluster, {}, false, true);
                createVoxel(0.22, 0.45, 0.22, 0x16a34a, -0.25, 0.25, 0.2, cluster, {}, false, true);
                createVoxel(0.2, 0.38, 0.2, 0x15803d, 0.25, 0.2, -0.2, cluster, {}, false, true);

                // 每个花簇包含 2~3 朵高低错落的立体体素小花
                const flowerCount = 2 + (delayIdx % 2);
                for (let f = 0; f < flowerCount; f++) {
                    const palette = flowerPalettes[(delayIdx + f) % flowerPalettes.length];
                    const fx = (f === 0) ? -0.18 : (f === 1 ? 0.2 : 0.0);
                    const fz = (f === 0) ? -0.15 : (f === 1 ? 0.16 : -0.22);
                    const stemH = 0.42 + (f * 0.14);

                    // 翠绿花茎
                    createVoxel(0.12, stemH, 0.12, 0x16a34a, fx, stemH / 2 + 0.1, fz, cluster, {}, false, true);
                    // 十字立体花瓣或郁金香杯状花冠
                    createVoxel(0.38, 0.14, 0.22, palette.petal, fx, stemH + 0.16, fz, cluster, {}, false, true);
                    createVoxel(0.22, 0.14, 0.38, palette.petal, fx, stemH + 0.16, fz, cluster, {}, false, true);
                    // 花蕊
                    createVoxel(0.16, 0.18, 0.16, palette.center, fx, stemH + 0.2, fz, cluster, {}, false, true);
                }

                cluster.userData = {
                    swayPhase: Math.random() * Math.PI * 2,
                    swaySpeed: 1.8 + Math.random() * 1.4
                };
                flowerClusters.push(cluster);

                // 第四阶段（1.45s - 2.15s）：五彩小花像雨点一样轻快落下生长
                registerSkyDrop(cluster, 1.45 + (delayIdx % 35) * 0.02, 0.52, 26, true);
            }

            // 检查坐标是否避开河道、石板主路和建筑底座，使小花自然分布在草坪、河岸、树下与小径旁
            function isValidFlowerSpot(x, z) {
                // 避开中央溪流 (-4.4 ~ 4.4)
                if (Math.abs(x) < 4.5) return false;
                // 避开东西两条南北向主石板路 (-11.3 ~ -7.7, 7.7 ~ 11.3)
                if (Math.abs(x - (-9.5)) < 2.1 || Math.abs(x - 9.5) < 2.1) return false;
                // 避开主要建筑占地包围盒
                const buildingBoxes = [
                    { x: -18.5, z: -7, rx: 6.0, rz: 5.2 },  // 鲜鱼铺
                    { x: -19.0, z: 7.5, rx: 6.0, rz: 5.5 }, // 烘焙坊
                    { x: -16.5, z: 19.5, rx: 5.5, rz: 5.0 },// 拉面馆
                    { x: -9.5,  z: 2.0, rx: 4.5, rz: 4.5 }, // 喷泉广场
                    { x: 18.5,  z: -7.5, rx: 6.5, rz: 5.5 },// 猫咖
                    { x: 18.5,  z: 7.5, rx: 5.5, rz: 5.2 }  // 毛线铺
                ];
                for (let b of buildingBoxes) {
                    if (Math.abs(x - b.x) < b.rx && Math.abs(z - b.z) < b.rz) return false;
                }
                return true;
            }

            // 1) 在河岸两侧、石板路边缘和精选景点周围固定生成精致花带
            const curatedFlowerSpots = [
                [-5.2, 1, -11], [-5.5, 1, -7], [-5.2, 1, -2.5], [-5.5, 1, 6.5], [-5.2, 1, 11.5], [-5.5, 1, 19.5],
                [5.2, 1, -11],  [5.5, 1, -7],  [5.2, 1, -2.5],  [5.5, 1, 6.5],  [5.2, 1, 11.5],  [5.5, 1, 19.5],
                [-12.8, 1, -2], [-12.8, 1, 13], [12.5, 1, -2],  [12.5, 1, 13],
                [8.5, 1, 17.5], [13.5, 1, 21.5], [16.5, 1, 16.5], [-24.5, 1, 1.5], [24.5, 1, 1.5],
                // 崖顶花园小花
                [-12, 14, -20], [-8, 14, -23], [9, 14, -20], [13, 14, -23]
            ];
            let flowerIdx = 0;
            curatedFlowerSpots.forEach(([fx, fy, fz]) => {
                createVoxelFlowerCluster(fx, fy, fz, flowerIdx++);
            });

            // 2) 在左右两岛绿茵草地上自然随机散布 95 簇五彩小花与草丛
            let seed = 42;
            function pseudoRand() {
                seed = (seed * 1664525 + 1013904223) % 4294967296;
                return seed / 4294967296;
            }
            for (let i = 0; i < 135; i++) {
                const isLeft = pseudoRand() > 0.48;
                const rx = isLeft ? (-4.8 - pseudoRand() * 28.5) : (4.8 + pseudoRand() * 28.5);
                const rz = -15.5 + pseudoRand() * 44.5;
                if (isValidFlowerSpot(rx, rz)) {
                    createVoxelFlowerCluster(rx, 1.0, rz, flowerIdx++);
                }
            }

            // 暖色日式街灯生成函数
            function createStreetLantern(x, y, z, attachPointLight = false, idx = 0) {
                const lamp = new THREE.Group();
                lamp.position.set(x, y, z);
                envGroup.add(lamp);

                createVoxel(0.6, 0.5, 0.6, 0x57534e, 0, 0.25, 0, lamp);
                createVoxel(0.28, 3.4, 0.28, 0x292524, 0, 1.9, 0, lamp);
                createVoxel(1.2, 0.25, 0.28, 0x292524, 0.4, 3.5, 0, lamp);
                // 暖光灯笼芯
                const lanternMat = getVoxelMat(0xfef08a, {
                    emissive: 0xf97316,
                    emissiveIntensity: 1.4
                });
                const core = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.65), lanternMat);
                core.position.set(0.8, 3.0, 0);
                lamp.add(core);
                createVoxel(0.9, 0.2, 0.9, 0x1e293b, 0.8, 3.5, 0, lamp);

                if (attachPointLight) {
                    const pLight = new THREE.PointLight(0xff9e44, 1.1, 18, 1.8);
                    pLight.position.set(x + 0.8, y + 3.0, z);
                    scene.add(pLight);
                    lampPointLights.push(pLight);
                }

                registerSkyDrop(lamp, 1.25 + idx * 0.04, 0.58, 34, true);
                registerOccludableStructure(lamp, false); // 街灯贴近镜头时也能 X-Ray 透视
            }

            const lampCoords = [
                [-6.8, 1, -4, true], [-6.8, 1, 9, true], [-12.5, 1, 15, false],
                [6.8, 1, -4, true], [6.8, 1, 9, true], [12.5, 1, 15, false],
                [-5.5, 1, 2, false], [5.5, 1, 2, false]
            ];
            lampCoords.forEach(([x, y, z, hasLight], idx) => createStreetLantern(x, y, z, hasLight, idx));

            // 飘落的樱花花瓣粒子 (Sakura Petals)
            const petalGeo = new THREE.BoxGeometry(0.28, 0.08, 0.28);
            const petalMat = getVoxelMat(0xfbcfe8, { emissive: 0xf472b6, emissiveIntensity: 0.3 });
            for (let i = 0; i < 85; i++) {
                const petal = new THREE.Mesh(petalGeo, petalMat);
                petal.position.set(
                    (Math.random() - 0.5) * 62,
                    2 + Math.random() * 24,
                    (Math.random() - 0.5) * 56
                );
                petal.userData = {
                    speedY: 1.2 + Math.random() * 1.2,
                    swaySpeed: 1.5 + Math.random() * 2.0,
                    phase: Math.random() * Math.PI * 2
                };
                scene.add(petal);
                sakuraPetals.push(petal);
            }

            // 烘焙坊烟囱袅袅炊烟 (Smoke Puffs)
            const smokeGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
            for (let i = 0; i < 10; i++) {
                const sMat = getVoxelMat(0xf8fafc, { transparent: true, opacity: 0.65 });
                const puff = new THREE.Mesh(smokeGeo, sMat.clone());
                puff.userData = { progress: i / 10 };
                scene.add(puff);
                smokePuffs.push(puff);
            }

            // 空中缓缓解锁漂浮的祈福孔明灯
            for (let i = 0; i < 12; i++) {
                const lGroup = new THREE.Group();
                createVoxel(0.7, 0.95, 0.7, 0xfef08a, 0, 0, 0, lGroup, { emissive: 0xf97316, emissiveIntensity: 1.2 });
                lGroup.position.set(
                    (Math.random() - 0.5) * 58,
                    12 + Math.random() * 22,
                    -25 + Math.random() * 50
                );
                lGroup.userData = {
                    baseY: lGroup.position.y,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.6 + Math.random() * 0.6
                };
                scene.add(lGroup);
                floatingLanterns.push(lGroup);
            }
        }

        // ==========================================
        // 7. 猫咪小镇导航路网与 12 只特色体素猫咪系统
        // ==========================================
        const townWaypoints = {
            plazaWest:   { x: -9.5, y: 1.0, z: 2.0,  name: '招财猫喷泉广场' },
            bridgeWest:  { x: -5.2, y: 1.0, z: 2.0,  name: '朱红拱桥西口' },
            bridgePeak:  { x: 0.0,  y: 2.8, z: 2.0,  name: '跨河拱桥中央' },
            bridgeEast:  { x: 5.2,  y: 1.0, z: 2.0,  name: '朱红拱桥东口' },
            fishShop:    { x: -11.8,y: 1.0, z: -7.0, name: '喵鲜鱼铺摊前' },
            waterfallW:  { x: -6.5, y: 1.0, z: -13.5,name: '瀑布西侧观景岸' },
            bakery:      { x: -11.8,y: 1.0, z: 7.5,  name: '肉垫烘焙坊门前' },
            ramen:       { x: -10.2,y: 1.0, z: 18.5, name: '深夜喵拉面馆' },
            southWest:   { x: -5.2, y: 1.0, z: 16.0, name: '溪流踏脚石西岸' },
            steppingMid: { x: 0.0,  y: 0.8, z: 16.0, name: '溪流踏脚石中央' },
            southEast:   { x: 5.2,  y: 1.0, z: 16.0, name: '溪流踏脚石东岸' },
            plazaEast:   { x: 9.5,  y: 1.0, z: 2.0,  name: '樱花东街路口' },
            catCafe:     { x: 10.5, y: 1.0, z: -7.5, name: '樱花猫咪咖啡馆' },
            waterfallE:  { x: 6.8,  y: 1.0, z: -13.5,name: '瀑布东侧垂钓台' },
            yarnShop:    { x: 11.8, y: 1.0, z: 7.5,  name: '魔法毛线杂货铺' },
            gardenSouth: { x: 11.0, y: 1.0, z: 19.0, name: '南岸樱花小花园' }
        };

        const waypointEdges = {
            plazaWest:   ['bridgeWest', 'fishShop', 'bakery', 'waterfallW'],
            bridgeWest:  ['plazaWest', 'bridgePeak'],
            bridgePeak:  ['bridgeWest', 'bridgeEast'],
            bridgeEast:  ['bridgePeak', 'plazaEast'],
            fishShop:    ['plazaWest', 'waterfallW'],
            waterfallW:  ['fishShop', 'plazaWest'],
            bakery:      ['plazaWest', 'ramen', 'southWest'],
            ramen:       ['bakery', 'southWest'],
            southWest:   ['bakery', 'ramen', 'steppingMid'],
            steppingMid: ['southWest', 'southEast'],
            southEast:   ['steppingMid', 'yarnShop', 'gardenSouth'],
            plazaEast:   ['bridgeEast', 'catCafe', 'yarnShop', 'waterfallE'],
            catCafe:     ['plazaEast', 'waterfallE'],
            waterfallE:  ['catCafe', 'plazaEast'],
            yarnShop:    ['plazaEast', 'southEast', 'gardenSouth'],
            gardenSouth: ['yarnShop', 'southEast']
        };

        // 12 只性格各异的猫咪档案
        const catProfiles = [
            { name: '橘座大叔', role: '拉面馆常客', coat: 0xf97316, accent: 0xffffff, ear: 0xfda4af, accessory: 'scarf_red', startNode: 'ramen', emoji: '🍜', thoughts: ['拉面汤头真香喵~', '再去鲜鱼店看看！', '吃饱喝足晒太阳~'] },
            { name: '糯米团子', role: '烘焙坊试吃员', coat: 0xffffff, accent: 0xfef08a, ear: 0xf9a8d4, accessory: 'chef_hat', startNode: 'bakery', emoji: '🥐', thoughts: ['刚出炉的猫爪吐司！', '身上都是奶油香~', '跑快点去桥上看风景！'] },
            { name: '煤球警长', role: '瀑布镇巡逻官', coat: 0x1e293b, accent: 0x334155, ear: 0xf43f5e, accessory: 'bell_gold', startNode: 'bridgePeak', emoji: '🐾', thoughts: ['今日小镇治安良好！', '谁偷吃了小鱼干？', '本警长眼神犀利！'] },
            { name: '三花小町', role: '猫咖看板娘', coat: 0xfffbeb, accent: 0xf97316, ear: 0xfb7185, accessory: 'ribbon_pink', startNode: 'catCafe', emoji: '🌸', thoughts: ['樱花落满屋顶啦~', '欢迎光临喵喵咖啡馆', '今天要拍美美的特写！'] },
            { name: '海盐船长', role: '鲜鱼铺品鉴师', coat: 0x64748b, accent: 0xf8fafc, ear: 0xfda4af, accessory: 'sailor_collar', startNode: 'fishShop', emoji: '🐟', thoughts: ['今天的秋刀鱼超新鲜！', '去瀑布边看锦鲤咯~', '海风的味道喵！'] },
            { name: '奶酪布丁', role: '追蝴蝶探险家', coat: 0xfbbf24, accent: 0xffffff, ear: 0xfda4af, accessory: 'scarf_blue', startNode: 'plazaWest', emoji: '🦋', thoughts: ['哇！快看那片花瓣！', '冲鸭！全速奔跑！', '在桥头歇一歇脚~'] },
            { name: '暹罗摩卡', role: '观瀑吟游诗人', coat: 0xfef3c7, accent: 0x451a03, ear: 0x451a03, accessory: 'bell_gold', startNode: 'waterfallE', emoji: '🌊', thoughts: ['瀑布的水声真治愈...', '灵感涌现喵！', '发呆是猫生的正经事'] },
            { name: '紫芋毛球', role: '毛线屋小帮手', coat: 0xc084fc, accent: 0xf5f3ff, ear: 0xf472b6, accessory: 'ribbon_pink', startNode: 'yarnShop', emoji: '🧶', thoughts: ['粉色毛线球最棒了！', '别把毛线团弄乱呀~', '伸个大大的懒腰！'] },
            { name: '抹茶大福', role: '樱花树睡神', coat: 0x86efac, accent: 0xffffff, ear: 0xfda4af, accessory: 'leaf_hat', startNode: 'gardenSouth', emoji: '🍵', thoughts: ['呼噜噜...再睡五分钟', '阳光暖洋洋的喵~', '梦里全是小鱼干！'] },
            { name: '虎斑闪电', role: '跨河跑酷选手', coat: 0xd97706, accent: 0x78350f, ear: 0xfda4af, accessory: 'scarf_red', startNode: 'steppingMid', emoji: '⚡', thoughts: ['看我飞跃踏脚石！', '小镇最快肉垫就是我', '风在耳边呼呼吹~'] },
            { name: '蜜桃甜心', role: '许愿喷泉守护者', coat: 0xfda4af, accent: 0xfff1f2, ear: 0xf43f5e, accessory: 'ribbon_pink', startNode: 'plazaEast', emoji: '💖', thoughts: ['向黄金招财猫许个愿~', '今天也是元气满满！', '跟好朋友打个招呼~'] },
            { name: '星空夜影', role: '夜灯守望喵', coat: 0x312e81, accent: 0xe0e7ff, ear: 0x818cf8, accessory: 'bell_gold', startNode: 'waterfallW', emoji: '✨', thoughts: ['水花里有彩虹的光！', '最喜欢黄昏的暖灯笼', '静静看着大家忙碌~'] }
        ];

        // 动作中文名映射
        const actionNamesMap = {
            WANDER: '悠闲漫步 (Walking)',
            RUN: '欢快奔跑 (Zoomies!)',
            ADMIRE: '驻足赏景 (Admiring View)',
            SNIFF_FLOWER: '轻嗅路边小花 (Sniffing Flowers)',
            NAP: '惬意打盹 (Catnap Zzz)',
            GROOM: '端坐舔爪 (Grooming)',
            PLAY: '扑蝶雀跃 (Playful Jump)'
        };

        // 创建精致可动画体素猫咪模型
        function createCatCharacter(profile, index) {
            const catRoot = new THREE.Group();
            const rig = new THREE.Group();
            rig.scale.set(0.88, 0.88, 0.88);
            catRoot.add(rig);

            // 1. 躯干 (BodyPivot)
            const bodyPivot = new THREE.Group();
            bodyPivot.position.set(0, 0.72, 0);
            rig.add(bodyPivot);

            createVoxel(0.82, 0.68, 1.35, profile.coat, 0, 0, 0, bodyPivot);
            // 胸前与肚皮雪白绒毛
            createVoxel(0.68, 0.52, 0.45, profile.accent, 0, -0.05, 0.52, bodyPivot);

            // 配饰系统
            if (profile.accessory === 'scarf_red' || profile.accessory === 'scarf_blue') {
                const sCol = profile.accessory === 'scarf_red' ? 0xef4444 : 0x38bdf8;
                createVoxel(0.9, 0.24, 0.45, sCol, 0, 0.15, 0.52, bodyPivot);
            } else if (profile.accessory === 'bell_gold') {
                createVoxel(0.88, 0.18, 0.35, 0xdc2626, 0, 0.12, 0.52, bodyPivot);
                createVoxel(0.26, 0.26, 0.26, 0xfbbf24, 0, -0.05, 0.72, bodyPivot);
            } else if (profile.accessory === 'sailor_collar') {
                createVoxel(0.92, 0.16, 0.55, 0x0284c7, 0, 0.22, 0.48, bodyPivot);
            }

            // 2. 头部 (HeadPivot)
            const headPivot = new THREE.Group();
            headPivot.position.set(0, 0.48, 0.58);
            bodyPivot.add(headPivot);

            createVoxel(0.96, 0.82, 0.88, profile.coat, 0, 0.22, 0, headPivot);
            // 脸颊花纹
            createVoxel(1.02, 0.32, 0.45, profile.accent, 0, 0.08, 0.1, headPivot);
            // 立体双耳
            [-0.32, 0.32].forEach(ex => {
                createVoxel(0.28, 0.36, 0.26, profile.coat, ex, 0.72, -0.05, headPivot);
                createVoxel(0.16, 0.22, 0.28, profile.ear, ex, 0.70, 0.02, headPivot);
            });
            // 明亮大眼睛与高光
            [-0.24, 0.24].forEach(eyeX => {
                createVoxel(0.18, 0.22, 0.1, 0x0f172a, eyeX, 0.24, 0.43, headPivot);
                createVoxel(0.07, 0.08, 0.12, 0xffffff, eyeX + 0.04, 0.28, 0.44, headPivot);
            });
            // 粉色小鼻头与胡须
            createVoxel(0.16, 0.11, 0.12, 0xfb7185, 0, 0.12, 0.46, headPivot);
            createVoxel(1.22, 0.04, 0.04, 0xffffff, 0, 0.10, 0.38, headPivot);

            // 头顶小配饰
            if (profile.accessory === 'chef_hat') {
                createVoxel(0.55, 0.45, 0.55, 0xffffff, 0, 0.82, 0, headPivot);
            } else if (profile.accessory === 'ribbon_pink') {
                createVoxel(0.38, 0.22, 0.22, 0xf43f5e, -0.32, 0.62, 0.15, headPivot);
            } else if (profile.accessory === 'leaf_hat') {
                createVoxel(0.48, 0.12, 0.48, 0x22c55e, 0, 0.68, 0, headPivot);
            }

            // 3. 四条可动小短腿 (Legs)
            const legs = [];
            const legPositions = [
                [-0.28, -0.32, 0.44],  // 左前 FL
                [0.28, -0.32, 0.44],   // 右前 FR
                [-0.28, -0.32, -0.44], // 左后 BL
                [0.28, -0.32, -0.44]   // 右后 BR
            ];
            legPositions.forEach(([lx, ly, lz]) => {
                const legPivot = new THREE.Group();
                legPivot.position.set(lx, ly, lz);
                createVoxel(0.24, 0.46, 0.24, profile.coat, 0, -0.18, 0, legPivot);
                createVoxel(0.25, 0.14, 0.28, profile.accent, 0, -0.36, 0.03, legPivot); // 白手套肉垫
                bodyPivot.add(legPivot);
                legs.push(legPivot);
            });

            // 4. 灵动高翘尾巴 (TailPivot)
            const tailPivot = new THREE.Group();
            tailPivot.position.set(0, 0.18, -0.66);
            bodyPivot.add(tailPivot);
            createVoxel(0.2, 0.2, 0.55, profile.coat, 0, 0.15, -0.22, tailPivot);
            createVoxel(0.18, 0.48, 0.18, profile.accent, 0, 0.42, -0.44, tailPivot);

            // 射线检测透明包围盒（方便玩家直接点击猫咪跟拍）
            const hitBox = new THREE.Mesh(
                new THREE.BoxGeometry(2.2, 2.2, 2.4),
                new THREE.MeshBasicMaterial({ visible: false })
            );
            hitBox.position.set(0, 1.0, 0);
            hitBox.userData = { catIndex: index };
            catRoot.add(hitBox);
            interactiveMeshes.push(hitBox);

            // 初始位置与导航状态
            const startWp = townWaypoints[profile.startNode];
            const neighbors = waypointEdges[profile.startNode];
            const nextNodeKey = neighbors[Math.floor(Math.random() * neighbors.length)];
            const nextWp = townWaypoints[nextNodeKey];

            catRoot.position.set(startWp.x, startWp.y, startWp.z);
            scene.add(catRoot);

            // 第五阶段（1.95s - 2.65s）：12只小猫从空中轻巧落下就位
            registerSkyDrop(catRoot, 1.95 + index * 0.045, 0.58, 28, true);

            return {
                index,
                profile,
                root: catRoot,
                rig,
                bodyPivot,
                headPivot,
                legs,
                tailPivot,
                currentNode: profile.startNode,
                targetNode: nextNodeKey,
                startPos: new THREE.Vector3(startWp.x, startWp.y, startWp.z),
                targetPos: new THREE.Vector3(nextWp.x, nextWp.y, nextWp.z),
                segmentProgress: Math.random() * 0.6,
                state: index % 3 === 0 ? 'RUN' : 'WANDER', // WANDER, RUN, ADMIRE, SNIFF_FLOWER, NAP, GROOM, PLAY
                stateTimer: 4 + Math.random() * 6,
                animPhase: Math.random() * Math.PI * 2,
                thoughtIndex: 0
            };
        }

        function initAllCats() {
            catProfiles.forEach((profile, idx) => {
                cats.push(createCatCharacter(profile, idx));
            });
            // 其他猫咪挡在镜头前时同样 X-Ray 透视（正在跟拍的猫咪除外）
            cats.forEach((cat, idx) => {
                registerOccludableStructure(cat.root, false, { everyFrame: true, catIndex: idx });
            });
        }

        // 更新所有猫咪的 AI 行为与骨骼动画
        function updateCats(dt, elapsed) {
            // 在开场高空落下组装未完成前，小猫保持可爱准备姿态不乱跑
            if (assemblySystem.active && (elapsed - assemblySystem.startTime) < 2.35) {
                return;
            }

            cats.forEach((cat) => {
                if(cat.isPlayer)return;
                cat.stateTimer -= dt;
                cat.animPhase += dt * (cat.state === 'RUN' ? 15 : 8);

                if(townPlayer)townPlayer.moveNPC(cat,dt);
                else {
                // 状态移动或原地动作逻辑
                if (cat.state === 'WANDER' || cat.state === 'RUN') {
                    const moveSpeed = cat.state === 'RUN' ? 5.6 : 2.5;
                    const dist = cat.startPos.distanceTo(cat.targetPos);
                    const step = (moveSpeed * dt) / Math.max(0.5, dist);
                    cat.segmentProgress += step;

                    if (cat.segmentProgress >= 1.0) {
                        // 抵达路点，决定下一步是驻足欣赏/嗅地面小花/打盹/玩耍，还是继续前往下一站
                        cat.segmentProgress = 0;
                        cat.currentNode = cat.targetNode;
                        cat.startPos.copy(cat.targetPos);

                        // 判断是否在特殊景点触发特色动作
                        const roll = Math.random();
                        if ((cat.currentNode === 'bridgePeak' || cat.currentNode === 'waterfallW' || cat.currentNode === 'waterfallE') && roll < 0.55) {
                            cat.state = 'ADMIRE';
                            cat.stateTimer = 5.5 + Math.random() * 3.0;
                            cat.thoughtIndex = (cat.thoughtIndex + 1) % cat.profile.thoughts.length;
                        } else if (roll < 0.25) {
                            cat.state = 'SNIFF_FLOWER';
                            cat.stateTimer = 4.5 + Math.random() * 2.5;
                        } else if (roll < 0.40) {
                            cat.state = 'NAP';
                            cat.stateTimer = 6.0 + Math.random() * 4.0;
                        } else if (roll < 0.55) {
                            cat.state = 'GROOM';
                            cat.stateTimer = 4.5 + Math.random() * 2.5;
                        } else if (roll < 0.68) {
                            cat.state = 'PLAY';
                            cat.stateTimer = 4.0 + Math.random() * 2.5;
                        } else {
                            pickNextDestination(cat);
                        }
                    } else {
                        // 沿路径插值前进（如果在拱桥或踏脚石上，自动拟合拱形高度）
                        cat.root.position.lerpVectors(cat.startPos, cat.targetPos, cat.segmentProgress);
                        if ((cat.currentNode === 'bridgeWest' && cat.targetNode === 'bridgePeak') ||
                            (cat.currentNode === 'bridgePeak' && cat.targetNode === 'bridgeEast') ||
                            (cat.currentNode === 'bridgeEast' && cat.targetNode === 'bridgePeak') ||
                            (cat.currentNode === 'bridgePeak' && cat.targetNode === 'bridgeWest')) {
                            const bx = cat.root.position.x;
                            cat.root.position.y = 1.25 + Math.cos((bx / 5.5) * (Math.PI / 2)) * 1.65;
                        }

                        // 平滑朝向目标方向
                        const dir = new THREE.Vector3().subVectors(cat.targetPos, cat.startPos).normalize();
                        if (dir.lengthSq() > 0.001) {
                            const targetYaw = Math.atan2(dir.x, dir.z);
                            let diff = targetYaw - cat.root.rotation.y;
                            while (diff > Math.PI) diff -= Math.PI * 2;
                            while (diff < -Math.PI) diff += Math.PI * 2;
                            cat.root.rotation.y += diff * Math.min(1, dt * 10);
                        }
                    }
                } else {
                    // 原地动作计时结束，恢复移动
                    if (cat.stateTimer <= 0) {
                        pickNextDestination(cat);
                    }
                }


                }
                // ----------------------------------------------------
                // 基于动作状态的精细骨骼动画表现
                // ----------------------------------------------------
                const p = cat.animPhase;
                // 先重置姿态基准
                cat.bodyPivot.position.set(0, 0.72, 0);
                cat.bodyPivot.rotation.set(0, 0, 0);
                cat.headPivot.rotation.set(0, 0, 0);

                if (cat.state === 'WANDER') {
                    // 轻快漫步四肢交替摆动
                    cat.legs[0].rotation.x = Math.sin(p) * 0.55;
                    cat.legs[1].rotation.x = -Math.sin(p) * 0.55;
                    cat.legs[2].rotation.x = -Math.sin(p) * 0.55;
                    cat.legs[3].rotation.x = Math.sin(p) * 0.55;
                    cat.bodyPivot.position.y = 0.72 + Math.abs(Math.sin(p * 2)) * 0.08;
                    cat.bodyPivot.rotation.z = Math.sin(p) * 0.05;
                    cat.headPivot.rotation.y = Math.sin(elapsed * 2 + cat.index) * 0.15;
                    cat.tailPivot.rotation.y = Math.cos(p) * 0.45;
                    cat.tailPivot.rotation.x = 0.2;
                } else if (cat.state === 'RUN') {
                    // 欢快奔跑（前后肢同步腾跃）
                    cat.legs[0].rotation.x = Math.sin(p) * 0.95;
                    cat.legs[1].rotation.x = Math.sin(p + 0.3) * 0.95;
                    cat.legs[2].rotation.x = -Math.sin(p) * 0.95;
                    cat.legs[3].rotation.x = -Math.sin(p + 0.3) * 0.95;
                    cat.bodyPivot.position.y = 0.78 + Math.abs(Math.sin(p)) * 0.26;
                    cat.bodyPivot.rotation.x = -0.18 + Math.cos(p) * 0.18;
                    cat.tailPivot.rotation.x = -0.35 + Math.sin(p) * 0.25;
                } else if (cat.state === 'ADMIRE') {
                    // 驻足凝望瀑布或小镇风景（自动面向北侧瀑布方向）
                    const waterfallDir = Math.atan2(0 - cat.root.position.x, -19 - cat.root.position.z);
                    let diff = waterfallDir - cat.root.rotation.y;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    cat.root.rotation.y += diff * Math.min(1, dt * 4);

                    cat.bodyPivot.rotation.x = -0.22; // 乖巧端坐昂首
                    cat.headPivot.rotation.x = -0.25 + Math.sin(elapsed * 2) * 0.08;
                    cat.headPivot.rotation.y = Math.sin(elapsed * 1.4) * 0.32;
                    cat.legs.forEach(l => l.rotation.x = 0);
                    cat.tailPivot.rotation.y = Math.sin(elapsed * 3) * 0.5;
                } else if (cat.state === 'SNIFF_FLOWER') {
                    // 俯身凑近地面小花轻轻嗅闻（鼻尖微颤、尾巴欢快摇摆）
                    cat.bodyPivot.position.y = 0.62;
                    cat.bodyPivot.rotation.x = 0.28;
                    cat.headPivot.rotation.x = 0.38 + Math.sin(elapsed * 14) * 0.07;
                    cat.headPivot.rotation.y = Math.sin(elapsed * 2.5) * 0.22;
                    cat.legs[0].rotation.x = -0.25;
                    cat.legs[1].rotation.x = -0.25;
                    cat.legs[2].rotation.x = 0.1;
                    cat.legs[3].rotation.x = 0.1;
                    cat.tailPivot.rotation.y = Math.sin(elapsed * 7) * 0.55;
                } else if (cat.state === 'NAP') {
                    // 蜷缩打盹呼吸起伏
                    cat.bodyPivot.position.y = 0.42;
                    cat.bodyPivot.rotation.z = 0.22;
                    cat.headPivot.rotation.x = 0.35 + Math.sin(elapsed * 2.2) * 0.06;
                    cat.headPivot.rotation.z = -0.2;
                    cat.legs.forEach(l => l.rotation.x = 1.25);
                    cat.tailPivot.rotation.y = Math.sin(elapsed * 1.2) * 0.15;
                } else if (cat.state === 'GROOM') {
                    // 端坐抬起右前爪舔毛
                    cat.bodyPivot.rotation.x = -0.32;
                    cat.legs[0].rotation.x = 0;
                    cat.legs[1].rotation.x = -1.35 + Math.sin(elapsed * 8) * 0.25; // 抬起右爪
                    cat.legs[2].rotation.x = 0.4;
                    cat.legs[3].rotation.x = 0.4;
                    cat.headPivot.rotation.x = 0.25 + Math.sin(elapsed * 8) * 0.18;
                    cat.headPivot.rotation.z = 0.2;
                } else if (cat.state === 'PLAY') {
                    // 原地转圈扑蝶跳跃
                    cat.root.rotation.y += dt * 2.4;
                    const jump = Math.max(0, Math.sin(elapsed * 6.5));
                    cat.bodyPivot.position.y = 0.72 + jump * 0.65;
                    cat.bodyPivot.rotation.x = -jump * 0.35;
                    cat.legs[0].rotation.x = -jump * 0.9;
                    cat.legs[1].rotation.x = -jump * 0.9;
                    cat.tailPivot.rotation.y = Math.sin(elapsed * 12) * 0.6;
                }
            });
        }

        function pickNextDestination(cat) {
            const neighbors = waypointEdges[cat.currentNode];
            const nextKey = neighbors[Math.floor(Math.random() * neighbors.length)];
            cat.targetNode = nextKey;
            cat.targetPos.set(
                townWaypoints[nextKey].x + (Math.random() - 0.5) * 1.2,
                townWaypoints[nextKey].y,
                townWaypoints[nextKey].z + (Math.random() - 0.5) * 1.2
            );
            cat.state = Math.random() < 0.35 ? 'RUN' : 'WANDER';
            cat.stateTimer = 5 + Math.random() * 6;
            cat.thoughtIndex = (cat.thoughtIndex + 1) % cat.profile.thoughts.length;
        }

        // ==========================================
        // 8. 电影级智能运镜追踪、镜头避让与近处遮挡半透明透视系统
        // ==========================================
        // 镜头机位配置说明（绝不死板跟在正后方）
        const cinematicShotTypes = {
            SIDE_TRACKING: {
                code: 'FOV: 42mm | SHOT: STEADICAM SIDE-TRACK',
                name: '侧面平行跟拍 (Steadicam Side)',
                fov: 42
            },
            LOW_HERO: {
                code: 'FOV: 54mm | SHOT: LOW-ANGLE HERO TRACK',
                name: '低角度动感仰拍 (Low-Angle Action)',
                fov: 54
            },
            OVER_SHOULDER_VISTA: {
                code: 'FOV: 38mm | SHOT: OVER-THE-SHOULDER VISTA',
                name: '过肩远眺瀑布景深 (Over-Shoulder Vista)',
                fov: 38
            },
            FLOWER_MACRO: {
                code: 'FOV: 34mm | SHOT: LOW PETAL MACRO',
                name: '花丛微距低角特写 (Flower Sniff Macro)',
                fov: 34
            },
            ORBIT_CLOSEUP: {
                code: 'FOV: 32mm | SHOT: 360° ORBIT PORTRAIT',
                name: '360° 环绕柔光特写 (Orbit Close-Up)',
                fov: 32
            },
            CRANE_ESTABLISHING: {
                code: 'FOV: 46mm | SHOT: DYNAMIC CRANE SWEEP',
                name: '摇臂俯冲全景伴随 (Cinema Crane Sweep)',
                fov: 46
            }
        };

        const shotKeys = Object.keys(cinematicShotTypes);

        // 根据猫咪当前动作自动选择最具电影感的运镜，或使用用户手动切换的机位
        function resolveActiveShotType(cat) {
            if(cat.isPlayer)return 'SIDE_TRACKING';
            if (followState.shotOverride) {
                return followState.shotOverride;
            }
            switch (cat.state) {
                case 'WANDER':       return 'SIDE_TRACKING';
                case 'RUN':          return 'LOW_HERO';
                case 'ADMIRE':       return 'OVER_SHOULDER_VISTA';
                case 'SNIFF_FLOWER': return 'FLOWER_MACRO';
                case 'NAP':
                case 'GROOM':        return 'ORBIT_CLOSEUP';
                case 'PLAY':         return 'CRANE_ESTABLISHING';
                default:             return 'SIDE_TRACKING';
            }
        }

        // ----------------------------------------------------
        // 平滑工具：临界阻尼弹簧 (SmoothDamp)，保证位置/角度/距离都具备速度连续性，彻底消除抖动与顿挫
        // ----------------------------------------------------
        function smoothDamp(cur, target, state, key, smoothTime, dt) {
            const st = Math.max(0.0001, smoothTime);
            const omega = 2.0 / st;
            const x = omega * dt;
            const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
            const change = cur - target;
            const vel = state[key] || 0;
            const temp = (vel + omega * change) * dt;
            state[key] = (vel - omega * temp) * exp;
            return target + (change + temp) * exp;
        }
        function wrapAngle(a) {
            a = (a + Math.PI) % (Math.PI * 2);
            if (a < 0) a += Math.PI * 2;
            return a - Math.PI;
        }
        function smoothDampAngle(cur, target, state, key, smoothTime, dt) {
            return smoothDamp(cur, cur + wrapAngle(target - cur), state, key, smoothTime, dt);
        }
        function smoothDampVec3(cur, target, velVec, smoothTime, dt) {
            const s = { x: velVec.x, y: velVec.y, z: velVec.z };
            cur.x = smoothDamp(cur.x, target.x, s, 'x', smoothTime, dt);
            cur.y = smoothDamp(cur.y, target.y, s, 'y', smoothTime, dt);
            cur.z = smoothDamp(cur.z, target.z, s, 'z', smoothTime, dt);
            velVec.set(s.x, s.y, s.z);
            return cur;
        }
        function smoothstep01(e0, e1, v) {
            const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
            return t * t * (3 - 2 * t);
        }

        // 跟拍镜头"球面支架"状态：相机围绕猫咪做 方位角/仰角/距离 三轴独立弹簧运动
        // —— 切换机位时镜头沿弧线绕行，而不是直线穿过猫咪或建筑
        const camRig = {
            initialized: false,
            focus: new THREE.Vector3(),
            focusVel: new THREE.Vector3(),
            look: new THREE.Vector3(),
            lookOff: new THREE.Vector3(),
            lookVel: new THREE.Vector3(),
            orbitDir: 1, orbitCheck: 0,
            az: 0, el: 0.3, dist: 6,
            collDist: 999,
            heading: 0,
            avoidAz: 0, avoidAzTarget: 0,
            avoidEl: 0, avoidElTarget: 0,
            avoidTimer: 0,
            groundLift: 0,
            userYaw: 0, userYawIdle: 0,
            userFov: 0,
            lastShot: null,
            vel: {}
        };

        // 世界包围盒缓存（用于快速粗筛遮挡与近距离检测）
        let boxRefreshTimer = 0;
        function refreshOccluderBoxes(force, onlyEveryFrame) {
            for (let i = 0; i < occludableGroups.length; i++) {
                const item = occludableGroups[i];
                if (onlyEveryFrame && !item.everyFrame) continue;
                if (!item.box) item.box = new THREE.Box3();
                if (item.everyFrame) { item.box.makeEmpty(); for (let m = 0; m < item.meshes.length; m++) item.box.expandByObject(item.meshes[m]); continue; }
                if (force || item.dynamic || !item.boxReady) {
                    item.box.makeEmpty();
                    for (let m = 0; m < item.meshes.length; m++) item.box.expandByObject(item.meshes[m]);
                    item.boxReady = !assemblySystem.active;
                }
            }
        }

        // 射线检测：从 from 到 to 之间是否被"实体"遮挡（建筑/悬崖），返回最近命中距离
        const _ray = new THREE.Ray();
        const _tmpV = new THREE.Vector3();
        const _tmpV2 = new THREE.Vector3();
        function firstSolidHit(from, dir, maxDist) {
            _ray.set(from, dir);
            let best = Infinity;
            for (let i = 0; i < occludableGroups.length; i++) {
                const item = occludableGroups[i];
                if (!item.solid || !item.box || item.box.isEmpty()) continue;
                const hp = _ray.intersectBox(item.box, _tmpV);
                if (!hp && !item.box.containsPoint(from)) continue;
                if (hp && hp.distanceTo(from) > Math.min(best, maxDist)) continue;
                collisionRaycaster.set(from, dir);
                collisionRaycaster.near = 0.3;
                collisionRaycaster.far = Math.min(best, maxDist);
                const hits = collisionRaycaster.intersectObjects(item.meshes, false);
                if (hits.length > 0 && hits[0].distance < best) best = hits[0].distance;
            }
            return best;
        }

        // ----------------------------------------------------
        // 核心算法 A：智能镜头避让 (Camera Collision Avoidance v2)
        // 1) 优先"绕开"：理想方位被实体挡住时，左右/上下搜索最近的无遮挡机位，并带迟滞避免来回横跳
        // 2) 兜底"推近"：仍有遮挡时平滑拉近（快进慢出），绝不瞬移
        // 3) 树木/灯笼/拱桥等非实体遮挡物不推镜头，交给 X-Ray 透视处理
        // ----------------------------------------------------
        function sphericalDir(az, el, out) {
            const ce = Math.cos(el);
            return out.set(Math.sin(az) * ce, Math.sin(el), Math.cos(az) * ce);
        }
        function isViewClear(focus, az, el, dist) {
            const dir = sphericalDir(az, el, _tmpV2).clone();
            return firstSolidHit(focus, dir, dist + 0.6) > dist * 0.92;
        }
        function updateAvoidanceSearch(dt, focus, baseAz, baseEl, dist) {
            camRig.avoidTimer -= dt;
            if (camRig.avoidTimer > 0) return;
            camRig.avoidTimer = 0.18; // 节流：每 0.18s 评估一次，降低开销并避免抖动

            // 当前偏置机位仍然通畅 → 若原始机位也通畅则逐步回归，否则保持（迟滞）
            const curOk = isViewClear(focus, baseAz + camRig.avoidAzTarget, baseEl + camRig.avoidElTarget, dist);
            if (camRig.avoidAzTarget !== 0 || camRig.avoidElTarget !== 0) {
                if (isViewClear(focus, baseAz, baseEl, dist)) {
                    camRig.avoidAzTarget = 0; camRig.avoidElTarget = 0;
                    return;
                }
                if (curOk) return;
            } else if (curOk) {
                return;
            }

            const candidates = [];
            const azSteps = [0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6];
            const elSteps = [0, 0.22, 0.45];
            for (const de of elSteps) {
                for (const da of (de === 0 ? azSteps : [0].concat(azSteps))) {
                    candidates.push([da, de]);
                }
            }
            // 优先选择离当前偏置最近的可行解，保持运动连续
            candidates.sort((a, b) => {
                const ca = Math.abs(a[0] - camRig.avoidAzTarget) + Math.abs(a[1]) * 1.6;
                const cb = Math.abs(b[0] - camRig.avoidAzTarget) + Math.abs(b[1]) * 1.6;
                return ca - cb;
            });
            for (const [da, de] of candidates) {
                if (isViewClear(focus, baseAz + da, Math.min(1.35, baseEl + de), dist)) {
                    camRig.avoidAzTarget = da;
                    camRig.avoidElTarget = de;
                    return;
                }
            }
            // 找不到通畅机位：抬高一些，剩下交给推近 + X-Ray
            camRig.avoidAzTarget = 0;
            camRig.avoidElTarget = 0.35;
        }

        // ----------------------------------------------------
        // 核心算法 B：视线遮挡 & 近距离物体 X-Ray 透视 (v2)
        // - 视线遮挡：相机→目标之间按相机空间扇形发射 5 条射线（覆盖猫咪身体），先包围盒粗筛再精确检测
        // - 近距离：按"相机到物体包围盒表面"的真实距离判断（而非物体中心），贴脸的树干、灯笼、屋檐都能透视
        // - 距离越近越透明；淡出快、淡入慢，并带 0.35s 保持时间，杜绝闪烁
        // ----------------------------------------------------
        function updateDynamicOcclusionTransparency(dt, targetWorldPos, isFollow) {
            boxRefreshTimer -= dt;
            if (boxRefreshTimer <= 0 || assemblySystem.active) {
                refreshOccluderBoxes(false);
                boxRefreshTimer = 0.5;
            } else {
                refreshOccluderBoxes(false, true);
            }
            const skipCat = isFollow ? followState.catIndex : -2;

            const camPos = camera.position;
            const toTarget = _tmpV.subVectors(targetWorldPos, camPos);
            const distToTarget = toTarget.length();

            const camForward = new THREE.Vector3();
            camera.getWorldDirection(camForward);
            const camRight = new THREE.Vector3().crossVectors(camForward, camera.up).normalize();
            const camUp = new THREE.Vector3().crossVectors(camRight, camForward).normalize();

            // 每组目标不透明度（取最小值）
            for (let i = 0; i < occludableGroups.length; i++) occludableGroups[i].wantOpacity = 1.0;

            // 1) 视线遮挡检测
            let sightBlocked = false;
            if (distToTarget > 0.8) {
                const spread = isFollow ? 0.55 : 2.2;
                const offsets = [[0, 0], [spread, 0.25], [-spread, 0.25], [0, spread * 0.9], [0, -0.25]];
                const rayFar = Math.max(0.3, distToTarget - (isFollow ? 0.55 : 2.0));
                for (const [ox, oy] of offsets) {
                    const p = targetWorldPos.clone().addScaledVector(camRight, ox).addScaledVector(camUp, oy);
                    const dir = p.sub(camPos).normalize();
                    _ray.set(camPos, dir);
                    for (let i = 0; i < occludableGroups.length; i++) {
                        const item = occludableGroups[i];
                        if (!item.box || item.box.isEmpty() || item.wantOpacity <= 0.16 || item.catIndex === skipCat) continue;
                        const hp = _ray.intersectBox(item.box, _tmpV2);
                        if (!hp || hp.distanceTo(camPos) > rayFar) continue;
                        collisionRaycaster.set(camPos, dir);
                        collisionRaycaster.near = 0.05;
                        collisionRaycaster.far = rayFar;
                        if (collisionRaycaster.intersectObjects(item.meshes, false).length > 0) {
                            item.wantOpacity = Math.min(item.wantOpacity, 0.16);
                            // 只有遮挡物尚未淡化完成时才需要猫咪剪影兜底
                            if (item.currentOpacity > 0.45) sightBlocked = true;
                        }
                    }
                }
            }

            // 2) 近距离 X-Ray：物体表面离镜头太近且位于视野内 → 按距离渐进透明
            const nearRadius = isFollow ? 4.2 : 9.0;
            const closest = new THREE.Vector3();
            for (let i = 0; i < occludableGroups.length; i++) {
                const item = occludableGroups[i];
                if (!item.box || item.box.isEmpty() || item.catIndex === skipCat) continue;
                const d = item.box.distanceToPoint(camPos);
                if (d > nearRadius) continue;
                if (d > 0.001) {
                    item.box.clampPoint(camPos, closest);
                    const toObj = closest.sub(camPos).normalize();
                    if (camForward.dot(toObj) < -0.15) continue; // 在镜头后方的不处理
                } // d≈0：相机在包围盒内部，必须透视
                const t = d / nearRadius; // 0 = 贴脸, 1 = 边界
                const op = d < 0.6 ? 0.0 : 0.08 + 0.77 * t * t; // 贴脸/镜头在物体内部 → 完全隐藏，杜绝满屏发白
                item.wantOpacity = Math.min(item.wantOpacity, op);
            }

            // Own-cat road corridor: fade large foreground roofs even if they miss the tiny center ray.
            if(isFollow&&cats[followState.catIndex]?.isPlayer){
                const probes=[];for(const ox of[-2.4,-1.2,0,1.2,2.4])for(const oy of[-1,0,1.6]){const direction=targetWorldPos.clone().addScaledVector(camRight,ox).addScaledVector(camUp,oy).sub(camPos);const distance=direction.length();probes.push({direction:direction.normalize(),distance});}
                for(const item of occludableGroups){
                    const box=item.box;if(item.catIndex>=0||!box||box.isEmpty()||box.max.y<targetWorldPos.y+.6)continue;
                    // Use the whole cat-and-road corridor. A building's aggregate box may contain
                    // the cat beside its eaves; that must never exempt its roof from fading.
                    let blocks=false;
                    for(const {direction,distance} of probes){
                        _ray.set(camPos,direction);const hit=_ray.intersectBox(box,_tmpV2);
                        if(hit&&hit.distanceTo(camPos)<distance-.25){blocks=true;break;}
                    }
                    if(blocks){item.wantOpacity=Math.min(item.wantOpacity,.015);if(item.currentOpacity>.45)sightBlocked=true;}
                }
            }
            // 3) 平滑插值（淡出快 / 淡入慢 / 保持时间）
            let activeOccludedCount = 0;
            const fadeOut = 1.0 - Math.exp(-12.0 * dt);
            const fadeIn = 1.0 - Math.exp(-3.5 * dt);
            for (let i = 0; i < occludableGroups.length; i++) {
                const item = occludableGroups[i];
                if (item.wantOpacity < 0.99) {
                    item.holdTimer = 0.35;
                    item.targetOpacity = item.wantOpacity;
                } else {
                    item.holdTimer = (item.holdTimer || 0) - dt;
                    if (item.holdTimer <= 0) item.targetOpacity = 1.0;
                }
                if (item.targetOpacity < 0.99) activeOccludedCount++;

                if (Math.abs(item.currentOpacity - item.targetOpacity) > 0.003) {
                    const k = item.targetOpacity < item.currentOpacity ? fadeOut : fadeIn;
                    item.currentOpacity += (item.targetOpacity - item.currentOpacity) * k;
                    if (Math.abs(item.currentOpacity - item.targetOpacity) <= 0.003) item.currentOpacity = item.targetOpacity;
                    const isFading = item.currentOpacity < 0.985;
                    for (let m = 0; m < item.materials.length; m++) {
                        const mat = item.materials[m];
                        mat.transparent = isFading ? true : mat.userData.baseTransparent;
                        mat.opacity = mat.userData.baseOpacity * item.currentOpacity;
                        mat.depthWrite = !isFading;
                        mat.visible = item.currentOpacity > 0.03;
                    }
                    for (let m = 0; m < item.meshes.length; m++) {
                        // 半透明时不投射阴影，避免"透明了但阴影还很重"的违和感
                        item.meshes[m].castShadow = item.currentOpacity > 0.5 ? item.meshes[m].userData.baseCastShadow : false;
                    }
                }
            }

            followState.occludedCount = activeOccludedCount;
            followState.sightBlocked = sightBlocked;
        }

        // 被遮挡时的猫咪 X-Ray 轮廓（穿透墙体可见的发光剪影）
        const xrayGhostMat = new THREE.MeshBasicMaterial({
            color: 0x67e8f9, transparent: true, opacity: 0, depthTest: false, depthWrite: false
        });
        let xrayGhostCat = null;
        let xrayGhostOpacity = 0;
        function ensureXrayGhost(cat) {
            if (xrayGhostCat === cat) return;
            if (xrayGhostCat && xrayGhostCat.ghosts) xrayGhostCat.ghosts.forEach(g => g.visible = false);
            xrayGhostCat = cat;
            if (!cat.ghosts) {
                cat.ghosts = [];
                const meshes = [];
                cat.root.traverse(o => { if (o.isMesh && !o.userData.isGhost && o.material && o.material.visible !== false) meshes.push(o); });
                meshes.forEach(o => {
                    const g = new THREE.Mesh(o.geometry, xrayGhostMat);
                    g.userData.isGhost = true;
                    g.renderOrder = 999;
                    g.castShadow = false; g.receiveShadow = false;
                    g.raycast = () => {};
                    o.add(g);
                    cat.ghosts.push(g);
                });
            }
        }
        function updateXrayGhost(dt, cat, show) {
            if (cat) ensureXrayGhost(cat);
            const target = show ? 0.32 : 0;
            xrayGhostOpacity += (target - xrayGhostOpacity) * (1 - Math.exp(-(show ? 10 : 5) * dt));
            xrayGhostMat.opacity = xrayGhostOpacity;
            const vis = xrayGhostOpacity > 0.01;
            if (xrayGhostCat && xrayGhostCat.ghosts) xrayGhostCat.ghosts.forEach(g => g.visible = vis);
        }

        // 每种机位的"理想球面参数"：方位角(相对猫咪朝向)、仰角、距离、注视点前探
        function getShotSpec(shotKey, cat, elapsed) {
            if(cat.isPlayer)return {relAz:.72,el:(camRig.userElevation||.48),dist:(camRig.userDistance||18)*Math.max(1,Math.min(1.18,.6/camera.aspect)),lead:.65,lookY:1,focusTime:.3};
            const sideSign = (cat.index % 2 === 0) ? 1 : -1;
            switch (shotKey) {
                case 'SIDE_TRACKING':
                    return { relAz: sideSign * 1.22, el: 0.30 + Math.sin(elapsed * 0.6) * 0.02, dist: 6.6, lead: 1.6, lookY: 1.05, focusTime: 0.22 };
                case 'LOW_HERO':
                    return { relAz: sideSign * 0.45, el: 0.06 + Math.sin(elapsed * 1.6) * 0.012, dist: 5.4, lead: -0.3, lookY: 1.15, focusTime: 0.16 };
                case 'OVER_SHOULDER_VISTA':
                    return { relAz: Math.PI - 0.47, el: 0.30, dist: 3.8, lead: 0, lookY: 0.8, vista: true, focusTime: 0.3 };
                case 'FLOWER_MACRO':
                    return { relAz: 0.64, el: 0.07, dist: 4.2, lead: 0.45, lookY: 0.65, focusTime: 0.3 };
                case 'ORBIT_CLOSEUP':
                    return { orbit: 0.32, el: 0.28 + Math.sin(elapsed * 0.5) * 0.04, dist: 4.4, lead: 0, lookY: 0.75, focusTime: 0.35 };
                case 'CRANE_ESTABLISHING':
                    return { orbit: 0.26, el: 0.48 + Math.sin(elapsed * 0.45) * 0.16, dist: 9.2, lead: 0, lookY: 1.0, focusTime: 0.3 };
            }
            return { relAz: 1.2, el: 0.3, dist: 6.5, lead: 1.5, lookY: 1.0, focusTime: 0.25 };
        }

        function updateCameraSystem(dt, elapsed) {
            if (followState.active && cats.length > 0) {
                const cat = cats[followState.catIndex];
                const shotKey = resolveActiveShotType(cat);
                const shotCfg = cinematicShotTypes[shotKey];
                const spec = getShotSpec(shotKey, cat, elapsed);
                const catPos = cat.root.position;

                // 初始化：从当前相机位置反推球面参数，进入跟拍时无缝滑入
                if (!camRig.initialized) {
                    camRig.focus.copy(catPos).add(new THREE.Vector3(0, 1.0, 0));
                    camRig.focusVel.set(0, 0, 0);
                    camRig.look.copy(followState.currentLookAt);
                    camRig.lookOff.subVectors(followState.currentLookAt, camRig.focus).clampLength(0, 3);
                    camRig.lookVel.set(0, 0, 0);
                    const off = new THREE.Vector3().subVectors(camera.position, camRig.focus);
                    camRig.dist = Math.max(1.5, off.length());
                    camRig.collDist = camRig.dist;
                    camRig.az = Math.atan2(off.x, off.z);
                    camRig.el = Math.asin(Math.min(0.99, Math.max(-0.99, off.y / camRig.dist)));
                    camRig.heading = cat.root.rotation.y;
                    camRig.avoidAz = camRig.avoidAzTarget = 0;
                    camRig.avoidEl = camRig.avoidElTarget = 0;
                    camRig.groundLift = 0;
                    camRig.vel = {};
                    camRig.lastShot = null;
                    camRig.initialized = true;
                }

                // 1) 平滑猫咪朝向（大惯性），避免猫咪转身时镜头甩动
                camRig.heading = smoothDampAngle(camRig.heading, cat.root.rotation.y, camRig.vel, 'heading', 1.1, dt);
                const fwd = new THREE.Vector3(Math.sin(camRig.heading), 0, Math.cos(camRig.heading));

                // 2) 平滑焦点（猫咪胸口），吸收走路颠簸
                const focusTarget = catPos.clone().add(new THREE.Vector3(0, 1.0, 0));
                smoothDampVec3(camRig.focus, focusTarget, camRig.focusVel, spec.focusTime, dt);

                // 3) 机位切换：环绕机位从当前方位角接续，不会突然跳到另一侧
                if (camRig.lastShot !== shotKey) {
                    if (spec.orbit) followState.orbitAngle = camRig.az - camRig.userYaw;
                    camRig.lastShot = shotKey;
                }
                let baseAz;
                if (spec.orbit) {
                    // 环绕前方若被建筑挡住则平滑反向（钟摆式环绕），避免绕进墙里把镜头挤到猫脸上
                    camRig.orbitCheck -= dt;
                    if (camRig.orbitCheck <= 0 && !assemblySystem.active) {
                        camRig.orbitCheck = 0.2;
                        const ahead = followState.orbitAngle + camRig.userYaw + camRig.orbitDir * 0.45;
                        if (!isViewClear(camRig.focus, ahead, spec.el, spec.dist)) {
                            const back = followState.orbitAngle + camRig.userYaw - camRig.orbitDir * 0.45;
                            if (isViewClear(camRig.focus, back, spec.el, spec.dist)) camRig.orbitDir *= -1;
                        }
                    }
                    camRig.orbitSpeed = smoothDamp(camRig.orbitSpeed || 0, spec.orbit * camRig.orbitDir, camRig.vel, 'orbitSpeed', 0.8, dt);
                    followState.orbitAngle += dt * camRig.orbitSpeed;
                    baseAz = followState.orbitAngle;
                } else {
                    baseAz = camRig.heading + spec.relAz;
                }

                // 用户拖拽的方位偏移：闲置 2.5s 后缓慢回正
                camRig.userYawIdle += dt;
                if (camRig.userYawIdle > 2.5 && !spec.orbit) {
                    camRig.userYaw = smoothDamp(camRig.userYaw, 0, camRig.vel, 'userYaw', 1.6, dt);
                }
                baseAz += camRig.userYaw;

                // 4) 智能避让：搜索无遮挡方位/仰角
                if (!assemblySystem.active) {
                    updateAvoidanceSearch(dt, camRig.focus, baseAz, spec.el, spec.dist);
                }
                camRig.avoidAz = smoothDamp(camRig.avoidAz, camRig.avoidAzTarget, camRig.vel, 'avoidAz', 0.75, dt);
                camRig.avoidEl = smoothDamp(camRig.avoidEl, camRig.avoidElTarget, camRig.vel, 'avoidEl', 0.75, dt);

                const targetAz = baseAz + camRig.avoidAz;
                const targetEl = Math.min(1.35, spec.el + camRig.avoidEl);

                // 5) 球面三轴弹簧
                camRig.az = smoothDampAngle(camRig.az, targetAz, camRig.vel, 'az', spec.orbit ? 0.35 : 0.85, dt);
                camRig.el = smoothDamp(camRig.el, targetEl, camRig.vel, 'el', 0.7, dt);
                camRig.dist = smoothDamp(camRig.dist, spec.dist, camRig.vel, 'dist', 0.8, dt);

                // 6) 兜底推近：快进(防穿模)慢出(防回弹抖动)
                const dir = sphericalDir(camRig.az, camRig.el, new THREE.Vector3());
                let hitDist = assemblySystem.active ? Infinity : firstSolidHit(camRig.focus, dir, camRig.dist + 0.8);
                const safeDist = cat.isPlayer ? 999 : hitDist < Infinity ? Math.max(2.2, hitDist - 0.7) : 999;
                const wantColl = Math.min(safeDist, camRig.dist);
                if (wantColl < camRig.collDist) {
                    camRig.collDist = smoothDamp(camRig.collDist, wantColl, camRig.vel, 'coll', 0.25, dt);
                    camRig.collDist = Math.max(camRig.collDist, wantColl); // 不超调
                } else {
                    camRig.collDist = smoothDamp(camRig.collDist, wantColl, camRig.vel, 'coll', 0.9, dt);
                }
                const finalDist = Math.min(camRig.dist, camRig.collDist);
                followState.isAvoidingObstacle = (camRig.dist - finalDist > 0.4) || Math.abs(camRig.avoidAzTarget) > 0.01 || camRig.avoidElTarget > 0.01;

                const camPos = camRig.focus.clone().addScaledVector(dir, finalDist);

                // 7) 地形防穿模：悬崖区高度用平滑过渡，避免跨区时镜头突然弹起
                const cliffT = smoothstep01(-17.4, -18.8, camPos.z);
                const minGroundY = 1.6 + (15.2 - 1.6) * cliffT;
                const liftNeeded = Math.max(0, minGroundY - camPos.y);
                camRig.groundLift = liftNeeded > camRig.groundLift
                    ? smoothDamp(camRig.groundLift, liftNeeded, camRig.vel, 'lift', 0.15, dt)
                    : smoothDamp(camRig.groundLift, liftNeeded, camRig.vel, 'lift', 0.6, dt);
                // 抬升同样走弹簧；短暂的轻微穿插由近距离 X-Ray 隐藏，不再硬性钳制导致镜头"弹一下"
                camPos.y += Math.max(camRig.groundLift, liftNeeded - 0.6);
                if (liftNeeded > 0.3) followState.isAvoidingObstacle = true;

                // 8) 注视点：略微领先猫咪行进方向，远眺镜头偏向瀑布
                // 注视偏移量单独平滑，再叠加到已平滑的焦点上 → 猫咪奔跑时也稳稳锁在画面构图位，不会"甩出画面"
                const lookOffTarget = new THREE.Vector3().addScaledVector(fwd, spec.lead);
                lookOffTarget.y += spec.lookY - 1.0;
                if (spec.vista) {
                    const vistaPull = new THREE.Vector3(0, 6.3, -18).sub(camRig.focus).multiplyScalar(0.4);
                    lookOffTarget.add(vistaPull);
                }
                smoothDampVec3(camRig.lookOff, lookOffTarget, camRig.lookVel, 0.45, dt);
                camRig.look.copy(camRig.focus).add(camRig.lookOff);

                followState.currentCamPos.copy(camPos);
                followState.currentLookAt.copy(camRig.look);
                const fovTarget = Math.max(25, Math.min(68, (cat.isPlayer?46:shotCfg.fov) + camRig.userFov));
                followState.currentFov = smoothDamp(followState.currentFov, fovTarget, camRig.vel, 'fov', 0.6, dt);

                camera.position.copy(camPos);
                camera.lookAt(camRig.look);
                camera.fov = followState.currentFov;
                camera.updateProjectionMatrix();

                // 视线遮挡 / 近距离 X-Ray 透视
                updateDynamicOcclusionTransparency(dt, catPos.clone().add(new THREE.Vector3(0, 0.9, 0)), true);
                updateXrayGhost(dt, cat, followState.sightBlocked);

                updateFollowHUD(cat, shotCfg);
                updateThoughtBubble(cat);

            } else {
                camRig.initialized = false;
                updateXrayGhost(dt, null, false);

                // 自由探索环绕模式 (Orbit & Zoom Controls)
                orbitState.theta += orbitState.velTheta;
                orbitState.phi += orbitState.velPhi;
                orbitState.radius += orbitState.velRadius;

                orbitState.velTheta *= 0.88;
                orbitState.velPhi *= 0.88;
                orbitState.velRadius *= 0.85;

                orbitState.phi = Math.max(0.18, Math.min(Math.PI * 0.46, orbitState.phi));
                orbitState.radius = Math.max(16, Math.min(overviewRadius()+40, orbitState.radius));

                const desiredX = orbitState.target.x + orbitState.radius * Math.sin(orbitState.phi) * Math.sin(orbitState.theta);
                const desiredY = orbitState.target.y + orbitState.radius * Math.cos(orbitState.phi);
                const desiredZ = orbitState.target.z + orbitState.radius * Math.sin(orbitState.phi) * Math.cos(orbitState.theta);

                followState.currentCamPos.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), 1 - Math.exp(-5 * dt));
                followState.currentLookAt.lerp(orbitState.target, 1 - Math.exp(-5 * dt));
                followState.currentFov += (45 - followState.currentFov) * (1 - Math.exp(-4 * dt));

                camera.position.copy(followState.currentCamPos);
                camera.lookAt(followState.currentLookAt);
                camera.fov = followState.currentFov;
                camera.updateProjectionMatrix();

                updateDynamicOcclusionTransparency(dt, orbitState.target, false);
            }
        }

        // 更新跟随界面 HUD 与猫咪头顶 2D 映射气泡
        function updateFollowHUD(cat, shotCfg) {
            document.getElementById('hud-cat-name').textContent = cat.profile.name;
            document.getElementById('hud-cat-role').textContent = cat.profile.role;
            document.getElementById('cat-avatar-dot').textContent = cat.profile.emoji;
            document.getElementById('hud-cat-action').textContent = actionNamesMap[cat.state] || cat.state;
            document.getElementById('hud-cat-target').textContent = townWaypoints[cat.targetNode].name;
            document.getElementById('hud-shot-name').textContent = shotCfg.name;
            document.getElementById('shot-code-display').textContent = `${shotCfg.code} | TARGET: ${cat.profile.name}`;

            // 更新镜头避障与遮挡透视状态指示器
            const avoidBadge = document.getElementById('cam-avoid-badge');
            const xrayBadge = document.getElementById('cam-xray-badge');
            const hudIndicator = document.getElementById('hud-avoid-indicator');

            if (followState.isAvoidingObstacle) {
                avoidBadge.classList.remove('hidden');
            } else {
                avoidBadge.classList.add('hidden');
            }

            if (followState.occludedCount > 0) {
                xrayBadge.classList.remove('hidden');
            } else {
                xrayBadge.classList.add('hidden');
            }

            if (followState.isAvoidingObstacle && followState.occludedCount > 0) {
                hudIndicator.textContent = `⚡ 避障 & 透视(${followState.occludedCount})`;
                hudIndicator.className = 'text-[10px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200 border border-amber-400/40';
            } else if (followState.occludedCount > 0) {
                hudIndicator.textContent = `👁️ 遮挡半透明(${followState.occludedCount})`;
                hudIndicator.className = 'text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-200 border border-cyan-400/40';
            } else if (followState.isAvoidingObstacle) {
                hudIndicator.textContent = '⚡ 智能避障跟拍';
                hudIndicator.className = 'text-[10px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200 border border-amber-400/40';
            } else {
                hudIndicator.textContent = '✨ 视野畅通';
                hudIndicator.className = 'text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';
            }
        }

        function updateThoughtBubble(cat) {
            const bubble = document.getElementById('cat-thought-bubble');
            const headWorldPos = cat.root.position.clone().add(new THREE.Vector3(0, 2.25, 0));
            headWorldPos.project(camera);

            if (headWorldPos.z > 1.0) {
                bubble.style.opacity = '0';
                return;
            }
            const x = (headWorldPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-(headWorldPos.y * 0.5) + 0.5) * window.innerHeight;

            bubble.style.left = `${x}px`;
            bubble.style.top = `${y}px`;
            bubble.style.opacity = '1';
            document.getElementById('bubble-emoji').textContent = cat.profile.emoji;
            document.getElementById('bubble-text').textContent = cat.profile.thoughts[cat.thoughtIndex];
        }

        // ==========================================
        // 9. UI 交互按钮与鼠标触控事件绑定
        // ==========================================
        const toggleFollowMode = function(forceEnable = null) {
            if(townPlayer)followState.catIndex=townPlayer.own.index;
            const nextState = forceEnable !== null ? forceEnable : !followState.active;
            followState.active = nextState;
            followState.shotOverride = null;
            camRig.initialized = false;
            camRig.userYaw = 0;
            camRig.userFov = 0;

            const hud = document.getElementById('follow-hud');
            const btnText = document.getElementById('follow-btn-text');
            const btnIcon = document.getElementById('follow-btn-icon');
            const lbTop = document.getElementById('letterbox-top');
            const lbBottom = document.getElementById('letterbox-bottom');
            const bubble = document.getElementById('cat-thought-bubble');

            if (followState.active) {
                hud.classList.remove('hidden');
                btnText.textContent = '退出跟拍 (自由探索)';
                btnIcon.textContent = '🔓';
                lbTop.style.height = '38px';
                lbBottom.style.height = '32px';
            } else {
                hud.classList.add('hidden');
                btnText.textContent = '跟随猫咪 (电影运镜)';
                btnIcon.textContent = '🎬';
                lbTop.style.height = '0px';
                lbBottom.style.height = '0px';
                bubble.style.opacity = '0';
                // 将当前跟拍的猫咪位置设为自由相机的环绕中心，实现无缝退出
                const cat = cats[followState.catIndex];
                if (cat) {
                    orbitState.target.copy(cat.root.position).setY(3.0);
                    orbitState.radius = 45;
                }
            }
        };

        const switchFollowedCat = function(step) {
            followState.catIndex = (followState.catIndex + step + cats.length) % cats.length;
            followState.shotOverride = null;
            if (!followState.active) {
                toggleFollowMode(true);
            }
        };

        const cycleCameraShotOverride = function() {
            if (!followState.active) return;
            if (!followState.shotOverride) {
                followState.shotOverride = shotKeys[0];
            } else {
                const idx = shotKeys.indexOf(followState.shotOverride);
                if (idx === shotKeys.length - 1) {
                    followState.shotOverride = null; // 回到 AI 自动导演模式
                } else {
                    followState.shotOverride = shotKeys[idx + 1];
                }
            }
        };

        const resetOverviewCamera = function() {
            if (followState.active) {
                toggleFollowMode(false);
            }
            orbitState.target.set(0, 4, 0);
            orbitState.theta = Math.PI * 0.22;
            orbitState.phi = Math.PI * 0.34;
            orbitState.radius = overviewRadius();
        };

        function setupInteractionEvents() {
            const dom = renderer.domElement;
            raycaster = new THREE.Raycaster();
            collisionRaycaster = new THREE.Raycaster();
            mouse = new THREE.Vector2();

            let pointerDownPos = { x: 0, y: 0 };let pointerOwner=null;

            listen(dom,'pointerdown', (e) => {
                if(!active)return;pointerOwner=e.pointerId;dom.setPointerCapture?.(e.pointerId);
                e.preventDefault();pointerDownPos = { x: e.clientX, y: e.clientY };
                if (e.button === 0) {
                    orbitState.isDraggingLeft = true;
                } else if (e.button === 2) {
                    orbitState.isDraggingRight = true;
                }
                orbitState.prevX = e.clientX;
                orbitState.prevY = e.clientY;
            });

            listen(window,'pointermove', (e) => {
                if (!orbitState.isDraggingLeft && !orbitState.isDraggingRight) return;
                if(pointerOwner===e.pointerId&&Math.hypot(e.clientX-pointerDownPos.x,e.clientY-pointerDownPos.y)<14)return;
                const dx = e.clientX - orbitState.prevX;
                const dy = e.clientY - orbitState.prevY;
                orbitState.prevX = e.clientX;
                orbitState.prevY = e.clientY;

                // 如果用户在跟随模式下主动大幅度拖拽画面，允许平滑旋转环绕特写角度，或按右键平移退出跟随
                if (followState.active) {
                    if (orbitState.isDraggingLeft) {
                        camRig.userYaw -= dx * 0.008;camRig.userElevation=Math.max(.22,Math.min(.95,(camRig.userElevation||.48)+dy*.003));
                        camRig.userYawIdle = 0;
                    }
                    return;
                }

                if (orbitState.isDraggingLeft) {
                    orbitState.velTheta = -dx * 0.0045;
                    orbitState.velPhi = -dy * 0.0040;
                } else if (orbitState.isDraggingRight) {
                    const forward = new THREE.Vector3();
                    camera.getWorldDirection(forward);
                    forward.y = 0;
                    forward.normalize();
                    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
                    orbitState.target.addScaledVector(right, -dx * 0.06);
                    orbitState.target.addScaledVector(forward, dy * 0.06);
                }
            });

            listen(window,'pointerup', (e) => {
                if(pointerOwner!==e.pointerId)return;pointerOwner=null;
                orbitState.isDraggingLeft = false;
                orbitState.isDraggingRight = false;

                // 检测是否是点击猫咪
                const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
                if (moveDist < 14 && e.button === 0) {
                    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
                    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
                    raycaster.setFromCamera(mouse, camera);
                    if(townPlayer){townPlayer.handlePointer(e);return;}
                    const hits = raycaster.intersectObjects(interactiveMeshes, false);
                    if(!hits.length&&townPlayer)townPlayer.pick(e);
                    if (hits.length > 0) {
                        const clickedCatIndex = hits[0].object.userData.catIndex;
                        if (clickedCatIndex !== undefined) {
                            if(townPlayer)townPlayer.clickNpc(clickedCatIndex);else{followState.catIndex = clickedCatIndex;followState.shotOverride = null;toggleFollowMode(true);}
                        }
                    }
                }
            });

            listen(dom,'pointercancel',()=>{pointerOwner=null;orbitState.isDraggingLeft=false;orbitState.isDraggingRight=false;});
            listen(dom,'wheel', (e) => {
                e.preventDefault();
                if (followState.active) {
                    camRig.userFov = Math.max(-18, Math.min(22, camRig.userFov + e.deltaY * 0.02));
                } else {
                    orbitState.velRadius += e.deltaY * 0.018;
                }
            }, { passive: false });

            listen(dom,'contextmenu', (e) => e.preventDefault());

            listen(window,'resize', () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            });
        }

        // ==========================================
        // 10. 环境细节动画更新（瀑布水花、风车、水车、樱花、炊烟、游鱼）
        // ==========================================
        function updateEnvironmentAnimations(dt, elapsed) {
            // 1. 瀑布水流与顺流而下的河面水波粒子
            waterfallParticles.forEach((drop) => {
                drop.userData.progress += drop.userData.speed * dt;
                if (drop.userData.progress >= 1.0) {
                    resetWaterfallDrop(drop, false);
                }
                const p = drop.userData.progress;
                if (p < 0.16) {
                    // 崖顶水道向前奔涌
                    const t = p / 0.16;
                    drop.position.set(
                        drop.userData.xOffset,
                        14.0,
                        -25.0 + t * 6.5
                    );
                    drop.scale.set(0.85, 0.45, 1.3);
                } else if (p < 0.56) {
                    // 垂直飞流直下
                    const t = (p - 0.16) / 0.40;
                    drop.position.set(
                        drop.userData.xOffset,
                        14.0 - (t * t) * 14.0,
                        -18.3 + t * 1.4 + drop.userData.zOffset * 0.3
                    );
                    drop.scale.set(0.75, 1.65, 0.75);
                } else {
                    // 汇入小镇中央溪流向南流淌
                    const t = (p - 0.56) / 0.44;
                    drop.position.set(
                        drop.userData.xOffset * 0.85,
                        0.08 + Math.sin(t * 25 + elapsed * 5) * 0.06,
                        -16.8 + t * 48.0
                    );
                    drop.scale.set(0.9, 0.25, 1.4);
                }
            });

            // 2. 瀑布底部拍打飞溅的白色体素泡沫
            splashParticles.forEach((foam) => {
                const wave = Math.sin(elapsed * foam.userData.speed + foam.userData.phase);
                foam.position.y = 0.2 + Math.abs(wave) * 1.35;
                foam.position.x = foam.userData.baseX + Math.cos(elapsed * 2 + foam.userData.phase) * 0.35;
                const s = 0.5 + (1 - Math.abs(wave)) * 0.85;
                foam.scale.set(s, s, s);
                foam.rotation.y += dt * 1.8;
                foam.rotation.z += dt * 1.2;
            });

            // 3. 风车与溪畔水车匀速转动
            if (windmillBlades) {
                windmillBlades.rotation.z -= dt * 0.75;
            }
            if (waterwheelMesh) {
                waterwheelMesh.rotation.x += dt * 1.35;
            }

            // 3B. 地面五彩体素小花簇随微风轻轻摇曳
            flowerClusters.forEach((cluster) => {
                const sway = Math.sin(elapsed * cluster.userData.swaySpeed + cluster.userData.swayPhase) * 0.065;
                cluster.rotation.z = sway;
                cluster.rotation.x = sway * 0.6;
            });

            // 4. 漫天飘落的樱花花瓣
            sakuraPetals.forEach((petal) => {
                petal.position.y -= petal.userData.speedY * dt;
                petal.position.x += Math.sin(elapsed * petal.userData.swaySpeed + petal.userData.phase) * dt * 1.2;
                petal.position.z += Math.cos(elapsed * petal.userData.swaySpeed + petal.userData.phase) * dt * 0.8;
                petal.rotation.x += dt * 1.5;
                petal.rotation.z += dt * 2.0;
                if (petal.position.y < 0.2) {
                    petal.position.y = 24 + Math.random() * 6;
                    petal.position.x = (Math.random() - 0.5) * 60;
                    petal.position.z = (Math.random() - 0.5) * 55;
                }
            });

            // 5. 肉垫烘焙坊屋顶烟囱袅袅炊烟 (-21.5, 12.8, 5.5)
            smokePuffs.forEach((puff) => {
                puff.userData.progress += dt * 0.22;
                if (puff.userData.progress >= 1.0) {
                    puff.userData.progress = 0;
                }
                const t = puff.userData.progress;
                puff.position.set(
                    -21.5 + Math.sin(t * 6 + elapsed) * (t * 1.2),
                    13.2 + t * 7.5,
                    5.5 + t * 1.8
                );
                const scale = 0.6 + t * 1.6;
                puff.scale.set(scale, scale, scale);
                puff.material.opacity = (1.0 - t) * 0.6;
                puff.rotation.y = t * 3;
            });

            // 6. 河道锦鲤游动与空中祈福灯笼摇曳
            fishList.forEach((fish) => {
                const t = elapsed * fish.userData.speed + fish.userData.phase;
                const nx = Math.sin(t) * fish.userData.radiusX;
                const nz = fish.userData.zCenter + Math.cos(t * 0.7) * 2.5;
                const dx = nx - fish.position.x;
                const dz = nz - fish.position.z;
                fish.position.set(nx, -0.05, nz);
                if (Math.hypot(dx, dz) > 0.001) {
                    fish.rotation.y = Math.atan2(dx, dz);
                }
            });

            floatingLanterns.forEach((l) => {
                l.position.y = l.userData.baseY + Math.sin(elapsed * l.userData.speed + l.userData.phase) * 1.2;
                l.rotation.y += dt * 0.35;
            });
        }

        // ==========================================
        // 11. 主程序入口与渲染循环
        // ==========================================
        function initApp() {
            const container = document.getElementById('canvas-container');

            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0xd98a82, 0.0068*68/overviewRadius());

            camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 320);
            camera.position.copy(followState.currentCamPos);

            renderer = hostRenderer;
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.08;
            container.appendChild(renderer.domElement);

            clock = new THREE.Clock();

            // 构建梦幻小镇全场景
            createSkyDome();
            setupLighting();
            buildTerrainAndWaterfall();
            buildRoadsAndBridges();
            buildTownBuildings();
            buildFloraAndLanterns();
            initAllCats();
            setupInteractionEvents();

            // 启动开场高空落下Q弹组装动画
            replayTownAssembly();
        }

        function animate() {
            frameId=0;if(!active||disposed)return;frameId=requestAnimationFrame(animate);
            const dt = Math.min(clock.getDelta(), 0.1);
            const elapsed = clock.getElapsedTime();

            updateSkyDropAssembly(elapsed);
            townPlayer?.serviceBridge();
            townPlayer?.serviceSocial();
            updateCats(dt, elapsed);
            townPlayer?.update(dt,elapsed);
            updateEnvironmentAnimations(dt, elapsed);
            updateCameraSystem(dt, elapsed);
            if (skyDomeMesh) skyDomeMesh.position.copy(camera.position);

            renderer.render(scene, camera);
        }


    
/* Embedded inside the original town closure. Shared road/circle occupancy, original pet/activities. */
function createTownPlayer(){
 if(!playerModel)return null;
 const RADIUS=.9,GAP=.16,DIAM=RADIUS*2+GAP,WIDTH=1.6;
 const v=(x,y,z)=>new THREE.Vector3(x,y,z),nav=new Map(),solidRects=[];let commandRevision=0,eventRevision=0,pendingEvent=null;
 let profile=playerProfile,session=null,store=null,mode='free',elapsed=0,started=0,intro=0,interacting=null,chatUntil=0,eventShown=false,ended=false,journey=[],collected=0,freeAt=0,lastMoving=false,eventPhase='idle',eventChoice=null,eventResumeAt=0,currentPlace='street',destination=null,ambient=null,ambientNext=0,ambientCount=0,socialReturn=null,eventSavedPath=[],coreActive=false,drawerBeforeCore=false;
 const ground= new THREE.Group();ground.name='原暖阳庭院·街道外围';ground.position.set(32,1,20);ground.scale.setScalar(.26);scene.add(ground);
 if(root.CatTownGarden)root.CatTownGarden.build({group:ground,Group:THREE.Group,Vector3:THREE.Vector3,box:(parent,size,pos,color,opts={})=>createVoxel(...size,color,...pos,parent,opts)});registerOccludableStructure(ground,true);
 townWaypoints.gardenGate={x:22,y:1,z:20,name:'暖阳庭院入口'};townWaypoints.gardenCenter={x:32,y:1.1,z:20,name:'暖阳庭院小径'};townWaypoints.gardenNorth={x:32,y:1.1,z:14,name:'庭院花丛'};townWaypoints.gardenSouthPath={x:32,y:1.1,z:26,name:'庭院栅栏前'};
 waypointEdges.gardenSouth.push('gardenGate');waypointEdges.gardenGate=['gardenSouth','gardenCenter'];waypointEdges.gardenCenter=['gardenGate','gardenNorth','gardenSouthPath'];waypointEdges.gardenNorth=['gardenCenter'];waypointEdges.gardenSouthPath=['gardenCenter'];
 const a=townWaypoints.gardenSouth,b=townWaypoints.gardenGate,len=Math.hypot(b.x-a.x,b.z-a.z),path=createVoxel(len+1,.22,3,'#d3bd8e',(a.x+b.x)/2,.92,(a.z+b.z)/2,scene);path.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
 // Original plaza waypoint sits inside its fountain: route around the unchanged pool.
 Object.assign(townWaypoints.plazaWest,{x:-6.1,z:2});townWaypoints.fishShop.x=-10.9;townWaypoints.bakery.x=-10.9;townWaypoints.ramen.x=-8.8;townWaypoints.catCafe.x=9.5;townWaypoints.yarnShop.x=9.5;
 Object.assign(townWaypoints,{plazaNE:{x:-6.1,y:1,z:-1.5,name:'喷泉东北侧'},plazaNorth:{x:-9.5,y:1,z:-1.5,name:'喷泉北侧'},plazaSE:{x:-6.1,y:1,z:5.5,name:'喷泉东南侧'},plazaSouth:{x:-9.5,y:1,z:5.5,name:'喷泉南侧'}});
 waypointEdges.plazaWest=['bridgeWest','plazaNE','plazaSE'];waypointEdges.plazaNE=['plazaWest','plazaNorth'];waypointEdges.plazaNorth=['plazaNE','fishShop','waterfallW'];waypointEdges.plazaSE=['plazaWest','plazaSouth'];waypointEdges.plazaSouth=['plazaSE','bakery'];waypointEdges.fishShop=['plazaNorth','waterfallW'];waypointEdges.waterfallW=['plazaNorth','fishShop'];waypointEdges.bakery=['plazaSouth','ramen','southWest'];
 // Narrow decorative stepping stones are not wide enough for the common cat clearance.
 waypointEdges.southWest=waypointEdges.southWest.filter(k=>k!=='steppingMid');waypointEdges.southEast=waypointEdges.southEast.filter(k=>k!=='steppingMid');delete waypointEdges.steppingMid;delete townWaypoints.steppingMid;
 // Dedicated bank bays: queued residents never wait in the crossing or its exits.
 townWaypoints.bridgeWaitW={x:-6.1,y:1,z:8,name:'西岸桥外等候处'};waypointEdges.bridgeWaitW=['plazaSE'];waypointEdges.plazaSE.push('bridgeWaitW');
 townWaypoints.bridgeWaitE={x:6.3,y:1,z:5.5,name:'东岸桥外等候处'};waypointEdges.bridgeWaitE=['yarnShop'];waypointEdges.yarnShop.push('bridgeWaitE');
 townWaypoints.bridgeLandingE={x:6.3,y:1,z:2,name:'东岸桥口'};waypointEdges.bridgeLandingE=['bridgeEast','plazaEast','bridgeExitE'];waypointEdges.bridgeEast=['bridgePeak','bridgeLandingE'];waypointEdges.plazaEast=waypointEdges.plazaEast.filter(k=>k!=='bridgeEast');waypointEdges.plazaEast.push('bridgeLandingE');townWaypoints.bridgeExitE={x:6.3,y:1,z:-1.5,name:'东岸离桥处'};waypointEdges.bridgeExitE=['bridgeLandingE','catCafe'];waypointEdges.catCafe.push('bridgeExitE');
 townWaypoints.bridgeExitW={x:-6.1,y:1,z:-4.5,name:'西岸离桥处'};waypointEdges.bridgeExitW=['plazaNE','plazaNorth','fishShop'];waypointEdges.plazaNE.push('bridgeExitW');waypointEdges.plazaNorth.push('bridgeExitW');waypointEdges.fishShop.push('bridgeExitW');
 for(const[a,b]of[['plazaSE','bridgeWaitW'],['yarnShop','bridgeWaitE'],['plazaNE','bridgeExitW'],['bridgeLandingE','bridgeExitE']]){const A=townWaypoints[a],B=townWaypoints[b],length=Math.hypot(B.x-A.x,B.z-A.z),mesh=createVoxel(length+1,.12,2.6,'#d3bd8e',(A.x+B.x)/2,1.02,(A.z+B.z)/2,scene);mesh.rotation.y=-Math.atan2(B.z-A.z,B.x-A.x);}
 const segments=[];for(const [a,neighbors]of Object.entries(waypointEdges))for(const b of neighbors)if(a<b)segments.push([a,b]);
 function point(k){const p=townWaypoints[k];return v(p.x,p.y,p.z);}
 function nearest(p){let best=null;for(const [a,b]of segments){const A=point(a),B=point(b),dx=B.x-A.x,dz=B.z-A.z,t=Math.max(0,Math.min(1,((p.x-A.x)*dx+(p.z-A.z)*dz)/(dx*dx+dz*dz))),q=v(A.x+dx*t,A.y+(B.y-A.y)*t,A.z+dz*t),distance=Math.hypot(p.x-q.x,p.z-q.z);if(!best||distance<best.distance)best={a,b,t,q,distance};}return best;}
 function height(p,s){if(inBridge(p))return 1.325+Math.cos(Math.min(5.5,Math.abs(p.x))/5.5*Math.PI/2)*1.65;if(['bridgeWest','bridgePeak','bridgeEast'].includes(s.a)&&['bridgeWest','bridgePeak','bridgeEast'].includes(s.b))return 1.25+Math.cos(p.x/5.5*Math.PI/2)*1.65;return s.q.y;}
 function inBridge(p){return Math.abs(p.x)<=6.4&&Math.abs(p.z-2)<=1.25;}
 function validSolid(p){if(inBridge(p))return true;if(Math.abs(p.x)<4.8+RADIUS)return false;return !solidRects.some(b=>p.x>b.min.x-RADIUS&&p.x<b.max.x+RADIUS&&p.z>b.min.z-RADIUS&&p.z<b.max.z+RADIUS);}
 function walkPoint(p){const s=nearest(p);if(!s||s.distance>WIDTH+.01||!validSolid(p))return null;const q=p.clone();q.y=height(q,s);return q;}
 function lineClear(A,B){const count=Math.max(1,Math.ceil(A.distanceTo(B)/.5));for(let i=0;i<=count;i++)if(!validSolid(A.clone().lerp(B,i/count)))return false;return true;}
 function route(from,to){const S=nearest(from),E=nearest(to);if(!S||!E)return[];if(S.a===E.a&&S.b===E.b&&lineClear(from,to))return[to.clone()];const costs={},paths={},open=new Set(Object.keys(townWaypoints));for(const k of open)costs[k]=Infinity;for(const k of[S.a,S.b]){if(lineClear(from,point(k))){costs[k]=from.distanceTo(point(k));paths[k]=[k];}}while(open.size){let k=[...open].sort((a,b)=>costs[a]-costs[b])[0];open.delete(k);if(!Number.isFinite(costs[k]))break;for(const n of waypointEdges[k]){if(!lineClear(point(k),point(n)))continue;const c=costs[k]+point(k).distanceTo(point(n));if(c<costs[n]){costs[n]=c;paths[n]=[...paths[k],n];}}}const end=[E.a,E.b].filter(k=>lineClear(point(k),to)).sort((a,b)=>costs[a]+point(a).distanceTo(to)-costs[b]-point(b).distanceTo(to))[0];return end&&paths[end]?[...paths[end].map(point),to.clone()]:[];}
 const ownerRoot=new THREE.Group(),visual=new THREE.Group();ownerRoot.name='当前存档小猫';visual.rotation.y=Math.PI;ownerRoot.add(visual);visual.add(playerModel.root);scene.add(ownerRoot);
 const own={index:cats.length,isPlayer:true,root:ownerRoot,profile:{name:profile.name,role:'你的猫',emoji:'🐈',thoughts:['闻闻花香，再去看看小镇。']},currentNode:'plazaWest',targetNode:'plazaWest',state:'WANDER',animPhase:0,thoughtIndex:0};cats.push(own);ownerRoot.position.copy(point('plazaWest'));
 function blocksStep(from,p,self,c){
  if(c===self||Math.abs(c.root.position.y-p.y)>=2.4)return false;
  const other=c.root.position,before=flatDistance(from,other),after=flatDistance(p,other);
  if(before<DIAM-.001)return after<=before+.00001;
  const dx=p.x-from.x,dz=p.z-from.z,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((other.x-from.x)*dx+(other.z-from.z)*dz)/length)):0;
  return Math.hypot(from.x+dx*t-other.x,from.z+dz*t-other.z)<DIAM;
 }
 function occupiedFrom(from,p,self){return cats.some(c=>blocksStep(from,p,self,c));}
 function occupied(p,self){return occupiedFrom(self.root.position,p,self);}
 // Place residents on the same road graph, with one common radius before first display.
 const candidates=[];for(const[a,b]of segments){const A=point(a),B=point(b),n=Math.max(1,Math.floor(A.distanceTo(B)/2.5));for(let k=0;k<n;k++)candidates.push(A.clone().lerp(B,(k+.35)/n));}
 // Read final ground-level boxes before the original drop-in animation; no physics engine.
 solidRects.push({min:v(-11.4,1,.1),max:v(-7.6,1.9,3.9)});
 const originals=assemblySystem.items.map(item=>({item,y:item.obj.position.y,scale:item.obj.scale.clone()}));for(const {item}of originals){item.obj.position.y=item.targetY;if(item.targetScale)item.obj.scale.copy(item.targetScale);}scene.updateMatrixWorld(true);
 for(const mesh of cameraColliderMeshes){let node=mesh,isCat=false;while(node&&node!==scene){if(cats.some(c=>c.root===node)){isCat=true;break;}node=node.parent;}if(isCat||!mesh.geometry||mesh.material?.visible===false)continue;const box=new THREE.Box3().setFromObject(mesh),height=box.max.y-box.min.y;if(height>.7&&box.min.y<1.85&&box.max.y>1.6)solidRects.push({min:box.min.clone(),max:box.max.clone()});}
 for(const {item,y,scale}of originals){item.obj.position.y=y;item.obj.scale.copy(scale);}scene.updateMatrixWorld(true);
 for(let i=candidates.length-1;i>=0;i--)if(!validSolid(candidates[i])||bridgeNoStop(candidates[i])||Math.hypot(candidates[i].x+6.1,candidates[i].z-8)<DIAM||Math.hypot(candidates[i].x-6.3,candidates[i].z-5.5)<DIAM)candidates.splice(i,1);
 const placed=[own];for(const c of cats.filter(c=>!c.isPlayer)){let found=null;for(let k=0;k<candidates.length;k++){const p=candidates[(k+c.index*7)%candidates.length];if(placed.every(o=>o.root.position.distanceTo(p)>=DIAM+.1)){found=p;break;}}if(found)c.root.position.copy(found);placed.push(c);nav.set(c,{path:[],wait:0,hold:0,blocked:0});}
 nav.set(own,{path:[],wait:0,hold:0,blocked:0});
 // One bridge lease. Waiting bays never share its entry / exit corridor.
 const bridgeQueue=new Map();let bridgeOwner=null,bridgeTicket=0;
 const bridgeSide=p=>p.x<0?'west':'east';
 const bridgeWait={west:'bridgeWaitW',east:'bridgeWaitE'},bridgeGate={west:'bridgeWest',east:'bridgeEast'},bridgeExit={west:'bridgeExitW',east:'bridgeExitE'};
 function onBridge(p){return Math.abs(p.x)<5.8&&Math.abs(p.z-2)<1.6;}
 function bridgeCorridor(p){return onBridge(p)||p.x<0&&Math.abs(p.x+6.1)<1.35&&p.z> -2.7&&p.z<4.5||p.x>=5.5&&p.x<10.7&&p.z>-.5&&p.z<3.3;}
 function bridgeNoStop(p){return bridgeCorridor(p)||flatDistance(p,point('bridgeExitW'))<DIAM+.4||flatDistance(p,point('bridgeExitE'))<DIAM+.4;}
 function bridgeCommitted(c){const n=nav.get(c);return n?.bridgeTrip?.phase==='crossing'||n?.bridgeRecovery;}
 function flatDistance(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
 function ordinaryPath(c,p){const path=route(c.root.position,p);if(!path.length)return false;const n=nav.get(c);n.path=path;n.hold=0;n.blocked=0;return true;}
 function startBridgeRequest(c,p){
  const n=nav.get(c),side=bridgeSide(c.root.position),opposite=side==='west'?'east':'west';
  // At most one NPC physically waits on each bank; others keep their bank-local route.
  if(!c.isPlayer&&[...bridgeQueue.values()].some(t=>!t.cat.isPlayer&&t.side===side))return false;
  const north=c.root.position.z<2,wait=point(north?(side==='west'?'fishShop':'catCafe'):(c.isPlayer?(side==='west'?'plazaSouth':'yarnShop'):bridgeWait[side]));
  if(!ordinaryPath(c,wait))return false;
  const trip={cat:c,side,opposite,final:p.clone(),wait:wait.clone(),ticket:++bridgeTicket,phase:'approach'};
  n.bridgeTrip=trip;bridgeQueue.set(c,trip);if(c.isPlayer)say('在桥外等前面的小猫通过，轮到你会连续走到对岸。');return true;
 }
 function clearBridgeRequest(c){bridgeQueue.delete(c);if(bridgeOwner===c)bridgeOwner=null;const n=nav.get(c);if(n){n.bridgeTrip=null;n.bridgeRecovery=false;}}
 function recoverBridgeCat(c){
  const n=nav.get(c);if(!n||n.bridgeRecovery)return;
  clearBridgeRequest(c);n.hold=n.wait=n.blocked=0;n.bridgeRecovery=true;
  const side=bridgeSide(c.root.position),sign=side==='west'?-1:1;
  // Old overlaps may only separate, never deepen. Leave to the nearest bank,
  // retaining the current side of the deck so two stale cats need not swap lanes.
  const lane=Math.max(-1.1,Math.min(1.1,c.root.position.z-2));
  const edge=v(sign*5.9,1,2+lane),gate=v(sign*6.1,1,2),exit=point(bridgeExit[side]);
  n.path=[edge,gate,...route(gate,exit)];n.recoveryExit=exit;c.state='WANDER';
 }
 function serviceBridge(){
  for(const c of cats){const n=nav.get(c);if(!n)continue;
   if(n.bridgeRecovery){n.hold=n.wait=0;if(!onBridge(c.root.position)&&flatDistance(c.root.position,n.recoveryExit)<.25){n.bridgeRecovery=false;const target=n.recoveryTarget;n.recoveryTarget=null;if(target)go(c,target);else ordinaryPath(c,point(c.root.position.x<0?'fishShop':'catCafe'));}continue;}
   if(onBridge(c.root.position)&&bridgeOwner!==c)recoverBridgeCat(c);
  }
  if(bridgeOwner){const n=nav.get(bridgeOwner),trip=n?.bridgeTrip;
   if(!trip){bridgeOwner=null;}else{
    n.hold=n.wait=0;
    const exit=point(bridgeExit[trip.opposite]);
    if(flatDistance(bridgeOwner.root.position,exit)<.22){const c=bridgeOwner,final=trip.final;clearBridgeRequest(c);go(c,final);if(!c.isPlayer)n.wait=3.2;}
   }
  }
  if(bridgeOwner||cats.some(c=>nav.get(c)?.bridgeRecovery||onBridge(c.root.position)))return;
  const ready=[...bridgeQueue.values()].filter(t=>{const n=nav.get(t.cat);return n&&(!n.path.length||flatDistance(t.cat.root.position,t.wait)<DIAM+.5);});
  ready.sort((a,b)=>Number(b.cat.isPlayer)-Number(a.cat.isPlayer)||a.ticket-b.ticket||a.cat.index-b.cat.index);
  const next=ready[0];if(!next)return;
  const entry=point(bridgeGate[next.side]),other=point(bridgeGate[next.opposite]),exit=point(bridgeExit[next.opposite]);
  const approach=route(next.cat.root.position,entry),finish=route(other,exit);
  if(!approach.length||!finish.length)return;
  bridgeOwner=next.cat;next.phase='crossing';if(next.cat.isPlayer)say('轮到你过桥了，先走到对岸再停下。');bridgeQueue.delete(next.cat);
  const n=nav.get(next.cat);n.hold=n.wait=n.blocked=0;n.path=[...approach,point('bridgePeak'),other,...finish];
 }
 function resetBridgeTraffic(){
  bridgeOwner=null;bridgeQueue.clear();bridgeTicket=0;
  for(const c of cats){const n=nav.get(c);if(!n)continue;n.bridgeTrip=null;n.bridgeRecovery=false;n.path=[];n.hold=n.wait=0;
   if(onBridge(c.root.position))recoverBridgeCat(c);
   else if(bridgeCorridor(c.root.position)&&!c.isPlayer)ordinaryPath(c,point(c.root.position.x<0?'plazaNorth':'catCafe'));
  }
 }
 function go(c,p){
  const n=nav.get(c);if(!n)return false;
  if(n.bridgeTrip){n.bridgeTrip.final=p.clone();return true;}if(n.bridgeRecovery){if(c.isPlayer){n.recoveryTarget=p.clone();return true;}return false;}
  let target=p.clone();if(onBridge(target)||!c.isPlayer&&bridgeNoStop(target))target=point(bridgeSide(c.root.position)==='west'?'catCafe':'fishShop');
  const path=route(c.root.position,target);if(!path.length)return false;
  if(path.some(onBridge)||bridgeSide(c.root.position)!==bridgeSide(target))return startBridgeRequest(c,target);
  n.path=path;n.hold=n.blocked=0;const near=nearest(target);c.targetNode=near.t<.5?near.a:near.b;return true;
 }
 function move(c,dt,speed){
  const n=nav.get(c);if(!n.path.length)return false;
  const goal=n.path[0],delta=goal.clone().sub(c.root.position);delta.y=0;const distance=delta.length();
  if(distance<.12){c.root.position.y=height(c.root.position,nearest(c.root.position));n.path.shift();return false;}
  delta.divideScalar(distance);const step=Math.min(distance,speed*Math.min(dt,.05));
  // No opportunistic lane changes or reverse-to-middle fallback inside the bridge.
  const controlled=bridgeCommitted(c)||onBridge(c.root.position),angles=controlled||n.socialDeparture?[0]:[0,.38,-.38,.8,-.8,1.25,-1.25];let next=null;
  for(const angle of angles){const dx=delta.x*Math.cos(angle)-delta.z*Math.sin(angle),dz=delta.x*Math.sin(angle)+delta.z*Math.cos(angle),candidate=walkPoint(c.root.position.clone().add(v(dx*step,0,dz*step)));
   if(!candidate||onBridge(candidate)&&bridgeOwner!==c&&!n.bridgeRecovery||occupied(candidate,c))continue;next=candidate;break;
  }
  if(!next){n.blocked+=dt;
   // A collision requests a right of way decision. It must never start an
   // interaction or replace a player's goal with a social/automatic target.
   const straight=walkPoint(c.root.position.clone().addScaledVector(delta,step));
   if(straight)for(const other of cats)if(blocksStep(c.root.position,straight,c,other))yieldTraffic(c,other);
   return false;
  }
  n.blocked=0;const dx=next.x-c.root.position.x,dz=next.z-c.root.position.z,yaw=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(yaw-c.root.rotation.y),Math.cos(yaw-c.root.rotation.y));c.root.rotation.y+=diff*Math.min(1,dt*9);c.root.position.copy(next);return true;
 }
 function moveNPC(c,dt){
  const n=nav.get(c);if(!n)return;
  if(n.bridgeTrip||n.bridgeRecovery){n.hold=0;c.state=move(c,dt,c.index%3===0?2.8:2.1)?'WANDER':'GROOM';return;}
  if(contactMembers.has(c)){const contact=contactMembers.get(c);c.state=contact.phase==='acting'?contact.action:'SNIFF_FLOWER';return;}
  if(n.socialDeparture){n.hold=0;c.state=move(c,dt,2.1)?'WANDER':'GROOM';return;}
  if(bridgeNoStop(c.root.position)){n.hold=n.wait=0;if(!n.path.length||n.path.some(onBridge))ordinaryPath(c,point(c.root.position.x<0?'plazaNorth':'catCafe'));c.state=move(c,dt,2.1)?'WANDER':'GROOM';return;}
  if(n.hold>0){n.hold-=dt;return;}
  if(!n.path.length){n.wait-=dt;if(n.wait>0)return;
   const side=bridgeSide(c.root.position),cross=(Math.floor(elapsed/7)+c.index)%4===0;
   const keys=Object.keys(townWaypoints).filter(k=>!k.startsWith('bridge')&&!k.startsWith('garden')&&!bridgeNoStop(point(k))&&(bridgeSide(point(k))===side)!==cross);
   if(keys.length&&!go(c,point(keys[(Math.floor(elapsed/7)+c.index)%keys.length]))){const local=keys.find(k=>bridgeSide(point(k))===side);if(local)ordinaryPath(c,point(local));}
   n.wait=2+c.index%4;
  }
  c.state=move(c,dt,c.index%3===0?2.8:2.1)?'WANDER':'GROOM';
 }
  // Scene-only encounter lifetimes. No social store, rewards or hardware events.
 const pairStates=new Map(),contactMembers=new Map(),npcContacts=new Set();let ownContact=null;
 const socialClock=()=>performance.now(),EXIT_DISTANCE=DIAM+1.8,SOCIAL_COOLDOWN=10000;
 const pairKey=(a,b)=>[a.index,b.index].sort((x,y)=>x-y).join(':');
 function pairState(a,b){const key=pairKey(a,b);if(!pairStates.has(key))pairStates.set(key,{a,b,until:0,left:true});return pairStates.get(key);}
 function pairReady(a,b){const p=pairState(a,b),now=socialClock();return p.left&&now>=p.until&&[a,b].every(c=>!contactMembers.has(c)&&!nav.get(c).socialDeparture&&now>=(nav.get(c).socialReadyAt||0));}
 function latchPair(a,b){const p=pairState(a,b);p.until=socialClock()+SOCIAL_COOLDOWN;p.left=false;}
 function coolDown(c){nav.get(c).socialReadyAt=socialClock()+SOCIAL_COOLDOWN;}
 function cancelSocialDeparture(c){nav.get(c).socialDeparture=null;}
 function separationPath(c,other){
  if(nav.get(c).bridgeTrip||nav.get(c).bridgeRecovery||bridgeNoStop(c.root.position))return [];
  // Search the actual walkable road width. A waypoint behind a cat is not a
  // blocked destination when its route goes around a corner. Check each edge
  // from its own origin, using exactly the movement collision clearance.
  const origin=c.root.position.clone(),bank=bridgeSide(origin),spacing=.5;
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  dirs.sort((a,b)=>flatDistance(origin.clone().add(v(b[0],0,b[1])),other.root.position)-flatDistance(origin.clone().add(v(a[0],0,a[1])),other.root.position));
  const queue=[{x:0,z:0,p:origin,parent:null}],seen=new Set(['0:0']);let found=null,best=queue[0];
  for(let head=0;head<queue.length&&head<900;head++){
   const node=queue[head];
   if(flatDistance(node.p,other.root.position)>flatDistance(best.p,other.root.position))best=node;
   if(node.parent&&flatDistance(node.p,other.root.position)>=EXIT_DISTANCE+.25){found=node;break;}
   for(const[dx,dz]of dirs){
    const x=node.x+dx,z=node.z+dz,key=x+':'+z;if(Math.abs(x)>16||Math.abs(z)>16||seen.has(key))continue;
    const target=walkPoint(origin.clone().add(v(x*spacing,0,z*spacing)));if(!target||bridgeSide(target)!==bank||bridgeNoStop(target)||occupiedFrom(node.p,target,c))continue;
    const steps=Math.ceil(flatDistance(node.p,target)/.2);let clear=true;
    for(let i=1;i<=steps;i++){const p=node.p.clone().lerp(target,i/steps);if(!walkPoint(p)||bridgeNoStop(p)){clear=false;break;}}
    if(!clear)continue;seen.add(key);queue.push({x,z,p:target,parent:node});
   }
  }
  // Partial progress is useful in a crowd; replan from the reached position.
  // Never teleport, ignore a resident, or clear the physical collision radius.
  found=found||(flatDistance(best.p,other.root.position)>flatDistance(origin,other.root.position)+.2?best:null);
  const path=[];for(let node=found;node?.parent;node=node.parent)path.unshift(node.p);
  return path;
 }
 function roadSeparation(c,other,resumePath=nav.get(c).socialDeparture?.resumePath||[]){
  const n=nav.get(c);if(n.bridgeTrip||n.bridgeRecovery||bridgeNoStop(c.root.position))return false;
  n.socialDeparture={...n.socialDeparture,other,resumePath,retryAt:socialClock()+1200};n.hold=n.wait=n.blocked=0;n.path=separationPath(c,other);c.state=n.path.length?'WANDER':'GROOM';return n.path.length>0;
 }
 // Collision recovery uses one existing departure owner. A manual player
 // command wins; otherwise a stable resident order decides who backs away.
 function yieldRank(c){const root=nav.get(c).socialDeparture?.yieldRoot||c;return root.isPlayer?1000000:bridgeCommitted(root)?900000:1000-root.index;}
 function yieldTraffic(mover,blocker,seen=new Set()){
  let leader=mover,cat=blocker;if(yieldRank(leader)<yieldRank(cat)){leader=blocker;cat=mover;}
  if(seen.has(cat)||cat.isPlayer||bridgeCommitted(cat)||contactMembers.get(cat)===ownContact&&ownContact)return;
  // Never make a resident back toward a follower already in its yield chain.
  for(let c=leader,chain=new Set();c&&!chain.has(c);c=nav.get(c).socialDeparture?.other){if(c===cat)return;chain.add(c);}
  seen.add(cat);const n=nav.get(cat),root=nav.get(leader).socialDeparture?.yieldRoot||leader;
  const contact=contactMembers.get(cat);if(contact&&npcContacts.has(contact))finishNpcContact(contact,false);
  if(n.bridgeTrip)clearBridgeRequest(cat);
  const resume=n.socialDeparture?.resumePath||n.path.slice(-1).map(p=>p.clone());
  if(!n.socialDeparture||n.socialDeparture.other!==leader||socialClock()>=n.socialDeparture.retryAt){
   roadSeparation(cat,leader,resume);if(n.socialDeparture)n.socialDeparture.yieldRoot=root;
  }
  if(!n.path.length)for(const other of cats)if(other!==cat&&other!==leader&&flatDistance(cat.root.position,other.root.position)<DIAM+.6)yieldTraffic(cat,other,seen);
 }
 function finishOwnContact(resume=true,scatter=true){
  const contact=ownContact;if(!contact&&!interacting)return;
  const other=contact?.other||interacting,saved=contact?.saved||socialReturn;ownContact=null;interacting=null;socialReturn=null;chatUntil=0;
  if(!contact||contactMembers.get(own)===contact)contactMembers.delete(own);coolDown(own);
  if(other){if(!contact||contactMembers.get(other)===contact)contactMembers.delete(other);latchPair(own,other);coolDown(other);nav.get(other).hold=0;other.state='GROOM';if(scatter)roadSeparation(other,own);}
  nav.get(own).hold=0;own.state='GROOM';if(eventPhase==='idle'){card.hidden=true;card.querySelector('.world-event-actions').replaceChildren();setCore(false);}
  if(resume&&saved){nav.get(own).path=[];if(scatter&&other){if(!roadSeparation(own,other,saved.path))nav.get(own).path=nav.get(own).socialDeparture?[]:saved.path;}else nav.get(own).path=saved.path;renderControlMode();}
  else if(!nav.get(own).bridgeTrip&&!nav.get(own).bridgeRecovery)nav.get(own).path=[];
  renderControlMode();
  freeAt=elapsed+1;ambientNext=elapsed+8;
 }
 function beginNpcContact(a,b){
  if(a.isPlayer||b.isPlayer||!pairReady(a,b)||nav.get(a).bridgeTrip||nav.get(b).bridgeTrip||nav.get(a).bridgeRecovery||nav.get(b).bridgeRecovery||bridgeNoStop(a.root.position)||bridgeNoStop(b.root.position))return false;
  const contact={a,b,phase:'acting',action:'SNIFF_FLOWER',until:socialClock()+900};latchPair(a,b);npcContacts.add(contact);contactMembers.set(a,contact);contactMembers.set(b,contact);
  for(const c of[a,b]){const n=nav.get(c);n.path=[];n.hold=1;c.state='SNIFF_FLOWER';}
  const face=b.root.position.clone().sub(a.root.position);a.root.rotation.y=Math.atan2(face.x,face.z);b.root.rotation.y=a.root.rotation.y+Math.PI;return true;
 }
 function finishNpcContact(contact,scatter=true){if(!npcContacts.delete(contact))return;for(const c of[contact.a,contact.b]){if(contactMembers.get(c)===contact)contactMembers.delete(c);coolDown(c);nav.get(c).hold=0;c.state='GROOM';}latchPair(contact.a,contact.b);if(scatter){roadSeparation(contact.a,contact.b);roadSeparation(contact.b,contact.a);}}
 function serviceSocial(){
  const now=socialClock();for(const p of pairStates.values())if(!p.left&&flatDistance(p.a.root.position,p.b.root.position)>=EXIT_DISTANCE)p.left=true;
  for(const contact of[...npcContacts])if(now>=contact.until)finishNpcContact(contact);
  if(ownContact&&now>=ownContact.until){finishOwnContact(true);say('这次打招呼结束了，先各自逛一逛吧。');}
  for(const c of cats){const n=nav.get(c),departure=n.socialDeparture;if(!departure)continue;
   if(flatDistance(c.root.position,departure.other.root.position)>=EXIT_DISTANCE){n.socialDeparture=null;const goal=departure.resumePath.at(-1);if(goal&&(c.isPlayer||!cats.some(other=>other!==c&&flatDistance(goal,other.root.position)<DIAM+.2)))go(c,goal);continue;}
   if(now>=departure.retryAt&&(!n.path.length||n.blocked>.6)){roadSeparation(c,departure.other);if(!n.path.length)for(const other of cats)if(other!==c&&other!==departure.other&&flatDistance(c.root.position,other.root.position)<DIAM+.6)yieldTraffic(c,other);}
  }
 }
 function clearContacts(){finishOwnContact(false,false);for(const contact of[...npcContacts])finishNpcContact(contact,false);contactMembers.clear();pairStates.clear();for(const n of nav.values()){n.socialDeparture=null;n.socialReadyAt=0;}}

 const ui=document.createElement('section');ui.className='town-player-ui pet-world-ui';ui.innerHTML='<div class="world-top"><div class="world-card"><strong data-player-name></strong><span data-player-status></span></div></div><div class="town-player-controls"><button data-player-mode="free">自由活动</button><button data-player-mode="guide">我来引导</button><button data-player-focus>跟着我的猫</button><button data-player-garden>去小花园</button><button data-player-next>下个路标</button><button data-player-settle>完成散步</button></div><section class="town-player-card world-event" hidden role="dialog" aria-label="小镇偶遇"><strong class="world-event-title"></strong><p class="world-event-copy"></p><div class="world-event-actions"></div></section>';panel.append(ui);
 const townActions=[['[data-player-mode=free]','roam','自由','自由活动'],['[data-player-mode=guide]','trip','引导','点击小路引导'],['[data-player-focus]','camera','跟随','跟随自己的小猫'],['[data-player-garden]','globe','庭院','走到外围小花园或回小镇'],['[data-player-next]','walk','路标','前往下个散步路标'],['[data-player-settle]','check','完成','按原规则完成散步']];
 for(const [selector,icon,label,accessible]of townActions){const button=ui.querySelector(selector);button.setAttribute('aria-label',accessible);button.innerHTML='<span class="town-button-icon" aria-hidden="true">'+(root.CatOfflineIcons?.svg(icon,22)||'')+'</span><span class="town-button-copy">'+label+'</span>';}
 for(const [key,icon,label]of [['home','home','回家'],['zoom-out',null,'−'],['zoom-in',null,'＋']]){const button=panel.querySelector('[data-host="'+key+'"]');if(button){button.innerHTML=(icon?'<span aria-hidden="true">'+(root.CatOfflineIcons?.svg(icon,22)||'')+'</span>':'')+'<span>'+label+'</span>';}}
 // Approved compact courtyard HUD; old controls remain owned but are not a permanent dock.
 ui.querySelector('.town-player-controls').hidden=true;
 const mini=document.createElement('div');mini.className='town-mini-actions';mini.innerHTML='<button type="button" data-player-toggle>我来引导</button><button type="button" data-player-overview aria-label="鸟瞰小镇">鸟瞰</button><button type="button" data-player-return hidden>回到小猫</button>';mini.querySelector('[data-player-toggle]').className='world-roam';ui.querySelector('.world-top').append(mini.querySelector('[data-player-toggle]'));mini.className='world-bottom town-bottom';ui.append(mini);
 const pocket=document.createElement('button');pocket.type='button';pocket.className='world-roam town-pocket-toggle';pocket.textContent='行程与口袋';pocket.setAttribute('aria-expanded','false');ui.querySelector('.world-top').append(pocket);
 const tripDetails=document.createElement('section');tripDetails.id='town-trip-sheet';tripDetails.dataset.mode='world';tripDetails.hidden=true;tripDetails.setAttribute('role','dialog');tripDetails.setAttribute('aria-modal','false');tripDetails.setAttribute('aria-label','行程与口袋');
 for(const selector of['.m-handle','.m-head']){const node=document.querySelector('#m-sheet '+selector)?.cloneNode(true);if(node){for(const item of[node,...node.querySelectorAll('[id]')])if(item.id)item.id='town-'+item.id;tripDetails.append(node);}}
 if(!tripDetails.querySelector('.m-head')){const header=document.createElement('header');header.className='m-head';header.innerHTML='<h2></h2><button type="button"></button>';tripDetails.append(header);}
 const title=tripDetails.querySelector('h2');if(title)title.textContent='行程与口袋';const close=tripDetails.querySelector('.m-head button');if(close){close.textContent='收起';close.setAttribute('aria-label','收起行程与口袋');}
 const tripActions=document.createElement('div');tripActions.id='town-trip-sheet-body';tripActions.className='town-trip-actions';tripDetails.append(tripActions);
 for(const button of panel.querySelectorAll('[data-host^=zoom]')){button.classList.add('town-camera-control');tripActions.append(button);}
 tripActions.append(ui.querySelector('[data-player-next]'),ui.querySelector('[data-player-settle]'),mini.querySelector('[data-player-overview]'),mini.querySelector('[data-player-return]'),ui.querySelector('[data-player-garden]'));
 const tripLabel=document.createElement('p');tripLabel.className='world-hint';tripActions.prepend(tripLabel);
 const tripContent=document.createElement('section');tripContent.className='town-trip-content';tripContent.setAttribute('aria-label','本次行程与真实口袋');tripContent.innerHTML='<h3>本次行程</h3><ol data-town-journey></ol><h3>本次待带回</h3><p data-town-pending></p><h3>家中口袋</h3><p data-town-inventory></p>';tripLabel.after(tripContent);ui.append(tripDetails);
 function setDrawer(open){if(open)renderProgress();tripDetails.hidden=!open;tripDetails.classList.toggle('on',open);pocket.setAttribute('aria-expanded',String(open));pocket.textContent=open?'收起行程':'行程与口袋';}
 pocket.addEventListener('click',()=>{if(!coreActive)setDrawer(tripDetails.hidden);});close?.addEventListener('click',()=>setDrawer(false));
 function setCore(value){if(value===coreActive)return;if(value){drawerBeforeCore=!tripDetails.hidden;setDrawer(false);}coreActive=value;panel.dataset.townCore=String(value);if(!value&&drawerBeforeCore){setDrawer(true);drawerBeforeCore=false;}}
 const gateButton=document.createElement('button');gateButton.type='button';gateButton.className='town-garden-gate';gateButton.dataset.sceneGarden='';gateButton.textContent='小花园 →';ui.append(gateButton);
 const goalMarker=new THREE.Group();scene.add(goalMarker);createVoxel(.9,.06,.9,'#83b9ad',0,.05,0,goalMarker);createVoxel(.28,.08,.28,'#fff4d8',0,.10,0,goalMarker);goalMarker.visible=false;
 const gardenFlower=new THREE.Group();gardenFlower.name='可闻的庭院小花';gardenFlower.position.set(33,1.1,14);scene.add(gardenFlower);createVoxel(.12,.72,.12,'#73987c',0,.36,0,gardenFlower);createVoxel(.34,.16,.34,'#e8d59b',0,.78,0,gardenFlower);for(const[x,z]of[[.28,0],[-.28,0],[0,.28],[0,-.28]])createVoxel(.32,.16,.32,'#deb598',x,.76,z,gardenFlower);
 const status=ui.querySelector('[data-player-status]'),card=ui.querySelector('.town-player-card'),marker=new THREE.Group();scene.add(marker);createVoxel(.7,.08,.9,'#f3c68e',0,.02,0,marker);createVoxel(.22,.08,.22,'#8ba487',.35,.02,-.55,marker);
 const navigationGuide='轻点小路或桥面，带小猫去逛逛';let navigationErrorUntil=0;
 function say(text){navigationErrorUntil=0;status.textContent=text;}
 function navigationError(text){say(text);navigationErrorUntil=elapsed+3;}
 function clearAmbient(restore=false){if(!ambient)return;const old=ambient;ambient=null;gardenFlower.rotation.z=0;butterfly.visible=false;nav.get(own).hold=0;if(restore)nav.get(own).path=old.path;ambientNext=elapsed+9;own.profile.thoughts=['闻闻花香，再去看看小镇。'];root.CatTownExperience?.sceneChanged('ambient_finished');}
 function startAmbient(){
  if(mode!=='free'||destination||eventPhase!=='idle'||ownContact)return;
  const type=ambientCount++%2===0?'flower':'butterfly',target=point(type==='flower'?'gardenNorth':'gardenSouthPath'),path=nav.get(own).path.map(p=>p.clone());
  if(!go(own,target)){ambientNext=elapsed+9;return;}
  ambient={type,target,path,phase:'approach',until:Infinity};if(type==='butterfly'){butterfly.visible=true;butterfly.position.copy(target).add(v(1,2,0));}
  say(type==='flower'?'小猫走向路边的小花。':'小猫发现了花边的蝴蝶，慢慢走近。');root.CatTownExperience?.sceneChanged('ambient_approach');
 }
 function updateAmbient(){
  if(!ambient)return;if(mode!=='free'){clearAmbient();return;}
  if(ambient.phase==='approach'&&own.root.position.distanceTo(ambient.target)<.45){ambient.phase='action';ambient.until=elapsed+4.5;nav.get(own).path=[];nav.get(own).hold=4.5;const target=ambient.type==='flower'?gardenFlower.position:butterfly.position;own.root.rotation.y=Math.atan2(target.x-own.root.position.x,target.z-own.root.position.z);own.profile.thoughts=[ambient.type==='flower'?'花香钻进鼻子里，轻轻闻一闻。':'别飞太快呀，我只轻轻碰一下。'];own.thoughtIndex=0;say(own.profile.thoughts[0]);root.CatTownExperience?.sceneChanged('ambient_action');}
  if(ambient.phase==='action'&&elapsed>=ambient.until){clearAmbient(true);say('小猫抖抖耳朵，继续在庭院自由走动。');freeAt=elapsed+2;}
 }
 function focus(){followState.catIndex=own.index;toggleFollowMode(true);}
 function renderControlMode(){
  const guide=mode==='guide',button=ui.querySelector('[data-player-toggle]');
  button.textContent=guide?'引导中 · 切回自由':'自由中 · 我来引导';button.setAttribute('aria-pressed',String(guide));
  button.setAttribute('aria-label',guide?'当前引导模式，点击切回自由活动':'当前自由活动，点击我来引导');
  for(const b of ui.querySelectorAll('[data-player-mode]'))b.setAttribute('aria-pressed',String(b.dataset.playerMode===mode));
 }
 function takePlayerControl(value=null){
  // One cancellation boundary: no old callback, pose, pursuit or saved route
  // may outlive the user's next command. Completed store choices stay intact.
  commandRevision++;finishOwnContact(false,false);cancelSocialDeparture(own);clearAmbient();
  if(eventPhase!=='idle')endEvent(false,'');pendingEvent=null;eventSavedPath=[];socialReturn=null;interacting=null;chatUntil=0;
  card.hidden=true;card.querySelector('.world-event-actions').replaceChildren();setCore(false);setDrawer(false);
  const n=nav.get(own);if(n.bridgeTrip&&!bridgeCommitted(own))clearBridgeRequest(own);
  if(!bridgeCommitted(own))n.path=[];n.hold=n.wait=0;if(value!==null)mode=value;destination=null;goalMarker.visible=false;if(value==='guide')intro=3.8;
  renderControlMode();
 }
 function setMode(value){takePlayerControl(value);say(mode==='free'?'小猫沿路自由活动；点地面也可以带路。':navigationGuide);focus();}
 function next(){if(!journey[collected])return;say('走向'+townWaypoints[journey[collected].key].name);if(!go(own,goalPoint(journey[collected].key)))go(own,point('plazaEast'));}
 function renderProgress(){
  const current=journey[collected];tripLabel.textContent=(ended?'已完成散步':'散步路标')+' '+collected+'/'+journey.length+' · '+(currentPlace==='garden'?'暖阳庭院':'喵喵小镇');marker.visible=!!current;if(current)marker.position.copy(goalPoint(current.key));ui.querySelector('[data-player-next]').hidden=!current;ui.querySelector('[data-player-settle]').disabled=!journey.length||collected<journey.length||!session||ended;
  const list=tripContent.querySelector('[data-town-journey]');list.replaceChildren();
  for(const[index,node]of journey.entries()){const row=document.createElement('li');row.textContent=townWaypoints[node.key].name+' · '+(index<collected?'已走到':index===collected?'下一站':'待前往');list.append(row);}
  if(!journey.length){const row=document.createElement('li');row.textContent='当前没有进行中的散步行程，请回家后重新出发。';list.append(row);}
  // Read the original store projection. Walk nodes intentionally have no item;
  // pending finds and the saved inventory are separate, never invented rewards.
  const state=store?.getState?.(),items=state?.catalog?.items||[];
  const describe=bag=>items.filter(item=>Number(bag?.[item.id])>0).map(item=>item.name+' × '+bag[item.id]).join('、');
  const pending=tripContent.querySelector('[data-town-pending]'),inventory=tripContent.querySelector('[data-town-inventory]');
  pending.textContent=ended?'本次散步已结算。':!session?'当前没有待结算的行程。':describe(state?.pendingWorld?.items)||(session.activity?.id==='walk'?'牵绳散步记录路标，不采集物品；走完后点「完成」结算。':'本次还没有拾取物品，完成行程后才会放入口袋。');
  inventory.textContent=state?describe(state.inventory)||'口袋还是空的；探险或钓鱼带回物品后会显示在这里。':'口袋暂时无法读取，请回家后重新进入小镇。';
 }
 function showCard(title,copy,choices,blocking=true){card.querySelector('.world-event-title').textContent=title;card.querySelector('p').textContent=copy;const row=card.querySelector('div');row.replaceChildren();const revision=commandRevision;for(const [label,fn]of choices){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{if(revision!==commandRevision)return;card.hidden=true;fn();if(card.hidden&&eventPhase==='idle'&&elapsed>=chatUntil)setCore(false);});row.append(b);}card.hidden=false;setCore(blocking);nav.get(own).path=[];}
 function resident(c){
  if(!ownContact||ownContact.other!==c||bridgeNoStop(own.root.position)||bridgeNoStop(c.root.position)||nav.get(own).bridgeTrip||nav.get(c).bridgeTrip){finishOwnContact(true);return;}
  ownContact.phase='choosing';ownContact.until=Math.min(ownContact.hardUntil,socialClock()+8000);interacting=null;
  const face=c.root.position.clone().sub(own.root.position);own.root.rotation.y=Math.atan2(face.x,face.z);c.root.rotation.y=own.root.rotation.y+Math.PI;
  const n=nav.get(c);n.path=[];n.hold=8;nav.get(own).hold=8;chatUntil=elapsed+8;c.state=own.state='SNIFF_FLOWER';
  const token=ownContact;
  const choose=state=>{if(ownContact!==token)return;ownContact.phase='acting';ownContact.action=state;ownContact.until=Math.min(ownContact.hardUntil,socialClock()+4000);n.hold=nav.get(own).hold=4;chatUntil=elapsed+4;c.state=own.state=state;say(state==='PLAY'?'陪它玩一小会儿，然后继续走走。':'一起闻了闻花香，过会儿各自散步。');};
  showCard(c.profile.name,c.profile.thoughts[(Math.floor(elapsed)+c.index)%c.profile.thoughts.length]+' · 镇上居民互动；点地面或「我来引导」可随时结束。',[['一起闻花',()=>choose('SNIFF_FLOWER')],['陪它玩一会',()=>choose('PLAY')],['结束互动，继续散步',()=>{finishOwnContact(true);say('打过招呼，继续散步。');}]],false);
 }
 function clickNpc(index){
  if(eventPhase!=='idle')return;const c=cats[index];if(!c||c===own){focus();return;}
  if(ownContact?.other===c){say('正在和它打招呼；点小路可以结束互动。');return;}
  if(bridgeNoStop(c.root.position)||nav.get(c).bridgeTrip||nav.get(c).bridgeRecovery||nav.get(own).bridgeTrip||nav.get(own).bridgeRecovery){say('它正在过桥，等它走到岸边再打招呼。');return;}
  const previous=ownContact?.saved;if(ownContact)finishOwnContact(false);
  if(!pairReady(own,c)){say('先各自走开一点、逛一会儿，再来打招呼吧。');return;}
  const saved=previous||{path:nav.get(own).path.map(p=>p.clone())};takePlayerControl();
  ownContact={other:c,saved,phase:'approach',until:socialClock()+12000,hardUntil:socialClock()+20000};socialReturn=saved;interacting=c;contactMembers.set(own,ownContact);contactMembers.set(c,ownContact);
  latchPair(own,c);
  renderControlMode();
  cancelSocialDeparture(c);nav.get(c).hold=12;nav.get(c).path=[];c.state='GROOM';const dir=own.root.position.clone().sub(c.root.position);dir.y=0;if(dir.length()<.1)dir.set(1,0,0);
  const desired=c.root.position.clone().addScaledVector(dir.normalize(),DIAM+.35),snap=nearest(desired);
  if(!snap||!go(own,snap.q)){finishOwnContact(true);say('暂时走不到它身边，先继续散步吧。');return;}say('走近'+c.profile.name+'，停在它面前。');focus();
 }
 function goalPoint(key){const base=point(key);if(walkPoint(base))return base;let best=null,distance=Infinity;for(const[a,b]of segments)if(a===key||b===key)for(let i=0;i<=24;i++){const q=point(a).lerp(point(b),i/24),d=q.distanceTo(base);if(d<distance&&walkPoint(q)){best=q;distance=d;}}return best||base;}
 function targetPoint(p,place=null){
  const target=onBridge(p)?point(bridgeSide(own.root.position)==='west'?'catCafe':'fishShop'):bridgeNoStop(p)?point(bridgeSide(p)==='west'?'fishShop':'catCafe'):p,q=walkPoint(target);
  if(!q){navigationError('这里暂时没有可通行的小路，请换个路口。');return false;}
  takePlayerControl('guide');
  if(!go(own,q)){navigationError('这里暂时没有可通行的小路，请换个路口。');return false;}
  destination={point:q.clone(),place};if(place)root.CatTownExperience?.sceneChanged('moving_to_'+place);goalMarker.position.copy(q);goalMarker.visible=true;focus();
  say(nav.get(own).bridgeTrip?'已接收目标；通过桥后继续前往脚印。':place==='garden'?'沿路前往自己的暖阳庭院。':place==='street'?'沿入口步道回小镇。':'已设下脚印，跟着自己的猫走过去。');return true;
 }
 function pick(e){
  const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);raycaster.setFromCamera(mouse,camera);
  // The arched deck is above the ground plane. Use its actual mesh hit for
  // picking only; the existing road graph, bank lease and collisions still rule.
  const decks=occludableGroups.flatMap(group=>group.meshes).filter(mesh=>mesh.userData.townBridgeDeck);
  const deck=raycaster.intersectObjects(decks,false)[0];if(deck){const snapped=nearest(deck.point);if(snapped&&validSolid(snapped.q)){targetPoint(snapped.q);return;}}
  const ray=raycaster.ray;if(Math.abs(ray.direction.y)<.001)return;const t=(1-ray.origin.y)/ray.direction.y;if(t<=0)return;
  const raw=ray.origin.clone().addScaledVector(ray.direction,t),snap=nearest(raw);
  if(!validSolid(raw)){navigationError(Math.abs(raw.x)<4.8+RADIUS?'这里是河面，请点桥面或岸边小路。':'这里有建筑，请点旁边的小路。');return;}
  if(!snap||snap.distance>2.6||!validSolid(snap.q)){navigationError('这里没有可通行的小路，请换个位置。');return;}targetPoint(snap.q);
 }
 function handlePointer(e){if(mode==='guide'||eventPhase!=='idle'||ownContact){pick(e);return;}const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);raycaster.setFromCamera(mouse,camera);
  const visibleMeshes=[];for(const cat of cats)if(cat!==own)cat.root.traverse(mesh=>{if(mesh.isMesh&&mesh.visible&&mesh.material&&mesh.material.visible!==false&&(!mesh.material.transparent||mesh.material.opacity>.25)){mesh.userData.townPickedCat=cat.index;visibleMeshes.push(mesh);}});
  const hit=raycaster.intersectObjects(visibleMeshes,false)[0];if(hit){clickNpc(hit.object.userData.townPickedCat);return;}pick(e);
 }
 function beginEvent(type){
  eventRevision=commandRevision;pendingEvent=null;finishOwnContact(false,false);
  clearAmbient(true);socialReturn=null;
  eventSavedPath=interacting||chatUntil>elapsed?[]:nav.get(own).path.map(p=>p.clone());interacting=null;chatUntil=0;nav.get(own).path=[];nav.get(own).hold=0;own.state='GROOM';lastMoving=false;
  for(const [cat,n]of nav)if(cat!==own)n.hold=0;
  own.profile.thoughts=[{rain:'雨落到鼻尖了，先停下来缩缩耳朵。',butterfly:'蝴蝶停在花上，蹲下来看看。','lost-pouch':'路旁有个小包，回头等你一起看看。'}[type]];own.thoughtIndex=0;eventType=type;eventChoice=null;eventPhase='choosing';eventResumeAt=Infinity;butterfly.position.copy(own.root.position).add(v(1,1.8,1));butterfly.visible=type==='butterfly';eventFx.start(type);eventFx.frame(0);
  for(const b of ui.querySelectorAll('[data-player-overview],[data-player-return],#town-trip-sheet button,[data-scene-garden]'))b.disabled=true;
 }
 function endEvent(restore=true,message='偶遇结束，继续陪小猫逛逛；本次选择在完成散步时按原规则保存。'){
  const path=eventSavedPath,valid=eventRevision===commandRevision;eventSavedPath=[];pendingEvent=null;eventPhase='idle';eventChoice=null;eventResumeAt=0;eventType=null;
  setCore(false);card.hidden=true;eventFx.cleanup();butterfly.visible=false;pouch.visible=false;own.profile.thoughts=['闻闻花香，再去看看小镇。'];own.state='GROOM';chatUntil=0;nav.get(own).hold=0;
  if(restore&&valid&&mode==='free'&&path.length)go(own,path[path.length-1]);
  for(const b of ui.querySelectorAll('[data-player-toggle],[data-player-overview],[data-player-return],#town-trip-sheet button,[data-scene-garden]'))b.disabled=false;
  renderProgress();if(message)say(message);
 }
 function story(){
  if(mode!=='free'||destination||ambient||ownContact||nav.get(own).socialDeparture)return;
  if(bridgeNoStop(own.root.position)||nav.get(own).bridgeTrip||nav.get(own).bridgeRecovery)return;
  if(!session||eventShown||ended||!root.CatTownEventCatalogue)return;
  eventShown=true;const kinds=['butterfly','lost-pouch','rain'],type=kinds[[...String(session.token)].reduce((a,c)=>a+c.charCodeAt(0),0)%3],item=root.CatTownEventCatalogue(profile)[type];
  beginEvent(type);const revision=eventRevision,token=session.token;
  showCard(item[0],item[1],item[2].map(([choice,label])=>[label,()=>{
   if(revision!==commandRevision||eventPhase!=='choosing'||session?.token!==token)return;
   if(choice==='safe'&&type!=='rain'){endEvent(true,'已绕过这次偶遇，继续散步。');return;}
   // Commit only after this chosen action completes. Manual cancellation drops
   // this pending action; it never rolls back an already completed store event.
   pendingEvent={revision,token,type,choice};eventChoice=choice;eventPhase='reacting';eventResumeAt=elapsed+4.6;eventFx.choose(choice);
  }]));
 }
 function completeEvent(){
  const action=pendingEvent;if(!action||action.revision!==commandRevision||session?.token!==action.token){endEvent(false,'');return;}
  const result=store.applyWorldChoice(action.token,action.type,action.choice);
  if(result.ok){pendingEvent=null;endEvent();return;}
  pendingEvent=null;eventChoice=null;eventResumeAt=0;eventPhase='choosing';card.hidden=false;say(result.message||'这次选择尚未保存，请重新选择。');
 }
 let eventType=null,eventUntil=0;const pouch=new THREE.Group();scene.add(pouch);createVoxel(.6,.45,.35,'#bd9271',0,.23,0,pouch);createVoxel(.65,.12,.4,'#e6bf91',0,.48,0,pouch);pouch.visible=false;const butterfly=new THREE.Group();scene.add(butterfly);createVoxel(.12,.25,.12,'#775e69',0,0,0,butterfly);const leftWing=createVoxel(.5,.32,.06,'#ebbd8a',-.28,.06,0,butterfly),rightWing=createVoxel(.5,.32,.06,'#ebbd8a',.28,.06,0,butterfly);butterfly.visible=false;
 const eventFx=root.CatTownEventFx.create({parent:panel,view:{cat:ownerRoot,canvas:renderer.domElement,scene,hemi:{get intensity(){return hemiLight._legacyIntensity??hemiLight.intensity},set intensity(value){hemiLight.intensity=value}},sun:{get intensity(){return dirLight._legacyIntensity??dirLight.intensity},set intensity(value){dirLight.intensity=value}},bf:butterfly,ev:card,proj(p){const q=p.clone().project(camera);return{x:(q.x+1)/2,y:(1-q.y)/2};}}});
 function prepareProfile(value){playerModel.setStage(value.stage);playerModel.setAppearance({breed:value.breed,outfit:'none'});playerModel.applyAnimation('idle',0);visual.position.y=0;playerModel.root.scale.setScalar(1);const box=new THREE.Box3().setFromObject(playerModel.root),size=box.getSize(new THREE.Vector3()),stage={kitten:.64,baby:.64,young:.82,adult:1}[value.stage]||1;playerModel.root.scale.setScalar(2.25*stage/Math.max(1,size.y));box.setFromObject(playerModel.root);visual.position.y=ownerRoot.position.y-box.min.y;playerModel.setAppearance({breed:value.breed,outfit:value.outfit,stage:value.stage});}
 function begin(value,trip,engine){commandRevision++;pendingEvent=null;clearContacts();clearAmbient();ambientNext=10;ambientCount=0;socialReturn=null;setCore(false);setDrawer(false);destination=null;eventSavedPath=[];currentPlace='street';goalMarker.visible=false;own.profile.thoughts=['闻闻花香，再去看看小镇。'];eventFx.cleanup();eventPhase='idle';eventChoice=null;eventResumeAt=0;profile=value;session=trip;store=engine;elapsed=0;started=performance.now();intro=0;ended=false;eventShown=false;collected=0;interacting=null;card.hidden=true;eventType=null;eventUntil=0;butterfly.visible=false;pouch.visible=false;own.profile.name=value.name;own.profile.role='你的猫 · '+(value.stageLabel||value.stage||'');prepareProfile(value);const start=point('plazaWest');own.root.position.copy(!occupied(start,own)&&validSolid(start)?start:(candidates.find(p=>!occupied(p,own)&&validSolid(p))||start));nav.get(own).path=[];resetBridgeTraffic();journey=(trip?.nodes||[]).map((n,i)=>({...n,key:['fishShop','bakery','southWest','gardenCenter','plazaEast','catCafe'][i%6]}));ui.querySelector('[data-player-name]').textContent=value.name+' · 小镇散步';takePlayerControl();resetOverviewCamera();orbitState.target.set(8,4,4);orbitState.radius=Math.min(overviewRadius()+40,overviewRadius()*1.18);renderProgress();say('先看看完整小镇，稍后跟随'+value.name+'。');}
 function update(dt,time){lastMoving=false;elapsed+=dt;if(navigationErrorUntil&&elapsed>=navigationErrorUntil)say(nav.get(own).bridgeTrip?'在桥外等候，轮到你会连续走到对岸。':navigationGuide);ui.querySelector('[data-player-return]').hidden=followState.active;const gate=v(22,4,20).project(camera);gateButton.hidden=true;gateButton.textContent=own.root.position.x>21?'← 回小镇':'小花园 →';gateButton.style.left=(gate.x*.5+.5)*100+'%';gateButton.style.top=(-gate.y*.5+.5)*100+'%';const gardenButton=ui.querySelector('[data-player-garden]'),gardenLabel=currentPlace==='garden'?'回小镇':'去自己的小花园';const gardenCopy=gardenButton.querySelector('.town-button-copy');if(gardenCopy.textContent!==gardenLabel)gardenCopy.textContent=gardenLabel;if(intro<3.8){intro+=dt;if(intro>=3.8)focus();return;}if(root.CatOfflineDurable?.transactionPaused)return;if(destination&&own.root.position.distanceTo(destination.point)<.4){const reached=destination;destination=null;goalMarker.visible=false;if(reached.place){currentPlace=reached.place;if(currentPlace==='garden'){ambientNext=elapsed+.6;freeAt=elapsed+1;}root.CatTownExperience?.sceneChanged('arrived_'+currentPlace);ui.querySelector('[data-player-name]').textContent=profile.name+' · '+(currentPlace==='garden'?'暖阳庭院':'小镇散步');say(currentPlace==='garden'?'到自己的小花园了；可自由走动，行程与口袋里可回小镇。':'已沿原路回到小镇。');renderProgress();}}if(mode==='free'&&currentPlace==='garden'&&!ambient&&!destination&&!interacting&&!nav.get(own).socialDeparture&&eventPhase==='idle'&&card.hidden&&!coreActive&&elapsed>ambientNext)startAmbient();updateAmbient();if(nav.get(own).hold>0)nav.get(own).hold-=dt;let moving=false;if(eventPhase==='idle'&&card.hidden&&(nav.get(own).hold<=0||bridgeCommitted(own))){if(interacting){nav.get(interacting).hold=Math.max(nav.get(interacting).hold,1);const distance=own.root.position.distanceTo(interacting.root.position);if(distance<=DIAM+.65){const c=interacting;interacting=null;resident(c);}else if(elapsed>freeAt){freeAt=elapsed+1;const delta=own.root.position.clone().sub(interacting.root.position);delta.y=0;if(delta.length()<.1)delta.set(1,0,0);const q=nearest(interacting.root.position.clone().addScaledVector(delta.normalize(),DIAM+.35));go(own,q.q);}}if(mode==='free'&&!ownContact&&!interacting&&!ambient&&!nav.get(own).socialDeparture&&!nav.get(own).bridgeTrip&&!nav.get(own).bridgeRecovery&&!nav.get(own).path.length&&elapsed>freeAt){freeAt=elapsed+3;if(currentPlace==='garden'){go(own,point(['gardenCenter','gardenNorth','gardenSouthPath'][Math.floor(elapsed/5)%3]));}else if(journey[collected])next();else{const k=Object.keys(townWaypoints)[Math.floor(elapsed/5)%Object.keys(townWaypoints).length];go(own,point(k));}}moving=move(own,dt,2.6);}lastMoving=moving;own.state=moving?'WANDER':elapsed<chatUntil?own.state:'GROOM';own.animPhase+=dt*(moving||own.state==='PLAY'?7:1);playerModel.applyAnimation(moving||own.state==='PLAY'?'walk':'idle',own.animPhase);const head=playerModel.bones.get('head');if(head&&!moving&&own.state==='SNIFF_FLOWER')head.rotation.x-=.22;
 if(ambient){if(ambient.type==='butterfly'){butterfly.visible=true;const q=ambient.target;butterfly.position.set(q.x+1+Math.sin(elapsed*1.8)*.5,q.y+1.6+Math.sin(elapsed*2.3)*.3,q.z+Math.cos(elapsed*1.4)*.5);leftWing.rotation.y=Math.sin(elapsed*11)*.8;rightWing.rotation.y=-leftWing.rotation.y;}if(ambient.phase==='action'){lastMoving=false;playerModel.applyAnimation(ambient.type==='butterfly'?'paw':'idle',elapsed);const head=playerModel.bones.get('head');if(head&&ambient.type==='flower')head.rotation.x-=.24;gardenFlower.rotation.z=Math.sin(elapsed*3)*.07;}}
 if(eventPhase==='idle'&&session&&!ended&&journey[collected]&&own.root.position.distanceTo(goalPoint(journey[collected].key))<1.1){const result=store.collectWorldItem(session.token,journey[collected].id);if(result.ok){collected++;say('路标 '+collected+'/'+journey.length+' · '+result.message);renderProgress();}}
 if(elapsed>9&&card.hidden&&eventPhase==='idle')story();
 if(eventPhase!=='idle'){lastMoving=false;own.state='GROOM';playerModel.applyAnimation(eventType==='butterfly'&&eventChoice==='coins'?'walk':'idle',elapsed*5);eventFx.pose(playerModel,ownerRoot,elapsed,false);eventFx.frame(dt);if(eventType==='butterfly'){butterfly.visible=eventFx.moveButterfly(butterfly,ownerRoot,elapsed);leftWing.rotation.y=Math.sin(elapsed*9)*.65;rightWing.rotation.y=-leftWing.rotation.y;}if(eventPhase==='reacting'&&elapsed>=eventResumeAt)completeEvent();}
 }

 listen(ui,'click',e=>{const b=e.target.closest('button');if(!b)return;if(eventPhase!=='idle'&&!b.closest('.world-event-actions')&&!b.hasAttribute('data-player-toggle'))return;if(b.dataset.playerMode)setMode(b.dataset.playerMode);if(b.hasAttribute('data-player-toggle'))setMode(ownContact?'guide':mode==='free'?'guide':'free');if(b.hasAttribute('data-player-overview'))resetOverviewCamera();if(b.hasAttribute('data-player-return'))focus();if(b.hasAttribute('data-scene-garden')){setMode('guide');const back=own.root.position.x>21;go(own,point(back?'gardenSouth':'gardenCenter'));say(back?'沿入口步道走回小镇。':'沿入口步道走进小花园；点小镇道路可以原路回去。');}if(b.hasAttribute('data-player-focus'))focus();if(b.hasAttribute('data-player-garden'))targetPoint(point(currentPlace==='garden'?'gardenSouth':'gardenCenter'),currentPlace==='garden'?'street':'garden');if(b.hasAttribute('data-player-next')&&journey[collected])targetPoint(goalPoint(journey[collected].key));if(b.hasAttribute('data-player-settle')&&session&&!ended){const result=store.settleWorldActivity(session.token);say(result.message||'本次散步尚未完成。');if(result.ok){ended=true;session=null;renderProgress();}}});
 prepareProfile(profile);
 const prev=panel.querySelector('#btn-prev-cat'),nextCat=panel.querySelector('#btn-next-cat');if(prev)prev.hidden=true;if(nextCat)nextCat.hidden=true;
 return{begin,update,serviceBridge,serviceSocial,moveNPC,pick,handlePointer,clickNpc,focus,own,leave(){commandRevision++;pendingEvent=null;eventSavedPath=[];clearContacts();bridgeOwner=null;bridgeQueue.clear();for(const n of nav.values()){n.bridgeTrip=null;n.bridgeRecovery=false;}clearAmbient();socialReturn=null;setCore(false);setDrawer(false);goalMarker.visible=false;eventFx.cleanup();eventPhase='idle';eventChoice=null;card.hidden=true;interacting=null;butterfly.visible=false;pouch.visible=false;nav.get(own).path=[];},get completed(){return ended;},get projection(){return{scene:'away',action:lastMoving?'walk':ambient?.phase==='action'&&ambient.type==='butterfly'?'play':'idle',weather:eventType==='rain'&&eventPhase!=='idle'?'rain':'clear',petId:profile.id,region:currentPlace,revision:root.CatTownExperience?.sceneRevision||0,source:'town-original-store'};}};
}

function initialize(){if(initialized)return;initApp();orbitState.radius=overviewRadius();townPlayer=createTownPlayer();initialized=true;}
function show(options={}){if(disposed)throw Error('ORIGINAL_TOWN_DISPOSED');panel.hidden=false;initialize();panel.querySelector('#canvas-container').append(hostRenderer.domElement);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setSize(innerWidth,innerHeight,false);clock.oldTime=performance.now();clock.running=true;if(!shown){replayTownAssembly();shown=true;}townPlayer?.begin(options.profile||playerProfile,options.session||null,options.store||null);active=true;if(!frameId)frameId=requestAnimationFrame(animate);}
function hide(){townPlayer?.leave();active=false;cancelAnimationFrame(frameId);frameId=0;orbitState.isDraggingLeft=false;orbitState.isDraggingRight=false;panel.hidden=true;if(hostRenderer.domElement.parentNode!==parent)parent.insertBefore(hostRenderer.domElement,nextSibling?.parentNode===parent?nextSibling:null);hostRenderer.outputColorSpace=saved.outputColorSpace;hostRenderer.toneMapping=saved.toneMapping;hostRenderer.toneMappingExposure=saved.exposure;hostRenderer.setPixelRatio(saved.pixelRatio);hostRenderer.shadowMap.enabled=saved.shadowEnabled;hostRenderer.shadowMap.type=saved.shadowType;if(parent)hostRenderer.setSize(Math.max(1,parent.clientWidth),Math.max(1,parent.clientHeight),false);}
function renderNow(){initialize();updateCameraSystem(1,clock.getElapsedTime());if(skyDomeMesh)skyDomeMesh.position.copy(camera.position);renderer.render(scene,camera);}
function previewFrame(seconds=5){initialize();updateSkyDropAssembly(seconds);updateCats(0,seconds);updateEnvironmentAnimations(0,seconds);updateCameraSystem(1,seconds);if(skyDomeMesh)skyDomeMesh.position.copy(camera.position);renderer.render(scene,camera);}
function captureOverview(){initialize();const old=followState.active;followState.active=false;const pos=camera.position.clone(),quat=camera.quaternion.clone(),fov=camera.fov;previewFrame(5);const copy=document.createElement('canvas');copy.width=renderer.domElement.width;copy.height=renderer.domElement.height;copy.getContext('2d').drawImage(renderer.domElement,0,0);camera.position.copy(pos);camera.quaternion.copy(quat);camera.fov=fov;camera.updateProjectionMatrix();followState.active=old;return copy;}
function dispose(){if(disposed)return;hide();disposed=true;listeners.splice(0).forEach(fn=>fn());const geos=new Set(),mats=new Set(Object.values(matCache));scene?.traverse(n=>{if(n.geometry)geos.add(n.geometry);for(const m of(Array.isArray(n.material)?n.material:[n.material]))if(m)mats.add(m)});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());dirLight?.shadow?.map?.dispose();playerModel?.dispose();panel.remove();}
const calls={setLightingMood,toggleFollowMode,switchFollowedCat,cycleCameraShotOverride,resetOverviewCamera,replayTownAssembly};
listen(panel,'click',e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.host==='home'){onHome();return}if(button.dataset.host==='garden'){const b=panel.querySelector('[data-player-garden]');if(b)b.click();else onGarden();return}if(button.dataset.host==='zoom-out'){if(followState.active){camRig.userDistance=Math.min(36,(camRig.userDistance||18)+3);return;}orbitState.radius=Math.min(overviewRadius()+40,orbitState.radius+12);return}if(button.dataset.host==='zoom-in'){if(followState.active){camRig.userDistance=Math.max(12,(camRig.userDistance||18)-3);return;}orbitState.radius=Math.max(22,orbitState.radius-12);return}const code=button.dataset.townCall;if(!code)return;const m=code.match(/^(\w+)\((?:'([^']*)'|(-?\d+))?\)$/);if(!m||!calls[m[1]])return;calls[m[1]](m[2]??(m[3]!==undefined?Number(m[3]):undefined));});
return{show,hide,dispose,get playerProjection(){return townPlayer?.projection||null},get sessionComplete(){return townPlayer?.completed===true},renderNow,previewFrame,captureOverview,setLightingMood,resetOverviewCamera,toggleFollowMode,switchFollowedCat,cycleCameraShotOverride,get active(){return active},inspect(){let meshes=0;scene?.traverse(n=>{if(n.isMesh)meshes++});return{source:'original-town-137976B',originalSha256:"9a7fcadba1d79c27fdc3baba75c020fda79a43c3be5b125770bd43243977912f",active,disposed,initialized,engine:'shared-r185',ownsRenderer:false,frameScheduled:!!frameId,residents:cats.map(c=>({name:c.profile.name,role:c.profile.role,position:c.root.position.toArray(),state:c.state})),waypoints:townWaypoints,mood:currentMood,follow:followState.active,meshes,camera:{fov:camera?.fov,position:camera?.position.toArray()},render:renderer?{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}:null}}};
}};})(window);
