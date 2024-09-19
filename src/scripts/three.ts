import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

let canvasContainer: HTMLDivElement | null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let model: THREE.Group<THREE.Object3DEventMap>;
let sphereMesh: THREE.Mesh;
let mouseX = 0;
let mouseY = 0;
let time: THREE.Clock;
let composer: EffectComposer;

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101010);

  camera = new THREE.PerspectiveCamera(75, (window.innerWidth / 2) / window.innerHeight, 0.01, 10000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth / 2, window.innerHeight);

  canvasContainer = document.querySelector<HTMLDivElement>('#canvas-container');
  if (!canvasContainer) return;

  canvasContainer.appendChild(renderer.domElement);

  // Hidden, for debug purposes
  // addBackgroundImageTexture();
  addSphere();

  renderer.setClearColor(0x101010);
  renderer.setAnimationLoop(animate);

  time = new THREE.Clock(true);

  const renderScene = new RenderPass(scene, camera);

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight), 1.5, 0.4, .85);
  bloomPass.threshold = 0;
  bloomPass.strength = 1.5;
  bloomPass.radius = 0;

  composer = new EffectComposer( renderer );
  composer.addPass( renderScene );
  composer.addPass( bloomPass );

  loadGLTFModel();
}

function addSphere() {
  const sphere = new THREE.SphereGeometry(1);
  const sphereMaterial = new THREE.MeshStandardMaterial({
    emissive: new THREE.Color(0xbd0249),
  });

  sphereMesh = new THREE.Mesh(sphere, sphereMaterial);

  sphereMesh.position.set(0, 0, -1);
  scene.add(sphereMesh);
}

function addBackgroundImageTexture() {
  new THREE.TextureLoader().loadAsync("/studiocms-login-test/evening-sky.png").then((texture) => {
    const bgGeo = new THREE.PlaneGeometry(15, 15);
    const bgMaterial = new THREE.MeshBasicMaterial({ map: texture });
    const bgMesh = new THREE.Mesh(bgGeo, bgMaterial);

    bgMesh.position.set(0, 0, -1);
    scene.add(bgMesh);
  })
}

function fitModelToViewport(model: THREE.Group<THREE.Object3DEventMap>) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  model.position.x += (model.position.x - center.x);
  model.position.y += (model.position.y - center.y);
  model.position.z += (model.position.z - center.z);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

  cameraZ *= 2.5;
  camera.position.z = cameraZ;

  camera.updateProjectionMatrix();
}

function loadGLTFModel() {
  const loader = new GLTFLoader();
  loader.load('/studiocms-login-test/studiocms-logo.glb', (gltf) => {
    model = gltf.scene;

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // TODO: Change material to frosted glass here
        const material = new THREE.MeshPhysicalMaterial({
          roughness: .45,
          transmission: .9,
          thickness: .8,
          clearcoat: .5,
          clearcoatRoughness: .5
          // NOTE: A fresnel shader might be needed to emphasize the corners some more.
        });
        child.material = material;
      }
    });

    // Light 2, the sequel to light, now available (SQLite??????)
    const light2 = new THREE.AmbientLight( 0x606060 ); // soft white light
    scene.add( light2 );

    scene.add(model);

    fitModelToViewport(model);
  }, undefined, (err) => {
    console.error(err);
  });
}

function animate() {
  if (model && canvasContainer) {
    const rotationX = (0.1 * ((mouseY / window.innerHeight) * Math.PI - Math.PI / 2)) + Math.PI / 2;
    const rotationY = 0.1 * ((mouseX / (canvasContainer.clientWidth)) * Math.PI - Math.PI / 2);

    model.rotation.z = -rotationY;
    model.rotation.x = rotationX;
  }

  if (sphereMesh) {
    console.log("Why")
    sphereMesh.position.set(Math.cos(time.getElapsedTime()), sphereMesh.position.y, sphereMesh.position.z)
  }

  composer.render();
}

// Mouse move event listener to capture and update mouse coordinates
document.getElementById('canvas-container')!.addEventListener('mousemove', (ev) => {
  mouseX = ev.clientX;
  mouseY = ev.clientY;
});

init();
