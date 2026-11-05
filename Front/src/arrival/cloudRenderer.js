const vertexSource = `attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0., 1.); }`;
const fragmentSource = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uOpen;
uniform float uShowcase;
float hash(vec3 p) {
  p = fract(p * .3183099 + vec3(.1, .2, .3));
  p *= 17.;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float f = .55 * noise(p);
  p = p * 2.03 + 7.3;
  f += .28 * noise(p);
  p = p * 2.01 + 3.1;
  return f + .14 * noise(p);
}
float cloudBank(vec3 p, vec3 center, vec3 inverseRadius) {
  return 1. - length((p - center) * inverseRadius);
}
float density(vec3 p) {
  p.y += uShowcase * 2.2;
  vec3 original = p;
  vec3 nearPoint = p;
  nearPoint.x = mod(p.x - uTime * .095 + 9., 18.) - 9.;
  vec3 middlePoint = p;
  middlePoint.x = mod(p.x - uTime * .065 + 9., 18.) - 9.;
  vec3 farPoint = p;
  farPoint.x = mod(p.x - uTime * .04 + 11., 22.) - 11.;
  vec3 wind = vec3(-uTime * .065, 0., 0.);
  float big = fbm(original * .9 + wind);
  float detail = noise(original * 5.8 + wind);
  float nearSpread = smoothstep(0., .78, uOpen) * 9.;
  float middleSpread = smoothstep(.12, .92, uOpen) * 8.;
  float farSpread = smoothstep(.30, 1., uOpen) * 10.;

  float nearBank = max(
    cloudBank(nearPoint, vec3(-3.8 - nearSpread, -1.4, 1.1), vec3(.24,.28,.24)),
    cloudBank(nearPoint, vec3(3.6 + nearSpread, .9, 2.1), vec3(.26,.29,.25)));
  float middleBank = max(
    cloudBank(middlePoint, vec3(-3.1 - middleSpread, 1.5, 5.), vec3(.22,.25,.21)),
    cloudBank(middlePoint, vec3(3.2 + middleSpread, -1.8, 6.), vec3(.23,.27,.22)));
  middleBank = max(middleBank,
    cloudBank(middlePoint, vec3(-.8 - middleSpread, 4.1, 5.8), vec3(.18,.32,.22)));
  float farBank = max(
    cloudBank(farPoint, vec3(-3. - farSpread, -1.7, 10.), vec3(.19,.24,.19)),
    cloudBank(farPoint, vec3(3. + farSpread, 2.3, 11.4), vec3(.20,.23,.18)));
  farBank = max(farBank,
    cloudBank(farPoint, vec3(.8 + farSpread, -4., 12.), vec3(.18,.30,.19)));

  float bank = max(nearBank, max(middleBank, farBank));
  return max(0., bank + .035 + (big - .50) * 1.1 - detail * .055) * 5.8;
}
void main() {
  vec2 uv = (gl_FragCoord.xy * 2. - uResolution) / uResolution.y;
  float dive = sin(uOpen * 3.14159265);
  float roll = dive * .055;
  uv = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * uv;
  vec3 ro = vec3(0., .4 + uShowcase * .7 - uOpen * 1.8, -5.5 + uOpen * 13.);
  vec3 rd = normalize(vec3(uv * (.83 + dive * .14), 1.5));
  vec3 sun = normalize(vec3(-.7, .8, -.5));
  vec3 sky = mix(vec3(.46,.69,.82), vec3(.14,.37,.56), smoothstep(-1.5, 1.8, uv.y));
  float glare = pow(max(0., dot(rd, normalize(vec3(-.65, .65, 1.)))), 12.);
  sky += vec3(.45,.33,.16) * glare;
  sky = mix(sky, vec3(.76,.84,.87), (1. - smoothstep(-1.4, .05, uv.y)) * uShowcase * .7);
  vec4 cloud = vec4(0.);
  float t = .12 + hash(vec3(gl_FragCoord.xy, 1.)) * .2;
  for (int i = 0; i < 56; i++) {
    vec3 p = ro + rd * t;
    float d = density(p);
    if (d > .01) {
      float light = clamp((d - density(p + sun * 1.1)) * 1.25 + .52, .08, 1.);
      vec3 shade = mix(vec3(.26,.36,.45), vec3(1.,.98,.90), light);
      shade = mix(shade, sky, 1. - exp(-t * .018));
      float alpha = 1. - exp(-d * .36);
      cloud.rgb += (1. - cloud.a) * shade * alpha;
      cloud.a += (1. - cloud.a) * alpha;
      if (cloud.a > .985) break;
    }
    t += .30;
  }
  float skyAlpha = 1. - smoothstep(.05, .68, uOpen);
  float alpha = cloud.a + (1. - cloud.a) * skyAlpha;
  vec3 color = (cloud.rgb + sky * skyAlpha * (1. - cloud.a)) / max(alpha, .001);
  gl_FragColor = vec4(color, alpha * (1. - smoothstep(.94, 1., uOpen)));
}`;
export function createCloudRenderer(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WEBGL_UNAVAILABLE');
  const shaders = [];
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('CLOUD_SHADER_FAILED'); }
    shaders.push(shader); return shader;
  }
  const program = gl.createProgram();
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('CLOUD_PROGRAM_FAILED');
  } catch (error) { shaders.forEach(s => gl.deleteShader(s)); gl.deleteProgram(program); throw error; }
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(['uResolution','uTime','uOpen','uShowcase'].map(name => [name, gl.getUniformLocation(program, name)]));
  return {
    render({ time, open, showcase = 0 }) {
      const width = Math.min(1440, Math.round(canvas.clientWidth * .8));
      const height = Math.round(canvas.clientHeight * width / Math.max(1, canvas.clientWidth));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height); }
      gl.uniform2f(uniforms.uResolution, width, height);
      gl.uniform1f(uniforms.uShowcase, showcase);
      gl.uniform1f(uniforms.uTime, time); gl.uniform1f(uniforms.uOpen, open);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    dispose() { gl.deleteBuffer(buffer); shaders.forEach(s => gl.deleteShader(s)); gl.deleteProgram(program); }
  };
}
