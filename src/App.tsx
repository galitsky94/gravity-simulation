import { useEffect, useRef, useState, useCallback } from "react";

// Define boundary behavior types
type BoundaryBehavior = "none" | "wrap" | "bounce";

interface GravityPoint {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  color: string;
  pulsePhase?: number; // For pulsing animation
  pulseSpeed?: number; // Speed of pulse
}

interface TrailPoint {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
  timestamp: number;
}

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  opacity: number;
  lifetime: number;
  timestamp: number;
}

interface SimulationStats {
  totalMass: number;
  averageVelocity: number;
  largestMass: number;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<GravityPoint[]>([]);
  const [trails, setTrails] = useState<TrailPoint[]>([]);
  const [burstParticles, setBurstParticles] = useState<BurstParticle[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [gravityStrength, setGravityStrength] = useState(1);
  const [pointMass, setPointMass] = useState(20);
  const [nextId, setNextId] = useState(0);
  const animationRef = useRef<number>();
  const [showTrails, setShowTrails] = useState(true);
  const [trailLifetime, setTrailLifetime] = useState(2000); // trail lifetime in ms
  const [trailDensity, setTrailDensity] = useState(3); // points captured per second
  const lastTrailCapture = useRef<number>(0);
  const [pulseEffect, setPulseEffect] = useState(true);
  const [collisionEffects, setCollisionEffects] = useState(true);
  const [boundaryBehavior, setBoundaryBehavior] = useState<BoundaryBehavior>("none");
  const [stats, setStats] = useState<SimulationStats>({
    totalMass: 0,
    averageVelocity: 0,
    largestMass: 0,
  });

  // For click and drag functionality
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 });

  // Generate a random color
  const getRandomColor = useCallback(() => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 80%, 60%)`;
  }, []);

  // Create a new gravity point with velocity
  const createPoint = (x: number, y: number, vx = 0, vy = 0, mass = pointMass) => {
    const newPoint: GravityPoint = {
      id: nextId,
      x,
      y,
      vx,
      vy,
      mass,
      radius: Math.sqrt(mass) * 2,
      color: getRandomColor(),
      pulsePhase: Math.random() * Math.PI * 2, // Random starting phase
      pulseSpeed: 0.05 + Math.random() * 0.05  // Random speed
    };

    setPoints((prevPoints) => [...prevPoints, newPoint]);
    setNextId((prevId) => prevId + 1);
  };

  // Random point creation
  const createRandomPoint = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const mass = pointMass + (Math.random() * pointMass * 0.5 - pointMass * 0.25);

    // Add random initial velocity
    const randomVelocity = 0.5;
    const vx = (Math.random() * 2 - 1) * randomVelocity;
    const vy = (Math.random() * 2 - 1) * randomVelocity;

    createPoint(x, y, vx, vy, mass);
  };

  // Create multiple random points
  const createMultiplePoints = (count = 10) => {
    for (let i = 0; i < count; i++) {
      createRandomPoint();
    }
  };

  // Create points in a specific pattern (e.g., circle or grid)
  const createCircleOfPoints = (count = 8) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 4;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      // Create velocity perpendicular to radius (for orbit)
      const vx = Math.sin(angle) * 0.5;
      const vy = -Math.cos(angle) * 0.5;

      createPoint(x, y, vx, vy);
    }
  };

  // Handle mouse down for drag start
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDragging(true);
    setDragStart({ x, y });
    setDragEnd({ x, y });
  };

  // Handle mouse move for dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDragEnd({ x, y });
  };

  // Handle mouse up for drag end
  const handleMouseUp = () => {
    if (!isDragging) return;

    // Calculate velocity from drag vector
    const dx = dragEnd.x - dragStart.x;
    const dy = dragEnd.y - dragStart.y;

    // Scale down the velocity
    const velocityScale = 0.05;
    const vx = dx * velocityScale;
    const vy = dy * velocityScale;

    // Create point at drag start with velocity
    createPoint(dragStart.x, dragStart.y, vx, vy);

    // Reset drag state
    setIsDragging(false);
  };

  // Apply boundary behavior to a point
  const applyBoundary = useCallback(
    (point: GravityPoint, canvasWidth: number, canvasHeight: number): GravityPoint => {
      if (boundaryBehavior === "none") {
        return point;
      }

      let { x, y, vx, vy } = point;

      if (boundaryBehavior === "wrap") {
        // Wrap around edges
        if (x < 0) x = canvasWidth;
        if (x > canvasWidth) x = 0;
        if (y < 0) y = canvasHeight;
        if (y > canvasHeight) y = 0;
      } else if (boundaryBehavior === "bounce") {
        // Bounce off edges with some energy loss
        const bounceFactor = 0.9;

        if (x < point.radius) {
          x = point.radius;
          vx = Math.abs(vx) * bounceFactor;
        } else if (x > canvasWidth - point.radius) {
          x = canvasWidth - point.radius;
          vx = -Math.abs(vx) * bounceFactor;
        }

        if (y < point.radius) {
          y = point.radius;
          vy = Math.abs(vy) * bounceFactor;
        } else if (y > canvasHeight - point.radius) {
          y = canvasHeight - point.radius;
          vy = -Math.abs(vy) * bounceFactor;
        }
      }

      return { ...point, x, y, vx, vy };
    },
    [boundaryBehavior]
  );

  // Calculate simulation statistics
  const calculateStats = useCallback((points: GravityPoint[]): SimulationStats => {
    if (points.length === 0) {
      return {
        totalMass: 0,
        averageVelocity: 0,
        largestMass: 0,
      };
    }

    let totalMass = 0;
    let totalVelocity = 0;
    let largestMass = 0;

    for (const point of points) {
      totalMass += point.mass;
      totalVelocity += Math.sqrt(point.vx ** 2 + point.vy ** 2);
      largestMass = Math.max(largestMass, point.mass);
    }

    return {
      totalMass,
      averageVelocity: totalVelocity / points.length,
      largestMass,
    };
  }, []);

  // Draw drag line preview
  const drawDragLine = useCallback(() => {
    if (!canvasRef.current || !isDragging) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw line from start to end
    ctx.beginPath();
    ctx.moveTo(dragStart.x, dragStart.y);
    ctx.lineTo(dragEnd.x, dragEnd.y);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw circle at start position with radius based on mass
    const radius = Math.sqrt(pointMass) * 2;
    ctx.beginPath();
    ctx.arc(dragStart.x, dragStart.y, radius, 0, Math.PI * 2);
    const color = getRandomColor();
    ctx.fillStyle = color;
    ctx.fill();

    // Add glow effect
    ctx.shadowBlur = radius * 0.5;
    ctx.shadowColor = color;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw arrow at end position
    const arrowLength = 10;
    const angle = Math.atan2(dragEnd.y - dragStart.y, dragEnd.x - dragStart.x);

    ctx.beginPath();
    ctx.moveTo(dragEnd.x, dragEnd.y);
    ctx.lineTo(
      dragEnd.x - arrowLength * Math.cos(angle - Math.PI / 6),
      dragEnd.y - arrowLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(dragEnd.x, dragEnd.y);
    ctx.lineTo(
      dragEnd.x - arrowLength * Math.cos(angle + Math.PI / 6),
      dragEnd.y - arrowLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.stroke();

    // Draw velocity text
    const velocity = Math.sqrt(
      (dragEnd.x - dragStart.x) ** 2 + (dragEnd.y - dragStart.y) ** 2
    );
    const velocityScale = 0.05;
    const scaledVelocity = (velocity * velocityScale).toFixed(2);

    ctx.font = "12px Arial";
    ctx.fillStyle = "white";
    ctx.fillText(`v: ${scaledVelocity}`, dragEnd.x + 10, dragEnd.y + 10);
    ctx.fillText(`m: ${pointMass}`, dragStart.x + radius + 5, dragStart.y);
  }, [isDragging, dragStart, dragEnd, getRandomColor, pointMass]);

  // Create collision burst effect
  const createBurst = useCallback((x: number, y: number, color: string, size: number) => {
    if (!collisionEffects) return;

    const particleCount = Math.min(20, Math.floor(size / 2));
    const newBurstParticles: BurstParticle[] = [];
    const now = Date.now();

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2;
      const lifetime = 500 + Math.random() * 1000;

      newBurstParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1 + Math.random() * 3,
        color,
        opacity: 0.6 + Math.random() * 0.4,
        lifetime,
        timestamp: now
      });
    }

    setBurstParticles(prev => [...prev, ...newBurstParticles]);
  }, [collisionEffects]);

  // Update simulation
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updateSimulation = () => {
      // For trail effect, don't clear completely
      if (showTrails) {
        ctx.fillStyle = "rgba(17, 24, 39, 0.2)"; // Semi-transparent background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#111827"; // Original dark background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw trails
      if (showTrails && trails.length > 0) {
        const now = Date.now();
        for (const t of trails) {
          const age = now - t.timestamp;
          if (age > trailLifetime) continue;
          const alpha = t.opacity * (1 - age / trailLifetime);
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
          ctx.fillStyle = t.color.startsWith("hsl")
            ? hslToRgba(t.color, alpha)
            : t.color.replace(/[\d\.]+\)$/g, `${alpha})`).replace(/^rgb\(/, "rgba(");
          ctx.globalAlpha = alpha;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // Draw burst particles
      if (collisionEffects && burstParticles.length > 0) {
        const now = Date.now();
        const updatedBurstParticles: BurstParticle[] = [];

        for (const p of burstParticles) {
          const age = now - p.timestamp;
          if (age > p.lifetime) continue;

          const alpha = p.opacity * (1 - age / p.lifetime);
          const updatedX = p.x + p.vx;
          const updatedY = p.y + p.vy;

          ctx.beginPath();
          ctx.arc(updatedX, updatedY, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color.startsWith("hsl")
            ? hslToRgba(p.color, alpha)
            : p.color.replace(/[\d\.]+\)$/g, `${alpha})`).replace(/^rgb\(/, "rgba(");
          ctx.globalAlpha = alpha;
          ctx.fill();
          ctx.globalAlpha = 1;

          updatedBurstParticles.push({
            ...p,
            x: updatedX,
            y: updatedY,
            vx: p.vx * 0.98,
            vy: p.vy * 0.98 + 0.02 // Add slight gravity
          });
        }

        setBurstParticles(updatedBurstParticles);
      }

      if (isRunning) {
        // Create a copy of points for manipulation
        let updatedPoints = [...points];

        // Calculate gravitational forces between points
        for (let i = 0; i < updatedPoints.length; i++) {
          const p1 = updatedPoints[i];

          for (let j = i + 1; j < updatedPoints.length; j++) {
            const p2 = updatedPoints[j];

            // Calculate distance between points
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);

            // Check for collision
            if (dist < p1.radius + p2.radius) {
              // Create burst effect at collision point
              const collisionX = (p1.x * p1.mass + p2.x * p2.mass) / (p1.mass + p2.mass);
              const collisionY = (p1.y * p1.mass + p2.y * p2.mass) / (p1.mass + p2.mass);
              createBurst(collisionX, collisionY, p1.color, p1.radius + p2.radius);

              // Merge points (conservation of momentum)
              const totalMass = p1.mass + p2.mass;
              const newMass = totalMass;
              const newRadius = Math.sqrt(newMass) * 2;

              // New position based on center of mass
              const newX = (p1.x * p1.mass + p2.x * p2.mass) / totalMass;
              const newY = (p1.y * p1.mass + p2.y * p2.mass) / totalMass;

              // New velocity based on conservation of momentum
              const newVx = (p1.vx * p1.mass + p2.vx * p2.mass) / totalMass;
              const newVy = (p1.vy * p1.mass + p2.vy * p2.mass) / totalMass;

              // Merge colors
              const newColor = getRandomColor(); // Simplified color merging

              // Create merged point
              const newPoint: GravityPoint = {
                id: p1.id, // Keep first point's ID
                x: newX,
                y: newY,
                vx: newVx,
                vy: newVy,
                mass: newMass,
                radius: newRadius,
                color: newColor,
                pulsePhase: Math.random() * Math.PI * 2,
                pulseSpeed: 0.05 + Math.random() * 0.05
              };

              // Remove old points and add new merged point
              updatedPoints = updatedPoints.filter((p) => p.id !== p1.id && p.id !== p2.id);
              updatedPoints.push(newPoint);

              // Restart the loop with our new set of points
              i = -1; // Will be incremented to 0 in the next loop iteration
              break;
            }

            // Apply gravitational force
            const G = 6.674 * gravityStrength; // Gravitational constant (scaled)
            const force = (G * p1.mass * p2.mass) / distSq;

            // Direction of force
            const fx = (force * dx) / dist;
            const fy = (force * dy) / dist;

            // Update velocities (F = ma, so a = F/m)
            updatedPoints[i] = {
              ...p1,
              vx: p1.vx + fx / p1.mass,
              vy: p1.vy + fy / p1.mass,
            };

            updatedPoints[j] = {
              ...p2,
              vx: p2.vx - fx / p2.mass,
              vy: p2.vy - fy / p2.mass,
            };
          }
        }

        // Update positions and apply boundary behavior
        updatedPoints = updatedPoints.map((p) => {
          // Add a slight damping effect to prevent infinite acceleration
          const damping = 0.99;
          const newVx = p.vx * damping;
          const newVy = p.vy * damping;

          const updatedPoint = {
            ...p,
            x: p.x + newVx,
            y: p.y + newVy,
            vx: newVx,
            vy: newVy,
          };

          // Apply boundary behavior
          return applyBoundary(updatedPoint, canvas.width, canvas.height);
        });

        // Calculate simulation statistics
        const newStats = calculateStats(updatedPoints);
        setStats(newStats);

        setPoints(updatedPoints);

        // Add to trails
        if (showTrails && trailDensity > 0) {
          const now = Date.now();
          if (now - lastTrailCapture.current > 1000 / trailDensity) {
            const newTrailPoints: TrailPoint[] = updatedPoints.map((p) => ({
              x: p.x,
              y: p.y,
              radius: Math.max(1, p.radius * 0.5),
              color: p.color,
              opacity: 0.7,
              timestamp: now,
            }));
            setTrails((prev) => {
              // Remove old trails
              const cutoff = now - trailLifetime;
              const filtered = prev.filter((t) => t.timestamp > cutoff);
              return [...filtered, ...newTrailPoints];
            });
            lastTrailCapture.current = now;
          }
        }
      }

      // Draw points with pulsing effect
      const now = Date.now();
      for (const p of points) {
        // Calculate pulse effect
        let radius = p.radius;
        if (pulseEffect && p.pulsePhase !== undefined && p.pulseSpeed !== undefined) {
          const pulseFactor = Math.sin(p.pulsePhase + now * p.pulseSpeed) * 0.1 + 1;
          radius *= pulseFactor;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Add a glow effect
        ctx.shadowBlur = radius * 0.5;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Draw drag line if dragging
      drawDragLine();

      animationRef.current = requestAnimationFrame(updateSimulation);
    };

    animationRef.current = requestAnimationFrame(updateSimulation);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    points,
    isRunning,
    gravityStrength,
    getRandomColor,
    drawDragLine,
    showTrails,
    applyBoundary,
    calculateStats,
    trails,
    trailLifetime,
    trailDensity,
    pulseEffect,
    collisionEffects,
    burstParticles,
    createBurst
  ]);

  // Helper to convert hsl to rgba for trail drawing
  function hslToRgba(hsl: string, alpha: number) {
    // hsl(210, 80%, 60%)
    const hslMatch = hsl.match(
      /hsl\(\s*([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\s*\)/
    );
    if (!hslMatch) return hsl;
    const h = Number.parseFloat(hslMatch[1]);
    const s = Number.parseFloat(hslMatch[2]) / 100;
    const l = Number.parseFloat(hslMatch[3]) / 100;

    // HSL to RGB conversion
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Resize canvas to fit window
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight - 100; // Leave space for controls
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initial resize

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Reset simulation
  const resetSimulation = () => {
    setPoints([]);
    setTrails([]);
    setBurstParticles([]);
    setNextId(0);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="p-4 flex flex-col lg:flex-row lg:justify-between items-center gap-4 bg-gray-800">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Gravity Simulator</h1>
          <div className="bg-gray-700 px-2 py-1 rounded">
            <span className="font-mono">{points.length}</span> objects
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex flex-col items-center text-xs bg-gray-700 p-2 rounded">
            <div>
              Total Mass: <span className="font-mono">{stats.totalMass.toFixed(0)}</span>
            </div>
            <div>
              Avg Velocity: <span className="font-mono">{stats.averageVelocity.toFixed(2)}</span>
            </div>
            <div>
              Largest Mass: <span className="font-mono">{stats.largestMass.toFixed(0)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="mass">Mass:</label>
            <input
              id="mass"
              type="range"
              min="1"
              max="100"
              step="1"
              value={pointMass}
              onChange={(e) => setPointMass(Number.parseFloat(e.target.value))}
              className="w-24"
            />
            <span>{pointMass}</span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="gravity">Gravity:</label>
            <input
              id="gravity"
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={gravityStrength}
              onChange={(e) => setGravityStrength(Number.parseFloat(e.target.value))}
              className="w-24"
            />
            <span>{gravityStrength.toFixed(1)}</span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="boundary">Boundary:</label>
            <select
              id="boundary"
              value={boundaryBehavior}
              onChange={(e) => setBoundaryBehavior(e.target.value as BoundaryBehavior)}
              className="bg-gray-700 rounded px-2 py-1"
            >
              <option value="none">None</option>
              <option value="wrap">Wrap</option>
              <option value="bounce">Bounce</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="trails">Trails:</label>
            <input
              id="trails"
              type="checkbox"
              checked={showTrails}
              onChange={(e) => setShowTrails(e.target.checked)}
              className="w-4 h-4"
            />
          </div>

          {showTrails && (
            <>
              <div className="flex items-center gap-2">
                <label htmlFor="trailDensity">Trail Density:</label>
                <input
                  id="trailDensity"
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={trailDensity}
                  onChange={(e) => setTrailDensity(Number.parseFloat(e.target.value))}
                  className="w-24"
                />
                <span>{trailDensity}</span>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="trailLifetime">Trail Lifetime:</label>
                <input
                  id="trailLifetime"
                  type="range"
                  min="500"
                  max="5000"
                  step="500"
                  value={trailLifetime}
                  onChange={(e) => setTrailLifetime(Number.parseFloat(e.target.value))}
                  className="w-24"
                />
                <span>{trailLifetime / 1000}s</span>
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <label htmlFor="pulse">Pulse:</label>
            <input
              id="pulse"
              type="checkbox"
              checked={pulseEffect}
              onChange={(e) => setPulseEffect(e.target.checked)}
              className="w-4 h-4"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="collisionEffects">Bursts:</label>
            <input
              id="collisionEffects"
              type="checkbox"
              checked={collisionEffects}
              onChange={(e) => setCollisionEffects(e.target.checked)}
              className="w-4 h-4"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
            onClick={createRandomPoint}
          >
            Add Point
          </button>
          <button
            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded"
            onClick={resetSimulation}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-crosshair"
        />
      </div>

      <div className="p-4 bg-gray-800 text-sm">
        <p>
          Click and drag on the canvas to create a gravity point with initial velocity. Points will attract each other, collide, and merge.
        </p>
        <p>
          Use the mass slider to adjust the mass of new points. Choose boundary behavior: none (points can go off-screen), wrap (points wrap around edges), or bounce (points bounce off edges).
        </p>
        <p>
          Visual effects: Enable trails to see particle paths (adjust density and lifetime), pulse for size oscillation, and bursts for collision explosions.
        </p>
      </div>
    </div>
  );
}

export default App;
