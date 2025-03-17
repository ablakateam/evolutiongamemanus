'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import SoundManager from '../components/SoundManager';

export default function Game() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [size, setSize] = useState(5);
  const [stage, setStage] = useState('Cellular');
  const [energy, setEnergy] = useState(100);
  const [evolutionPoints, setEvolutionPoints] = useState(0);
  const [showEvolutionMenu, setShowEvolutionMenu] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [traits, setTraits] = useState({
    speed: 0,
    size: 0,
    defense: 0,
    absorption: 0,
    speedBurst: false,
    toxin: false,
    ally: false
  });

  // Game state refs to access in animation loop
  const gameStateRef = useRef({
    score,
    size,
    stage,
    energy,
    maxEnergy: 100,
    evolutionPoints,
    gameOver,
    isPaused,
    performanceMode,
    traits,
    cooldowns: {
      speedBurst: 0,
      toxin: 0,
      ally: 0
    },
    mouse: { x: 0, y: 0 },
    player: null as THREE.Mesh | null,
    entities: [] as any[],
    allies: [] as any[],
    particles: [] as any[],
    feedbackMessages: [] as any[]
  });

  // Update ref when state changes
  useEffect(() => {
    gameStateRef.current.score = score;
    gameStateRef.current.size = size;
    gameStateRef.current.stage = stage;
    gameStateRef.current.energy = energy;
    gameStateRef.current.evolutionPoints = evolutionPoints;
    gameStateRef.current.gameOver = gameOver;
    gameStateRef.current.isPaused = isPaused;
    gameStateRef.current.performanceMode = performanceMode;
    gameStateRef.current.traits = traits;
  }, [score, size, stage, energy, evolutionPoints, gameOver, isPaused, performanceMode, traits]);

  // Initialize game
  useEffect(() => {
    if (!containerRef.current) return;

    // Three.js setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000033);

    const camera = new THREE.OrthographicCamera(
      window.innerWidth / -2, window.innerWidth / 2,
      window.innerHeight / 2, window.innerHeight / -2,
      0.1, 1000
    );
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);

    // Create player
    const geometry = new THREE.CircleGeometry(5, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const player = new THREE.Mesh(geometry, material);
    player.scale.set(gameStateRef.current.size / 5, gameStateRef.current.size / 5, 1);
    scene.add(player);
    gameStateRef.current.player = player;

    // Create initial entities
    createEntities(scene, 20);

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      
      camera.left = window.innerWidth / -2;
      camera.right = window.innerWidth / 2;
      camera.top = window.innerHeight / 2;
      camera.bottom = window.innerHeight / -2;
      camera.updateProjectionMatrix();
      
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Handle mouse movement
    const handleMouseMove = (event: MouseEvent) => {
      gameStateRef.current.mouse.x = (event.clientX - window.innerWidth / 2);
      gameStateRef.current.mouse.y = -(event.clientY - window.innerHeight / 2);
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Handle keyboard input
    const handleKeyDown = (event: KeyboardEvent) => {
      // E key - Evolution menu
      if (event.key === 'e' || event.key === 'E') {
        if (gameStateRef.current.gameOver) return;
        
        setShowEvolutionMenu(prev => !prev);
        setIsPaused(prev => !prev);
      }
      
      // Space key - Speed burst
      if (event.key === ' ') {
        if (gameStateRef.current.gameOver || gameStateRef.current.isPaused) return;
        
        if (gameStateRef.current.traits.speedBurst && 
            gameStateRef.current.cooldowns.speedBurst === 0 && 
            gameStateRef.current.energy > 20) {
          gameStateRef.current.cooldowns.speedBurst = 60; // 2 seconds at 30fps
          setEnergy(prev => prev - 20);
          showFeedback(scene, 'Speed Burst!', 0x00ffff);
          
          // Play sound
          if (typeof window !== 'undefined' && (window as any).gameAudio) {
            (window as any).gameAudio.play('speedburst');
          }
        }
      }
      
      // T key - Toxin release
      if (event.key === 't' || event.key === 'T') {
        if (gameStateRef.current.gameOver || gameStateRef.current.isPaused) return;
        
        if (gameStateRef.current.traits.toxin && 
            gameStateRef.current.cooldowns.toxin === 0 && 
            gameStateRef.current.energy > 30) {
          gameStateRef.current.cooldowns.toxin = 90; // 3 seconds at 30fps
          setEnergy(prev => prev - 30);
          showFeedback(scene, 'Toxin Release!', 0x00ffff);
          
          // Create toxin particles
          createToxinEffect(scene);
          
          // Play sound
          if (typeof window !== 'undefined' && (window as any).gameAudio) {
            (window as any).gameAudio.play('toxin');
          }
        }
      }
      
      // A key - Spawn ally
      if (event.key === 'a' || event.key === 'A') {
        if (gameStateRef.current.gameOver || gameStateRef.current.isPaused) return;
        
        if (gameStateRef.current.traits.ally && 
            gameStateRef.current.cooldowns.ally === 0 && 
            gameStateRef.current.energy > 40) {
          gameStateRef.current.cooldowns.ally = 300; // 10 seconds at 30fps
          setEnergy(prev => prev - 40);
          createAlly(scene);
          showFeedback(scene, 'Ally Spawned!', 0x00ffff);
          
          // Play sound
          if (typeof window !== 'undefined' && (window as any).gameAudio) {
            (window as any).gameAudio.play('ally');
          }
        }
      }
      
      // P key - Pause
      if (event.key === 'p' || event.key === 'P') {
        if (gameStateRef.current.gameOver) return;
        
        setIsPaused(prev => !prev);
        showFeedback(scene, isPaused ? 'Resumed' : 'Paused', 0xffffff);
      }
      
      // F key - Performance mode
      if (event.key === 'f' || event.key === 'F') {
        setPerformanceMode(prev => !prev);
        showFeedback(scene, performanceMode ? 'Performance Mode: OFF' : 'Performance Mode: ON', 0xffffff);
      }
      
      // M key - Mute
      if (event.key === 'm' || event.key === 'M') {
        setIsMuted(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      if (!gameStateRef.current.gameOver && !gameStateRef.current.isPaused) {
        updateGame(scene);
      }
      
      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Create entities
  const createEntities = (scene: THREE.Scene, count: number) => {
    for (let i = 0; i < count; i++) {
      // 80% chance of food, 20% chance of predator
      const type = Math.random() < 0.8 ? 'food' : 'predator';
      createEntity(scene, type);
    }
  };

  // Create a single entity
  const createEntity = (scene: THREE.Scene, type: string) => {
    let size, color;
    
    if (type === 'food') {
      size = 2 + Math.random() * 3;
      color = 0x0088ff;
    } else if (type === 'predator') {
      // Predator size based on player size
      size = gameStateRef.current.size * (0.8 + Math.random() * 0.8);
      color = 0xff0000;
    } else {
      return;
    }
    
    const geometry = new THREE.CircleGeometry(5, 32);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Random position within bounds
    const bound = 500;
    const x = (Math.random() - 0.5) * bound * 2;
    const y = (Math.random() - 0.5) * bound * 2;
    
    mesh.position.set(x, y, 0);
    mesh.scale.set(size / 5, size / 5, 1);
    
    scene.add(mesh);
    
    gameStateRef.current.entities.push({
      type: type,
      size: size,
      position: { x: x, y: y },
      mesh: mesh
    });
  };

  // Create an ally
  const createAlly = (scene: THREE.Scene) => {
    const size = gameStateRef.current.size * 0.6;
    const geometry = new THREE.CircleGeometry(5, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0x00aa00 });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position near player
    const angle = Math.random() * Math.PI * 2;
    const distance = gameStateRef.current.size * 2;
    const x = gameStateRef.current.player?.position.x || 0 + Math.cos(angle) * distance;
    const y = gameStateRef.current.player?.position.y || 0 + Math.sin(angle) * distance;
    
    mesh.position.set(x, y, 0);
    mesh.scale.set(size / 5, size / 5, 1);
    
    scene.add(mesh);
    
    gameStateRef.current.allies.push({
      size: size,
      position: { x: x, y: y },
      mesh: mesh
    });
  };

  // Create toxin effect
  const createToxinEffect = (scene: THREE.Scene) => {
    if (gameStateRef.current.performanceMode) return;
    
    const particleCount = 50;
    const radius = gameStateRef.current.size * 3;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius;
      const x = (gameStateRef.current.player?.position.x || 0) + Math.cos(angle) * distance;
      const y = (gameStateRef.current.player?.position.y || 0) + Math.sin(angle) * distance;
      
      const geometry = new THREE.CircleGeometry(1, 8);
      const material = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff,
        transparent: true,
        opacity: 0.7
      });
      const particle = new THREE.Mesh(geometry, material);
      
      particle.position.set(x, y, 0);
      scene.add(particle);
      
      gameStateRef.current.particles.push({
        mesh: particle,
        life: 60, // 2 seconds at 30fps
        velocity: {
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2
        }
      });
    }
  };

  // Create absorption effect
  const createAbsorptionEffect = (scene: THREE.Scene, x: number, y: number, color: number) => {
    if (gameStateRef.current.performanceMode) return;
    
    const particleCount = 10;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 5;
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance;
      
      const geometry = new THREE.CircleGeometry(1, 8);
      const material = new THREE.MeshBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.7
      });
      const particle = new THREE.Mesh(geometry, material);
      
      particle.position.set(px, py, 0);
      scene.add(particle);
      
      gameStateRef.current.particles.push({
        mesh: particle,
        life: 30, // 1 second at 30fps
        velocity: {
          x: Math.cos(angle) * 2,
          y: Math.sin(angle) * 2
        }
      });
    }
  };

  // Show feedback message
  const showFeedback = (scene: THREE.Scene, text: string, color: number) => {
    // Create a canvas texture for the text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    
    canvas.width = 256;
    canvas.height = 64;
    
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.font = 'bold 24px Arial';
    context.fillStyle = '#' + color.toString(16).padStart(6, '0');
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    const sprite = new THREE.Sprite(material);
    
    sprite.position.set(
      gameStateRef.current.player?.position.x || 0,
      (gameStateRef.current.player?.position.y || 0) + 20,
      1
    );
    sprite.scale.set(50, 20, 1);
    
    scene.add(sprite);
    
    gameStateRef.current.feedbackMessages.push({
      mesh: sprite,
      life: 60, // 2 seconds at 30fps
      velocity: { x: 0, y: 0.5 }
    });
  };

  // Update game state
  const updateGame = (scene: THREE.Scene) => {
    if (!gameStateRef.current.player) return;
    
    // Move player towards mouse position
    const targetX = gameStateRef.current.mouse.x;
    const targetY = gameStateRef.current.mouse.y;
    
    // Calculate direction vector
    const dirX = targetX - gameStateRef.current.player.position.x;
    const dirY = targetY - gameStateRef.current.player.position.y;
    
    // Normalize direction
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    if (length > 0) {
      const normalizedX = dirX / length;
      const normalizedY = dirY / length;
      
      // Calculate speed based on traits
      let speed = 2 + gameStateRef.current.traits.speed;
      
      // Apply speed burst if active
      if (gameStateRef.current.cooldowns.speedBurst > 0) {
        speed *= 2;
        gameStateRef.current.cooldowns.speedBurst--;
        
        // Energy cost for speed burst
        setEnergy(prev => Math.max(0, prev - 0.2));
        
        // Create speed trail effect
        if (!gameStateRef.current.performanceMode && Math.random() > 0.7) {
          createSpeedTrail(scene);
        }
      }
      
      // Move player
      gameStateRef.current.player.position.x += normalizedX * speed;
      gameStateRef.current.player.position.y += normalizedY * speed;
      
      // Energy cost for movement
      setEnergy(prev => Math.max(0, prev - 0.05));
    }
    
    // Update cooldowns
    if (gameStateRef.current.cooldowns.toxin > 0) {
      gameStateRef.current.cooldowns.toxin--;
    }
    
    if (gameStateRef.current.cooldowns.ally > 0) {
      gameStateRef.current.cooldowns.ally--;
    }
    
    // Update allies
    gameStateRef.current.allies.forEach(ally => {
      // Simple AI for allies - move towards nearest food
      let nearestFood = null;
      let minDist = Infinity;
      
      gameStateRef.current.entities.forEach(entity => {
        if (entity.type === 'food') {
          const dx = entity.position.x - ally.position.x;
          const dy = entity.position.y - ally.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < minDist) {
            minDist = dist;
            nearestFood = entity;
          }
        }
      });
      
      if (nearestFood) {
        const dx = nearestFood.position.x - ally.position.x;
        const dy = nearestFood.position.y - ally.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
          const normalizedX = dx / dist;
          const normalizedY = dy / dist;
          
          ally.position.x += normalizedX * 1.5;
          ally.position.y += normalizedY * 1.5;
          ally.mesh.position.set(ally.position.x, ally.position.y, 0);
        }
      }
      
      // Check for collisions with food
<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with `grep -n` in order to find the line numbers of what you are looking for.</NOTE>