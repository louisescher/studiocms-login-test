varying vec3 vPositionW;
varying vec3 vNormalW;

void main() {
  vPositionW = normalize(vec3(modelViewMatrix * vec4(position, 1.0)).xyz);
  vNormalW = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}