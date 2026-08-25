// Design language: a small business owner's paper order-book, digitised.
// Warm kraft/cream paper, ink-navy text, two washi-tape accent colours
// (clay pink + dusty blue) lifted straight from the physical notebook cover.

export const colors = {
  paper: '#F6F1E7', // page background
  paperCard: '#FFFDF8', // card surface, slightly lighter than page
  ink: '#2E2A24', // primary text, warm near-black
  inkSoft: '#6B6355', // secondary text
  line: '#DCD3C0', // hairline / dashed rule colour, like the printed form

  clay: '#D98C82', // washi pink accent (primary)
  clayDeep: '#B96659',
  clayLight: '#F3D9D5',
  dusk: '#7FA6B8', // washi blue accent (secondary)
  duskDeep: '#4F7C90',
  duskLight: '#D5E6ED',

  // order status stamp colours
  statusPlaced: '#C99A3F',
  statusPacked: '#7FA6B8',
  statusDispatched: '#9B84B0',
  statusDelivered: '#6E9E71',

  // business inflow / outflow
  inflow: '#4E8A54',
  outflow: '#B9483D',
  pending: '#D48827',

  danger: '#B9483D',
  dangerLight: '#FCEBE9',
  success: '#4E8A54',
  successLight: '#EAF5EC',
  white: '#FFFFFF',
};

export const statusColor: Record<string, string> = {
  Placed: colors.statusPlaced,
  Packed: colors.statusPacked,
  Dispatched: colors.statusDispatched,
  Delivered: colors.statusDelivered,
};

export const categoryColor: Record<string, string> = {
  'Raw Materials': '#B96659',
  'Shipping': '#4F7C90',
  'Packaging': '#C99A3F',
  'Rent': '#9B84B0',
  'Utilities': '#6E9E71',
  'Salary': '#5C7A92',
  'Marketing': '#D48827',
  'Miscellaneous': '#8A8275',
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
};

export const spacing = (n: number) => n * 4;

export const fonts = {
  // Caveat: handwritten marker feel for headings, echoing a notebook cover.
  display: 'Caveat_700Bold',
  displayRegular: 'Caveat_600SemiBold',
  // DM Sans: clean, highly legible for actual order data / numbers.
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
};

export const shadow = {
  card: {
    shadowColor: '#2E2A24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
};
