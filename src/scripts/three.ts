import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let canvasContainer: HTMLDivElement | null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let model: THREE.Group<THREE.Object3DEventMap>;

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101010);

  camera = new THREE.PerspectiveCamera(75, (window.innerWidth / 2) / window.innerHeight, 0.01, 10000);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth / 2, window.innerHeight);

  canvasContainer = document.querySelector<HTMLDivElement>('#canvas-container');
  if (!canvasContainer) return;

  canvasContainer.appendChild(renderer.domElement);

  renderer.setAnimationLoop(animate);

  loadGLTFModel();
}

/**
 * ChatGPT function because I've never worked with basic three.js & models at the same time
 */
function fitModelToViewport(model: THREE.Group<THREE.Object3DEventMap>) {
  // Compute bounding box of the model
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Reposition and center the model
  model.position.x += (model.position.x - center.x);
  model.position.y += (model.position.y - center.y);
  model.position.z += (model.position.z - center.z);

  // Calculate the model's largest dimension
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180); // Convert FOV to radians
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

  // Adjust camera position based on model size
  cameraZ *= 2.5; // Factor to add space around the model (optional)
  camera.position.z = cameraZ;

  // Update camera's near and far planes based on model size
  const maxZ = box.max.z;
  camera.near = Math.max(0.1, cameraZ - maxZ);
  camera.far = cameraZ + maxZ;

  camera.updateProjectionMatrix();
}

function loadGLTFModel() {
  const loader = new GLTFLoader();
  loader.load('/studiocms-logo.glb', (gltf) => {
    model = gltf.scene;
    model.rotation.set(Math.PI / 2, 0, 0);

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
  renderer.render(scene, camera);
}

init();