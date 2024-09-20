import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { fitModelToViewport } from '@/utils/fitModelToViewport';

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
  outlinedObjects: THREE.Group<THREE.Object3DEventMap>[] = [];
  defaultComputedCameraZ: number | undefined;

  /**
   * Creates the StudioCMS Logo along with its background in a specified container.
   * @param containerEl The container that the canvas is placed in.
   * @param outlineColor Color of the outline for the StudioCMS logo
   * @param reducedMotion Whether the user prefers reduced motion or not
   * @param debugWithBackgroundImage Whether to show a background image for debugging purposes. Disables the bloom effect.
   */
  constructor(containerEl: HTMLDivElement, outlineColor: THREE.Color, reducedMotion: boolean, debugWithBackgroundImage?: boolean) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101010);
  
    this.camera = new THREE.PerspectiveCamera(75, (window.innerWidth / 2) / window.innerHeight, 0.01, 10000);
  
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth / 2, window.innerHeight);
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
    this.addPostProcessing(true, true, outlineColor, debugWithBackgroundImage || false);

    if (debugWithBackgroundImage) {
      this.addDebugBackgroundImage();
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

        const material = new THREE.MeshPhysicalMaterial({
          roughness: .45,
          transmission: .9,
          thickness: .8,
          clearcoat: .5,
          clearcoatRoughness: .5
        });

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

  addPostProcessing = (bloom: boolean, outlines: boolean, outlineColor: THREE.Color, debugImage: boolean) => {
    if (bloom && !debugImage) this.addBloom();
    if (outlines) this.addOutlines(outlineColor)
  }

  addOutlines = (outlineColor: THREE.Color) => {
    const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight), this.scene, this.camera);
  
    outlinePass.selectedObjects = this.outlinedObjects;
    outlinePass.edgeStrength = 2.0;
    outlinePass.edgeGlow = 0;
    outlinePass.edgeThickness = .1;
    outlinePass.pulsePeriod = 0;
    outlinePass.visibleEdgeColor.set(outlineColor);
    outlinePass.hiddenEdgeColor.set(new THREE.Color(0x000000));
    
    this.composer.addPass(outlinePass);
  }
  
  addBloom = () => {
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight), 1.5, 0.4, .85);
    bloomPass.threshold = 0;
    bloomPass.strength = 1.2;
    bloomPass.radius = 0;
  
    this.composer.addPass(bloomPass);
  }

  addDebugBackgroundImage = () => {
    const loader = new THREE.TextureLoader();
    
    loader.loadAsync("/studiocms-login-test/evening-sky.png").then((texture) => {
      const bgGeo = new THREE.PlaneGeometry(15, 15);
      const bgMaterial = new THREE.MeshBasicMaterial({ map: texture });
      const bgMesh = new THREE.Mesh(bgGeo, bgMaterial);
  
      bgMesh.position.set(0, 0, -1);
      this.scene.add(bgMesh);
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
}

// function addSphere() {
//   const sphere = new THREE.SphereGeometry(1);
//   const sphereMaterial = new THREE.MeshStandardMaterial({
//     emissive: new THREE.Color(0x6366f1),
//   });

//   sphereMesh = new THREE.Mesh(sphere, sphereMaterial);

//   sphereMesh.position.set(0, 0, -1);
//   scene.add(sphereMesh);
// }

const logoContainer = document.querySelector<HTMLDivElement>('#canvas-container')!;
const usingReducedMotion = window.matchMedia(`(prefers-reduced-motion: reduce)`).matches === true;
const smallScreen = window.matchMedia(`(max-width: 850px)`).matches === true;

if (!smallScreen) {
  new StudioCMS3DLogo(logoContainer, new THREE.Color(0xaa87f4), usingReducedMotion, false);
}

// TODO:
// 1. Background anim (Astro Logo?)
// 2. On screen sizes between 1100px & 850px, make the camera be further away / the logo smaller