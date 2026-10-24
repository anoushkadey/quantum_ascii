// Bodies of the solar system. Sizes and distances are in scene units and are
// deliberately not to scale, so every world is big enough to see.
//   orbit   distance from the sun        radius  planet radius
//   tilt    axial tilt (radians)         focus   camera distance when visited
//   halo    atmosphere glow [tint, strength]
//   moons   r radius, d distance, w angular speed (negative = retrograde),
//           incl orbit inclination relative to the planet's equator
window.COSMOS_DATA = {
  sun: {
    key: 'sun', name: 'the sun', radius: 12, focus: 80,
    age: '4.6 billion years old',
    fact: 'holds 99.86% of all the mass in the solar system.',
  },
  planets: [
    {
      key: 'mercury', name: 'mercury', orbit: 22, radius: 1.6, tint: 'MERCURY', phase: 0.4,
      tilt: 0.0, focus: 10, halo: null, moons: [],
      age: '4.5 billion years old',
      fact: 'a single day there lasts longer than its year.',
    },
    {
      key: 'venus', name: 'venus', orbit: 30, radius: 2.7, tint: 'VENUS', phase: 2.3,
      tilt: 0.05, focus: 16, halo: ['VENUS', 0.5], moons: [],
      age: '4.5 billion years old',
      fact: 'the hottest planet, around 465 °c. it spins backwards.',
    },
    {
      key: 'earth', name: 'earth', orbit: 39, radius: 3.0, tint: 'EARTH', phase: 4.1,
      tilt: 0.41, focus: 26, halo: ['EHALO', 0.6],
      moons: [{ name: 'the moon', r: 0.8, d: 7.5, w: 0.45, phase: 1.0, incl: 0.09, tint: 'MOONG' }],
      age: '4.54 billion years old',
      fact: 'the only world known to hold life.',
    },
    {
      key: 'mars', name: 'mars', orbit: 48, radius: 2.1, tint: 'MARS', phase: 5.6,
      tilt: 0.44, focus: 15, halo: ['MARS', 0.12],
      moons: [
        { name: 'phobos', r: 0.22, d: 3.3, w: 1.6, phase: 0.3, incl: 0.02, tint: 'GANY' },
        { name: 'deimos', r: 0.17, d: 4.6, w: 0.9, phase: 3.1, incl: 0.03, tint: 'CALLISTO' },
      ],
      age: '4.5 billion years old',
      fact: 'home to olympus mons, a volcano nearly 22 km tall.',
    },
    {
      key: 'jupiter', name: 'jupiter', orbit: 78, radius: 7.5, tint: 'JUP', phase: 1.2,
      tilt: 0.05, focus: 62, halo: ['JUP2', 0.18],
      moons: [
        { name: 'io', r: 0.62, d: 11, w: 0.9, phase: 0.2, incl: 0.0, tint: 'IO' },
        { name: 'europa', r: 0.54, d: 14, w: 0.64, phase: 2.0, incl: 0.01, tint: 'EUROPA' },
        { name: 'ganymede', r: 0.9, d: 18, w: 0.45, phase: 4.0, incl: 0.01, tint: 'GANY' },
        { name: 'callisto', r: 0.82, d: 23, w: 0.3, phase: 5.3, incl: 0.03, tint: 'CALLISTO' },
      ],
      age: '4.6 billion years old',
      fact: 'its great red spot is a storm wider than earth.',
    },
    {
      key: 'saturn', name: 'saturn', orbit: 100, radius: 6.3, tint: 'SAT', phase: 3.4,
      tilt: 0.47, focus: 60, halo: ['SAT', 0.15],
      moons: [
        { name: 'enceladus', r: 0.3, d: 16, w: 0.8, phase: 0.8, incl: 0.0, tint: 'ENCEL' },
        { name: 'rhea', r: 0.48, d: 19, w: 0.55, phase: 3.5, incl: 0.0, tint: 'MOONG' },
        { name: 'titan', r: 0.95, d: 24, w: 0.35, phase: 5.0, incl: 0.01, tint: 'TITAN' },
      ],
      age: '4.5 billion years old',
      fact: 'less dense than water. it would float.',
    },
    {
      key: 'uranus', name: 'uranus', orbit: 120, radius: 4.2, tint: 'URANUS', phase: 0.9,
      tilt: 1.71, focus: 30, halo: ['URANUS', 0.35],
      moons: [
        { name: 'miranda', r: 0.22, d: 6.4, w: 0.9, phase: 0.5, incl: 0.07, tint: 'MOONG' },
        { name: 'titania', r: 0.42, d: 8.2, w: 0.55, phase: 2.6, incl: 0.0, tint: 'GANY' },
        { name: 'oberon', r: 0.4, d: 10, w: 0.42, phase: 4.6, incl: 0.0, tint: 'CALLISTO' },
      ],
      age: '4.5 billion years old',
      fact: 'tilted 98°, it rolls around the sun on its side.',
    },
    {
      key: 'neptune', name: 'neptune', orbit: 137, radius: 4.0, tint: 'NEPTUNE', phase: 4.8,
      tilt: 0.49, focus: 27, halo: ['NEPTUNE', 0.4],
      moons: [{ name: 'triton', r: 0.6, d: 7.5, w: -0.5, phase: 1.5, incl: 0.4, tint: 'TRITON' }],
      age: '4.5 billion years old',
      fact: 'winds there reach 2,100 km/h, the fastest we know of.',
    },
    {
      key: 'pluto', name: 'pluto', orbit: 152, radius: 1.3, tint: 'PLUTO', phase: 2.0,
      tilt: 2.1, focus: 10, halo: null,
      moons: [{ name: 'charon', r: 0.65, d: 3.4, w: 0.7, phase: 0.0, incl: 0.0, tint: 'CHARON' }],
      age: '4.5 billion years old',
      fact: 'once the ninth planet. a heart of nitrogen ice covers its face.',
    },
  ],
};
