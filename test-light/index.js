import * as THREE from 'three';

import metaversefile from 'metaversefile';
import {WebaverseShaderMaterial} from '../../materials.js';
import Simplex from '../../simplex-noise.js';
const {useApp, useFrame, useInternals, useLoaders, usePhysics} = metaversefile;
const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const simplex = new Simplex();
const textureLoader = new THREE.TextureLoader();
const lightTexture = textureLoader.load(`${baseUrl}/textures/light.png`);
const maskTexture = textureLoader.load(`${baseUrl}/textures/mask3.png`);

export default () => {
  const app = useApp();
  const {camera} = useInternals();
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
    const particleCount = 30;
    const info = {
        fadeIn: [particleCount],
        maxOP: [particleCount],
    }
    const attributeSpecs = [];
    attributeSpecs.push({name: 'id', itemSize: 1});
    attributeSpecs.push({name: 'scales', itemSize: 1});
    attributeSpecs.push({name: 'opacity', itemSize: 1});
    attributeSpecs.push({name: 'rotation', itemSize: 3});
    const geometry2 = new THREE.PlaneBufferGeometry(0.3, 3.);
    const geometry = _getGeometry(geometry2, attributeSpecs, particleCount);
    const idAttribute = geometry.getAttribute('id');
    for(let i = 0; i < particleCount; i++){
        idAttribute.setX(i, i);
        info.fadeIn[i] = true;
        info.maxOP[i] = 0.5 + Math.random() * 0.5;
    }
    idAttribute.needsUpdate = true;
    const opAttribute = geometry.getAttribute('opacity');
    for(let i = 0; i < particleCount; i++){
        opAttribute.setX(i, Math.random());
    }
    opAttribute.needsUpdate = true;

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            // opacity: { value: 0 },
            maskTexture: {
                value: maskTexture
            }
        },
        vertexShader: `
            ${THREE.ShaderChunk.common}
            ${THREE.ShaderChunk.logdepthbuf_pars_vertex}
            // uniform float uTime;
            // uniform float size;
            // uniform vec4 cameraBillboardQuaternion;
            
            attribute float id;
            attribute float scales;
            attribute float opacity;
            attribute vec3 rotation;
            attribute vec3 positions;

            varying vec2 vUv;
            varying float vOpacity;
            // varying float vId;
            
            
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
                // vId = id;
                vec3 pos = position;
                pos *= scales;
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
            // uniform float uTime;
            // uniform float sphereNum;
            // uniform float opacity;

            uniform sampler2D maskTexture;
            
            varying vec2 vUv;
            varying float vOpacity;
            // varying float vId;
            // varying float vTextureRotation;

            // #define PI 3.1415926


            void main() {
                
                // vec4 tex = texture2D(electronicballTexture, vUv); 
                // if(tex.a < 0.01)
                // {
                //     discard;    
                // }   
                // gl_FragColor.r *= abs(sin(uTime) * vId);
                // gl_FragColor.g *= abs(sin(uTime) * vId);
                // gl_FragColor = tex;
                // gl_FragColor.a *= opacity;
                vec4 mask = texture2D(maskTexture, vUv); 
                float s = smoothstep(0.5, 0.2, length(vUv - 0.5));
                gl_FragColor = vec4(s) * vec4(0.120, 0.280, 1.920, 1.0) * (2. + vUv.y);
                
                gl_FragColor.a = vOpacity * vUv.y * vUv.y * vUv.y;
                // gl_FragColor *= mask;
                
                ${THREE.ShaderChunk.logdepthbuf_fragment}
                
            }
        `,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const godRay = new THREE.InstancedMesh(geometry, material, particleCount);
    app.add(godRay)
    
    useFrame(({timestamp}) => {
        const scalesAttribute = godRay.geometry.getAttribute('scales');
        const positionsAttribute = godRay.geometry.getAttribute('positions');
        const rotationAttribute = godRay.geometry.getAttribute('rotation');
        const opacityAttribute = godRay.geometry.getAttribute('opacity');
        const IDAttribute = godRay.geometry.getAttribute('id');
        
        for(let i = 0; i < particleCount; i++){
            if (opacityAttribute.getX(i) <= 0) {
                rotationAttribute.setY(i, Math.random() * 2 * Math.PI);
                opacityAttribute.setX(i, Math.random() * 0.05);
                IDAttribute.setX(i, Math.floor(Math.random() * particleCount));
                info.maxOP[i] = 0.5 + Math.random() * 0.5;
                info.fadeIn[i] = true;
            }

            if (opacityAttribute.getX(i) >= info.maxOP[i]) {
                info.fadeIn[i] = false;
            }


            if (!info.fadeIn[i]) {
                opacityAttribute.setX(i, opacityAttribute.getX(i) - 0.0025);
            }
            else {
                opacityAttribute.setX(i, opacityAttribute.getX(i) + 0.0025);
            }
            
            scalesAttribute.setX(i, 1);
            const theta = 2. * Math.PI * i / particleCount;
            let xNoise = simplex.noise1D(Math.sin(theta) * timestamp * 0.001) * 0.2;
            let zNoise = simplex.noise1D(Math.cos(theta) * timestamp * 0.001) * 0.2;
            positionsAttribute.setXYZ(
                                    i,
                                    Math.sin(theta) * 0.65 + xNoise,
                                    3,
                                    Math.cos(theta) * 0.65 + zNoise
            ) 
            rotationAttribute.setXYZ(
                            i,
                            Math.PI / 6 * Math.cos(theta),
                            rotationAttribute.getY(i),
                            Math.PI / 6 * -Math.sin(theta)
            )  
        }
        
        scalesAttribute.needsUpdate = true;
        positionsAttribute.needsUpdate = true;
        rotationAttribute.needsUpdate = true;
        opacityAttribute.needsUpdate = true;
        IDAttribute.needsUpdate = true;
        // material.uniforms.uTime.value = timestamp / 1000;
        // material.uniforms.cameraBillboardQuaternion.value.copy(camera.quaternion);
    
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