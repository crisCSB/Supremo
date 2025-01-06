'use client';

import React, { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Draggable from 'react-draggable';
import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { Share2, Square, Circle, StickyNote, Type } from 'lucide-react';

interface Shape {
 id: string;
 type: 'square' | 'circle' | 'sticky' | 'text';
 x: number;
 y: number;
 content?: string;
}

interface BoardStore {
 shapes: Shape[];
 setShapes: (shapes: Shape[]) => void;
 addShape: (shape: Shape) => void;
 updateShape: (id: string, updates: Partial<Shape>) => void;
}

const useStore = create<BoardStore>((set) => ({
 shapes: [],
 setShapes: (shapes) => set({ shapes }),
 addShape: (shape) => set((state) => ({ shapes: [...state.shapes, shape] })),
 updateShape: (id, updates) =>
   set((state) => ({
     shapes: state.shapes.map((shape) =>
       shape.id === id ? { ...shape, ...updates } : shape
     ),
   })),
}));

const ShapeComponent = React.forwardRef<HTMLDivElement, {
 shape: Shape;
 onDragStop: (e: React.DragEvent<HTMLDivElement>, data: { x: number; y: number }) => void;
 onDoubleClick: () => void;
}>(({ shape, onDragStop, onDoubleClick }, ref) => {
 const nodeRef = useRef<HTMLDivElement>(null);
 
 let content;
 switch (shape.type) {
   case 'square':
     content = <div className="w-32 h-32 bg-blue-500 rounded-lg" />;
     break;
   case 'circle':
     content = <div className="w-32 h-32 bg-green-500 rounded-full" />;
     break;
   case 'sticky':
     content = (
       <div className="w-48 h-48 bg-yellow-200 p-4 shadow-lg rounded-lg">
         {shape.content}
       </div>
     );
     break;
   case 'text':
     content = (
       <div className="min-w-48 min-h-12 px-4 py-2 bg-white border border-gray-200 rounded">
         {shape.content}
       </div>
     );
     break;
 }

 return (
   <Draggable
     nodeRef={nodeRef}
     position={{ x: shape.x, y: shape.y }}
     onStop={onDragStop}
   >
     <div
       ref={nodeRef}
       className="absolute cursor-move"
       onDoubleClick={onDoubleClick}
     >
       {content}
     </div>
   </Draggable>
 );
});

ShapeComponent.displayName = 'ShapeComponent';

export default function CollaborativeBoard() {
 const { shapes, setShapes, addShape, updateShape } = useStore();
 const [doc] = useState(() => new Y.Doc());
 const [copied, setCopied] = useState(false);
 const shapeRefs = useRef<{ [key: string]: React.RefObject<HTMLDivElement> }>({});
 const [isConnected, setIsConnected] = useState(false);

 useEffect(() => {
   const wsHost = window.location.hostname;
   const wsProvider = new WebsocketProvider(
     `ws://${wsHost}:1234`,
     'collab-board',
     doc
   );
   
   wsProvider.on('status', (event: { status: string }) => {
     setIsConnected(event.status === 'connected');
   });

   const yShapes = doc.getArray('shapes');
   
   const handleSync = () => {
     const shapeArray = yShapes.toArray() as Shape[];
     setShapes(shapeArray);
   };

   yShapes.observe(handleSync);
   handleSync();

   return () => {
     wsProvider.destroy();
   };
 }, [doc, setShapes]);

 const createShape = (type: Shape['type']) => {
   const newShape: Shape = {
     id: uuidv4(),
     type,
     x: Math.random() * (window.innerWidth - 200),
     y: Math.random() * (window.innerHeight - 200),
     content: type === 'sticky' || type === 'text' ? 'Double click to edit' : undefined,
   };
   
   const yShapes = doc.getArray('shapes');
   yShapes.push([newShape]);
   shapeRefs.current[newShape.id] = React.createRef();
 };

 const handleDrag = (id: string, _: React.DragEvent<HTMLDivElement>, data: { x: number; y: number }) => {
   const yShapes = doc.getArray('shapes');
   const index = shapes.findIndex((shape) => shape.id === id);
   
   if (index !== -1) {
     yShapes.delete(index, 1);
     yShapes.insert(index, [{
       ...shapes[index],
       x: data.x,
       y: data.y
     }]);
   }
 };

 const handleDoubleClick = (id: string) => {
   const shape = shapes.find((s) => s.id === id);
   if (shape && (shape.type === 'sticky' || shape.type === 'text')) {
     const newContent = prompt('Enter new content:', shape.content);
     if (newContent !== null) {
       const yShapes = doc.getArray('shapes');
       const index = shapes.findIndex((s) => s.id === id);
       if (index !== -1) {
         yShapes.delete(index, 1);
         yShapes.insert(index, [{
           ...shapes[index],
           content: newContent
         }]);
       }
     }
   }
 };

 const shareBoard = async () => {
   try {
     const wsHost = window.location.hostname;
     const url = `http://${wsHost}:3000`;
     await navigator.clipboard.writeText(url);
     setCopied(true);
     setTimeout(() => setCopied(false), 2000);
   } catch (err) {
     console.error('Failed to copy:', err);
     const textArea = document.createElement('textarea');
     const wsHost = window.location.hostname;
     textArea.value = `http://${wsHost}:3000`;
     document.body.appendChild(textArea);
     textArea.select();
     try {
       document.execCommand('copy');
       setCopied(true);
       setTimeout(() => setCopied(false), 2000);
     } catch (e) {
       console.error('Fallback copy failed:', e);
     }
     document.body.removeChild(textArea);
   }
 };

 return (
   <div className="w-screen h-screen bg-gray-50 overflow-hidden relative">
     {!isConnected && (
       <div className="fixed top-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg z-50">
         Connecting to server...
       </div>
     )}
     
     <div className="fixed top-4 left-4 flex flex-col gap-4 bg-white p-2 rounded-lg shadow-lg z-50">
       <button
         onClick={() => createShape('square')}
         className="p-2 hover:bg-gray-100 rounded"
         disabled={!isConnected}
       >
         <Square className="w-6 h-6" />
       </button>
       <button
         onClick={() => createShape('circle')}
         className="p-2 hover:bg-gray-100 rounded"
         disabled={!isConnected}
       >
         <Circle className="w-6 h-6" />
       </button>
       <button
         onClick={() => createShape('sticky')}
         className="p-2 hover:bg-gray-100 rounded"
         disabled={!isConnected}
       >
         <StickyNote className="w-6 h-6" />
       </button>
       <button
         onClick={() => createShape('text')}
         className="p-2 hover:bg-gray-100 rounded"
         disabled={!isConnected}
       >
         <Type className="w-6 h-6" />
       </button>
     </div>

     <button
       onClick={shareBoard}
       className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-colors z-50"
     >
       <Share2 className="w-4 h-4" />
       {copied ? 'Copied!' : 'Share'}
     </button>

     <div className="w-full h-full">
       {shapes.map((shape) => {
         if (!shapeRefs.current[shape.id]) {
           shapeRefs.current[shape.id] = React.createRef();
         }
         return (
           <ShapeComponent
             key={shape.id}
             ref={shapeRefs.current[shape.id]}
             shape={shape}
             onDragStop={(e, data) => handleDrag(shape.id, e, data)}
             onDoubleClick={() => handleDoubleClick(shape.id)}
           />
         );
       })}
     </div>
   </div>
 );
}
