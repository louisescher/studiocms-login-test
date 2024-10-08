import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { fitModelToViewport } from '@/utils/fitModelToViewport';

import { Pane } from 'tweakpane';

/**
 * List of valid images.
 */
const validImages = [
  { name: 'skyline', format: 'png' },
  { name: 'grid-1', format: 'png' },
  { name: 'grid-2', format: 'png' },
  { name: 'astro-layers', format: 'png' },
  { name: 'astro-rays', format: 'png'},
  { name: 'studiocms-blobs', format: 'png'},
  { name: 'studiocms-blobs-light', format: 'png'},
  { name: 'studiocms-curves', format: 'png'},
  { name: 'studiocms-curves-light', format: 'png'},
  { name: 'custom', format: 'web' },
] as const;

type ValidImage = typeof validImages[number];

const bgPARAMS = {
  background: 'skyline',
  customImageHref: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
};

const glassPARAMS = {
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
};

const outlinePARAMS = {
  outlineColor: '#aa87f4',
  edgeStrength: .6,
  edgeThickness: .1,
  edgeGlow: 5.0,
};

const sitePARAMS = {
  lightMode: false,
}

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
  BackgroundMesh: THREE.Mesh | undefined;
  frustumHeight: number | undefined;

  /**
   * Creates the StudioCMS Logo along with its background in a specified container.
   * @param containerEl The container that the canvas is placed in.
   * @param outlineColor Color of the outline for the StudioCMS logo
   * @param reducedMotion Whether the user prefers reduced motion or not
   */
  constructor(containerEl: HTMLDivElement, outlineColor: THREE.Color, reducedMotion: boolean, image: ValidImage) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101010);
  
    this.camera = new THREE.PerspectiveCamera(75, (window.innerWidth / 2) / window.innerHeight, 0.01, 10000);
  
    this.renderer = new THREE.WebGLRenderer({ antialias: false, failIfMajorPerformanceCaveat: true });
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
    this.addPostProcessing(true, outlineColor);

    this.addBackgroundImage(image || validImages[0]);
    this.initTweakpane();

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

        const material = new THREE.MeshPhysicalMaterial(glassPARAMS);

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

  addPostProcessing = (outlines: boolean, outlineColor: THREE.Color) => {
    if (outlines) this.addOutlines(outlineColor);
  }

  addOutlines = (outlineColor: THREE.Color) => {
    this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight), this.scene, this.camera);
  
    this.outlinePass.selectedObjects = this.outlinedObjects;
    this.outlinePass.edgeStrength = 1.5;
    this.outlinePass.edgeGlow = 0;
    this.outlinePass.edgeThickness = .0000000001;
    this.outlinePass.pulsePeriod = 0;
    this.outlinePass.visibleEdgeColor.set(outlineColor);
    this.outlinePass.hiddenEdgeColor.set(new THREE.Color(0xffffff));
    
    this.composer.addPass(this.outlinePass);
  }

  addBackgroundImage = (image: ValidImage) => {
    const bgPositionZ = -5;

    // Height of the viewcone
    if (!this.frustumHeight) {
      this.frustumHeight = 9 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * Math.abs(this.camera.position.z - bgPositionZ);
    }
    
    const loader = new THREE.TextureLoader();
    loader.loadAsync(image.format === 'web' ? bgPARAMS.customImageHref : `/studiocms-login-test/${image.name}.${image.format}`).then((texture) => {
      const planeHeight = this.frustumHeight!;
      const planeWidth = planeHeight * (texture.source.data.width / texture.source.data.height);

      const bgGeo = new THREE.PlaneGeometry(planeWidth, planeHeight);
      const bgMat = new THREE.MeshBasicMaterial({ map: texture });

      this.BackgroundMesh = new THREE.Mesh(bgGeo, bgMat);
  
      this.BackgroundMesh.position.set(0, 0, bgPositionZ);
      this.scene.add(this.BackgroundMesh);
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
      expanded: false,
    });

    let imageBlade = f1.addBinding(bgPARAMS, 'background', {
      options: validImages.map((image) => ({
        text: image.name, value: image.name
      })),
    });
    
    imageBlade.on('change', ({ value }) => {
      if (!this.BackgroundMesh) return;

      const image = validImages.find((x) => x.name === value);

      if (!image) return;

      this.BackgroundMesh!.removeFromParent();
      this.addBackgroundImage(image);
    });

    let hrefBlade = f1.addBinding(bgPARAMS, 'customImageHref');
    
    hrefBlade.on('change', ({ value }) => {
      if (bgPARAMS.background !== 'custom') return;

      this.addBackgroundImage({ name: value as any, format: 'web' });
    });

    let f2 = pane.addFolder({
      title: 'Frosted Glass Material',
      expanded: false,
    });
    
    f2.addBinding(glassPARAMS, 'color').on('change', this.recomputeGlassMaterial);

    f2.addBinding(glassPARAMS, 'roughness', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(glassPARAMS, 'transmission', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(glassPARAMS, 'opacity', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(glassPARAMS, 'transparent', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(glassPARAMS, 'thickness', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(glassPARAMS, 'envMapIntensity', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(glassPARAMS, 'clearcoat', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(glassPARAMS, 'clearcoatRoughness', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    f2.addBinding(glassPARAMS, 'metalness', {
      min: 0,
      max: 1
    }).on('change', this.recomputeGlassMaterial);

    let f3 = pane.addFolder({
      title: 'Model Outline',
      expanded: false,
    });

    f3.addBinding(outlinePARAMS, 'outlineColor').on('change', ({ value }) => {
      if (!this.outlinePass) return;

      this.outlinePass.visibleEdgeColor = new THREE.Color(value as THREE.ColorRepresentation);
    });

    f3.addBinding(outlinePARAMS, 'edgeStrength', {
      min: 0,
      max: 5,
    }).on('change', ({ value }) => {
      if (!this.outlinePass) return;
  
      this.outlinePass.edgeStrength = value;
    });

    f3.addBinding(outlinePARAMS, 'edgeGlow', {
      min: 0,
      max: 25,
    }).on('change', ({ value }) => {
      if (!this.outlinePass) return;
  
      this.outlinePass.edgeGlow = value;
    });

    f3.addBinding(outlinePARAMS, 'edgeThickness', {
      min: 0.1,
      max: 1,
    }).on('change', ({ value }) => {
      if (!this.outlinePass) return;
  
      this.outlinePass.edgeThickness = value;
    });

    let f4 = pane.addFolder({
      title: 'Site',
      expanded: false,
    });

    f4.addBinding(sitePARAMS, 'lightMode').on('change', () => {
      document.documentElement.classList.toggle('light');
    })
  }

  recomputeGlassMaterial = () => {
    if (!this.model) return;

    this.model.traverse((child) => {
      const isMesh = child instanceof THREE.Mesh;

      if (!isMesh) return;

      const material = new THREE.MeshPhysicalMaterial(glassPARAMS);

      child.material = material;
    });
  }
}

const logoContainer = document.querySelector<HTMLDivElement>('#canvas-container')!;
const usingReducedMotion = window.matchMedia(`(prefers-reduced-motion: reduce)`).matches === true;
const smallScreen = window.matchMedia(`(max-width: 850px)`).matches === true;

if (!smallScreen) {
  try {
    new StudioCMS3DLogo(logoContainer, new THREE.Color(0xaa87f4), usingReducedMotion, validImages[0]);
  } catch(err) {
    // TODO: Show static image instead (configured background plus non-transparent logo in the same position, allow for custom bgs)
  }
}