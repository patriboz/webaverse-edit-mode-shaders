import * as THREE from 'three';

import metaversefile from 'metaversefile';
import {WebaverseShaderMaterial} from '../../materials.js';
import Simplex from '../../simplex-noise.js';
const {useApp, useFrame, useInternals, useLoaders, usePhysics, useLocalPlayer} = metaversefile;
const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const simplex = new Simplex();
const textureLoader = new THREE.TextureLoader();
const lightTexture = textureLoader.load(`${baseUrl}/textures/light.png`);
const maskTexture = textureLoader.load(`${baseUrl}/textures/mask5.png`);
const trapezoidTexture = textureLoader.load(`${baseUrl}/textures/trapezoid.png`);

export default () => {
  const app = useApp();
  const {camera} = useInternals();
  const localPlayer = useLocalPlayer();
  const _getGeometry = (geometry, attributeSpecs, particleCount) => {
    const geometry2 = new THREE.BufferGeometry();
    ['position', 'normal', 'uv'].forEach(k => {
    geometry2.setAttribute(k, geometry.attributes[k]);
    });
    geometry2.setIndex(geometry.index);

    const positions = new Float32Array(particleCount * 3);
    const positionsAttribute = new THREE.InstancedBufferAttribute(positions, 3);
    geometry2.setAttribute('positions', positionsAttribute);

    for(const attributeSpec of attributeSpecs){
        const {
            name,
            itemSize,
        } = attributeSpec;
        const array = new Float32Array(particleCount * itemSize);
        geometry2.setAttribute(name, new THREE.InstancedBufferAttribute(array, itemSize));
    }

    return geometry2;
  };
  {
    const particleCount = 20;
    const info = {
        fadeIn: [particleCount],
        maxOP: [particleCount],
    }
    const attributeSpecs = [];
    attributeSpecs.push({name: 'scales', itemSize: 1});
    attributeSpecs.push({name: 'opacity', itemSize: 1});
    attributeSpecs.push({name: 'rotation', itemSize: 3});
    const geometry2 = new THREE.PlaneBufferGeometry(0.25, 1.2);
    const geometry = _getGeometry(geometry2, attributeSpecs, particleCount);
    const scAttribute = geometry.getAttribute('scales');
    const opAttribute = geometry.getAttribute('opacity');
    for(let i = 0; i < particleCount; i++){
        scAttribute.setX(i, 0.8 + Math.random() * 0.5);
        opAttribute.setX(i, Math.random());
        info.fadeIn[i] = true;
        info.maxOP[i] = 0.5 + Math.random() * 0.5;
    }
    scAttribute.needsUpdate = true;
    opAttribute.needsUpdate = true;

    const material = new THREE.ShaderMaterial({
        uniforms: {
            maskTexture: {
                value: maskTexture
            },
            trapezoidTexture: {
                value: trapezoidTexture
            }
        },
        vertexShader: `
            ${THREE.ShaderChunk.common}
            ${THREE.ShaderChunk.logdepthbuf_pars_vertex}
            attribute float scales;
            attribute float opacity;
            attribute vec3 rotation;
            attribute vec3 positions;

            varying vec2 vUv;
            varying float vOpacity;
            varying vec3 vPos;
           
            void main() {  
                mat3 rotX = mat3(
                    1.0, 0.0, 0.0, 
                    0.0, cos(rotation.x), sin(rotation.x), 
                    0.0, -sin(rotation.x), cos(rotation.x)
                );
                mat3 rotY = mat3(
                    cos(rotation.y), 0.0, -sin(rotation.y), 
                    0.0, 1.0, 0.0, 
                    sin(rotation.y), 0.0, cos(rotation.y)
                );
                mat3 rotZ = mat3(
                    cos(rotation.z), sin(rotation.z), 0.0,
                    -sin(rotation.z), cos(rotation.z), 0.0, 
                    0.0, 0.0 , 1.0
                );
                vOpacity = opacity;
                vUv = uv;
                vPos = position;
                vec3 pos = position;
                pos.x *= scales;
                pos *= rotY;
                pos *= rotZ;
                pos *= rotX;
                pos += positions;
                

                vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
                vec4 viewPosition = viewMatrix * modelPosition;
                vec4 projectionPosition = projectionMatrix * viewPosition;
                gl_Position = projectionPosition;
                ${THREE.ShaderChunk.logdepthbuf_vertex}
            }
        `,
        fragmentShader: `
            ${THREE.ShaderChunk.logdepthbuf_pars_fragment}
            uniform sampler2D maskTexture;
            uniform sampler2D trapezoidTexture;
            
            varying vec2 vUv;
            varying float vOpacity;
            varying vec3 vPos;

            void main() {
                
                vec4 mask = texture2D(maskTexture, vUv); 
                vec4 trapezoid = texture2D(trapezoidTexture, vUv); 
                
                // scanline
                float scanline = sin(vPos.y * 160.0) * 0.04;
                
                
                gl_FragColor = trapezoid * vec4(0.120, 0.280, 1.920, 1.0) * (1. + vUv.y);
                
                
                if (gl_FragColor.b > 0.)
                    gl_FragColor -= scanline;
                gl_FragColor.a = vOpacity * pow(vUv.y, 1.0);
                
                ${THREE.ShaderChunk.logdepthbuf_fragment}
                
            }
        `,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const godRay = new THREE.InstancedMesh(geometry, material, particleCount);
    const group = new THREE.Group();
    group.add(godRay);
    app.add(group)
    group.rotation.x = -Math.PI;
    // group.position.y = 4.3;
    
    useFrame(({timestamp}) => {
        group.position.copy(localPlayer.position);
        group.position.y += localPlayer.avatar ? localPlayer.avatar.height - 0.5 : 0;
        const scalesAttribute = godRay.geometry.getAttribute('scales');
        const positionsAttribute = godRay.geometry.getAttribute('positions');
        const rotationAttribute = godRay.geometry.getAttribute('rotation');
        const opacityAttribute = godRay.geometry.getAttribute('opacity');
        
        for(let i = 0; i < particleCount; i++){
            if (opacityAttribute.getX(i) <= 0) {
                rotationAttribute.setY(i, Math.random() * 2 * Math.PI);
                opacityAttribute.setX(i, Math.random() * 0.05);
                info.maxOP[i] = 0.5 + Math.random() * 0.5;
                info.fadeIn[i] = true;
                scalesAttribute.setX(i, 0.8 + Math.random());
            }

            if (opacityAttribute.getX(i) >= info.maxOP[i]) {
                info.fadeIn[i] = false;
            }


            if (!info.fadeIn[i]) {
                opacityAttribute.setX(i, opacityAttribute.getX(i) - 0.005);
            }
            else {
                opacityAttribute.setX(i, opacityAttribute.getX(i) + 0.005);
            }
            
            
            const theta = 2. * Math.PI * i / particleCount;
            let xNoise = simplex.noise1D(Math.sin(theta) * timestamp * 0.001) * 0.05;
            let zNoise = simplex.noise1D(Math.cos(theta) * timestamp * 0.001) * 0.05;
            positionsAttribute.setXYZ(
                                    i,
                                    Math.sin(theta) * 0.22 + xNoise,
                                    0,
                                    Math.cos(theta) * 0.22 + zNoise
            ) 
            // const n = Math.cos(theta) > 0 ? 1 : -1;
            const n = Math.cos(camera.rotation.y) > 0 ? -1 : 1;
            const angle = Math.PI / 8;
            rotationAttribute.setXYZ(
                            i,
                            angle * Math.cos(theta),
                            // -Math.sin(theta) * n * (Math.PI / 2),
                            // rotationAttribute.getY(i),
                            -Math.sin(camera.rotation.y) * n * (Math.PI / 2),
                            angle * -Math.sin(theta)
            ) 
        }
        
        scalesAttribute.needsUpdate = true;
        positionsAttribute.needsUpdate = true;
        rotationAttribute.needsUpdate = true;
        opacityAttribute.needsUpdate = true;
    
        app.updateMatrixWorld();
    });
  }

  app.setComponent('renderPriority', 'low');
  
  return app;
};





// (async () => {
    //     const u = `${baseUrl}/assets/cone2.glb`;
    //     const cone = await new Promise((accept, reject) => {
    //         const {gltfLoader} = useLoaders();
    //         gltfLoader.load(u, accept, function onprogress() {}, reject);
            
    //     });
    //     cone.scene.children[0].material = new WebaverseShaderMaterial({
    //         uniforms: {
    //             cameraBillboardQuaternion: {
    //                 value: new THREE.Quaternion(),
    //             },
    //             lightTexture:{value: lightTexture},
    //         },
    //         vertexShader: `\
                
    //             uniform vec4 cameraBillboardQuaternion;
        
    //             varying vec2 vUv;
    //             varying vec3 vPos;
                
    //             vec3 rotateVecQuat(vec3 position, vec4 q) {
    //                 vec3 v = position.xyz;
    //                 return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
    //             }
            
    //             void main() {
    //                 vUv = uv;
    //                 vUv.y = 1. - vUv.y;
    //                 vPos = position;
    //                 vec3 pos = position;
                    
    //                 pos = rotateVecQuat(pos, cameraBillboardQuaternion);
                    
    //                 vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
    //                 vec4 viewPosition = viewMatrix * modelPosition;
    //                 vec4 projectionPosition = projectionMatrix * viewPosition;
            
    //                 gl_Position = projectionPosition;
    //             }
    //         `,
    //         fragmentShader: `\
    //             varying vec2 vUv;
    //             varying vec3 vPos;
              
    //             uniform sampler2D lightTexture;
               
    //             void main() {
    //                 vec4 light = texture2D(lightTexture, vUv);
                   
    //                 gl_FragColor= light;
                    
    //             }
    //         `,
    //         side: THREE.DoubleSide,
    //         transparent: true,
    //         depthWrite: false,
    //         blending: THREE.AdditiveBlending,
    //     });
    //     app.add(cone.scene);
    //     cone.scene.position.y = 3;
    //     cone.scene.scale.set(0.3, 0.3, 0.3);
    //     // let physicsId;
    //     // physicsId = physics.addGeometry(cone.scene);
    //     // physicsIds.push(physicsId)
    // })();

    // const lightMaterial = new WebaverseShaderMaterial({
    //     uniforms: {
    //         cameraBillboardQuaternion: {
    //             value: new THREE.Quaternion(),
    //         },
    //         lightTexture:{value: lightTexture},
    //     },
    //     vertexShader: `\
            
    //         uniform vec4 cameraBillboardQuaternion;
    
    //         varying vec2 vUv;
    //         varying vec3 vPos;
            
    //         vec3 rotateVecQuat(vec3 position, vec4 q) {
    //             vec3 v = position.xyz;
    //             return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
    //         }
        
    //         void main() {
    //             vUv = uv;
    //             vPos = position;
    //             vec3 pos = position;
                
    //             pos = rotateVecQuat(pos, cameraBillboardQuaternion);
                
    //             vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
    //             vec4 viewPosition = viewMatrix * modelPosition;
    //             vec4 projectionPosition = projectionMatrix * viewPosition;
        
    //             gl_Position = projectionPosition;
    //         }
    //     `,
    //     fragmentShader: `\
    //         varying vec2 vUv;
    //         varying vec3 vPos;
          
    //         uniform sampler2D lightTexture;
           
    //         void main() {
    //             vec4 light = texture2D(lightTexture, vUv);
               
    //             gl_FragColor= light;
                
    //         }
    //     `,
    //     side: THREE.DoubleSide,
    //     transparent: true,
    //     depthWrite: false,
    //     blending: THREE.AdditiveBlending,
    // });
    // const geometry = new THREE.PlaneGeometry( 1, 1 );
    // const plane = new THREE.Mesh(geometry, lightMaterial);
    // const plane2 = new THREE.Mesh(geometry, lightMaterial);
    // plane.position.y = 2;
    // plane2.position.y = 2;
    // plane2.rotation.y = Math.PI / 2;
    // // app.add(plane);
    // // app.add(plane2);