// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\services\buildcores.js

// 3D PC Builder Service - With Rotation Controls and Labels

class Pc3DViewer {
    constructor() {
        this.container = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.isLoaded = false;
        this.isInitialized = false;
        this.containerId = 'sidebarPc3dViewer';
        this.bundleComponents = [];
        this.SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';
        this.autoRotate = true;
        this.rotationSpeed = 0.5;
        this._threeLoaded = false;
        this.controlButton = null;
        this.pcGroup = null;
        this._lightsAdded = false;
        this.animationId = null;
        this.isFirstRender = true;
        this.labelSprites = [];
        this.componentLabels = [];
    }

    isThreeLoaded() {
        return typeof THREE !== 'undefined' && typeof THREE.OrbitControls !== 'undefined';
    }

    async init(containerId) {
        this.containerId = containerId || 'sidebarPc3dViewer';
        this.container = document.getElementById(this.containerId);
        
        if (!this.container) {
            console.warn('⚠️ Container not found:', this.containerId);
            this.isInitialized = false;
            return false;
        }

        console.log('📦 Container found:', this.container.id);

        if (!this.isThreeLoaded()) {
            await this.loadThreeJS();
        }

        this.isInitialized = true;
        return true;
    }

    loadThreeJS() {
        return new Promise((resolve, reject) => {
            if (this.isThreeLoaded()) {
                this._threeLoaded = true;
                resolve();
                return;
            }

            if (typeof THREE !== 'undefined') {
                this._threeLoaded = true;
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
            script.onload = () => {
                const controlsScript = document.createElement('script');
                controlsScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
                controlsScript.onload = () => {
                    if (typeof THREE.OrbitControls === 'undefined' && typeof OrbitControls !== 'undefined') {
                        THREE.OrbitControls = OrbitControls;
                    }
                    this._threeLoaded = true;
                    resolve();
                };
                controlsScript.onerror = () => {
                    const fallbackScript = document.createElement('script');
                    fallbackScript.src = 'https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js';
                    fallbackScript.onload = () => {
                        if (typeof THREE.OrbitControls === 'undefined' && typeof OrbitControls !== 'undefined') {
                            THREE.OrbitControls = OrbitControls;
                        }
                        this._threeLoaded = true;
                        resolve();
                    };
                    fallbackScript.onerror = reject;
                    document.head.appendChild(fallbackScript);
                };
                document.head.appendChild(controlsScript);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    getImageUrl(imagePath) {
        if (!imagePath) return null;
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }
        return `${this.SUPABASE_URL}/storage/v1/object/public/images/${encodeURIComponent(imagePath)}`;
    }

    async displayComponents(components, options = {}) {
        console.log('🎮 Building 3D PC with components:', components.length);
        this.bundleComponents = components || [];
        
        this.container = document.getElementById(this.containerId);
        
        if (!this.container) {
            console.error('❌ Container not available:', this.containerId);
            return false;
        }

        if (!components || components.length === 0) {
            console.log('⚠️ No components to display');
            this.showEmptyState();
            return false;
        }

        if (!this._threeLoaded) {
            await this.loadThreeJS();
        }

        await new Promise(resolve => setTimeout(resolve, 50));

        if (typeof THREE === 'undefined') {
            console.error('❌ THREE is not loaded');
            this.showFallback();
            return false;
        }

        if (!this.scene || !this.renderer) {
            this.initThreeScene();
        }

        // Clear old PC group
        if (this.pcGroup) {
            this.scene.remove(this.pcGroup);
            this.disposeGroup(this.pcGroup);
            this.pcGroup = null;
        }

        // Clear old labels
        this.clearLabels();

        // Build new PC
        this.pcGroup = new THREE.Group();
        this.buildPc(components, this.pcGroup);
        this.scene.add(this.pcGroup);
        
        // Add labels after building
        this.addComponentLabels(components);
        
        if (this.controls) {
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }

        this.addControlButton();
        
        if (!this.animationId) {
            this.animate();
        }
        
        console.log('✅ 3D Viewer updated successfully');
        return true;
    }

    clearLabels() {
        // Remove old label sprites from scene
        this.labelSprites.forEach(sprite => {
            if (this.scene) this.scene.remove(sprite);
        });
        this.labelSprites = [];
        this.componentLabels = [];
    }

    disposeGroup(group) {
        if (!group) return;
        group.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
    }

    initThreeScene() {
        const container = this.container;
        const width = container.clientWidth || 300;
        const height = container.clientHeight || 250;

        console.log('🎬 Initializing Three.js scene:', width, 'x', height);

        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(3.5, 2.5, 4.5);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x1a1a2e, 1);
        container.appendChild(this.renderer.domElement);

        try {
            if (typeof THREE.OrbitControls !== 'undefined') {
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.08;
                this.controls.autoRotate = this.autoRotate;
                this.controls.autoRotateSpeed = this.rotationSpeed;
                this.controls.minDistance = 1.5;
                this.controls.maxDistance = 10;
                this.controls.target.set(0, 0, 0);
                this.controls.update();
            }
        } catch (e) {
            console.warn('OrbitControls error:', e);
        }

        this.setupLighting();
        this.addFloor();

        window.addEventListener('resize', () => this.onResize());

        this.isFirstRender = true;
        console.log('✅ Three.js scene initialized');
    }

    addFloor() {
        if (!this.scene) return;

        const gridHelper = new THREE.GridHelper(4, 10, 0x00d4ff, 0x444466);
        gridHelper.position.y = -1.1;
        this.scene.add(gridHelper);

        const circleGeometry = new THREE.RingGeometry(0.5, 1.8, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.05,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.rotation.x = -Math.PI / 2;
        circle.position.y = -1.09;
        this.scene.add(circle);
    }

    setupLighting() {
        if (!this.scene) return;

        const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
        mainLight.position.set(5, 8, 7);
        mainLight.castShadow = true;
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
        fillLight.position.set(-3, 2, -4);
        this.scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0x00d4ff, 0.2);
        rimLight.position.set(0, -3, 5);
        this.scene.add(rimLight);

        const pointLight = new THREE.PointLight(0x00d4ff, 0.3, 5);
        pointLight.position.set(0, 1, 1);
        this.scene.add(pointLight);

        this._lightsAdded = true;
    }

    buildPc(components, group) {
        console.log('🏗️ Building PC with components:', components.map(c => c.category).join(', '));

        const cpu = components.find(c => c.category === 'cpu');
        const gpu = components.find(c => c.category === 'gpu');
        const ram = components.find(c => c.category === 'ram');
        const motherboard = components.find(c => c.category === 'motherboard');
        const storage = components.find(c => c.category === 'storage');
        const psu = components.find(c => c.category === 'psu');
        const cooler = components.find(c => c.category === 'cooler');

        this.buildCase(group);
        if (motherboard) this.buildMotherboard(group, motherboard);
        if (cpu) this.buildCPU(group, cpu);
        if (ram) this.buildRAM(group, ram);
        if (gpu) this.buildGPU(group, gpu);
        if (storage) this.buildStorage(group, storage);
        if (psu) this.buildPSU(group, psu);
        if (cooler) this.buildCooler(group, cooler);
        this.addRGBEffects(group);

        console.log('✅ PC built with', group.children.length, 'objects');
    }

    buildCase(group) {
        const caseGeo = new THREE.BoxGeometry(2.6, 2.2, 1.2);
        const caseMat = new THREE.MeshPhysicalMaterial({
            color: 0x1a1a2e,
            metalness: 0.6,
            roughness: 0.3,
            transparent: true,
            opacity: 0.85,
            clearcoat: 0.1,
            side: THREE.DoubleSide,
        });
        const caseMesh = new THREE.Mesh(caseGeo, caseMat);
        caseMesh.position.set(0, 0, 0);
        caseMesh.castShadow = true;
        caseMesh.receiveShadow = true;
        group.add(caseMesh);

        const glassGeo = new THREE.PlaneGeometry(2.2, 1.8);
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.12,
            roughness: 0.02,
            metalness: 0.0,
            side: THREE.DoubleSide,
            clearcoat: 0.3,
        });
        const glassMesh = new THREE.Mesh(glassGeo, glassMat);
        glassMesh.position.set(0, 0, 0.61);
        group.add(glassMesh);

        const frameMat = new THREE.MeshPhysicalMaterial({
            color: 0x00d4ff,
            metalness: 0.8,
            roughness: 0.2,
            emissive: 0x00d4ff,
            emissiveIntensity: 0.05,
        });

        const topFrame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.03, 0.03), frameMat);
        topFrame.position.set(0, 1.1, 0.6);
        group.add(topFrame);

