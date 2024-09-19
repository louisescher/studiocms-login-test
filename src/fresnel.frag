varying vec3 vPositionW;
varying vec3 vNormalW;

void main() {   
  float fresnelTerm = (1.0 - -min(dot(vPositionW, normalize(vNormalW)), 0.0));
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0) * vec4(fresnelTerm);
}