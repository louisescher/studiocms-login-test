import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { fitModelToViewport } from '@/utils/fitModelToViewport';

import { Pane } from 'tweakpane';

/**
 * List of valid images.
 */
const validImages = [
  { name: 'sky', format: 'png' },
  { name: 'grid-1', format: 'png' },
  { name: 'grid-2', format: 'png' },
  { name: 'layers', format: 'png' },
  { name: 'custom', format: 'web' },
] as const;

type ValidImage = typeof validImages[number];

const PARAMS = {
  background: 'sky',
  // ---
  color: '#ffffff',
  roughness: 0.6,
  transmission: 1,
  opacity: 1,
  transparent: true,
  thickness: 0.5,
  envMapIntensity: 1,
  clearcoat: 1,
  clearcoatRoughness: 0.2,
  metalness: 0,
  // ---
  outlineColor: '#aa87f4',
  customImageHref: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1744&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  edgeStrength: 2.0,
  edgeThickness: .1,
  edgeGlow: 0,
};

/**
 * Creates the StudioCMS Logo along with its background in a specified container.
 */
class StudioCMS3DLogo {
  canvasContainer: HTMLDivElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  model: THREE.Group<THREE.Object3DEventMap> | undefined;
  mouseX: number = 0;
  mouseY: number = 0;
  time: THREE.Clock;
  composer: EffectComposer;
  outlinePass: OutlinePass | undefined;
  outlinedObjects: THREE.Group<THREE.Object3DEventMap>[] = [];
  defaultComputedCameraZ: number | undefined;
  debugBackgroundMesh: THREE.Mesh | undefined;
  frustumHeight: number | undefined;

