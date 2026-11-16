/** Every key a benchmark dataset may use. Spec §7.2. A unit test asserts the dataset stays inside this list. */
export const BENCHMARK_KEYS = [
  'door.clearWidth',
  'door.threshold',
  'door.handleHeight',
  'door.handleType',
  'route.clearWidth',
  'bathroom.doorOperation',
  'bathroom.turningDiameter',
  'toilet.seatHeight',
  'toilet.type',
  'grabBar.horizontalHeight',
  'grabBar.projectionPastBowl',
  'grabBar.foldDownGap',
  'grabBar.diameter',
  'basin.rimHeight',
  'basin.kneeClearanceDepth',
  'floor.slipResistant',
  'socket.height',
] as const

export type BenchmarkKey = (typeof BENCHMARK_KEYS)[number]
