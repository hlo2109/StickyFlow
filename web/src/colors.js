// Mismos nombres que la app de escritorio (NoteColor); `solid` para puntos/selector y `tint` para el fondo del editor
export const COLORS = [
  { id: 'yellow', label: 'Amarillo', solid: '#f5b82e', tint: '#fff8e1', tintDark: '#3a3320' },
  { id: 'orange', label: 'Naranja', solid: '#f28b3d', tint: '#fff0e3', tintDark: '#3b2c20' },
  { id: 'coral', label: 'Coral', solid: '#ef6a7a', tint: '#ffebee', tintDark: '#3b2428' },
  { id: 'pink', label: 'Rosa', solid: '#e86ab0', tint: '#fde8f3', tintDark: '#3a2434' },
  { id: 'purple', label: 'Morado', solid: '#a46bea', tint: '#f1e8fd', tintDark: '#2f2540' },
  { id: 'indigo', label: 'Índigo', solid: '#6572e6', tint: '#e8eafd', tintDark: '#262a45' },
  { id: 'blue', label: 'Azul', solid: '#3fa6e8', tint: '#e5f3fd', tintDark: '#20323f' },
  { id: 'teal', label: 'Turquesa', solid: '#27b7a6', tint: '#e0f6f3', tintDark: '#1d3835' },
  { id: 'green', label: 'Verde', solid: '#46b872', tint: '#e6f6ec', tintDark: '#223a2b' },
  { id: 'dark', label: 'Oscuro', solid: '#4b5563', tint: '#e9ebee', tintDark: '#2a2d33' },
];
export const colorOf = (id) => COLORS.find((c) => c.id === id) || COLORS[0];