        const bottomFrame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.03, 0.03), frameMat);
        bottomFrame.position.set(0, -1.1, 0.6);
        group.add(bottomFrame);

        const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.2, 0.03), frameMat);
        leftFrame.position.set(1.3, 0, 0.6);
        group.add(leftFrame);

        const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.2, 0.03), frameMat);
        rightFrame.position.set(-1.3, 0, 0.6);
        group.add(rightFrame);
    }

    buildMotherboard(group, component) {
        const moboGeo = new THREE.BoxGeometry(1.4, 1.2, 0.05);
        const moboMat = new THREE.MeshPhysicalMaterial({
            color: 0x1a4a3e,
            metalness: 0.3,
            roughness: 0.6,
        });
        const moboMesh = new THREE.Mesh(moboGeo, moboMat);
        moboMesh.position.set(0, 0.05, 0.25);
        moboMesh.castShadow = true;
        group.add(moboMesh);

        const detailMat = new THREE.MeshPhysicalMaterial({
            color: 0x2a6a5e,
            metalness: 0.4,
            roughness: 0.5,
        });

        for (let i = 0; i < 3; i++) {
            const detail = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.02, 0.1),
                detailMat
            );
            detail.position.set(-0.4 + i * 0.4, 0.1, 0.3);
            group.add(detail);
        }

        const socketMat = new THREE.MeshPhysicalMaterial({
            color: 0x333344,
            metalness: 0.8,
            roughness: 0.2,
        });
        const socket = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.01, 0.6),
            socketMat
        );
        socket.position.set(0, 0.15, 0.25);
        group.add(socket);

        if (component) {
            console.log('✅ Motherboard added:', component.name);
        }
    }

    buildCPU(group, component) {
        const cpuGeo = new THREE.BoxGeometry(0.5, 0.06, 0.5);
        const cpuMat = new THREE.MeshPhysicalMaterial({
            color: 0x00d4ff,
            metalness: 0.7,
            roughness: 0.2,
            emissive: 0x00d4ff,
            emissiveIntensity: 0.3,
        });
        const cpuMesh = new THREE.Mesh(cpuGeo, cpuMat);
        cpuMesh.position.set(0, 0.22, 0.25);
        cpuMesh.castShadow = true;
        group.add(cpuMesh);

        const logoMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            emissive: 0x00d4ff,
            emissiveIntensity: 0.3,
        });
        const logo = new THREE.Mesh(
            new THREE.BoxGeometry(0.25, 0.005, 0.25),
            logoMat
        );
        logo.position.set(0, 0.25, 0.25);
        group.add(logo);

        if (component) {
            console.log('✅ CPU added:', component.name);
        }
    }

    buildRAM(group, component) {
        const ramCount = component?.quantity || 2;
        const ramColor = component ? 0xffd93d : 0x665533;

        for (let i = 0; i < Math.min(ramCount, 4); i++) {
            const ramGeo = new THREE.BoxGeometry(0.04, 0.35, 0.04);
            const ramMat = new THREE.MeshPhysicalMaterial({
                color: ramColor,
                metalness: 0.4,
                roughness: 0.3,
                emissive: component ? 0xffd93d : 0x000000,
                emissiveIntensity: 0.15,
            });
            const ramMesh = new THREE.Mesh(ramGeo, ramMat);
            const xPos = 0.45 + (i >= 2 ? 0.25 : 0);
            const zPos = 0.25 + (i % 2) * 0.15;
            ramMesh.position.set(xPos, 0.1, zPos);
            ramMesh.castShadow = true;
            group.add(ramMesh);

            const spreaderMat = new THREE.MeshPhysicalMaterial({
                color: 0x444466,
                metalness: 0.6,
                roughness: 0.3,
            });
            const spreader = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, 0.02, 0.06),
                spreaderMat
            );
            spreader.position.set(xPos, 0.28, zPos);
            group.add(spreader);
        }

        if (component) {
            console.log('✅ RAM added:', component.name, 'x' + ramCount);
        }
    }

    buildGPU(group, component) {
        const color = component ? 0xff6b6b : 0x663333;

        const gpuGeo = new THREE.BoxGeometry(0.6, 0.1, 0.5);
        const gpuMat = new THREE.MeshPhysicalMaterial({
            color: color,
            metalness: 0.6,
            roughness: 0.3,
            emissive: component ? 0xff6b6b : 0x000000,
            emissiveIntensity: 0.1,
        });
        const gpuMesh = new THREE.Mesh(gpuGeo, gpuMat);
        gpuMesh.position.set(-0.35, -0.35, 0.25);
        gpuMesh.castShadow = true;
        gpuMesh.receiveShadow = true;
        group.add(gpuMesh);

        for (let i = 0; i < 2; i++) {
            const fanGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.015, 16);
            const fanMat = new THREE.MeshPhysicalMaterial({
                color: 0x222233,
                metalness: 0.8,
                roughness: 0.2,
            });
            const fanMesh = new THREE.Mesh(fanGeo, fanMat);
            fanMesh.position.set(-0.35 + (i * 0.18) - 0.09, -0.35, 0.52);
            fanMesh.rotation.x = Math.PI / 2;
            group.add(fanMesh);

            const centerMat = new THREE.MeshPhysicalMaterial({
                color: 0x444466,
                metalness: 0.7,
                roughness: 0.3,
            });
            const center = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8),
                centerMat
            );
            center.position.set(-0.35 + (i * 0.18) - 0.09, -0.35, 0.52);
            center.rotation.x = Math.PI / 2;
            group.add(center);
        }

        const plateMat = new THREE.MeshPhysicalMaterial({
            color: 0x333344,
            metalness: 0.8,
            roughness: 0.2,
        });
        const plate = new THREE.Mesh(
            new THREE.BoxGeometry(0.45, 0.02, 0.35),
            plateMat
        );
        plate.position.set(-0.35, -0.25, 0.25);
        group.add(plate);

        if (component) {
            console.log('✅ GPU added:', component.name);
        }
    }

    buildStorage(group, component) {
        const color = component ? 0x00b894 : 0x336655;

        const storageGeo = new THREE.BoxGeometry(0.35, 0.03, 0.25);
        const storageMat = new THREE.MeshPhysicalMaterial({
            color: color,
            metalness: 0.5,
            roughness: 0.4,
        });
        const storageMesh = new THREE.Mesh(storageGeo, storageMat);
        storageMesh.position.set(0.5, -0.25, 0.25);
        storageMesh.castShadow = true;
        group.add(storageMesh);

        const labelMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            emissive: 0x00b894,
            emissiveIntensity: 0.05,
        });
        const label = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.005, 0.15),
            labelMat
        );
        label.position.set(0.5, -0.22, 0.25);
        group.add(label);

        if (component) {
            console.log('✅ Storage added:', component.name);
        }
    }

    buildPSU(group, component) {
        const color = component ? 0xfd79a8 : 0x664455;

        const psuGeo = new THREE.BoxGeometry(0.4, 0.18, 0.3);
        const psuMat = new THREE.MeshPhysicalMaterial({
            color: color,
            metalness: 0.7,
            roughness: 0.3,
            emissive: component ? 0xfd79a8 : 0x000000,
            emissiveIntensity: 0.05,
        });
        const psuMesh = new THREE.Mesh(psuGeo, psuMat);
        psuMesh.position.set(0.65, -0.75, -0.15);
        psuMesh.castShadow = true;
        group.add(psuMesh);

        const fanMat = new THREE.MeshPhysicalMaterial({
            color: 0x222233,
            metalness: 0.8,
            roughness: 0.2,
        });
        const fan = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, 0.015, 16),
            fanMat
        );
        fan.position.set(0.65, -0.75, 0.16);
        fan.rotation.x = Math.PI / 2;
        group.add(fan);

        if (component) {
            console.log('✅ PSU added:', component.name);
        }
    }

    buildCooler(group, component) {
        const color = component ? 0x74b9ff : 0x445566;

        for (let i = 0; i < 8; i++) {
            const finGeo = new THREE.BoxGeometry(0.3, 0.01, 0.3);
            const finMat = new THREE.MeshPhysicalMaterial({
                color: color,
                metalness: 0.8,
                roughness: 0.2,
            });
            const finMesh = new THREE.Mesh(finGeo, finMat);
            finMesh.position.set(0, 0.25 + (i * 0.012), 0.25);
            group.add(finMesh);
        }

        const baseMat = new THREE.MeshPhysicalMaterial({
            color: 0x334455,
            metalness: 0.9,
            roughness: 0.2,
        });
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.02, 0.35),
            baseMat
        );
        base.position.set(0, 0.22, 0.25);
        group.add(base);

        const fanGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16);
        const fanMat = new THREE.MeshPhysicalMaterial({
            color: 0x1a1a2e,
            metalness: 0.3,
            roughness: 0.5,
            transparent: true,
            opacity: 0.8,
        });
        const fanMesh = new THREE.Mesh(fanGeo, fanMat);
        fanMesh.position.set(0, 0.38, 0.25);
        group.add(fanMesh);

        if (component) {
            console.log('✅ Cooler added:', component.name);
        }
    }

    addRGBEffects(group) {
        const stripMat = new THREE.MeshPhysicalMaterial({
            color: 0x00d4ff,
            emissive: 0x00d4ff,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.4,
        });
        const stripGeo = new THREE.BoxGeometry(1.8, 0.015, 0.015);
        const stripMesh = new THREE.Mesh(stripGeo, stripMat);
        stripMesh.position.set(0, -0.85, 0.25);
        group.add(stripMesh);

        const strip2 = new THREE.Mesh(stripGeo.clone(), stripMat);
        strip2.position.set(0, 0.85, 0.25);
        group.add(strip2);

        const colors = [0xff6b6b, 0xffd93d, 0x00d4ff, 0x6c5ce7];
        for (let i = 0; i < 8; i++) {
            const led = new THREE.Mesh(
                new THREE.SphereGeometry(0.015, 6, 6),
                new THREE.MeshPhysicalMaterial({
                    color: colors[i % colors.length],
                    emissive: colors[i % colors.length],
                    emissiveIntensity: 0.5,
                })
            );
            led.position.set(-0.8 + i * 0.23, -0.85, 0.28);
            group.add(led);
        }
    }

    // ============================================
    // COMPONENT LABELS - Shows names in 3D view
    // ============================================

    addComponentLabels(components) {
        console.log('🏷️ Adding component labels...');
        
        // Define label positions for each component category
        const labelPositions = {
            cpu: { x: 0, y: 0.5, z: 0.25 },
            motherboard: { x: 0, y: 0.8, z: 0.25 },
            ram: { x: 0.7, y: 0.5, z: 0.3 },
            gpu: { x: -0.35, y: -0.1, z: 0.25 },
            storage: { x: 0.5, y: -0.05, z: 0.25 },
            psu: { x: 0.65, y: -0.5, z: -0.15 },
            cooler: { x: 0, y: 0.7, z: 0.25 }
        };

        // Define colors for each category
        const categoryColors = {
            cpu: '#00d4ff',
            motherboard: '#4CAF50',
            ram: '#ffd93d',
            gpu: '#ff6b6b',
            storage: '#00b894',
            psu: '#fd79a8',
            cooler: '#74b9ff'
        };

        // Define icons for each category
        const categoryIcons = {
            cpu: '🖥️',
            motherboard: '🔌',
            ram: '💾',
            gpu: '🎮',
            storage: '💿',
            psu: '⚡',
            cooler: '❄️'
        };

        components.forEach((component) => {
            if (!component || !component.category) return;
            
            const category = component.category;
            const pos = labelPositions[category];
            if (!pos) return;

            // Get a shortened name
            let displayName = component.name || category.toUpperCase();
            if (displayName.length > 20) {
                displayName = displayName.substring(0, 18) + '...';
            }

            // Create label with icon
            const icon = categoryIcons[category] || '📦';
            const color = categoryColors[category] || '#00d4ff';
            
            // Create the label sprite
            const label = this.createLabelSprite(
                `${icon} ${displayName}`,
                color,
                category.toUpperCase()
            );

            // Position the label above the component
            label.position.set(pos.x, pos.y + 0.3, pos.z);
            
            // Store label reference
            this.labelSprites.push(label);
            this.scene.add(label);
            
            console.log(`🏷️ Added label for ${category}: ${displayName}`);
        });

        console.log(`✅ Added ${this.labelSprites.length} labels`);
    }

    createLabelSprite(text, color, subtext) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        canvas.width = 512;
        canvas.height = 128;

        // Background with rounded rect
        const padding = 20;
        const radius = 16;
        const x = padding;
        const y = padding;
        const w = canvas.width - padding * 2;
        const h = canvas.height - padding * 2;

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        // Background
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();

        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, 'rgba(26, 26, 46, 0.85)');
        gradient.addColorStop(1, 'rgba(26, 26, 46, 0.92)');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Border
        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Main text
        ctx.shadowBlur = 0;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Icon/Emoji
        ctx.font = '32px Arial, sans-serif';
        ctx.fillStyle = color;
        ctx.fillText(text.split(' ')[0] || '📦', canvas.width / 2 - 120, canvas.height / 2);

        // Main text
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        const mainText = text.split(' ').slice(1).join(' ') || text;
        ctx.fillText(mainText, canvas.width / 2 + 20, canvas.height / 2 - 8);

        // Subtext (category)
        ctx.font = '16px Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(subtext || '', canvas.width / 2 + 20, canvas.height / 2 + 28);

        // Create texture and sprite
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            depthTest: false,
            sizeAttenuation: true,
            opacity: 0.95,
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(1.2, 0.3, 1);
        
        return sprite;
    }

    addControlButton() {
        const container = this.container;
        if (!container) return;

        const oldBtn = document.getElementById('pc3dControlBtn');
        if (oldBtn) oldBtn.remove();

        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = `
            position: absolute;
            bottom: 10px;
            right: 10px;
            z-index: 20;
            display: flex;
            flex-direction: column;
            gap: 6px;
        `;

        // Toggle rotation button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'pc3dControlBtn';
        toggleBtn.style.cssText = `
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 2px solid rgba(0,212,255,0.3);
            background: rgba(0,0,0,0.6);
            color: #00d4ff;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        `;
        toggleBtn.textContent = this.autoRotate ? '⏸' : '▶️';
        
        toggleBtn.addEventListener('click', () => {
            this.autoRotate = !this.autoRotate;
            toggleBtn.textContent = this.autoRotate ? '⏸' : '▶️';
            if (this.controls) {
                this.controls.autoRotate = this.autoRotate;
            }
        });

        // Toggle labels button
        const labelsBtn = document.createElement('button');
        labelsBtn.style.cssText = `
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 2px solid rgba(0,212,255,0.3);
            background: rgba(0,0,0,0.6);
            color: #00d4ff;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        `;
        labelsBtn.textContent = '🏷️';
        labelsBtn.title = 'Toggle Labels';
        
        let labelsVisible = true;
        labelsBtn.addEventListener('click', () => {
            labelsVisible = !labelsVisible;
            this.labelSprites.forEach(sprite => {
                sprite.visible = labelsVisible;
            });
            labelsBtn.style.opacity = labelsVisible ? '1' : '0.3';
        });

        btnContainer.appendChild(toggleBtn);
        btnContainer.appendChild(labelsBtn);
        container.style.position = 'relative';
        container.appendChild(btnContainer);
        this.controlButton = toggleBtn;
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        if (this.controls) {
            this.controls.update();
        }
        
        // Animate labels - slight floating effect
        this.labelSprites.forEach((sprite, index) => {
            if (sprite.visible) {
                const offset = Math.sin(Date.now() / 1000 + index * 1.5) * 0.03;
                sprite.position.y += offset * 0.01;
            }
        });
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    onResize() {
        if (!this.container || !this.camera || !this.renderer) return;
        
        const width = this.container.clientWidth || 300;
        const height = this.container.clientHeight || 250;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    showEmptyState() {
        if (!this.container) return;
        
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
        
        this.container.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 12px;
                color: rgba(255,255,255,0.3);
                font-size: 14px;
                flex-direction: column;
                gap: 10px;
            ">
                <i class="fas fa-cube" style="font-size: 48px; opacity: 0.3;"></i>
                <p>No components found</p>
            </div>
        `;
    }

    showFallback() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 12px;
                color: rgba(255,255,255,0.3);
                font-size: 14px;
                flex-direction: column;
                gap: 10px;
            ">
                <i class="fas fa-cube" style="font-size: 48px; opacity: 0.3;"></i>
                <p>3D view not available</p>
            </div>
        `;
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.clearLabels();
        
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        
        if (this.scene) {
            this.scene = null;
        }
        
        if (this.controls) {
            this.controls = null;
        }
        
        if (this.pcGroup) {
            this.disposeGroup(this.pcGroup);
            this.pcGroup = null;
        }
        
        this.isInitialized = false;
    }
}

export default Pc3DViewer;
window.Pc3DViewer = Pc3DViewer;