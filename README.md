# 3D Scene Editor - Blueprint

## 1. Project Overview

This is a browser-based 3D scene editor built with React, TypeScript, and React Three Fiber. It provides an interactive environment where users can add, manipulate, and customize various 3D shapes. The application features a physics-based drag-and-drop system, a detailed properties editor for selected objects, and a variety of materials and textures. The entire experience runs in the browser without a backend, using Babel Standalone for on-the-fly TSX transpilation.

## 2. Tech Stack

- **UI Framework**: React 18 (Functional Components, Hooks)
- **Language**: TypeScript
- **3D Rendering**: Three.js, React Three Fiber (`@react-three/fiber`)
- **3D Helpers/Controls**: React Three Drei (`@react-three/drei`)
- **Styling**: Tailwind CSS (via CDN)
- **Icons**: Lucide React
- **Unique IDs**: `uuid`
- **In-Browser Transpilation**: Babel Standalone

## 3. Component Guide

The application is primarily built within a single file, `src/App.tsx`, but is composed of several logical components.

### `App` (Main Component)
- **State**:
    - `objects: SceneObject[]`: An array holding the state of every object in the scene.
    - `selectedId: string | null`: The ID of the currently selected object.
    - `mode: InteractionMode`: The current user interaction mode, either `'drag'` or `'select'`.
    - `draggingId: string | null`: The ID of the object currently being dragged by the user.
    - `isTransforming: boolean`: A flag to disable orbit controls while using the `TransformControls` gizmo.
    - UI State: `isMenuOpen`, `showReadme`, `themeColor`.
- **Logic**:
    - Manages all CRUD (Create, Update, Delete) operations for scene objects.
    - Toggles between interaction modes.
    - Handles object selection and deselection logic.
    - Renders the main UI layout, including the canvas, toolbars, and panels.

### `SceneContent`
- **Props**:
    - `objects`, `selectedId`, `mode`, `draggingId`
    - Callbacks: `onSelect`, `onUpdate`, `onBulkUpdate`, `setDraggingId`, `setIsTransforming`
    - `isPreview: boolean`: A flag to render a simplified version of the scene for the editor preview window.
- **Logic**:
    - Renders the core 3D environment: lights, floor, walls.
    - Maps over the `objects` array to render each `DraggableObject`.
    - Manages the `TransformControls` (gizmo), showing it only when an object is selected in `'select'` mode.
    - Handles pointer events on the floor for deselection and for updating object positions during a drag.

### `DraggableObject`
- **Props**: `data`, `isSelected`, `mode`, `onSelect`, `setDraggingId`
- **Logic**:
    - Acts as an interactive wrapper for a `SceneObjectMesh`.
    - Handles `onPointerDown`, `onPointerUp`, `onPointerOver`, and `onPointerOut` events.
    - In `'drag'` mode, it initiates and terminates the dragging state.
    - In `'select'` mode, it simply selects the object.
    - Changes the cursor style on hover based on the current mode.

### `SceneObjectMesh`
- **Props**: `data: SceneObject`, `isSelected: boolean`, `isPreview?: boolean`
- **Logic**:
    - The visual representation of a single scene object.
    - Uses a `useMemo` hook to create and cache the appropriate `THREE.Material` based on the object's properties (color, material type, texture, etc.).
    - Loads and configures textures for 'wood', 'metal', and 'fabric' materials, including tiling based on `textureGrain`.
    - Renders the correct geometry using the `Geometry` component.
    - Conditionally renders a skeletal wireframe overlay when `isSelected` is true.

### `Geometry`
- **Props**: `type: ShapeType`
- **Logic**: A simple component that returns the appropriate R3F geometry element (`<boxGeometry>`, `<sphereGeometry>`, etc.) based on the `type` prop.

### UI Panels
- **Editor Panel**: A right-hand sidebar that appears when an object is selected in `'select'` mode. It contains controls for dimensions, color, material, and a live "TV Preview" canvas.
- **Bottom Toolbar**: A central dock containing the mode switcher (`drag`/`select`) and a scrollable list of shapes that can be added to the scene.
- **Main Menu**: A collapsible top-left menu containing a help/readme modal, settings (theme color), and a "Clear Scene" action.

## 4. Data Models

```typescript
// The type of geometric shape
type ShapeType = 'cube' | 'sphere' | 'cone' | 'torus' | 'cylinder' | 'capsule' | 'dodecahedron' | 'icosahedron';

// The current interaction mode for the user
type InteractionMode = 'drag' | 'select';

// The core data structure for a single object in the scene
interface SceneObject {
  id: string; // Unique identifier
  type: ShapeType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string; // Hex color code
  material: 'standard' | 'wireframe' | 'glass' | 'wood' | 'metal' | 'fabric';
  textureGrain: number; // Controls the tiling/repeat of textures
}
```

## 5. User Guide & Key Features

### 1. Adding Shapes
- Use the **scrollable toolbar** at the bottom of the screen to add new shapes.
- Click an icon (e.g., Cube, Sphere) to add it to the center of the scene.

### 2. Interaction Modes
- The editor has two primary modes, switchable via the toolbar:
    - **Drag Mode (Hand Icon)**: The default mode. Click and drag objects to move them around the scene. This mode features a simple physics simulation where objects will push each other upon collision.
    - **Select Mode (Pointer Icon)**: This mode is for editing. Clicking an object will select it and open the **Editor Panel** on the right, where you can modify its properties.

### 3. Selecting & Deselecting
- **To Select**: Click on an object. A bright green **skeletal wireframe** will appear around it, highlighting its geometry.
- **To Deselect**: Click on the floor grid or press the 'X' button in the Editor Panel. Deselecting automatically switches you back to **Drag Mode** for a fluid workflow.

### 4. Editing Object Properties
- Once an object is selected in **Select Mode**, the **Editor Panel** provides numerous options:
    - **TV Preview**: A live, isolated view of the selected object.
    - **Dimensions**: Use the "Overall Size" slider for uniform scaling, or the individual Width/Height/Depth sliders for precise control. The object's position automatically adjusts to stay on the floor when height is changed.
    - **Gizmo**: In the main viewport, a transform gizmo appears, allowing you to move, rotate, or scale the object on specific axes without physics collisions.
    - **Color Tint**: Choose from a palette of preset colors or use the custom color picker for any color imaginable.
    - **Material**: Change the object's surface appearance (Standard, Wood, Metal, Fabric, Glass, Wireframe).
    - **Texture Grain**: For textured materials, this slider controls the tiling size of the texture, from coarse (low value) to fine (high value).
Auto-deploy fix
