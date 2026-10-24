// Facts shown in the info panel when a body is clicked.
// Distances are averages; ages refer to formation of the solar system.
window.COSMOS_DATA = {
  sun: {
    key: 'sun',
    name: 'the sun',
    kind: 'g-type yellow dwarf star',
    stats: [
      ['age', '~4.6 billion years'],
      ['diameter', '1.39 million km'],
      ['surface', '5,500 °C'],
      ['core', '~15 million °C'],
    ],
    facts: [
      'Holds 99.86% of all the mass in the solar system.',
      'Its light takes about 8 minutes 20 seconds to reach Earth.',
      'It fuses roughly 600 million tonnes of hydrogen into helium every second.',
    ],
  },
  planets: [
    {
      key: 'mercury', name: 'mercury', kind: 'terrestrial planet',
      f: 0.22, size: 0.014, tint: 'MERCURY', phase: 0.4,
      stats: [['age', '~4.5 billion years'], ['from sun', '57.9 million km'], ['year', '88 earth days'], ['moons', '0']],
      facts: [
        'The smallest planet, only slightly larger than our Moon.',
        'Swings from −180 °C at night to 430 °C in the day.',
        'One solar day there lasts 176 Earth days, two of its years.',
      ],
    },
    {
      key: 'venus', name: 'venus', kind: 'terrestrial planet',
      f: 0.29, size: 0.021, tint: 'VENUS', phase: 2.3,
      stats: [['age', '~4.5 billion years'], ['from sun', '108.2 million km'], ['year', '225 earth days'], ['moons', '0']],
      facts: [
        'The hottest planet, around 465 °C at the surface.',
        'It spins backwards, so the sun rises in the west.',
        'Its day (243 Earth days) is longer than its year.',
      ],
    },
    {
      key: 'earth', name: 'earth', kind: 'terrestrial planet',
      f: 0.36, size: 0.023, tint: 'EARTH', phase: 4.1,
      stats: [['age', '~4.54 billion years'], ['from sun', '149.6 million km'], ['year', '365.25 days'], ['moons', '1']],
      facts: [
        'The only world known to hold life.',
        'About 71% of its surface is covered by ocean.',
        'Its magnetic field shields the surface from the solar wind.',
      ],
    },
    {
      key: 'mars', name: 'mars', kind: 'terrestrial planet',
      f: 0.43, size: 0.016, tint: 'MARS', phase: 5.6,
      stats: [['age', '~4.5 billion years'], ['from sun', '227.9 million km'], ['year', '687 earth days'], ['moons', '2']],
      facts: [
        'Iron oxide dust gives it its rust-red colour.',
        'Olympus Mons is about 22 km tall, nearly 2.5× Everest.',
        'Its two small moons are named Phobos and Deimos, fear and dread.',
      ],
    },
    {
      key: 'jupiter', name: 'jupiter', kind: 'gas giant',
      f: 0.585, size: 0.052, tint: 'JUP', phase: 1.2,
      stats: [['age', '~4.6 billion years'], ['from sun', '778 million km'], ['year', '11.9 earth years'], ['moons', '~95']],
      facts: [
        'More than twice as massive as all other planets combined.',
        'The Great Red Spot is a storm wider than Earth.',
        'A day lasts under 10 hours, the shortest of any planet.',
      ],
    },
    {
      key: 'saturn', name: 'saturn', kind: 'gas giant',
      f: 0.705, size: 0.043, tint: 'SAT', phase: 3.4,
      stats: [['age', '~4.5 billion years'], ['from sun', '1.43 billion km'], ['year', '29.4 earth years'], ['moons', '270+']],
      facts: [
        'Less dense than water. It would float in a large enough ocean.',
        'Its rings are mostly ice, yet often only tens of metres thick.',
        'It has more known moons than any other planet.',
      ],
    },
    {
      key: 'uranus', name: 'uranus', kind: 'ice giant',
      f: 0.805, size: 0.030, tint: 'URANUS', phase: 0.9,
      stats: [['age', '~4.5 billion years'], ['from sun', '2.87 billion km'], ['year', '84 earth years'], ['moons', '28']],
      facts: [
        'Tilted about 98°, it rolls around the sun on its side.',
        'The coldest planetary atmosphere, down to −224 °C.',
        'Each pole gets about 42 years of daylight, then 42 of night.',
      ],
    },
    {
      key: 'neptune', name: 'neptune', kind: 'ice giant',
      f: 0.9, size: 0.029, tint: 'NEPTUNE', phase: 4.8,
      stats: [['age', '~4.5 billion years'], ['from sun', '4.5 billion km'], ['year', '165 earth years'], ['moons', '16']],
      facts: [
        'Found in 1846 by mathematics before anyone saw it.',
        'Winds reach about 2,100 km/h, the fastest in the solar system.',
        'Its largest moon, Triton, orbits backwards.',
      ],
    },
    {
      key: 'pluto', name: 'pluto', kind: 'dwarf planet, the ninth world',
      f: 1.0, size: 0.011, tint: 'PLUTO', phase: 2.0,
      stats: [['age', '~4.5 billion years'], ['from sun', '5.9 billion km'], ['year', '248 earth years'], ['moons', '5']],
      facts: [
        'Counted as the ninth planet until 2006, now a dwarf planet.',
        'A heart-shaped plain of nitrogen ice spans its surface.',
        'Its moon Charon is half its size; they orbit each other.',
      ],
    },
  ],
};
