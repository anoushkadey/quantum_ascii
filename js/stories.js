// The history of each world, played when you fly to it.
//   lines    [start, end, text], typed out with key clicks
//   tracks   keyframes [time, value] that drive how the world looks;
//            `now` is how it looks outside its story (the present day)
//   impacts  t: moment of impact, dur: flight time, from: approach direction
//            in camera terms [right, up, toward viewer], size: impactor
//            radius as a fraction of the world's, debris: 'moon' | 'burst'
window.COSMOS_STORIES = {
  sun: {
    dur: 27,
    lines: [
      [0.5, 4.6, '4.6 billion years ago, a cloud of gas collapsed and the sun ignited.'],
      [5, 9.6, 'every second it fuses 600 million tonnes of hydrogen into helium.'],
      [10, 14, 'it is about halfway through its life.'],
      [14.5, 19.2, 'in 5 billion years it will swell into a red giant and may swallow mercury and venus.'],
      [19.6, 25, 'then it will shrink to a white dwarf, about the size of earth, and slowly fade.'],
    ],
    tracks: {
      scale: [[0, 0.3], [2.2, 0.3], [4, 1]],
      bright: [[0, 0.25], [2.4, 0.25], [3, 1.35], [4.6, 1]],
      giant: [[0, 0], [15, 0], [18.2, 1], [21, 1], [22.4, 0]],
      dwarf: [[0, 0], [21.6, 0], [23, 1], [25.4, 1], [26.8, 0]],
    },
    now: { scale: 1, bright: 1, giant: 0, dwarf: 0 },
    impacts: [],
  },

  mercury: {
    dur: 19,
    lines: [
      [0.5, 4.5, 'the smallest planet, and the closest to the sun.'],
      [5, 9.5, 'early on, a giant impact may have blasted away much of its rock.'],
      [10, 14, 'what remains is mostly a huge iron core.'],
      [14.5, 18.6, 'scarred by craters, it bakes at 430 °c by day and freezes at −180 °c by night.'],
    ],
    tracks: { scar: [[0, 0], [7, 0], [7.15, 1], [10, 0.6], [14, 0]] },
    now: { scar: 0 },
    impacts: [{ t: 7, dur: 2.2, from: [-1, 0.35, 0.25], size: 0.4, tint: 'MERCURY', flash: 0.9, debris: 'burst' }],
  },

  venus: {
    dur: 20,
    lines: [
      [0.5, 4.5, 'young venus may have had shallow oceans, like early earth.'],
      [5, 9.5, 'but it was closer to the sun, and the oceans began to boil.'],
      [10, 14.5, 'the steam trapped the heat. the greenhouse ran away.'],
      [15, 19.6, 'today it hides under clouds of sulfuric acid, hot enough to melt lead.'],
    ],
    tracks: {
      ocean: [[0, 1], [5.5, 1], [11.5, 0]],
      haze: [[0, 0.15], [7, 0.3], [14, 1]],
    },
    now: { ocean: 0, haze: 1 },
    impacts: [],
  },

  earth: {
    dur: 48,
    lines: [
      [0.5, 4.5, '4.54 billion years ago, earth was a ball of molten rock.'],
      [5, 9.5, 'then theia, a world the size of mars, crashed into it.'],
      [10, 14, 'the debris gathered in orbit and became the moon.'],
      [14.5, 18.6, 'as it cooled, rain fell for millions of years and filled the oceans.'],
      [19, 23, 'life began in the sea about 3.8 billion years ago.'],
      [23.5, 27.6, 'plants spread over the land. then came the dinosaurs.'],
      [28, 32.5, '66 million years ago, an asteroid 10 km wide struck.'],
      [33, 37, 'dust blotted out the sun. the dinosaurs vanished.'],
      [37.5, 42, 'small mammals survived. 300,000 years ago, humans appeared.'],
      [42.5, 47.5, 'today the night side glows with our cities.'],
    ],
    tracks: {
      molten: [[0, 1], [11, 1], [15.5, 0]],
      moon: [[0, 0], [10.2, 0], [14, 1]],
      ocean: [[0, 0], [14.5, 0], [18.5, 1]],
      clouds: [[0, 0], [14, 0], [17, 1]],
      life: [[0, 0], [23.5, 0], [26.5, 1]],
      dust: [[0, 0], [30.3, 0], [31.6, 1], [35.5, 1], [39.5, 0]],
      lights: [[0, 0], [43, 0], [45.5, 1]],
      scar: [[0, 0], [30.2, 0], [30.35, 1], [34, 0.5], [38, 0]],
    },
    now: { molten: 0, moon: 1, ocean: 1, clouds: 1, life: 1, dust: 0, lights: 1, scar: 0 },
    impacts: [
      { t: 7.6, dur: 2.6, from: [-1, 0.2, 0.35], size: 0.53, tint: 'MERCURY', flash: 1, debris: 'moon' },
      { t: 30.2, dur: 1.9, from: [0.9, 0.55, 0.45], size: 0.06, tint: 'EMBER', flash: 0.8, debris: 'burst' },
    ],
  },

  mars: {
    dur: 29,
    lines: [
      [0.5, 4.5, '4 billion years ago, mars was warm and wet.'],
      [5, 9, 'rivers ran across it, and an ocean may have covered its north.'],
      [9.5, 13.5, 'then its core cooled and its magnetic shield faded.'],
      [14, 18.5, 'the solar wind stripped its air away, a little at a time.'],
      [19, 23, 'its water froze underground or escaped to space.'],
      [23.5, 28.6, 'today rovers drive over dry riverbeds, and ice still hides at its poles.'],
    ],
    tracks: {
      water: [[0, 1], [15, 1], [21.5, 0]],
      air: [[0, 1], [14.5, 1], [21, 0]],
      field: [[0, 1], [10, 1], [13, 0]],
      wind: [[0, 0], [13.5, 0], [14.5, 1], [20, 1], [21.5, 0]],
      poles: [[0, 0.25], [24, 0.25], [26, 1]],
    },
    now: { water: 0, air: 0, field: 0, wind: 0, poles: 1 },
    impacts: [],
  },

  jupiter: {
    dur: 26,
    lines: [
      [0.5, 4.5, 'jupiter formed first and swept up most of what the sun left over.'],
      [5, 9.5, 'the great red spot is a storm wider than earth, watched for almost 200 years.'],
      [10, 15.4, 'in 1994, comet shoemaker-levy 9 broke into pieces and struck it, one by one.'],
      [16, 20.5, 'galileo found its four largest moons in 1610: io, europa, ganymede, callisto.'],
      [21, 25.5, 'europa hides an ocean of liquid water beneath its ice.'],
    ],
    tracks: {
      scars: [[0, 0], [11.6, 0], [15.6, 1], [24, 1], [26, 0]],
      labels: [[0, 0], [16, 0], [16.6, 1], [25, 1], [26, 0]],
    },
    now: { scars: 0, labels: 0 },
    impacts: [0, 1, 2, 3, 4, 5].map(i => ({
      t: 11.6 + i * 0.75, dur: 2.2, from: [-0.95, 0.42 - i * 0.05, 0.25 - i * 0.04],
      size: 0.035, tint: 'ICE', flash: 0.45, debris: 'burst', scar: true,
    })),
  },

  saturn: {
    dur: 25,
    lines: [
      [0.5, 4.5, 'saturn is so light it would float on water.'],
      [5, 9.5, 'its rings are mostly ice. they may be younger than the dinosaurs.'],
      [10, 14, 'they span 280,000 km, yet are often only tens of metres thick.'],
      [14.5, 19, 'titan, its largest moon, has rivers and seas of liquid methane.'],
      [19.5, 24.5, 'enceladus sprays water into space from an ocean under its ice.'],
    ],
    tracks: {
      labels: [[0, 0], [14.5, 0], [15, 1], [24, 1], [25, 0]],
      plume: [[0, 0], [19.5, 0], [20.6, 1], [24, 1], [25, 0]],
    },
    now: { labels: 0, plume: 0 },
    impacts: [],
  },

  uranus: {
    dur: 20,
    lines: [
      [0.5, 4.5, 'long ago, something the size of earth may have struck uranus.'],
      [5, 9.5, 'it was knocked onto its side. now it rolls around the sun.'],
      [10, 14.5, 'each pole gets 42 years of daylight, then 42 years of night.'],
      [15, 19.5, 'only one spacecraft has ever visited: voyager 2, in 1986.'],
    ],
    tracks: { tilt: [[0, 0.1], [3.1, 0.1], [7, 1.71]] },
    now: { tilt: 1.71 },
    impacts: [{ t: 3, dur: 2.2, from: [-1, 0.5, 0.3], size: 0.45, tint: 'ICE', flash: 0.9, debris: 'burst' }],
  },

  neptune: {
    dur: 20,
    lines: [
      [0.5, 4.5, 'in 1846, mathematics predicted where it was before anyone saw it.'],
      [5, 9.5, 'its winds reach 2,100 km/h, the fastest in the solar system.'],
      [10, 14.5, 'its moon triton orbits backwards. it was probably a captured dwarf planet.'],
      [15, 19.5, 'one neptune year is 165 earth years. it completed its first since discovery in 2011.'],
    ],
    tracks: { labels: [[0, 0], [10, 0], [10.6, 1], [14.5, 1], [15, 0]] },
    now: { labels: 0 },
    impacts: [],
  },

  pluto: {
    dur: 25,
    lines: [
      [0.5, 4.5, 'found in 1930 by clyde tombaugh, a 24-year-old from a kansas farm.'],
      [5, 9.5, 'for 76 years it was called the ninth planet.'],
      [10, 14.5, 'in 2006 astronomers renamed it a dwarf planet.'],
      [15, 20, 'in 2015 new horizons flew past and found a heart of nitrogen ice.'],
      [20.5, 24.6, 'its moon charon is so big that the two circle each other.'],
    ],
    tracks: {
      heart: [[0, 0.1], [15.5, 0.1], [17.5, 1]],
      labels: [[0, 0], [20.5, 0], [21, 1], [24, 1], [25, 0]],
    },
    now: { heart: 1, labels: 0 },
    impacts: [],
  },
};
