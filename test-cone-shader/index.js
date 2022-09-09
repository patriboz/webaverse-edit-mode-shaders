import * as THREE from 'three';
import metaversefile from 'metaversefile';


const {useApp, useFrame, useLoaders, usePhysics, useCleanup, useLocalPlayer, useActivate, useInternals} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\/]*$/, '$1'); 
const textureLoader = new THREE.TextureLoader();
// const testTexture = textureLoader.load(`${baseUrl}/textures/test.png`);

export default () => {  

    const app = useApp();
    const {camera} = useInternals();
    const localPlayer = useLocalPlayer();

    const tildeGrabGroup = new THREE.Group();

    const localVector = new THREE.Vector3();
    const localVector2 = new THREE.Vector3();
    let currentDir = new THREE.Vector3();
    //################################################ trace playerDir ########################################
    {
        useFrame(() => {
            localVector.set(0, 0, -1);
            currentDir = localVector.applyQuaternion( localPlayer.quaternion );
            currentDir.normalize();
        });
    }
  
    {
        let iphone = null;
        (async () => {
            const u = `${baseUrl}/assets/iphone.glb`;
            const i = await new Promise((accept, reject) => {
                const {gltfLoader} = useLoaders();
                gltfLoader.load(u, accept, function onprogress() {}, reject);
                
            });
            iphone = i.scene;
            iphone.scale.set(0.1, 0.1, 0.1);
            tildeGrabGroup.add(iphone)
            app.add(tildeGrabGroup);
        })();
    
    
        let cone = null;
        const group = new THREE.Group();
        (async () => {
            const u = `${baseUrl}/assets/cone3.glb`;
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
    
                    varying vec2 vUv;
                    varying vec3 vPos;
    
                    #define S smoothstep
                    #define T uTime * 2.
    
    
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
    
                        vec3 ro = vec3(cnoise(vec3(T * 0.5)), 3, -3)*.6;
                        
                        
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
                        gl_FragColor *= vec4(0.120, 0.280, 1.920, 1.0) * (2. + (vPos.y + 1.8));
                        float scanline = sin((vPos.y + 1.8) * 80.0) * gl_FragColor.b * 0.04;
                        gl_FragColor -= scanline;
                        gl_FragColor.a *= pow(vPos.y + 1.8, 3.0);
                        
                    ${THREE.ShaderChunk.logdepthbuf_fragment}
                    }
                `,
                side: THREE.DoubleSide,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            });
            
            group.add(cone.scene);
            tildeGrabGroup.add(group);
            // app.add(group);
            cone.scene.rotation.x = Math.PI / 2;
            cone.scene.scale.set(0.5, 0.5, 0.5);
            cone.scene.position.y = 0.2;
            cone.scene.position.z = -0.02;
            app.updateMatrixWorld();
            
    
    
        })();


        const geometry = new THREE.BoxGeometry( 1, 1, 1 );
        const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        const cube = new THREE.Mesh( geometry, material );
        app.add( cube );
        
        const quaternion = new THREE.Quaternion();
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
        useFrame(({timestamp}) => {
            localVector2.set(currentDir.x, currentDir.y, currentDir.z).applyQuaternion(quaternion);
            tildeGrabGroup.position.copy(localPlayer.position);
            tildeGrabGroup.position.x += 0.3 * localVector2.x;
            tildeGrabGroup.position.z += 0.3 * localVector2.z;
            if (iphone) {
                iphone.rotation.copy(localPlayer.rotation);
            }
            if (cone) {
                // cone.scene.rotation.x = - Math.abs(Math.sin(timestamp * 0.0005)) * (Math.PI / 2);
                // group.rotation.y = camera.rotation.y;
                group.lookAt(cube.position)
                // group.rotation.copy(localPlayer.rotation);
                cone.scene.children[0].material.uniforms.uTime.value=timestamp / 1000;
                cone.scene.children[0].material.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1);
            }
            app.updateMatrixWorld();
            
        });
    }
    

    return app;
}