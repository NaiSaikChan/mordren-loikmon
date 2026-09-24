/**
 * @loikmon/media-standards — the one place media rules are defined.
 *
 *  formats     accepted file formats, MIME types, upload byte limits
 *  storage     storage kinds → bucket visibility
 *  standards   per-asset-type ratios, dimensions, display and processing rules
 *  variants    thumbnail sizes, derived-file layout and encoder settings
 *  validation  upload checks shared by the browser and the server
 *  responsive  srcset descriptors from a storage key
 */
export * from './formats.js'
export * from './storage.js'
export * from './standards.js'
export * from './variants.js'
export * from './validation.js'
export * from './responsive.js'
