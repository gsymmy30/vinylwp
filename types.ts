
export interface Track {
  id: string;
  file: File;
  url: string;
  name: string;
  artist?: string;
  duration?: number;
  analysis?: AIAnalysisResult;
}

export interface AIAnalysisResult {
  mood: string;
  genre: string;
  description: string;
  meaning: string;
  colors: {
    bg_gradient: string[];    // Array of hex colors for background mesh
    vinyl_gradient: string[]; // Array of hex colors for the record disc
    accent: string;           // Main interactive color
    text: string;             // Text color
    label_text: string;       // Color for text on the vinyl label
  };
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}
