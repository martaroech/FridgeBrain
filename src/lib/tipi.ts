export type Unita = "g" | "ml" | "pz";
export type Nutriente =
  | "calorie"
  | "carboidrati"
  | "zuccheri"
  | "proteine"
  | "grassi"
  | "fibre"
  | "sale";
export type ValoriNutrizionali = Record<Nutriente, number | null>;
export interface Prodotto {
  code: string;
  product_name: string;
  brands?: string;
  quantity?: string;
  ingredients_text?: string;
  ingredients?: unknown[];
  allergens_tags?: string[];
  traces_tags?: string[];
  labels_tags?: string[];
  ingredients_analysis_tags?: string[];
  categories_tags?: string[];
  nutriments?: Record<string, unknown>;
  nutriscore_grade?: string;
  personalizzato?: boolean;
  unita_nutrizionale?: "g" | "ml";
  nutrition_data_per?: string;
  product_quantity_unit?: string;
}
export interface VoceInventario {
  id: number;
  prodotto: Prodotto;
  confezioni: number;
  quantita: number | null;
  scorta_minima?: number | null;
  unita: Unita;
  posizione: string;
  scadenza: string | null;
  inserito_il: string;
}
export interface VoceSpesa {
  id: number;
  nome: string;
  quantita: string;
  completato: boolean;
  inserito_il: string;
}
export interface LimiteNutrizionale {
  nutriente: Nutriente;
  minimo?: number;
  massimo?: number;
}
export interface Preferenze {
  regime: "onnivoro" | "vegetariano" | "vegano";
  allergeni: string[];
  esclusioni: string[];
  limiti: LimiteNutrizionale[];
  priorita_scadenza: boolean;
}
export interface RichiestaRicetta extends Preferenze {
  persone: number;
  tempo_massimo: number;
}
export interface IngredienteProposto {
  inventario_id: number;
  quantita: number;
  unita: Unita;
}
export interface PropostaRicetta {
  titolo: string;
  minuti: number;
  porzioni: number;
  ingredienti: IngredienteProposto[];
  passaggi: string[];
}
export interface NutrizioneRicetta {
  ingredienti: {
    inventario_id: number;
    nome: string;
    valori: ValoriNutrizionali;
  }[];
  totale: ValoriNutrizionali;
  per_porzione: ValoriNutrizionali;
}
export interface Ricetta extends PropostaRicetta {
  id: number;
  nutrizione: NutrizioneRicetta;
  avvisi: string[];
  nomi_ingredienti: Record<string, string>;
  preparata_il: string | null;
  creata_il: string;
  provider: string;
}
export interface StatoApplicazione {
  inventario: VoceInventario[];
  spesa: VoceSpesa[];
  ricette: Ricetta[];
  preferenze: Preferenze;
  posizioni: string[];
  catalogo_disponibile: boolean;
  generatore: "locale" | "simulato" | "disabilitato";
  copia_offline?: boolean;
  aggiornato_il?: string;
}
export interface EventoStorico {
  id: number;
  azione: string;
  descrizione: string;
  creato_il: string;
}
