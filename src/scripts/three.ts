import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let canvasContainer: HTMLDivElement | null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let model: THREE.Group<THREE.Object3DEventMap>;
let clock: THREE.Clock;
let mouseX = 0;
let mouseY = 0;

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101010);

  camera = new THREE.PerspectiveCamera(75, (window.innerWidth / 2) / window.innerHeight, 0.01, 10000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth / 2, window.innerHeight);

  canvasContainer = document.querySelector<HTMLDivElement>('#canvas-container');
  if (!canvasContainer) return;

  canvasContainer.appendChild(renderer.domElement);

  addBackgroundTexture();

  renderer.setClearColor(0x101010);
  renderer.setAnimationLoop(animate);

  clock = new THREE.Clock();

  loadGLTFModel();
}

function addBackgroundTexture() {
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
          // NOTE: A fresnel shader might be needed to emphasize the corners some more.
        });
        child.material = material;
      }
    });

    const light = new THREE.DirectionalLight(0xFFFFFF);
    light.position.set(0, 2, 5);
    light.target.position.set(0, 0, 0);

    scene.add(model);
    scene.add(light);
    scene.add(light.target);

    fitModelToViewport(model);
  }, undefined, (err) => {
    console.error(err);
  });
}

function animate() {
  if (model) {
    mouseX = mouseX > (window.innerWidth / 2) ? window.innerWidth / 2 : mouseX
    const rotationX = (0.1 * ((mouseY / window.innerHeight) * Math.PI - Math.PI / 2)) + Math.PI / 2;
    const rotationY = 0.1 * ((mouseX / (window.innerWidth / 2)) * Math.PI - Math.PI / 2);

    model.rotation.z = -rotationY;
    model.rotation.x = rotationX;
  }

  renderer.render(scene, camera);
}

// Mouse move event listener to capture and update mouse coordinates
document.addEventListener('mousemove', (ev) => {
  mouseX = ev.clientX;
  mouseY = ev.clientY;
});

init();
