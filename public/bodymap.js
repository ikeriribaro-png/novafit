/* BodyMap.js - Anatomical SVG visualization for NovaFit */

const BODY_MAP_SVG = `
<svg class="body-map-svg" viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
  <!-- Front View -->
  <g transform="translate(20, 10)">
    <text x="35" y="-5" text-anchor="middle" font-size="6" fill="#9090b8">FRONTAL</text>
    <!-- Chest -->
    <path id="chest" class="muscle-path" d="M25,25 L45,25 L45,40 L35,45 L25,40 Z" />
    <!-- Shoulders -->
    <path id="shoulders_front_l" class="muscle-path" d="M15,25 Q20,22 25,25 L25,35 L15,35 Z" />
    <path id="shoulders_front_r" class="muscle-path" d="M55,25 Q50,22 45,25 L45,35 L55,35 Z" />
    <!-- Biceps -->
    <path id="biceps_l" class="muscle-path" d="M10,35 L20,35 L20,55 L10,55 Z" />
    <path id="biceps_r" class="muscle-path" d="M50,35 L60,35 L60,55 L50,55 Z" />
    <!-- Abs / Core -->
    <path id="core" class="muscle-path" d="M30,45 L40,45 L40,75 L30,75 Z" />
    <!-- Quads / Legs -->
    <path id="legs_l" class="muscle-path" d="M25,80 L35,80 L35,130 L25,130 Z" />
    <path id="legs_r" class="muscle-path" d="M35,80 L45,80 L45,130 L35,130 Z" />
    <!-- Head/Body outline simplified -->
    <circle cx="35" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.05)" />
    <path d="M20,20 L50,20" stroke="rgba(255,255,255,0.05)" />
  </g>

  <!-- Back View -->
  <g transform="translate(110, 10)">
    <text x="35" y="-5" text-anchor="middle" font-size="6" fill="#9090b8">POSTERIOR</text>
    <!-- Back -->
    <path id="back" class="muscle-path" d="M20,25 L50,25 L45,70 L25,70 Z" />
    <!-- Triceps -->
    <path id="triceps_l" class="muscle-path" d="M10,35 L20,35 L20,55 L10,55 Z" />
    <path id="triceps_r" class="muscle-path" d="M50,35 L60,35 L60,55 L50,55 Z" />
    <!-- Glutes -->
    <path id="glutes" class="muscle-path" d="M25,70 L45,70 L45,85 L25,85 Z" />
    <!-- Hamstrings / Legs Back -->
    <path id="hamstrings_l" class="muscle-path" d="M25,85 L35,85 L35,130 L25,130 Z" />
    <path id="hamstrings_r" class="muscle-path" d="M35,85 L45,85 L45,130 L35,130 Z" />
  </g>
</svg>
`;

function getMuscleColor(volume) {
  if (volume === 0) return '#1a1a2e';
  if (volume < 500) return '#06b6d4';   // Cyan (min)
  if (volume < 2000) return '#10b981';  // Green (opt)
  if (volume < 5000) return '#f59e0b';  // Amber (high)
  return '#ef4444';                     // Red (fatigue)
}

function renderBodyMap(volumes) {
  const container = document.getElementById('body-map-svg-container');
  if (!container) return;
  
  container.innerHTML = BODY_MAP_SVG;

  // Muscle mapping: state key -> SVG IDs
  const mapping = {
    chest: ['chest'],
    back: ['back'],
    shoulders: ['shoulders_front_l', 'shoulders_front_r'],
    biceps: ['biceps_l', 'biceps_r'],
    triceps: ['triceps_l', 'triceps_r'],
    legs: ['legs_l', 'legs_r', 'hamstrings_l', 'hamstrings_r'],
    glutes: ['glutes'],
    core: ['core']
  };

  Object.entries(mapping).forEach(([muscle, ids]) => {
    const vol = volumes[muscle] || 0;
    const color = getMuscleColor(vol);
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.fill = color;
    });
  });
}

window.renderBodyMap = renderBodyMap;
