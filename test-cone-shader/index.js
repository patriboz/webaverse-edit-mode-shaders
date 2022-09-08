import * as THREE from 'three';
import metaversefile from 'metaversefile';


const {useApp, useFrame, useLoaders, usePhysics, useCleanup, useLocalPlayer, useActivate, useInternals} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\/]*$/, '$1'); 
const textureLoader = new THREE.TextureLoader();
const testTexture = textureLoader.load(`${baseUrl}/textures/test.png`);

export default () => {  

    const app = useApp();
    const {camera} = useInternals();
    let cone = null;
    const group = new THREE.Group();
    (async () => {
        const u = `${baseUrl}/assets/cone2.glb`;
        cone = await new Promise((accept, reject) => {
            const {gltfLoader} = useLoaders();
            gltfLoader.load(u, accept, function onprogress() {}, reject);
            
        });
        cone.scene.children[0].material= new THREE.ShaderMaterial({
            uniforms: {
                uTime: {
                    value: 0,
                },
                iResolution: { value: new THREE.Vector3() },
                testTexture: {
                    value: testTexture
                },
            },
            vertexShader: `\
                
                ${THREE.ShaderChunk.common}
                ${THREE.ShaderChunk.logdepthbuf_pars_vertex}
            
            
                uniform float uTime;
        
                varying vec2 vUv;
                varying vec3 vPos;

            
                void main() {
                vUv = uv;
                vPos = position;
                vec4 modelPosition = modelMatrix * vec4(position, 1.0);
                vec4 viewPosition = viewMatrix * modelPosition;
                vec4 projectionPosition = projectionMatrix * viewPosition;
        
                gl_Position = projectionPosition;
                ${THREE.ShaderChunk.logdepthbuf_vertex}
                }
            `,
            fragmentShader: `\
                ${THREE.ShaderChunk.logdepthbuf_pars_fragment}
                uniform float uTime;
                uniform vec3 iResolution;

                uniform sampler2D testTexture;
                

                varying vec2 vUv;
                varying vec3 vPos;

                // void mainImage( out vec4 o, in vec2 fc ) {
                //     vec2 uv = fc / iResolution.xy;
                //     vec2 mid = uv - vec2(0.5);   
                   
                //     float a = 0.5 + atan(mid.y, mid.x) / 6.28;
                //     float t = fract(mod(uTime * 0.03, 1.0));
                //     float l = length(mid) * 0.2 + 0.4;
                
                    
                //     vec3 col = texture(testTexture, vec2(t, a), 3.0).rgb;
                //     float n = 1.0 - smoothstep(col.r * 0.3, col.r * 0.5, l)
                //         + smoothstep(col.r*0.5, col.r * 0.7, l * 0.7);
                //     o = vec4(mix(col, vec3(0.), n), 1.0);
                // }

#define S smoothstep
#define T uTime


mat2 Rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
}


float range(float oldValue, float oldMin, float oldMax, float newMin, float newMax) {
    float oldRange = oldMax - oldMin;
    float newRange = newMax - newMin;
    return (((oldValue - oldMin) * newRange) / oldRange) + newMin;
}



float cnoise(vec3 v) {
    float t = v.z * 0.3;
    v.y *= 0.8;
    float noise = 0.0;
    float s = 0.5;
    noise += range(sin(v.x * 0.9 / s + t * 10.0) + sin(v.x * 2.4 / s + t * 15.0) + sin(v.x * -3.5 / s + t * 4.0) + sin(v.x * -2.5 / s + t * 7.1), -1.0, 1.0, -0.3, 0.3);
    noise += range(sin(v.y * -0.3 / s + t * 18.0) + sin(v.y * 1.6 / s + t * 18.0) + sin(v.y * 2.6 / s + t * 8.0) + sin(v.y * -2.6 / s + t * 4.5), -1.0, 1.0, -0.3, 0.3);
    return noise;
}

float BallGyroid(vec3 p) {
    p.yz *= Rot(T * .2);
    p *= 2.;
    return abs(cnoise(p) * dot(sin(p), cos(p.yzx)) / 10.) - .02;
}

vec3 GetRayDir(vec2 uv, vec3 p, vec3 l, float z) {
    vec3 f = normalize(l-p),
        r = normalize(cross(vec3(0,1,0), f)),
        u = cross(f, r),
        c = f * z,
        i = c + uv.x * r + uv.y * u,
        d = normalize(i);
    return d;
}




vec3 RayPlane(vec3 ro, vec3 rd, vec3 p, vec3 n) {
    float t = dot(p - ro, n) / dot(rd, n);
    t = max(0., t);
    return ro  + rd * t;
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord-.5*iResolution.xy)/iResolution.y;
    float cds = dot(uv, uv); //center distance squared

    vec3 ro = vec3(0., 3, -3)*.6;
    
    
    vec3 rd = GetRayDir(uv, ro, vec3(0,0.,0), 1.);
    vec3 col = vec3(0);


    float light = .005 / cds;
    vec3 lightCol = vec3(1., .8, .7);
    float s = BallGyroid(normalize(ro));
    col += light * .3 * S(.2, .01, s) * lightCol;
   
    //volumetrics
    vec3 pp = RayPlane(ro, rd, vec3(0), normalize(ro));
    float sb = BallGyroid(normalize(pp));
    sb *= S(0.5, .1, cds);
    col += max(0., sb * 2.);
    
    col = pow(col, vec3(.4545));	// gamma correction
    col *= 1. - cds*.5;
    
    fragColor = vec4(col,1.0);
}
                
                void main() {
                    mainImage(gl_FragColor, vUv * iResolution.xy);
                    gl_FragColor *= vec4(0.120, 0.280, 1.920, 1.0) * (2. + (vPos.y + 1.));
                    float scanline = sin((vPos.y + 1.) * 80.0) * gl_FragColor.b * 0.04;
                    gl_FragColor -= scanline;
                    gl_FragColor.a *= pow(vPos.y + 1., 3.0);
                    
                ${THREE.ShaderChunk.logdepthbuf_fragment}
                }
            `,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        group.add(cone.scene);
        app.add(group);
        cone.scene.position.y = 2.3;
        cone.scene.rotation.x = Math.PI;
        cone.scene.scale.set(0.5, 0.5, 0.5);
        app.updateMatrixWorld();
        


    })();
    

    useFrame(({timestamp}) => {
        if (cone) {
            // group.rotation.y = camera.rotation.y;
            cone.scene.children[0].material.uniforms.uTime.value=timestamp / 1000;
            cone.scene.children[0].material.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1);
        }
        app.updateMatrixWorld();
        
    });

    return app;
}