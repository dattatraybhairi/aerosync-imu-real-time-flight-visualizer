import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createAirbusA350,
  createBoeing787,
  createBoeing747,
  createAirbusA380,
  createFighterJet,
  createStuntPlane,
  type AircraftInstance,
  type AircraftType,
} from '../three/aircraftModels';
import { degreesToRadians, type IMUData } from '../utils/imuMath';

export type { AircraftType };
export type CameraPreset = 'isometric' | 'chase' | 'cockpit_front' | 'wing_view' | 'top' | 'side';

interface AeroViewportProps {
  imuData: IMUData;
  selectedAircraft: AircraftType;
  cameraPreset: CameraPreset;
  showAxes: boolean;
  showGrid: boolean;
}

export const AeroViewport: React.FC<AeroViewportProps> = ({
  imuData,
  selectedAircraft,
  cameraPreset,
  showAxes,
  showGrid,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const imuRef = useRef(imuData);
  imuRef.current = imuData;

  const selectedRef = useRef(selectedAircraft);
  selectedRef.current = selectedAircraft;

  const axesRef = useRef(showAxes);
  axesRef.current = showAxes;

  const gridRef = useRef(showGrid);
  gridRef.current = showGrid;

  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const axesGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect Software WebGL
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Setup Scene (Clean Daylight Aviation Atmosphere)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    scene.fog = new THREE.Fog(0xf1f5f9, 28, 68);

    // 3. Setup Camera
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(5.2, 3.2, -5.8);
    cameraRef.current = camera;

    // 4. Setup Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 5. Studio Environment Reflection
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 6. Three-Point Daylight Studio Rig
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.95);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaf0, 1.7);
    dirLight.position.set(7, 13, -6);
    dirLight.castShadow = !isSoftwareGl;
    if (dirLight.shadow) {
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 35;
      dirLight.shadow.camera.left = -6;
      dirLight.shadow.camera.right = 6;
      dirLight.shadow.camera.top = 6;
      dirLight.shadow.camera.bottom = -6;
      dirLight.shadow.bias = -0.0005;
      dirLight.shadow.normalBias = 0.02;
    }
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x94a3b8, 0.75);
    rimLight.position.set(-7, 4, 8);
    scene.add(rimLight);

    // 7. Ground Grid & Contact Shadow Plane
    const grid = new THREE.GridHelper(50, 50, 0x94a3b8, 0xe2e8f0);
    grid.position.y = -2.1;
    scene.add(grid);
    gridHelperRef.current = grid;

    const shadowPlaneGeo = new THREE.PlaneGeometry(24, 24);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.18 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -2.09;
    shadowPlane.receiveShadow = !isSoftwareGl;
    scene.add(shadowPlane);

    // 8. 3D Attitude Gimbal Rings around the active aircraft
    const axesGroup = new THREE.Group();
    // Pitch Ring (Red X)
    const ringPitchGeo = new THREE.TorusGeometry(2.8, 0.014, 10, 64);
    ringPitchGeo.rotateY(Math.PI / 2);
    const ringPitchMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.42,
    });
    axesGroup.add(new THREE.Mesh(ringPitchGeo, ringPitchMat));

    // Roll Ring (Blue Z)
    const ringRollGeo = new THREE.TorusGeometry(2.8, 0.014, 10, 64);
    const ringRollMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.42,
    });
    axesGroup.add(new THREE.Mesh(ringRollGeo, ringRollMat));

    // Yaw Ring (Emerald Y)
    const ringYawGeo = new THREE.TorusGeometry(2.8, 0.014, 10, 64);
    ringYawGeo.rotateX(Math.PI / 2);
    const ringYawMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.42,
    });
    axesGroup.add(new THREE.Mesh(ringYawGeo, ringYawMat));

    scene.add(axesGroup);
    axesGroupRef.current = axesGroup;

    // 9. Instantiate Fleet Models (Strictly ONE active/visible at any moment)
    const fleet: Record<AircraftType, AircraftInstance> = {
      airbus_a350: createAirbusA350(),
      boeing_787: createBoeing787(),
      boeing_747: createBoeing747(),
      airbus_a380: createAirbusA380(),
      fighter_jet: createFighterJet(),
      stunt_plane: createStuntPlane(),
    };

    (Object.values(fleet) as AircraftInstance[]).forEach((aircraft) => {
      aircraft.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.castShadow = !isSoftwareGl;
          obj.receiveShadow = !isSoftwareGl;
        }
      });
      aircraft.group.visible = aircraft.type === selectedRef.current;
      scene.add(aircraft.group);
    });

    // 10. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 26;
    controls.minDistance = 2.5;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 11. Animation & Orientation Synchronization Loop
    let frameId = 0;
    const clock = new THREE.Clock();
    const targetQuat = new THREE.Quaternion();
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 70);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function animateLoop() {
      const delta = Math.min(clock.getDelta(), 0.1);
      const { pitch, roll, yaw } = imuRef.current;

      const pRad = degreesToRadians(pitch);
      const rRad = degreesToRadians(roll);
      const yRad = degreesToRadians(yaw);

      // Aeronautical YXZ Euler order (Forward = -Z)
      euler.set(pRad, -yRad, -rRad, 'YXZ');
      targetQuat.setFromEuler(euler);

      const currentSelected = selectedRef.current;
      const showAx = axesRef.current;
      const showGr = gridRef.current;

      if (gridHelperRef.current) gridHelperRef.current.visible = showGr;
      if (axesGroupRef.current) axesGroupRef.current.visible = showAx;

      const slerpFactor = isSoftwareGl ? 0.35 : 0.22;

      // Enforce ONLY ONE aircraft visible and active at a time
      (Object.keys(fleet) as AircraftType[]).forEach((key) => {
        const instance = fleet[key];
        const isCurrent = key === currentSelected;
        instance.group.visible = isCurrent;
        if (isCurrent) {
          instance.group.position.set(0, 0, 0);
          instance.group.quaternion.slerp(targetQuat, slerpFactor);
          instance.animate?.(delta, pitch, roll, yaw);
        }
      });

      if (axesGroupRef.current) {
        axesGroupRef.current.position.set(0, 0, 0);
        axesGroupRef.current.quaternion.slerp(targetQuat, slerpFactor);
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(animateLoop);
      } else {
        frameId = requestAnimationFrame(animateLoop);
      }
    }

    animateLoop();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Camera Preset smoothly
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const dist = 9.2;
    const targetY = -0.35;

    switch (cameraPreset) {
      case 'isometric':
        // Front-quarter 3/4 view showing cockpit, nose, wings, and engines clearly
        camera.position.set(dist * 0.72, dist * 0.42, -dist * 0.75);
        controls.target.set(0, targetY, 0);
        break;
      case 'chase':
        // Rear tail chase view
        camera.position.set(0, dist * 0.34, dist * 0.96);
        controls.target.set(0, targetY, 0);
        break;
      case 'cockpit_front':
        // Head-on nose & engine intake inspection view
        camera.position.set(0, 0.45, -dist * 0.92);
        controls.target.set(0, targetY, 0);
        break;
      case 'wing_view':
        // Starboard wingtip & engine nacelle perspective
        camera.position.set(dist * 0.9, 0.55, -1.2);
        controls.target.set(0, targetY, 0);
        break;
      case 'top':
        // Planform overhead view
        camera.position.set(0, dist * 1.22, 0.01);
        controls.target.set(0, 0, 0);
        break;
      case 'side':
        // Full fuselage profile view
        camera.position.set(dist * 1.1, 0.2, 0);
        controls.target.set(0, targetY, 0);
        break;
    }
    camera.updateProjectionMatrix();
    controls.update();
  }, [cameraPreset]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden">
      <div
        ref={mountRef}
        data-testid="threejs-canvas-mount"
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};
