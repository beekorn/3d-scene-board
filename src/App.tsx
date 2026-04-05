import React, { useState, useRef, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useThree, ThreeEvent, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  TransformControls,
  useCursor,
  PerspectiveCamera,
  Environment,
  useTexture
} from '@react-three/drei';
import * as THREE from 'three';
import {
  Menu, X, HelpCircle, Settings,
  Box, Circle, Triangle, Disc,
  Hand, MousePointer2, Trash2,
  Monitor, Scaling, Move,
  Cylinder, Gem, Pill, Layers
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// --- Types ---

type ShapeType = 'cube' | 'sphere' | 'cone' | 'torus' | 'cylinder' | 'capsule' | 'dodecahedron' | 'icosahedron';
type InteractionMode = 'drag' | 'select';

interface SceneObject {
  id: string;
  type: ShapeType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  material: 'standard' | 'wireframe' | 'glass' | 'wood' | 'metal' | 'fabric';
  textureGrain: number;
}

// --- Constants ---

const GRID_SIZE = 20;
const GRID_DIVISIONS = 20;
const WALL_HEIGHT = 0.5;
const WALL_THICKNESS = 0.5;
const BOUNDARY_LIMIT = GRID_SIZE / 2;

// --- Helper Functions ---

const clampPosition = (pos: THREE.Vector3, scale: [number, number, number]) => {
  const halfSizeX = scale[0] / 2;
  const halfSizeY = scale[1] / 2;
  const halfSizeZ = scale[2] / 2;
  const limitX = BOUNDARY_LIMIT - (WALL_THICKNESS / 2) - halfSizeX;
  const limitZ = BOUNDARY_LIMIT - (WALL_THICKNESS / 2) - halfSizeZ;

  return new THREE.Vector3(
    Math.max(-limitX, Math.min(limitX, pos.x)),
    Math.max(halfSizeY, pos.y),
    Math.max(-limitZ, Math.min(limitZ, pos.z))
  );
};

const varyColor = (color: string, amount = 0.1) => {
  const base = new THREE.Color(color);
  base.r += (Math.random() - 0.5) * amount * 2;
  base.g += (Math.random() - 0.5) * amount * 2;
  base.b += (Math.random() - 0.5) * amount * 2;
  return base;
};

// --- Collision Solver ---

const solveCollisions = (objects: SceneObject[], movingId: string | null): SceneObject[] => {
  const newObjects = JSON.parse(JSON.stringify(objects)) as SceneObject[];
  const iterations = 4;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < newObjects.length; i++) {
      for (let j = i + 1; j < newObjects.length; j++) {
        const a = newObjects[i];
        const b = newObjects[j];

        const aHalfX = a.scale[0] / 2;
        const aHalfZ = a.scale[2] / 2;
        const bHalfX = b.scale[0] / 2;
        const bHalfZ = b.scale[2] / 2;

        const dx = a.position[0] - b.position[0];
        const dz = a.position[2] - b.position[2];

        const absDx = Math.abs(dx);
        const absDz = Math.abs(dz);

        const overlapX = (aHalfX + bHalfX) - absDx;
        const overlapZ = (aHalfZ + bHalfZ) - absDz;

        if (overlapX > 0 && overlapZ > 0) {
          let pushX = 0;
          let pushZ = 0;

          if (overlapX < overlapZ) {
            pushX = dx > 0 ? overlapX : -overlapX;
          } else {
            pushZ = dz > 0 ? overlapZ : -overlapZ;
          }

          if (a.id === movingId) {
            b.position[0] -= pushX;
            b.position[2] -= pushZ;
          } else if (b.id === movingId) {
            a.position[0] += pushX;
            a.position[2] += pushZ;
          } else {
            const halfX = pushX / 2;
            const halfZ = pushZ / 2;
            a.position[0] += halfX;
            a.position[2] += halfZ;
            b.position[0] -= halfX;
            b.position[2] -= halfZ;
          }

          if (a.id !== movingId) {
             const clampedA = clampPosition(new THREE.Vector3(...a.position), a.scale);
             a.position[0] = clampedA.x;
             a.position[2] = clampedA.z;
          }
          if (b.id !== movingId) {
             const clampedB = clampPosition(new THREE.Vector3(...b.position), b.scale);
             b.position[0] = clampedB.x;
             b.position[2] = clampedB.z;
          }
        }
      }
    }
  }

  return newObjects;
};