  /**
   * Creates the StudioCMS Logo along with its background in a specified container.
   * @param containerEl The container that the canvas is placed in.
   * @param outlineColor Color of the outline for the StudioCMS logo
   * @param reducedMotion Whether the user prefers reduced motion or not
   * @param debugWithBackgroundImage Whether to show a background image for debugging purposes. Disables the bloom effect.
   */
  constructor(containerEl: HTMLDivElement, outlineColor: THREE.Color, reducedMotion: boolean, debugWithBackgroundImage?: boolean, image?: ValidImage) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101010);
  
    this.camera = new THREE.PerspectiveCamera(75, (window.innerWidth / 2) / window.innerHeight, 0.01, 10000);
  
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth / 2, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio * 2);
    this.renderer.setClearColor(0x101010, 1);
    this.renderer.setAnimationLoop(this.animate);

    this.canvasContainer = containerEl;
    this.canvasContainer.appendChild(this.renderer.domElement);

    this.time = new THREE.Clock(true);

    this.composer = new EffectComposer(this.renderer);
  
    // Light 2, the sequel to light, now available
    const light2 = new THREE.AmbientLight(0x606060);
    this.scene.add(light2);

    const renderScene = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderScene);

    this.loadLogoModel();
    this.addPostProcessing(true, true, true, outlineColor, debugWithBackgroundImage || false);

    if (debugWithBackgroundImage) {
      this.addDebugBackgroundImage(image || validImages[0]);
      this.initTweakpane();
    }

    this.initListeners(reducedMotion);
    this.registerLoadingCallback();
  }

  animate = () => {
    if (this.model && this.canvasContainer) {
      // Movement courtesy of Otterlord, easing courtesy of Louis Escher
      const targetRotationX = this.mouseY === 0 ? Math.PI / 2 : (0.1 * ((this.mouseY / window.innerHeight) * Math.PI - Math.PI / 2)) + Math.PI / 2;
      const targetRotationY = this.mouseX === 0 ? 0 : 0.1 * ((this.mouseX / (window.innerWidth / 2)) * Math.PI - Math.PI / 2);

      const lerpFactor = .035;

      this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, targetRotationX, lerpFactor);
      this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, 0, lerpFactor);
      this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, -targetRotationY, lerpFactor);

      // this.model.rotation.set(rotationX, 0, -rotationY);
    }
  
    this.composer.render();
  }

  loadLogoModel = () => {
    const loader = new GLTFLoader();

    // Load the GLTF Model from the public dir & apply the material to all children
    loader.loadAsync('/studiocms-login-test/studiocms-logo.glb').then((gltf) => {
      this.model = gltf.scene;

      this.model.traverse((child) => {
        const isMesh = child instanceof THREE.Mesh;

        if (!isMesh) return;

        // const material1_old = new THREE.MeshPhysicalMaterial({
        //   roughness: .45,
        //   transmission: .9,
        //   thickness: .8,
        //   clearcoat: .5,
        //   clearcoatRoughness: .5
        // });

        const material = new THREE.MeshPhysicalMaterial(PARAMS);

        child.material = material;
      });

      this.scene.add(this.model);

      this.model.rotation.set(Math.PI / 2, 0, 0);

      // Fit the model into the camera viewport
      this.defaultComputedCameraZ = fitModelToViewport(this.model, this.camera);

      // Push to array for outline to be added
      this.outlinedObjects.push(this.model);
    });
  }

  addPostProcessing = (bloom: boolean, outlines: boolean, smaa: boolean, outlineColor: THREE.Color, debugImage: boolean) => {
    if (bloom && !debugImage) this.addBloom();
    if (outlines) this.addOutlines(outlineColor);
    if (smaa) this.addSMAA();
  }

  addOutlines = (outlineColor: THREE.Color) => {
    this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight), this.scene, this.camera);
  
    this.outlinePass.selectedObjects = this.outlinedObjects;
    this.outlinePass.edgeStrength = 2.0;
    this.outlinePass.edgeGlow = 0;
    this.outlinePass.edgeThickness = .1;
    this.outlinePass.pulsePeriod = 0;
    this.outlinePass.visibleEdgeColor.set(outlineColor);
    this.outlinePass.hiddenEdgeColor.set(new THREE.Color(0x000000));
    
    this.composer.addPass(this.outlinePass);
  }
  
  addBloom = () => {
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight), 1.5, 0.4, .85);
    bloomPass.threshold = 0;
    bloomPass.strength = 1.2;
    bloomPass.radius = 0;
  
    this.composer.addPass(bloomPass);
  }

  addSMAA = () => {
    const smaaPass = new SMAAPass(window.innerWidth / 2, window.innerHeight);
    smaaPass.renderToScreen = true;
    this.composer.addPass(smaaPass);
  }

  addDebugBackgroundImage = (image: ValidImage) => {
    const bgPositionZ = -5;

    // Height of the viewcone
    if (!this.frustumHeight) {
      this.frustumHeight = 9 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * Math.abs(this.camera.position.z - bgPositionZ);
    }
    
    const loader = new THREE.TextureLoader();
    loader.loadAsync(image.format === 'web' ? PARAMS.customImageHref : `/studiocms-login-test/${image.name}.${image.format}`).then((texture) => {
      const planeHeight = this.frustumHeight!;
      const planeWidth = planeHeight * (texture.source.data.width / texture.source.data.height);

      const bgGeo = new THREE.PlaneGeometry(planeWidth, planeHeight);
      const bgMat = new THREE.MeshBasicMaterial({ map: texture });

      this.debugBackgroundMesh = new THREE.Mesh(bgGeo, bgMat);
  
      this.debugBackgroundMesh.position.set(0, 0, bgPositionZ);
      this.scene.add(this.debugBackgroundMesh);
    });
  }

  initListeners = (reducedMotion: boolean) => {
    this.initResizeListener();

    if (!reducedMotion) {
      this.initMouseMoveListener();
    }
  }

  initResizeListener = () => {
    window.addEventListener('resize', () => {
      if (window.innerWidth > 850) {
        this.camera.aspect = (window.innerWidth / 2) / window.innerHeight;
        this.camera.updateProjectionMatrix();
  
        this.renderer.setSize(window.innerWidth / 2, window.innerHeight);
        this.composer.setSize(window.innerWidth / 2, window.innerHeight);

        // Move camera for smaller logo if necessary
        if (window.innerWidth < 1100 && this.defaultComputedCameraZ) {
          this.camera.position.set(
            this.camera.position.x,
            this.camera.position.y,
            this.defaultComputedCameraZ + 5
          );
        } else if (window.innerWidth >= 1100 && this.defaultComputedCameraZ) {
          this.camera.position.set(
            this.camera.position.x,
            this.camera.position.y,
            this.defaultComputedCameraZ
          );
        }
      }
    });
  }

  initMouseMoveListener = () => {
    // Mouse move event listener to capture and update mouse coordinates
    document.addEventListener('mousemove', (ev) => {
      this.mouseX = ev.clientX;
      this.mouseY = ev.clientY;
    });
  }

  registerLoadingCallback = () => {
    THREE.DefaultLoadingManager.onLoad = () => {
      this.canvasContainer.classList.add("loaded");
    }
  }

  initTweakpane = () => {
    const pane = new Pane({
      title: 'Dev Settings',
    });

    let f1 = pane.addFolder({
      title: 'Background',
    });

    let imageBlade = f1.addBinding(PARAMS, 'background', {
      options: validImages.map((image) => ({
        text: image.name, value: image.name
      })),
    });
    
    imageBlade.on('change', ({ value }) => {
      if (!this.debugBackgroundMesh) return;

      const image = validImages.find((x) => x.name === value);

      if (!image) return;

      this.debugBackgroundMesh!.removeFromParent();
      this.addDebugBackgroundImage(image);
    });

    let hrefBlade = f1.addBinding(PARAMS, 'customImageHref');
    
    hrefBlade.on('change', ({ value }) => {
      if (PARAMS.background !== 'custom') return;

      this.addDebugBackgroundImage({ name: value as any, format: 'web' });
    });

    let f2 = pane.addFolder({
      title: 'Frosted Glass Material',
    });
    
    f2.addBinding(PARAMS, 'color').on('change', this.recomputeGlassMaterial);

    f2.addBinding(PARAMS, 'roughness', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(PARAMS, 'transmission', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(PARAMS, 'opacity', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(PARAMS, 'transparent', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(PARAMS, 'thickness', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(PARAMS, 'envMapIntensity', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(PARAMS, 'clearcoat', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(PARAMS, 'clearcoatRoughness', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(PARAMS, 'metalness', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    let f3 = pane.addFolder({
      title: 'Model Outline',
    });

    f3.addBinding(PARAMS, 'outlineColor').on('change', ({ value }) => {
      if (!this.outlinePass) return;

      this.outlinePass.visibleEdgeColor = new THREE.Color(value as THREE.ColorRepresentation);
    });

    f3.addBinding(PARAMS, 'edgeStrength', {
      min: 0,
      max: 5,
    }).on('change', ({ value }) => {
      if (!this.outlinePass) return;
  
      this.outlinePass.edgeStrength = value;
    });

    f3.addBinding(PARAMS, 'edgeGlow', {
      min: 0,
      max: 25,
    }).on('change', ({ value }) => {
      if (!this.outlinePass) return;
  
      this.outlinePass.edgeGlow = value;
    });

    f3.addBinding(PARAMS, 'edgeThickness', {
      min: 0.1,
      max: 1,
    }).on('change', ({ value }) => {
      if (!this.outlinePass) return;
  
      this.outlinePass.edgeThickness = value;
    });
  }

  recomputeGlassMaterial = () => {
    if (!this.model) return;

    this.model.traverse((child) => {
      const isMesh = child instanceof THREE.Mesh;

      if (!isMesh) return;

      // const material1_old = new THREE.MeshPhysicalMaterial({
      //   roughness: .45,
      //   transmission: .9,
      //   thickness: .8,
      //   clearcoat: .5,
      //   clearcoatRoughness: .5
      // });

      const material = new THREE.MeshPhysicalMaterial(PARAMS);

      child.material = material;
    });
  }
}

const logoContainer = document.querySelector<HTMLDivElement>('#canvas-container')!;
const usingReducedMotion = window.matchMedia(`(prefers-reduced-motion: reduce)`).matches === true;
const smallScreen = window.matchMedia(`(max-width: 850px)`).matches === true;

if (!smallScreen) {
  new StudioCMS3DLogo(logoContainer, new THREE.Color(0xaa87f4), usingReducedMotion, true, validImages[0]);
}

// TODO:
// 1. Background anim (Astro Logo?)
// 2. On screen sizes between 1100px & 850px, make the camera be further away / the logo smaller