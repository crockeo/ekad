export interface Colors {
  text: string;
  primary: string;
  primaryDarker: string;
  secondary: string;
  secondaryDarker: string;
  constructive: string;
  constructiveDarker: string;
  destructive: string;
  destructiveDarker: string;
}

export interface Theme {
  colors: Colors;
}

export default function useTheme(): Theme {
  // TODO: fill out the colors here
  return {
    colors: {
      text: "#333333",
      primary: "#ffffff",
      primaryDarker: "#dddddd",
      secondary: "#dddddd",
      secondaryDarker: "#cccccc",
      constructive: "#65e696",
      constructiveDarker: "#223b2b",
      destructive: "#ed4040",
      destructiveDarker: "#801b1b",
    },
  };
}