// --- Scene Components ---

const Floor = ({ onFloorClick, onFloorMove }: { onFloorClick?: (e: ThreeEvent<PointerEvent>) => void, onFloorMove?: (e: ThreeEvent<PointerEvent>) => void }) => {
  return (
    <group>
      <gridHelper args={[GRID_SIZE, GRID_DIVISIONS, '#555', '#ccc']} position={[0, 0.01, 0]} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerDown={onFloorClick}
        onPointerMove={onFloorMove}
        receiveShadow
      >
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.8} metalness={0.1} />
      </mesh>
    </group>
  );
};

const Walls = () => {
  const offset = BOUNDARY_LIMIT + (WALL_THICKNESS / 2) - 0.5;
  const length = GRID_SIZE + (WALL_THICKNESS * 2);

  return (
    <group>
      <mesh position={[0, WALL_HEIGHT / 2, -BOUNDARY_LIMIT - WALL_THICKNESS/2]} receiveShadow castShadow>
        <boxGeometry args={[length, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, BOUNDARY_LIMIT + WALL_THICKNESS/2]} receiveShadow castShadow>
        <boxGeometry args={[length, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      <mesh position={[BOUNDARY_LIMIT + WALL_THICKNESS/2, WALL_HEIGHT / 2, 0]} rotation={[0, Math.PI/2, 0]} receiveShadow castShadow>
        <boxGeometry args={[length, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      <mesh position={[-BOUNDARY_LIMIT - WALL_THICKNESS/2, WALL_HEIGHT / 2, 0]} rotation={[0, Math.PI/2, 0]} receiveShadow castShadow>
        <boxGeometry args={[length, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
    </group>
  );
};

// --- Reusable Geometry Component ---

const Geometry = ({ type }: { type: ShapeType }) => {
  switch (type) {
    case 'cube': return <boxGeometry />;
    case 'sphere': return <sphereGeometry args={[0.5, 32, 32]} />;
    case 'cone': return <coneGeometry args={[0.5, 1, 32]} />;
    case 'torus': return <torusGeometry args={[0.4, 0.15, 16, 32]} />;
    case 'cylinder': return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
    case 'capsule': return <capsuleGeometry args={[0.35, 0.5, 4, 8]} />;
    case 'dodecahedron': return <dodecahedronGeometry args={[0.5]} />;
    case 'icosahedron': return <icosahedronGeometry args={[0.5]} />;
    default: return <boxGeometry />;
  }
};

const SceneObjectMesh = ({ data, isSelected, isPreview }: { data: SceneObject, isSelected: boolean, isPreview?: boolean }) => {
  const { position, rotation, scale, color, type, material, textureGrain } = data;

  const [woodTexture, metalTexture, fabricTexture] = useTexture([
    'https://cdn.polyhaven.com/asset_img/primary/wood_planks.png?height=512',
    'https://cdn.polyhaven.com/asset_img/primary/metal_plate.png?height=512',
    'https://cdn.polyhaven.com/asset_img/primary/fabric_pattern_07.png?height=512'
  ]);

  const configuredTextures = useMemo(() => {
    const textures = [woodTexture, metalTexture, fabricTexture];
    textures.forEach(t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(textureGrain, textureGrain);
    });
    return { woodTexture, metalTexture, fabricTexture };
  }, [woodTexture, metalTexture, fabricTexture, textureGrain]);

  const meshMaterial = useMemo(() => {
    if (type === 'cube' && material === 'standard') {
      return [...Array(6)].map(() => new THREE.MeshStandardMaterial({
        color: varyColor(color),
        roughness: 0.4,
        metalness: 0.1
      }));
    }

    switch (material) {
      case 'wireframe':
        return new THREE.MeshBasicMaterial({ color, wireframe: true });
      case 'glass':
        return new THREE.MeshPhysicalMaterial({ color, transmission: 0.7, opacity: 0.5, transparent: true, roughness: 0.15, thickness: 0.1 });
      case 'wood':
        return new THREE.MeshStandardMaterial({ map: configuredTextures.woodTexture, color, roughness: 0.7 });
      case 'metal':
        // The `color` property acts as a tint on the texture map. This is standard PBR behavior.
        return new THREE.MeshStandardMaterial({ map: configuredTextures.metalTexture, color, metalness: 0.8, roughness: 0.2 });
      case 'fabric':
        return new THREE.MeshStandardMaterial({ map: configuredTextures.fabricTexture, color, roughness: 0.9 });
      case 'standard':
      default:
        return new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
    }
  }, [type, material, color, configuredTextures]);

  return (
    <mesh
      key={`${data.id}-${material}-${color}-${textureGrain}`}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
      material={meshMaterial}
    >
      <Geometry type={type} />
      
      {/* Skeletal Selection Overlay */}
      {isSelected && !isPreview && (
        <mesh scale={[1.01, 1.01, 1.01]}>
          <Geometry type={type} />
          <meshBasicMaterial color="#86efac" wireframe />
        </mesh>
      )}
    </mesh>
  );
};

// --- Interactive Object Wrapper ---

const DraggableObject = ({
  data,
  isSelected,
  mode,
  onSelect,
  setDraggingId
}: {
  data: SceneObject;
  isSelected: boolean;
  mode: InteractionMode;
  onSelect: (id: string) => void;
  setDraggingId: (id: string | null) => void;
}) => {
  const [hovered, setHover] = useState(false);
  useCursor(hovered && mode === 'drag', 'grab', 'auto');
  useCursor(hovered && mode === 'select', 'pointer', 'auto');

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect(data.id);

    if (mode === 'drag') {
      setDraggingId(data.id);
      // @ts-ignore
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (mode === 'drag') {
      setDraggingId(null);
      // @ts-ignore
      e.target.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <group
      name={data.id}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <SceneObjectMesh data={data} isSelected={isSelected} />
    </group>
  );
};

// --- Reusable Scene Content ---

const SceneContent = ({
  objects,
  selectedId,
  mode,
  onSelect,
  onUpdate,
  onBulkUpdate,
  draggingId,
  setDraggingId,
  isPreview = false,
  setIsTransforming
}: {
  objects: SceneObject[];
  selectedId: string | null;
  mode: InteractionMode;
  onSelect?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<SceneObject>) => void;
  onBulkUpdate?: (newObjects: SceneObject[]) => void;
  draggingId?: string | null;
  setDraggingId?: (id: string | null) => void;
  isPreview?: boolean;
  setIsTransforming?: (isTransforming: boolean) => void;
}) => {
  const { scene } = useThree();
  const selectedObjectRef = useMemo(() => {
    if (!selectedId || isPreview) return null;
    return scene.getObjectByName(selectedId);
  }, [selectedId, scene, objects, isPreview]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 20, 10]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />

      {!isPreview && <Floor
        onFloorClick={(e) => {
          e.stopPropagation();
          onSelect && onSelect('');
        }}
        onFloorMove={(e) => {
          if (!isPreview && mode === 'drag' && draggingId && setDraggingId && onBulkUpdate) {
             const objIndex = objects.findIndex(o => o.id === draggingId);
             if (objIndex !== -1) {
               const obj = objects[objIndex];
               const rawPos = new THREE.Vector3(e.point.x, obj.position[1], e.point.z);
               const clamped = clampPosition(rawPos, obj.scale);
               const tempObjects = [...objects];
               tempObjects[objIndex] = {
                 ...obj,
                 position: [clamped.x, clamped.y, clamped.z]
               };
               const solvedObjects = solveCollisions(tempObjects, draggingId);
               onBulkUpdate(solvedObjects);
             }
          }
        }}
      />}

      {isPreview && <gridHelper args={[20, 20, '#444', '#222']} />}

      <Walls />

      {objects.map(obj => (
        <group key={obj.id}>
          {isPreview ? (
            <SceneObjectMesh data={obj} isSelected={selectedId === obj.id} isPreview={true} />
          ) : (
            <DraggableObject
              data={obj}
              isSelected={selectedId === obj.id}
              mode={mode}
              onSelect={onSelect!}
              setDraggingId={setDraggingId!}
            />
          )}
        </group>
      ))}

      {!isPreview && selectedId && mode === 'select' && onUpdate && selectedObjectRef && (
        <TransformControls
          object={selectedObjectRef}
          onDraggingChanged={(e) => e && setIsTransforming && setIsTransforming(e.value)}
          onObjectChange={(e) => {
             if (e?.target?.object) {
                const o = e.target.object;
                const newScale: [number, number, number] = [o.scale.x, o.scale.y, o.scale.z];
                const adjustedPosition = new THREE.Vector3(o.position.x, newScale[1] / 2, o.position.z);
                const clamped = clampPosition(adjustedPosition, newScale);

                onUpdate(selectedId, {
                  position: [clamped.x, clamped.y, clamped.z],
                  rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
                  scale: newScale
                });
             }
          }}
        />
      )}
    </>
  );
};

// --- Preview Camera Rig ---

const PreviewCameraRig = ({ targetPos }: { targetPos: THREE.Vector3 }) => {
  useFrame((state) => {
    const offset = new THREE.Vector3(4, 3, 4);
    const desiredPos = targetPos.clone().add(offset);
    state.camera.position.lerp(desiredPos, 0.1);
    state.camera.lookAt(targetPos);
  });
  return null;
};

// --- Main App Component ---

export default function App() {
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<InteractionMode>('drag');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showReadme, setShowReadme] = useState(false);
  const [themeColor, setThemeColor] = useState('#3b82f6');

  const shapes: { type: ShapeType; icon: React.ElementType; color: string; title: string }[] = [
    { type: 'cube', icon: Box, color: 'text-blue-400', title: 'Add Cube' },
    { type: 'sphere', icon: Circle, color: 'text-purple-400', title: 'Add Sphere' },
    { type: 'cone', icon: Triangle, color: 'text-yellow-400', title: 'Add Cone' },
    { type: 'torus', icon: Disc, color: 'text-green-400', title: 'Add Torus' },
    { type: 'cylinder', icon: Cylinder, color: 'text-indigo-400', title: 'Add Cylinder' },
    { type: 'capsule', icon: Pill, color: 'text-rose-400', title: 'Add Capsule' },
    { type: 'dodecahedron', icon: Gem, color: 'text-cyan-400', title: 'Add Dodecahedron' },
    { type: 'icosahedron', icon: Gem, color: 'text-teal-400', title: 'Add Icosahedron' },
  ];

  const addObject = (type: ShapeType) => {
    const newObj: SceneObject = {
      id: uuidv4(),
      type,
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      material: 'standard',
      textureGrain: 2,
    };

    const tempObjects = [...objects, newObj];
    const solvedObjects = solveCollisions(tempObjects, newObj.id);
    setObjects(solvedObjects);

    if (mode === 'select') {
      setSelectedId(newObj.id);
    }
  };

  const updateObject = (id: string, updates: Partial<SceneObject>) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...updates } : obj));
  };

  const bulkUpdateObjects = (newObjects: SceneObject[]) => {
    setObjects(newObjects);
  };

  const handleDeselect = () => {
    setSelectedId(null);
    setMode('drag');
  };

  const deleteObject = (id: string) => {
    setObjects(prev => prev.filter(obj => obj.id !== id));
    if (selectedId === id) handleDeselect();
  };

  const handleSelect = (id: string) => {
    if (id) {
      setSelectedId(id);
    } else {
      handleDeselect();
    }
  };

  const selectedObject = objects.find(o => o.id === selectedId);

  return (
    <div className="w-full h-screen bg-gray-900 overflow-hidden relative font-sans text-gray-100">

      {/* --- Top Left Menu --- */}
      <div className="absolute top-4 left-4 z-50">
        <button
          onClick={() => setIsMenuOpen(true)}
          className="p-3 bg-gray-800 rounded-lg shadow-lg hover:bg-gray-700 transition-colors border border-gray-700"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* --- Menu Drawer --- */}
      {isMenuOpen && (
        <div className="absolute top-0 left-0 w-80 h-full bg-gray-900/95 backdrop-blur-md z-[60] shadow-2xl border-r border-gray-700 p-6 flex flex-col gap-6 transform transition-transform duration-300">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Menu</h2>
            <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-gray-800 rounded-full">
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setShowReadme(true)}
              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <HelpCircle size={20} />
              <span>Help / Readme</span>
            </button>

            <div className="p-4 bg-gray-800 rounded-lg space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Settings size={18} />
                <span className="font-semibold">Settings</span>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Theme Color</label>
                <div className="flex gap-2 flex-wrap">
                  {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'].map(c => (
                    <button
                      key={c}
                      onClick={() => setThemeColor(c)}
                      className={`w-6 h-6 rounded-full border-2 ${themeColor === c ? 'border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => { setObjects([]); setSelectedId(null); }}
              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-red-900/50 text-red-400 transition-colors"
            >
              <Trash2 size={20} />
              <span>Clear Scene</span>
            </button>
          </div>
        </div>
      )}

      {/* --- Readme Modal --- */}
      {showReadme && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl flex flex-col border border-gray-700">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h2 className="text-2xl font-bold">3D Scene Editor Guide</h2>
              <button onClick={() => setShowReadme(false)} className="p-2 hover:bg-gray-700 rounded-full">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-gray-300 leading-relaxed">
              <p>Welcome to the 3D Scene Editor with <strong>Physics Collisions</strong> and <strong>Dynamic Materials</strong>.</p>

              <h3 className="text-lg font-semibold text-white mt-4">Key Features</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Expanded Shape Library</strong>: Create scenes with a wider variety of shapes, including cubes, spheres, cones, tori, cylinders, capsules, and polyhedrons.</li>
                <li><strong>Custom Colors & Textures</strong>: Use the color swatches or the custom color picker for infinite color options. For textured materials (Wood, Metal, Fabric), a **Texture Grain** slider appears, allowing you to control the tiling size of the texture.</li>
                <li><strong>Physics Collisions</strong>: When you drag an object into another, it will <strong>push</strong> the other object away, allowing for more natural scene arrangement.</li>
                <li><strong>Floor-Aligned Scaling</strong>: When you adjust an object's height, it correctly stays on the ground plane instead of sinking into it.</li>
                <li><strong>Skeletal Selection</strong>: Selected objects now display a <strong>wireframe overlay</strong>, visualizing their internal structure and geometry.</li>
                <li><strong>Streamlined Workflow</strong>: Deselecting an object automatically switches you back to <strong>Drag Mode</strong>, so you can immediately continue arranging your scene.</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mt-4">Tools & Modes</h3>
              <ul className="list-disc pl-5 space-y-2">
                 <li><strong>Click to Select</strong>: Clicking an object will select it. To see its properties, switch to **Select Mode (Pointer Icon)**.</li>
                <li><strong>Drag Tool (Hand):</strong> The default mode. Click and drag objects to move them. Collisions are active in this mode.</li>
                <li><strong>Select Tool (Pointer):</strong> Puts you in a mode to view and edit properties. The editor panel for the currently selected object will appear.</li>
                <li><strong>Overall Size Slider</strong>: In the editor panel, use the top 'Overall Size' slider to uniformly scale an object.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* --- Main 3D Scene --- */}
      <Canvas shadows camera={{ position: [8, 12, 12], fov: 45 }}>
        <color attach="background" args={['#111827']} />
        <Suspense fallback={null}>
          <SceneContent
            objects={objects}
            selectedId={selectedId}
            mode={mode}
            onSelect={handleSelect}
            onUpdate={updateObject}
            onBulkUpdate={bulkUpdateObjects}
            draggingId={draggingId}
            setDraggingId={setDraggingId}
            setIsTransforming={setIsTransforming}
          />
          <OrbitControls
            enabled={draggingId === null && !isTransforming}
            makeDefault
            maxPolarAngle={Math.PI / 2.1}
            minDistance={5}
            maxDistance={40}
            enableDamping
          />
        </Suspense>
      </Canvas>

      {/* --- Bottom Dock (Toolbar) --- */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-40 w-full max-w-md md:max-w-lg lg:max-w-xl px-4">
        {/* Mode Switcher */}
        <div className="bg-gray-800/90 backdrop-blur p-2 rounded-xl border border-gray-700 flex gap-1 shadow-xl flex-shrink-0">
          <button
            onClick={() => setMode('drag')}
            className={`p-3 rounded-lg transition-all ${mode === 'drag' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-700'}`}
            title="Drag Mode (Move Objects)"
          >
            <Hand size={20} />
          </button>
          <button
            onClick={() => setMode('select')}
            className={`p-3 rounded-lg transition-all ${mode === 'select' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-700'}`}
            title="Select Mode (Edit Properties)"
          >
            <MousePointer2 size={20} />
          </button>
        </div>

        {/* Shape Adder */}
        <div className="bg-gray-800/90 backdrop-blur p-2 rounded-xl border border-gray-700 flex gap-2 shadow-xl overflow-x-auto flex-grow min-w-0">
            <div className="flex gap-2 flex-nowrap">
                {shapes.map(({ type, icon: Icon, color, title }) => (
                    <button
                        key={type}
                        onClick={() => addObject(type)}
                        className={`p-3 hover:bg-gray-700 rounded-lg ${color} transition-colors flex-shrink-0`}
                        title={title}
                    >
                        <Icon size={24} />
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* --- Editor Panel (Right Side) --- */}
      {selectedObject && mode === 'select' && (
        <div className="absolute top-4 right-4 w-80 bg-gray-800/95 backdrop-blur-md rounded-xl border border-gray-700 shadow-2xl z-40 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Settings size={16} />
              Object Editor
            </h3>
            <button
              onClick={handleDeselect}
              className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-100px)]">

            {/* TV Preview Window */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                <Monitor size={14} />
                TV Context View
              </div>
              <div className="w-full aspect-video bg-black rounded-lg overflow-hidden border border-gray-600 relative shadow-inner">
                <Canvas shadows>
                  <color attach="background" args={['#000']} />
                  <Suspense fallback={null}>
                    <SceneContent
                      objects={objects}
                      selectedId={selectedId}
                      mode="select"
                      isPreview={true}
                    />
                    <PreviewCameraRig targetPos={new THREE.Vector3(...selectedObject.position)} />
                  </Suspense>
                </Canvas>
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded uppercase tracking-wider">
                  Live
                </div>
              </div>
            </div>

            {/* Sizing Options */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                <Scaling size={14} />
                Dimensions
              </div>

              {/* Overall Size */}
              <div className="space-y-1 pt-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Overall Size</span>
                  <span>{((selectedObject.scale[0] + selectedObject.scale[1] + selectedObject.scale[2]) / 3).toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0.2" max="5" step="0.1"
                  value={(selectedObject.scale[0] + selectedObject.scale[1] + selectedObject.scale[2]) / 3}
                  onChange={(e) => {
                    const newSize = parseFloat(e.target.value);
                    const newScale: [number, number, number] = [newSize, newSize, newSize];
                    const adjustedPosition = new THREE.Vector3(selectedObject.position[0], newSize / 2, selectedObject.position[2]);
                    const clampedPos = clampPosition(adjustedPosition, newScale);
                    updateObject(selectedObject.id, {
                      scale: newScale,
                      position: [clampedPos.x, clampedPos.y, clampedPos.z]
                    });
                  }}
                  className="w-full h-1 bg-blue-500 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Scale X */}
              <div className="space-y-1 pt-2 border-t border-gray-700/50">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Width (X)</span>
                  <span>{selectedObject.scale[0].toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0.2" max="5" step="0.1"
                  value={selectedObject.scale[0]}
                  onChange={(e) => updateObject(selectedObject.id, { scale: [parseFloat(e.target.value), selectedObject.scale[1], selectedObject.scale[2]] })}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Scale Y */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Height (Y)</span>
                  <span>{selectedObject.scale[1].toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0.2" max="5" step="0.1"
                  value={selectedObject.scale[1]}
                  onChange={(e) => {
                    const newHeight = parseFloat(e.target.value);
                    updateObject(selectedObject.id, {
                      scale: [selectedObject.scale[0], newHeight, selectedObject.scale[2]],
                      position: [selectedObject.position[0], newHeight / 2, selectedObject.position[2]]
                    });
                  }}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Scale Z */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Depth (Z)</span>
                  <span>{selectedObject.scale[2].toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0.2" max="5" step="0.1"
                  value={selectedObject.scale[2]}
                  onChange={(e) => updateObject(selectedObject.id, { scale: [selectedObject.scale[0], selectedObject.scale[1], parseFloat(e.target.value)] })}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Color Tint</label>
              <div className="flex gap-2 flex-wrap items-center">
                {['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ffffff', '#9ca3af', '#1f2937'].map(c => (
                  <button
                    key={c}
                    onClick={() => updateObject(selectedObject.id, { color: c })}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${selectedObject.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                 <div className="relative w-8 h-8 rounded-full border-2 border-gray-600 overflow-hidden bg-gray-700" title="Custom Color">
                    <input
                        type="color"
                        value={selectedObject.color}
                        onChange={(e) => updateObject(selectedObject.id, { color: e.target.value })}
                        className="absolute -top-1 -left-1 w-12 h-12 cursor-pointer"
                    />
                </div>
              </div>
            </div>

            {/* Material */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Material</label>
              <select
                value={selectedObject.material}
                onChange={(e) => updateObject(selectedObject.id, { material: e.target.value as any })}
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="standard">Standard</option>
                <option value="wood">Wood</option>
                <option value="metal">Metal</option>
                <option value="fabric">Fabric</option>
                <option value="glass">Glass</option>
                <option value="wireframe">Wireframe</option>
              </select>
            </div>

            {/* Texture Grain */}
            {['wood', 'metal', 'fabric'].includes(selectedObject.material) && (
                <div className="space-y-3 pt-4 border-t border-gray-700">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                        <Layers size={14} />
                        Texture Properties
                    </div>
                    <div className="space-y-1 pt-2">
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>Texture Grain</span>
                            <span>{selectedObject.textureGrain.toFixed(1)}x</span>
                        </div>
                        <input
                            type="range" min="1" max="16" step="0.5"
                            value={selectedObject.textureGrain}
                            onChange={(e) => updateObject(selectedObject.id, { textureGrain: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={() => deleteObject(selectedObject.id)}
                className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Delete Object
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
