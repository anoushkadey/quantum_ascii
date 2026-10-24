// Bodies of the solar system. Sizes and distances are in scene units and are
// deliberately not to scale, so every world is big enough to see.
window.COSMOS_DATA = {
  sun: {
    key: 'sun', name: 'the sun', radius: 12,
    age: '4.6 billion years old',
    fact: 'holds 99.86% of all the mass in the solar system.',
  },
  planets: [
    {
      key: 'mercury', name: 'mercury', orbit: 22, radius: 1.6, tint: 'MERCURY', phase: 0.4,
      age: '4.5 billion years old',
      fact: 'a single day there lasts longer than its year.',
    },
    {
      key: 'venus', name: 'venus', orbit: 30, radius: 2.7, tint: 'VENUS', phase: 2.3,
      age: '4.5 billion years old',
      fact: 'the hottest planet, around 465 °c. it spins backwards.',
    },
    {
      key: 'earth', name: 'earth', orbit: 39, radius: 3.0, tint: 'EARTH', phase: 4.1,
      age: '4.54 billion years old',
      fact: 'the only world known to hold life.',
    },
    {
      key: 'mars', name: 'mars', orbit: 48, radius: 2.1, tint: 'MARS', phase: 5.6,
      age: '4.5 billion years old',
      fact: 'home to olympus mons, a volcano nearly 22 km tall.',
    },
    {
      key: 'jupiter', name: 'jupiter', orbit: 78, radius: 7.5, tint: 'JUP', phase: 1.2,
      age: '4.6 billion years old',
      fact: 'its great red spot is a storm wider than earth.',
    },
    {
      key: 'saturn', name: 'saturn', orbit: 100, radius: 6.3, tint: 'SAT', phase: 3.4,
      age: '4.5 billion years old',
      fact: 'less dense than water. it would float.',
    },
    {
      key: 'uranus', name: 'uranus', orbit: 120, radius: 4.2, tint: 'URANUS', phase: 0.9,
      age: '4.5 billion years old',
      fact: 'tilted 98°, it rolls around the sun on its side.',
    },
    {
      key: 'neptune', name: 'neptune', orbit: 137, radius: 4.0, tint: 'NEPTUNE', phase: 4.8,
      age: '4.5 billion years old',
      fact: 'winds there reach 2,100 km/h, the fastest we know of.',
    },
    {
      key: 'pluto', name: 'pluto', orbit: 152, radius: 1.3, tint: 'PLUTO', phase: 2.0,
      age: '4.5 billion years old',
      fact: 'once the ninth planet. a heart of nitrogen ice covers its face.',
    },
  ],
};
