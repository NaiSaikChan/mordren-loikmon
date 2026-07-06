export interface User {
  id: number | string;
  firstname: string;
  lastname: string;
  name: string;
  email: string;
  thumbnail?: string;
  avatar?: string;
  coins: number;
  isadminuser: string | boolean;
  device_limit: number;
  devices_in_use: number;
}

export interface Book {
  id: number | string;
  name: string;
  title?: string;
  thumbnail?: string;
  cover?: string;
  pdf?: string;
  pdffile?: string;
  epub?: string;
  epubfile?: string;
  author?: string;
  description?: string;
  category?: string;
}

export interface Article {
  id: number | string;
  title?: string;
  name?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  category?: string;
  createdate?: string;
}

export interface Author {
  id: number | string;
  name?: string;
  firstname?: string;
  lastname?: string;
  thumbnail?: string;
  bio?: string;
}

export interface CoinPackage {
  id: number | string;
  name: string;
  productid: string;
  amount: number;   // coin count
  value: number;    // price MMK
}
