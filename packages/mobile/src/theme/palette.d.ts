type Ramp = Readonly<Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>>

export declare const brand: Ramp
export declare const audio: Ramp & { readonly 950: string }
export declare const surface: Ramp
export declare const status: Readonly<{
  red400: string
  red600: string
  emerald400: string
  emerald700: string
  amber400: string
  amber500: string
  amber600: string
  amber700: string
}>
